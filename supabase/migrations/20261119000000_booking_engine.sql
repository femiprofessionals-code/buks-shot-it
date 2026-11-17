-- Deliverable 9: booking engine.
-- - catalogue seeded from the approved prices (src/content/services.ts); slugs match the website
-- - booking hours, start-time step and notice period as settings (defaults to be confirmed by the client)
-- - open start times per day and package, honouring the daily limit, the gap between sessions and blocked dates
-- - booking requests by package slug, validated against the open times
-- - reschedule (pending requests too) by local time, cancel, quotes need a total before approval
-- - one admin view of bookings with client, package and balance

-- ---------------------------------------------------------------- settings
alter table public.settings
  add column earliest_start_minutes smallint not null default 420 check (earliest_start_minutes between 0 and 1439),  -- 7:00
  add column latest_end_minutes     smallint not null default 1440 check (latest_end_minutes between 60 and 1440),    -- midnight
  add column slot_minutes           smallint not null default 30 check (slot_minutes in (15, 30, 60)),
  add column min_notice_hours       smallint not null default 24 check (min_notice_hours between 0 and 720),
  add constraint settings_booking_window check (latest_end_minutes > earliest_start_minutes);

-- ---------------------------------------------------------------- catalogue seed
-- Prices exactly as supplied. Portrait sessions are not seeded: their prices have not been supplied yet,
-- so portraits are enquiries until they are. Product session length (2 hours) is an assumption to confirm.
insert into public.services (kind, name, slug, sort) values
  ('wedding',  'Wedding Photography',  'weddings',  1),
  ('event',    'Event Photography',    'events',    3),
  ('product',  'Product Photography',  'products',  4),
  ('portrait', 'Portrait Photography', 'portraits', 2)
on conflict (kind) do nothing;

insert into public.packages (service_id, name, slug, price_type, price_cents, coverage_minutes, edited_images, includes, delivery, sort)
select s.id, v.name, v.slug, v.price_type::public.price_type, v.price_cents, v.coverage_minutes, v.edited_images, v.includes, v.delivery, v.sort
  from (values
    ('wedding', 'Essential',                'wedding-essential', 'fixed',     190000, 240,  '250+',     array['1 photographer'],                              '2–4 weeks',          1),
    ('wedding', 'Classic',                  'wedding-classic',   'fixed',     300000, 360,  '400+',     array['Timeline assistance'],                         '2–4 weeks',          2),
    ('wedding', 'Signature',                'wedding-signature', 'fixed',     420000, 480,  '600+',     array['Engagement session'],                          '2–4 weeks',          3),
    ('event',   'Hourly Coverage',          'event-hourly',      'hourly',    10000,  null, '35',       array[]::text[],                                      '3–4 business days',  1),
    ('event',   'Half Day (8 Hours)',       'event-half-day',    'fixed',     75000,  480,  '70',       array['Edited gallery', 'Highlight images'],          '2–3 weeks',          2),
    ('event',   'Full Day (12 Hours)',      'event-full-day',    'fixed',     180000, 720,  '120',      array['Event documentation', 'Online delivery'],      '2–3 weeks',          3),
    ('product', 'Simple Product Images',    'product-simple',    'per_image', 4000,   120,  null,       array['Edited images', 'White background'],           null,                 1),
    ('product', 'Standard Product Package', 'product-standard',  'fixed',     35000,  120,  'Up to 10', array[]::text[],                                      null,                 2),
    ('product', 'Brand Content Package',    'product-brand',     'quote',     80000,  120,  null,       array['Styled product imagery', 'Creative direction'], null,                3)
  ) as v(kind, name, slug, price_type, price_cents, coverage_minutes, edited_images, includes, delivery, sort)
  join public.services s on s.kind = v.kind::public.service_kind
on conflict (slug) do nothing;

alter table public.addons add column slug text unique;
insert into public.addons (slug, name, price_type, price_cents, price_max_cents, services, sort) values
  ('extra-image',             'Extra edited image',         'per_image', 2000,  null,  array['wedding','portrait','event','product']::public.service_kind[], 1),
  ('rush-delivery',           'Rush delivery (48 hours)',   'fixed',     15000, null,  array['event','product']::public.service_kind[], 2),
  ('additional-hour',         'Additional shooting hour',   'hourly',    25000, null,  array['wedding']::public.service_kind[], 3),
  ('additional-photographer', 'Additional photographer',    'fixed',     50000, 90000, array['wedding']::public.service_kind[], 4),
  ('travel',                  'Travel outside the DMV',     'quote',     null,  null,  array['wedding','portrait','event']::public.service_kind[], 5)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- helpers
