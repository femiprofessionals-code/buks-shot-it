-- Buks Shot It: initial schema
-- Deliverable 6. Target: Supabase (PostgreSQL 15+).
--
-- Principles
--   * The database is the source of truth for capacity, booking state and access.
--   * Row Level Security is enabled on every table. Public visitors never write
--     to tables directly: they call validated SECURITY DEFINER functions.
--   * Daily capacity and time overlaps are enforced by triggers and an exclusion
--     constraint, so no code path (website, admin, webhook) can bypass them.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role         as enum ('admin', 'client');
create type public.service_kind      as enum ('wedding', 'portrait', 'event', 'product');
create type public.price_type        as enum ('fixed', 'hourly', 'per_image', 'quote');
create type public.booking_status    as enum (
  'pending',           -- request received, not reviewed. Does NOT use capacity.
  'approved',          -- approved, payment link being prepared. Uses capacity while the hold is valid.
  'awaiting_payment',  -- retainer link sent. Uses capacity while the hold is valid.
  'confirmed',         -- retainer (or full amount) paid. Uses capacity.
  'rescheduled',       -- confirmed booking moved to a new date/time. Uses capacity.
  'completed',         -- session done. Uses capacity (historical).
  'declined',          -- photographer declined. No capacity.
  'cancelled',         -- cancelled by either side. No capacity.
  'expired'            -- hold ran out before payment. No capacity.
);
create type public.payment_kind      as enum ('retainer', 'balance', 'full');
create type public.payment_status    as enum ('pending', 'succeeded', 'failed', 'cancelled', 'refunded');
create type public.gallery_status    as enum ('draft', 'delivered', 'revoked');
create type public.outbox_status     as enum ('queued', 'sending', 'sent', 'failed', 'dead');

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
create table public.settings (
  id                    boolean primary key default true check (id),
  daily_capacity_units  smallint not null default 2  check (daily_capacity_units between 0 and 10),
  hold_hours            smallint not null default 72 check (hold_hours between 1 and 336),
  retainer_percent      numeric(5,2) not null default 35.00 check (retainer_percent between 0 and 100),
  buffer_minutes        smallint not null default 60 check (buffer_minutes between 0 and 480),
  timezone              text not null default 'America/New_York',
  max_requests_per_email_per_day smallint not null default 5,
  updated_at            timestamptz not null default now()
);
insert into public.settings default values;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'client',
  full_name   text,
  created_at  timestamptz not null default now()
);

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  full_name   text not null check (length(full_name) between 1 and 200),
  phone       text check (length(phone) <= 40),
  user_id     uuid unique references auth.users (id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now()
);
create unique index clients_email_key on public.clients (lower(email));

-- Admin check used by policies. SECURITY DEFINER so it can read profiles under RLS.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- The client record for the signed-in user (null for visitors and admins without one).
create function public.current_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.clients where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.services (
  id     smallint generated always as identity primary key,
  kind   public.service_kind not null unique,
  name   text not null,
  slug   text not null unique,
  sort   smallint not null default 0
);

create table public.packages (
  id                uuid primary key default gen_random_uuid(),
  service_id        smallint not null references public.services (id),
  name              text not null,
  slug              text not null unique,
  price_type        public.price_type not null,
  price_cents       integer check (price_cents >= 0),          -- null only for quote-only
  coverage_minutes  integer check (coverage_minutes > 0),
  edited_images     text,                                      -- e.g. '250+', '35'
  includes          text[] not null default '{}',
  delivery          text,
  capacity_units    smallint not null default 1 check (capacity_units between 1 and 2),
  active            boolean not null default true,
  sort              smallint not null default 0,
  check (price_type = 'quote' or price_cents is not null)
);

create table public.addons (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  price_type   public.price_type not null,
  price_cents  integer check (price_cents >= 0),
  price_max_cents integer check (price_max_cents >= price_cents),  -- for ranges such as $500-$900
  services     public.service_kind[] not null,
  active       boolean not null default true,
  sort         smallint not null default 0
);

