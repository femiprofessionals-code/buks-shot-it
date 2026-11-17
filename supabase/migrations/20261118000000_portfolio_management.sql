-- Buks Shot It: portfolio management (Deliverable 8)
--
-- Adds what the admin dashboard needs to manage public galleries:
--   * image variants and metadata on portfolio photos
--   * ordering, cover and featured photo functions (admin only, validated)
--   * a storage deletion queue so files are removed when photos are deleted or replaced
--   * a public view that exposes only what the website needs

alter table public.portfolio_photos
  add column original_key  text,                      -- full-size original in the private bucket
  add column variants      jsonb not null default '[]'::jsonb,  -- [{w, h, key, format}] in the public bucket
  add column blur_data_url text,                      -- tiny inline placeholder
  add column bytes         bigint check (bytes > 0),
  add column filename      text,
  add column updated_at    timestamptz not null default now();

alter table public.portfolio_galleries
  add column updated_at timestamptz not null default now(),
  add constraint portfolio_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80);

-- Gallery slugs must not collide with the fixed category pages under /portfolio.
alter table public.portfolio_galleries
  add constraint portfolio_slug_not_category check (slug not in ('weddings', 'portraits', 'events', 'products', 'all'));

create index portfolio_photos_gallery_idx on public.portfolio_photos (gallery_id, sort);

-- Files to remove from storage after a photo is deleted or replaced. A scheduled job
-- deletes them and stamps done_at; failures are retried.
create table public.storage_deletions (
  id          bigint generated always as identity primary key,
  bucket      text not null check (bucket in ('public', 'private')),
  key         text not null,
  queued_at   timestamptz not null default now(),
  done_at     timestamptz,
  attempts    smallint not null default 0,
  last_error  text
);
alter table public.storage_deletions enable row level security;
create policy admin_all on public.storage_deletions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Queue every stored file of a photo for deletion.
create function public.queue_photo_files(p public.portfolio_photos) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p.original_key is not null then
    insert into public.storage_deletions (bucket, key) values ('private', p.original_key);
  end if;
  insert into public.storage_deletions (bucket, key)
  select 'public', v->>'key' from jsonb_array_elements(p.variants) v where v ? 'key';
end;
$$;

create function public.portfolio_photo_deleted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.queue_photo_files(old);
  return old;
end;
$$;
create trigger portfolio_photo_deleted
  after delete on public.portfolio_photos
  for each row execute function public.portfolio_photo_deleted();

-- Replacing a photo's files queues the old ones for deletion.
create function public.portfolio_photo_replaced() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if old.original_key is distinct from new.original_key or old.variants is distinct from new.variants then
    perform public.queue_photo_files(old);
  end if;
  return new;
end;
$$;
create trigger portfolio_photo_replaced
  before update on public.portfolio_photos
  for each row execute function public.portfolio_photo_replaced();

create function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger portfolio_gallery_touch before update on public.portfolio_galleries
  for each row execute function public.touch_updated_at();

-- The cover must be a photo of the same gallery.
create function public.portfolio_cover_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cover_photo_id is not null and not exists (
    select 1 from public.portfolio_photos where id = new.cover_photo_id and gallery_id = new.id) then
    raise exception 'COVER_NOT_IN_GALLERY' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger portfolio_cover_check before insert or update of cover_photo_id on public.portfolio_galleries
  for each row execute function public.portfolio_cover_check();

-- Reorder: the given ids become the gallery's order. Every id must belong to the gallery,
-- and every photo of the gallery must be listed exactly once.
create function public.reorder_portfolio_photos(g_id uuid, ordered uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare total integer;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select count(*) into total from public.portfolio_photos where gallery_id = g_id;
  if total <> coalesce(array_length(ordered, 1), 0)
     or (select count(distinct x) from unnest(ordered) x) <> total
     or exists (select 1 from unnest(ordered) x where not exists (
          select 1 from public.portfolio_photos where id = x and gallery_id = g_id)) then
    raise exception 'INVALID_ORDER' using errcode = 'P0001';
  end if;
  update public.portfolio_photos p
     set sort = o.pos
    from unnest(ordered) with ordinality as o(id, pos)
   where p.id = o.id;
end;
$$;

-- What the public website reads: published galleries and their photos, no admin fields.
create view public.public_portfolio with (security_invoker = true) as
select g.id as gallery_id, g.slug, g.title, g.category, g.description, g.featured as gallery_featured, g.sort as gallery_sort,
       p.id as photo_id, p.alt, p.width, p.height, p.variants, p.blur_data_url, p.featured as photo_featured, p.sort as photo_sort,
       (p.id = g.cover_photo_id) as is_cover
  from public.portfolio_galleries g
  join public.portfolio_photos p on p.gallery_id = g.id
 where g.published;

grant execute on function public.reorder_portfolio_photos(uuid, uuid[]) to authenticated;

-- Lock down every function again (new functions are executable by everyone by default),
-- then grant back only what each role needs. Keep this block at the end of every migration.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_availability(date, date)  to anon, authenticated;
grant execute on function public.request_booking(jsonb)        to anon, authenticated;
grant execute on function public.submit_enquiry(jsonb)         to anon, authenticated;
grant execute on function public.approve_booking(uuid, integer) to authenticated;
grant execute on function public.decline_booking(uuid, text)    to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.reorder_portfolio_photos(uuid, uuid[]) to authenticated;
grant execute on function public.is_admin(), public.current_client_id(), public.can_view_gallery(uuid),
                  public.uses_capacity(public.booking_status, timestamptz), public.day_capacity(date)
  to anon, authenticated;