-- How long a session lasts, in minutes.
create function public.session_minutes(pkg public.packages, qty numeric) returns integer
language sql immutable as $$
  select case
    when pkg.price_type = 'hourly' then (coalesce(qty, 1) * 60)::integer
    when pkg.coverage_minutes is not null then pkg.coverage_minutes
    else 120 end;
$$;

-- Valid quantities: whole hours 1-12 for hourly coverage, 1-500 images for per-image pricing, none otherwise.
create function public.valid_quantity(pkg public.packages, qty numeric) returns boolean
language sql immutable as $$
  select case pkg.price_type
    when 'hourly'    then qty is not null and qty = trunc(qty) and qty between 1 and 12
    when 'per_image' then qty is not null and qty = trunc(qty) and qty between 1 and 500
    else true end;
$$;

-- Bookings currently holding time (confirmed ones, and approvals whose hold has not run out).
create function public.holds_time(s public.booking_status, hold timestamptz) returns boolean
language sql stable as $$
  select public.uses_capacity(s, hold) and (s not in ('approved', 'awaiting_payment') or hold > now());
$$;

-- ---------------------------------------------------------------- open start times
-- Start times a visitor can request for a package on a day, in the studio's time zone.
-- Honours: blocked dates, the daily limit, the gap after every session, booking hours and notice.
create function public.get_open_times(day date, package_slug text, qty numeric default null)
returns setof timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  s     public.settings;
  pkg   public.packages;
  mins  integer;
  units integer;
  used  integer;
  m     integer;
  t     timestamptz;
begin
  select * into s from public.settings;
  select * into pkg from public.packages p where p.slug = package_slug and p.active;
  if not found or not public.valid_quantity(pkg, qty) then return; end if;
  if day < current_date or day > current_date + 730 then return; end if;

  mins  := public.session_minutes(pkg, qty);
  units := case when mins >= s.full_day_minutes then 2 else pkg.capacity_units end;

  select coalesce(sum(b.capacity_units), 0) into used
    from public.bookings b
   where b.session_date = day and public.holds_time(b.status, b.hold_expires_at);
  if used + units > public.day_capacity(day) then return; end if;

  for m in s.earliest_start_minutes .. (s.latest_end_minutes - mins) by s.slot_minutes loop
    t := (day::timestamp + make_interval(mins => m)) at time zone s.timezone;
    continue when t < now() + make_interval(hours => s.min_notice_hours);
    continue when exists (
      select 1 from public.bookings b
       where public.holds_time(b.status, b.hold_expires_at)
         and tstzrange(b.starts_at, b.busy_until, '[)')
             && tstzrange(t, t + make_interval(mins => mins + s.buffer_minutes), '[)'));
    return next t;
  end loop;
end;
$$;

-- ---------------------------------------------------------------- booking request (replaces Deliverable 6 version)
create or replace function public.request_booking(p jsonb) returns table (booking_id uuid, reference text)
language plpgsql security definer set search_path = public as $$
declare
  s      public.settings;
  pkg    public.packages;
  c_id   uuid;
  b      public.bookings;
  starts timestamptz;
  ends   timestamptz;
  qty    numeric;
  total  integer;
  day    date;
  units  integer;
  used   integer;
  recent integer;