-- ---------------------------------------------------------------------------
-- Availability controls
-- ---------------------------------------------------------------------------
create table public.blocked_dates (
  day        date primary key,
  reason     text,
  created_at timestamptz not null default now()
);

create table public.capacity_overrides (
  day    date primary key,
  units  smallint not null check (units between 0 and 10)
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  client_id        uuid not null references public.clients (id),
  package_id       uuid not null references public.packages (id),
  status           public.booking_status not null default 'pending',
  is_quote         boolean not null default false,
  session_date     date not null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  capacity_units   smallint not null default 1 check (capacity_units between 1 and 2),
  quantity         numeric(8,2) check (quantity > 0),          -- hours or images where priced that way
  location         text not null check (length(location) between 1 and 500),
  details          jsonb not null default '{}'::jsonb,
  total_cents      integer check (total_cents >= 0),           -- null until quoted
  retainer_cents   integer check (retainer_cents >= 0),
  hold_expires_at  timestamptz,
  idempotency_key  uuid unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_at > starts_at),
  check (status not in ('approved', 'awaiting_payment') or hold_expires_at is not null),
  check (status not in ('approved', 'awaiting_payment', 'confirmed', 'rescheduled', 'completed') or total_cents is not null)
);
create index bookings_day_idx on public.bookings (session_date) where status in ('approved','awaiting_payment','confirmed','rescheduled','completed');
create index bookings_client_idx on public.bookings (client_id);
create index bookings_hold_idx on public.bookings (hold_expires_at) where status in ('approved','awaiting_payment');

-- No two capacity-using bookings may overlap in time (double-booking guard).
-- Holds are expired under the same lock before any check (see trigger), so an
-- expired hold never blocks a new booking for longer than the request that finds it.
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
  where (status in ('approved', 'awaiting_payment', 'confirmed', 'rescheduled', 'completed'));

create table public.booking_events (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  from_status public.booking_status,
  to_status   public.booking_status not null,
  actor       uuid,                       -- auth user, null for system/webhook
  note        text,
  at          timestamptz not null default now()
);

create table public.booking_addons (
  booking_id   uuid not null references public.bookings (id) on delete cascade,
  addon_id     uuid not null references public.addons (id),
  quantity     smallint not null default 1 check (quantity between 1 and 1000),
  price_cents  integer check (price_cents >= 0),     -- agreed price, null until agreed
  primary key (booking_id, addon_id)
);

-- Statuses that use a day's capacity. Holds only count while unexpired.
create function public.uses_capacity(s public.booking_status, hold timestamptz) returns boolean
language sql immutable as $$
  select case
    when s in ('confirmed', 'rescheduled', 'completed') then true
    when s in ('approved', 'awaiting_payment') then hold is not null   -- expiry is applied under lock
    else false end;
$$;

create function public.day_capacity(d date) returns smallint
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.blocked_dates where day = d) then 0::smallint
    else coalesce((select units from public.capacity_overrides where day = d),
                  (select daily_capacity_units from public.settings))
  end;
$$;

-- Allowed status transitions.
create function public.valid_transition(f public.booking_status, t public.booking_status) returns boolean
language sql immutable as $$
  select f = t or (f, t) in (
    ('pending','approved'), ('pending','awaiting_payment'), ('pending','declined'), ('pending','cancelled'),
    ('approved','awaiting_payment'), ('approved','confirmed'), ('approved','cancelled'), ('approved','expired'),
    ('awaiting_payment','confirmed'), ('awaiting_payment','cancelled'), ('awaiting_payment','expired'),
    ('expired','confirmed'),            -- late payment, accepted only if capacity is still free
    ('confirmed','rescheduled'), ('confirmed','completed'), ('confirmed','cancelled'),
    ('rescheduled','rescheduled'), ('rescheduled','completed'), ('rescheduled','cancelled')
  );
$$;