begin
  select * into s from public.settings;

  -- Idempotent retry: the same key returns the same booking.
  if nullif(p->>'idempotency_key', '') is not null then
    select * into b from public.bookings where idempotency_key = (p->>'idempotency_key')::uuid;
    if found then
      return query select b.id, b.reference; return;
    end if;
  end if;

  if nullif(p->>'package_slug', '') is not null then
    select * into pkg from public.packages where slug = p->>'package_slug' and active;
  else
    select * into pkg from public.packages where id = (p->>'package_id')::uuid and active;
  end if;
  if not found then raise exception 'INVALID_PACKAGE' using errcode = 'P0001'; end if;

  qty := nullif(p->>'quantity', '')::numeric;
  if pkg.price_type not in ('hourly', 'per_image') then qty := null; end if;
  if not public.valid_quantity(pkg, qty) then raise exception 'INVALID_QUANTITY' using errcode = 'P0001'; end if;

  starts := (p->>'starts_at')::timestamptz;
  if starts is null or starts < now() + make_interval(hours => s.min_notice_hours) then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;
  if starts > now() + interval '2 years' then
    raise exception 'DATE_TOO_FAR' using errcode = 'P0001';
  end if;
  if length(coalesce(p->'details', '{}'::jsonb)::text) > 4000 then
    raise exception 'DETAILS_TOO_LONG' using errcode = 'P0001';
  end if;

  ends  := starts + make_interval(mins => public.session_minutes(pkg, qty));
  day   := (starts at time zone s.timezone)::date;
  units := case when extract(epoch from (ends - starts)) / 60 >= s.full_day_minutes then 2 else pkg.capacity_units end;

  select coalesce(sum(capacity_units), 0) into used from public.bookings
   where session_date = day and public.holds_time(status, hold_expires_at);
  if used + units > public.day_capacity(day) then
    raise exception 'DATE_FULL' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.get_open_times(day, pkg.slug, qty) g where g = starts) then
    raise exception 'TIME_UNAVAILABLE' using errcode = 'P0001';
  end if;

  total := case pkg.price_type
    when 'fixed'     then pkg.price_cents
    when 'hourly'    then (pkg.price_cents * qty)::integer
    when 'per_image' then (pkg.price_cents * qty)::integer
    else null end;

  insert into public.clients (email, full_name, phone)
  values (lower(trim(p->>'email')), trim(p->>'full_name'), nullif(trim(p->>'phone'), ''))
  on conflict ((lower(email))) do update set phone = coalesce(excluded.phone, clients.phone)
  returning id into c_id;

  select count(*) into recent from public.bookings
   where client_id = c_id and created_at > now() - interval '1 day';
  if recent >= s.max_requests_per_email_per_day then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;

  insert into public.bookings (client_id, package_id, is_quote, session_date, starts_at, ends_at,
                               capacity_units, quantity, location, details, total_cents,
                               retainer_cents, idempotency_key)
  values (c_id, pkg.id, pkg.price_type = 'quote', day, starts, ends, units, qty,
          trim(p->>'location'), coalesce(p->'details', '{}'::jsonb), total,
          case when total is null then null else round(total * s.retainer_percent / 100.0)::integer end,
          nullif(p->>'idempotency_key', '')::uuid)
  returning * into b;

  insert into public.outbox (template, to_email, booking_id, dedupe_key)
  values ('request_received_client', lower(trim(p->>'email')), b.id, 'request_received_client:' || b.id),
         ('request_received_admin', 'admin', b.id, 'request_received_admin:' || b.id);

  return query select b.id, b.reference;
end;
$$;

-- ---------------------------------------------------------------- approve (quotes need a total)
create or replace function public.approve_booking(b_id uuid, total integer default null) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare s public.settings; b public.bookings;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if total is not null and total < 0 then raise exception 'INVALID_TOTAL' using errcode = 'P0001'; end if;
  select * into s from public.settings;
  select * into b from public.bookings where id = b_id for update;
  if not found or b.status <> 'pending' then raise exception 'NOT_PENDING' using errcode = 'P0001'; end if;
  if coalesce(total, b.total_cents) is null then raise exception 'TOTAL_REQUIRED' using errcode = 'P0001'; end if;
  update public.bookings
     set status = 'awaiting_payment',
         total_cents = coalesce(total, total_cents),
         retainer_cents = round(coalesce(total, total_cents) * s.retainer_percent / 100.0)::integer,
         hold_expires_at = now() + make_interval(hours => s.hold_hours)
   where id = b_id
  returning * into b;
  insert into public.outbox (template, to_email, booking_id, dedupe_key)
  select 'booking_approved', c.email, b.id, 'booking_approved:' || b.id
    from public.clients c where c.id = b.client_id;
  return b;
end;
$$;

-- ---------------------------------------------------------------- reschedule (replaces Deliverable 6 version)
drop function public.reschedule_booking(uuid, timestamptz, timestamptz);

-- new_local is the new start in the studio's time zone (e.g. 2027-06-12 14:30). The length stays the same.
create function public.reschedule_booking(b_id uuid, new_local timestamp) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare s public.settings; b public.bookings; new_start timestamptz; dur interval;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into s from public.settings;
  select * into b from public.bookings where id = b_id for update;
  if not found or b.status not in ('pending', 'approved', 'awaiting_payment', 'confirmed', 'rescheduled') then
    raise exception 'NOT_RESCHEDULABLE' using errcode = 'P0001';
  end if;
  new_start := new_local at time zone s.timezone;
  if new_start < now() then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
  dur := b.ends_at - b.starts_at;
  if exists (
    select 1 from public.bookings o
     where o.id <> b.id and public.holds_time(o.status, o.hold_expires_at)
       and tstzrange(o.starts_at, o.busy_until, '[)')
           && tstzrange(new_start, new_start + dur + make_interval(mins => s.buffer_minutes), '[)')) then
    raise exception 'TIME_TAKEN' using errcode = 'P0001';
  end if;

  update public.bookings
     set starts_at = new_start, ends_at = new_start + dur, session_date = new_local::date,
         status = case when b.status = 'confirmed' then 'rescheduled'::public.booking_status else b.status end
   where id = b_id
  returning * into b;

  insert into public.outbox (template, to_email, booking_id, dedupe_key)
  select 'booking_rescheduled', c.email, b.id, 'booking_rescheduled:' || b.id || ':' || extract(epoch from new_start)::bigint
    from public.clients c where c.id = b.client_id
  on conflict (dedupe_key) do nothing;
  if b.status in ('confirmed', 'rescheduled') then
    insert into public.calendar_sync (booking_id, desired_state) values (b.id, 'present')
    on conflict (booking_id) do update set desired_state = 'present', updated_at = now();
  end if;
  return b;
end;
$$;

-- ---------------------------------------------------------------- cancel
create function public.cancel_booking(b_id uuid, reason text default null) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if length(reason) > 1000 then raise exception 'REASON_TOO_LONG' using errcode = 'P0001'; end if;
  update public.bookings set status = 'cancelled'
   where id = b_id and status in ('pending', 'approved', 'awaiting_payment', 'confirmed', 'rescheduled')
  returning * into b;
  if not found then raise exception 'NOT_CANCELLABLE' using errcode = 'P0001'; end if;
  insert into public.outbox (template, to_email, booking_id, dedupe_key, payload)
  select 'booking_cancelled', c.email, b.id, 'booking_cancelled:' || b.id, jsonb_build_object('reason', reason)
    from public.clients c where c.id = b.client_id;
  update public.calendar_sync set desired_state = 'absent', updated_at = now() where booking_id = b.id;
  return b;
end;
$$;

-- ---------------------------------------------------------------- history also records moves
create or replace function public.bookings_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status or old.starts_at is distinct from new.starts_at then
    insert into public.booking_events (booking_id, from_status, to_status, actor, note)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(),
            case when tg_op = 'UPDATE' and old.starts_at is distinct from new.starts_at
                 then 'Moved to ' || to_char(new.starts_at at time zone (select timezone from public.settings), 'Dy DD Mon YYYY HH24:MI') end);
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------- admin view
create view public.admin_bookings with (security_invoker = true) as
select b.id, b.reference, b.status, b.is_quote, b.session_date, b.starts_at, b.ends_at, b.quantity, b.location,
       b.details, b.total_cents, b.retainer_cents, b.hold_expires_at, b.created_at, b.updated_at,
       c.id as client_id, c.full_name, c.email, c.phone,
       pk.slug as package_slug, pk.name as package_name, pk.price_type,
       sv.kind as service_kind, sv.name as service_name,
       bb.paid_cents, bb.balance_cents
  from public.bookings b
  join public.clients c   on c.id = b.client_id
  join public.packages pk on pk.id = b.package_id
  join public.services sv on sv.id = pk.service_id
  join public.booking_balances bb on bb.booking_id = b.id;

-- Lock down every function again (new functions are executable by everyone by default),
-- then grant back only what each role needs. Keep this block at the end of every migration.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_availability(date, date)                to anon, authenticated;
grant execute on function public.get_open_times(date, text, numeric)         to anon, authenticated;
grant execute on function public.request_booking(jsonb)                      to anon, authenticated;
grant execute on function public.submit_enquiry(jsonb)                       to anon, authenticated;
grant execute on function public.approve_booking(uuid, integer)              to authenticated;
grant execute on function public.decline_booking(uuid, text)                 to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamp)         to authenticated;
grant execute on function public.cancel_booking(uuid, text)                  to authenticated;
grant execute on function public.reorder_portfolio_photos(uuid, uuid[])      to authenticated;
grant execute on function public.is_admin(), public.current_client_id(), public.can_view_gallery(uuid),
                  public.uses_capacity(public.booking_status, timestamptz), public.day_capacity(date),
                  public.holds_time(public.booking_status, timestamptz),
                  public.session_minutes(public.packages, numeric), public.valid_quantity(public.packages, numeric)
  to anon, authenticated;