-- Core guard. Runs for every insert and update, whatever the source.
create function public.bookings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  used   integer;
  cap    smallint;
begin
  if tg_op = 'UPDATE' and not public.valid_transition(old.status, new.status) then
    raise exception 'INVALID_TRANSITION: % -> %', old.status, new.status using errcode = 'P0001';
  end if;

  new.updated_at := now();

  -- Holds that have passed their time stop counting.
  if new.status in ('approved', 'awaiting_payment') and new.hold_expires_at <= now() then
    raise exception 'HOLD_EXPIRED' using errcode = 'P0001';
  end if;

  if public.uses_capacity(new.status, new.hold_expires_at)
     and (tg_op = 'INSERT'
          or not public.uses_capacity(old.status, old.hold_expires_at)
          or new.session_date <> old.session_date
          or new.capacity_units > old.capacity_units) then

    -- Serialise every capacity decision for this date. Concurrent requests for
    -- the same day queue here; each then counts what has been committed.
    perform pg_advisory_xact_lock(hashtextextended('capacity:' || new.session_date::text, 0));

    -- Release expired holds on this date first.
    update public.bookings
       set status = 'expired'
     where session_date = new.session_date
       and status in ('approved', 'awaiting_payment')
       and hold_expires_at <= now()
       and id <> new.id;

    select coalesce(sum(capacity_units), 0) into used
      from public.bookings
     where session_date = new.session_date
       and id <> new.id
       and public.uses_capacity(status, hold_expires_at);

    cap := public.day_capacity(new.session_date);

    if used + new.capacity_units > cap then
      raise exception 'CAPACITY_EXCEEDED: % of % units used on %', used, cap, new.session_date
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger bookings_guard
  before insert or update on public.bookings
  for each row execute function public.bookings_guard();

create function public.bookings_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.booking_events (booking_id, from_status, to_status, actor)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return null;
end;
$$;

create trigger bookings_log
  after insert or update on public.bookings
  for each row execute function public.bookings_log();

-- ---------------------------------------------------------------------------
-- Payments (separate from booking status)
-- ---------------------------------------------------------------------------
create table public.payments (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references public.bookings (id),
  kind                        public.payment_kind not null,
  amount_cents                integer not null check (amount_cents > 0),
  currency                    text not null default 'usd' check (currency = 'usd'),
  status                      public.payment_status not null default 'pending',
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text unique,
  receipt_url                 text,
  failure_reason              text,
  created_at                  timestamptz not null default now(),
  paid_at                     timestamptz
);
create index payments_booking_idx on public.payments (booking_id);

-- Every Stripe webhook event is stored once. A repeated delivery is a no-op.
create table public.stripe_events (
  event_id      text primary key,
  type          text not null,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);

create view public.booking_balances with (security_invoker = true) as
select b.id as booking_id,
       b.total_cents,
       coalesce(sum(p.amount_cents) filter (where p.status = 'succeeded'), 0) as paid_cents,
       greatest(coalesce(b.total_cents, 0) - coalesce(sum(p.amount_cents) filter (where p.status = 'succeeded'), 0), 0) as balance_cents
  from public.bookings b
  left join public.payments p on p.booking_id = b.id
 group by b.id;

-- ---------------------------------------------------------------------------
-- Enquiries
-- ---------------------------------------------------------------------------
create table public.enquiries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 200),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic       text not null check (topic in ('weddings','portraits','events','products','licensing','other')),
  message     text not null check (length(message) between 1 and 5000),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Portfolio (public)
-- ---------------------------------------------------------------------------
create table public.portfolio_galleries (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  title                text not null,
  category             public.service_kind not null,
  description          text,
  cover_photo_id       uuid,
  published            boolean not null default false,
  featured             boolean not null default false,
  permission_confirmed boolean not null default false,
  sort                 integer not null default 0,
  created_at           timestamptz not null default now(),
  check (not published or permission_confirmed)   -- never publish without the client's permission
);

create table public.portfolio_photos (
  id          uuid primary key default gen_random_uuid(),
  gallery_id  uuid not null references public.portfolio_galleries (id) on delete cascade,
  storage_key text not null unique,
  width       integer not null check (width > 0),
  height      integer not null check (height > 0),
  alt         text not null check (length(alt) between 1 and 300),
  featured    boolean not null default false,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.portfolio_galleries
  add constraint portfolio_cover_fk foreign key (cover_photo_id) references public.portfolio_photos (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Private client galleries
-- ---------------------------------------------------------------------------
create table public.client_galleries (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references public.bookings (id),
  title         text not null,
  status        public.gallery_status not null default 'draft',
  downloads_enabled boolean not null default true,
  delivered_at  timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table public.client_gallery_members (
  gallery_id  uuid not null references public.client_galleries (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  primary key (gallery_id, client_id)
);

create table public.client_photos (
  id          uuid primary key default gen_random_uuid(),
  gallery_id  uuid not null references public.client_galleries (id) on delete cascade,
  storage_key text not null unique,
  filename    text not null,
  bytes       bigint not null check (bytes > 0),
  width       integer not null,
  height      integer not null,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index client_photos_gallery_idx on public.client_photos (gallery_id, sort);

-- Can the signed-in client open this gallery right now?
create function public.can_view_gallery(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.client_galleries cg
      join public.client_gallery_members m on m.gallery_id = cg.id
     where cg.id = g
       and m.client_id = public.current_client_id()
       and cg.status = 'delivered'
       and (cg.expires_at is null or cg.expires_at > now())
       -- photographs are released only once the balance is paid
       and (cg.booking_id is null or exists (
             select 1 from public.booking_balances bb
              where bb.booking_id = cg.booking_id and bb.balance_cents = 0))
  );
$$;

-- ---------------------------------------------------------------------------
-- Email outbox and calendar sync
-- ---------------------------------------------------------------------------
create table public.outbox (
  id             uuid primary key default gen_random_uuid(),
  template       text not null,
  to_email       text not null,
  booking_id     uuid references public.bookings (id),
  payload        jsonb not null default '{}'::jsonb,
  dedupe_key     text not null unique,              -- e.g. 'booking_approved:<booking id>'
  status         public.outbox_status not null default 'queued',
  attempts       smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error     text,
  provider_id    text,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);
create index outbox_due_idx on public.outbox (next_attempt_at) where status in ('queued', 'failed');

create table public.calendar_sync (
  booking_id       uuid primary key references public.bookings (id) on delete cascade,
  google_event_id  text unique,
  desired_state    text not null check (desired_state in ('present', 'absent')),
  synced_version   timestamptz,
  last_error       text,
  attempts         smallint not null default 0,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Public functions (callable by visitors)
-- ---------------------------------------------------------------------------

-- Day-level availability for the booking calendar. No personal data.
create function public.get_availability(from_day date, to_day date)
returns table (day date, units_used integer, capacity smallint)
language sql stable security definer set search_path = public as $$
  select d::date,
         coalesce((select sum(b.capacity_units) from public.bookings b
                    where b.session_date = d::date
                      and public.uses_capacity(b.status, b.hold_expires_at)
                      and (b.status not in ('approved','awaiting_payment') or b.hold_expires_at > now())), 0)::integer,
         public.day_capacity(d::date)
    from generate_series(from_day, least(to_day, from_day + 92), interval '1 day') d
   where to_day >= from_day;
$$;

-- Booking request from the public form. Validates everything server-side.
create function public.request_booking(p jsonb) returns table (booking_id uuid, reference text)
language plpgsql security definer set search_path = public as $$
declare
  s        public.settings;
  pkg      public.packages;
  c_id     uuid;
  b        public.bookings;
  starts   timestamptz;
  ends     timestamptz;
  qty      numeric;
  total    integer;
  day      date;
  used     integer;
  recent   integer;
begin
  select * into s from public.settings;

  -- idempotent retry: same key returns the same booking
  if p ? 'idempotency_key' then
    select * into b from public.bookings where idempotency_key = (p->>'idempotency_key')::uuid;
    if found then
      return query select b.id, b.reference; return;
    end if;
  end if;

  select * into pkg from public.packages where id = (p->>'package_id')::uuid and active;
  if not found then raise exception 'INVALID_PACKAGE' using errcode = 'P0001'; end if;

  starts := (p->>'starts_at')::timestamptz;
  qty    := nullif(p->>'quantity', '')::numeric;
  if starts is null or starts < now() + interval '24 hours' then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;
  if starts > now() + interval '2 years' then
    raise exception 'DATE_TOO_FAR' using errcode = 'P0001';
  end if;

  ends := case
    when pkg.price_type = 'hourly' then starts + make_interval(mins => (coalesce(qty, 1) * 60)::int)
    when pkg.coverage_minutes is not null then starts + make_interval(mins => pkg.coverage_minutes)
    else starts + interval '2 hours' end;
  day := (starts at time zone s.timezone)::date;

  total := case pkg.price_type
    when 'fixed'     then pkg.price_cents
    when 'hourly'    then (pkg.price_cents * coalesce(qty, 1))::int
    when 'per_image' then (pkg.price_cents * coalesce(qty, 1))::int
    else null end;

  -- reject dates that are already full (informational; the real guard runs at approval)
  select coalesce(sum(capacity_units), 0) into used from public.bookings
   where session_date = day and public.uses_capacity(status, hold_expires_at)
     and (status not in ('approved','awaiting_payment') or hold_expires_at > now());
  if used + pkg.capacity_units > public.day_capacity(day) then
    raise exception 'DATE_FULL' using errcode = 'P0001';
  end if;

  -- client record (email is the identity for visitors)
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
  values (c_id, pkg.id, pkg.price_type = 'quote', day, starts, ends, pkg.capacity_units, qty,
          trim(p->>'location'), coalesce(p->'details', '{}'::jsonb), total,
          case when total is null then null else round(total * s.retainer_percent / 100.0)::int end,
          nullif(p->>'idempotency_key', '')::uuid)
  returning * into b;

  insert into public.outbox (template, to_email, booking_id, dedupe_key)
  values ('request_received_client', lower(trim(p->>'email')), b.id, 'request_received_client:' || b.id),
         ('request_received_admin', 'admin', b.id, 'request_received_admin:' || b.id);

  return query select b.id, b.reference;
end;
$$;

create function public.submit_enquiry(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare e_id uuid;
begin
  insert into public.enquiries (name, email, topic, message)
  values (trim(p->>'name'), lower(trim(p->>'email')), p->>'topic', trim(p->>'message'))
  returning id into e_id;
  insert into public.outbox (template, to_email, dedupe_key, payload)
  values ('enquiry_admin', 'admin', 'enquiry_admin:' || e_id, jsonb_build_object('enquiry_id', e_id));
  return e_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin functions (check is_admin() themselves)
-- ---------------------------------------------------------------------------
create function public.approve_booking(b_id uuid, total integer default null) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare s public.settings; b public.bookings;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into s from public.settings;
  update public.bookings
     set status = 'awaiting_payment',
         total_cents = coalesce(total, total_cents),
         retainer_cents = round(coalesce(total, total_cents) * s.retainer_percent / 100.0)::int,
         hold_expires_at = now() + make_interval(hours => s.hold_hours)
   where id = b_id and status = 'pending'
  returning * into b;
  if not found then raise exception 'NOT_PENDING' using errcode = 'P0001'; end if;
  insert into public.outbox (template, to_email, booking_id, dedupe_key)
  select 'booking_approved', c.email, b.id, 'booking_approved:' || b.id
    from public.clients c where c.id = b.client_id;
  return b;
end;
$$;

create function public.decline_booking(b_id uuid, reason text default null) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.bookings set status = 'declined' where id = b_id and status = 'pending' returning * into b;
  if not found then raise exception 'NOT_PENDING' using errcode = 'P0001'; end if;
  insert into public.outbox (template, to_email, booking_id, dedupe_key, payload)
  select 'booking_declined', c.email, b.id, 'booking_declined:' || b.id, jsonb_build_object('reason', reason)
    from public.clients c where c.id = b.client_id;
  return b;
end;
$$;

create function public.reschedule_booking(b_id uuid, new_start timestamptz, new_end timestamptz) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare s public.settings; b public.bookings;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into s from public.settings;
  update public.bookings
     set status = 'rescheduled', starts_at = new_start, ends_at = new_end,
         session_date = (new_start at time zone s.timezone)::date
   where id = b_id and status in ('confirmed', 'rescheduled')
  returning * into b;
  if not found then raise exception 'NOT_RESCHEDULABLE' using errcode = 'P0001'; end if;
  insert into public.outbox (template, to_email, booking_id, dedupe_key)
  select 'booking_rescheduled', c.email, b.id, 'booking_rescheduled:' || b.id || ':' || extract(epoch from new_start)::bigint
    from public.clients c where c.id = b.client_id;
  insert into public.calendar_sync (booking_id, desired_state) values (b.id, 'present')
  on conflict (booking_id) do update set desired_state = 'present', updated_at = now();
  return b;
end;
$$;

-- Called only by the Stripe webhook handler (service role) after signature verification.
-- Idempotent: the same Stripe event or checkout session never records twice.
create function public.record_stripe_payment(
  ev_id text, ev_type text, ev_payload jsonb,
  checkout_session text, payment_intent text, amount integer, b_id uuid, p_kind public.payment_kind
) returns text
language plpgsql security definer set search_path = public as $$
declare b public.bookings; inserted integer;
begin
  insert into public.stripe_events (event_id, type, payload) values (ev_id, ev_type, ev_payload)
  on conflict (event_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return 'duplicate_event'; end if;

  insert into public.payments (booking_id, kind, amount_cents, status, stripe_checkout_session_id,
                               stripe_payment_intent_id, paid_at)
  values (b_id, p_kind, amount, 'succeeded', checkout_session, payment_intent, now())
  on conflict (stripe_checkout_session_id) do update
     set status = 'succeeded', stripe_payment_intent_id = excluded.stripe_payment_intent_id,
         paid_at = coalesce(payments.paid_at, now());

  select * into b from public.bookings where id = b_id for update;
  if b.status in ('approved', 'awaiting_payment', 'expired') then
    begin
      update public.bookings set status = 'confirmed', hold_expires_at = null where id = b_id;
      insert into public.outbox (template, to_email, booking_id, dedupe_key)
      select 'booking_confirmed', c.email, b_id, 'booking_confirmed:' || b_id from public.clients c where c.id = b.client_id;
      insert into public.calendar_sync (booking_id, desired_state) values (b_id, 'present')
      on conflict (booking_id) do update set desired_state = 'present', updated_at = now();
    exception when others then
      -- e.g. a late payment after the date filled up: keep the money record, flag for the photographer
      update public.stripe_events set error = sqlerrm where event_id = ev_id;
      insert into public.outbox (template, to_email, booking_id, dedupe_key, payload)
      values ('payment_needs_attention', 'admin', b_id, 'payment_needs_attention:' || ev_id, jsonb_build_object('error', sqlerrm));
      return 'paid_but_not_confirmed';
    end;
  end if;

  insert into public.outbox (template, to_email, booking_id, dedupe_key, payload)
  select 'payment_receipt', c.email, b_id, 'payment_receipt:' || coalesce(checkout_session, ev_id), jsonb_build_object('amount_cents', amount)
    from public.clients c where c.id = b.client_id;
  update public.stripe_events set processed_at = now() where event_id = ev_id;
  return 'recorded';
end;
$$;

-- Scheduled job (every 5 minutes): release holds and queue reminders.
create function public.expire_holds() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with x as (
    update public.bookings set status = 'expired'
     where status in ('approved', 'awaiting_payment') and hold_expires_at <= now()
    returning id, client_id
  )
  insert into public.outbox (template, to_email, booking_id, dedupe_key)
  select 'hold_expired', c.email, x.id, 'hold_expired:' || x.id from x join public.clients c on c.id = x.client_id;
  get diagnostics n = row_count;

  insert into public.outbox (template, to_email, booking_id, dedupe_key)
  select 'payment_reminder', c.email, b.id, 'payment_reminder:' || b.id
    from public.bookings b join public.clients c on c.id = b.client_id
   where b.status = 'awaiting_payment' and b.hold_expires_at between now() and now() + interval '24 hours'
  on conflict (dedupe_key) do nothing;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.settings              enable row level security;
alter table public.profiles              enable row level security;
alter table public.clients               enable row level security;
alter table public.services              enable row level security;
alter table public.packages              enable row level security;
alter table public.addons                enable row level security;
alter table public.blocked_dates         enable row level security;
alter table public.capacity_overrides    enable row level security;
alter table public.bookings              enable row level security;
alter table public.booking_events        enable row level security;
alter table public.booking_addons        enable row level security;
alter table public.payments              enable row level security;
alter table public.stripe_events         enable row level security;
alter table public.enquiries             enable row level security;
alter table public.portfolio_galleries   enable row level security;
alter table public.portfolio_photos      enable row level security;
alter table public.client_galleries      enable row level security;
alter table public.client_gallery_members enable row level security;
alter table public.client_photos         enable row level security;
alter table public.outbox                enable row level security;
alter table public.calendar_sync         enable row level security;

-- Admin: full access everywhere.
do $$
declare t text;
begin
  foreach t in array array['settings','profiles','clients','services','packages','addons','blocked_dates',
    'capacity_overrides','bookings','booking_events','booking_addons','payments','stripe_events','enquiries',
    'portfolio_galleries','portfolio_photos','client_galleries','client_gallery_members','client_photos',
    'outbox','calendar_sync'] loop
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Public catalogue and portfolio.
create policy public_read on public.services  for select to anon, authenticated using (true);
create policy public_read on public.packages  for select to anon, authenticated using (active);
create policy public_read on public.addons    for select to anon, authenticated using (active);
create policy public_read on public.portfolio_galleries for select to anon, authenticated using (published);
create policy public_read on public.portfolio_photos for select to anon, authenticated
  using (exists (select 1 from public.portfolio_galleries g where g.id = gallery_id and g.published));

-- Clients: their own records only.
create policy own_profile on public.profiles for select to authenticated using (id = auth.uid());
create policy own_client on public.clients for select to authenticated using (user_id = auth.uid());
create policy own_bookings on public.bookings for select to authenticated using (client_id = public.current_client_id());
create policy own_payments on public.payments for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.client_id = public.current_client_id()));
create policy own_galleries on public.client_galleries for select to authenticated using (public.can_view_gallery(id));
create policy own_membership on public.client_gallery_members for select to authenticated using (client_id = public.current_client_id());
create policy own_photos on public.client_photos for select to authenticated using (public.can_view_gallery(gallery_id));

-- Function permissions: nothing executable by default, then grant explicitly.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_availability(date, date)  to anon, authenticated;
grant execute on function public.request_booking(jsonb)        to anon, authenticated;
grant execute on function public.submit_enquiry(jsonb)         to anon, authenticated;
grant execute on function public.approve_booking(uuid, integer) to authenticated;
grant execute on function public.decline_booking(uuid, text)    to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.is_admin(), public.current_client_id(), public.can_view_gallery(uuid),
                  public.uses_capacity(public.booking_status, timestamptz), public.day_capacity(date)
  to anon, authenticated;
-- record_stripe_payment and expire_holds: service role only (server-side).
