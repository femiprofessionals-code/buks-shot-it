-- Deliverable 10: payments.
-- - every approved booking gets a private payment link (a random token; only its SHA-256 hash is stored)
-- - the payment page reads only what the client needs, by that token
-- - the server prepares Stripe Checkout from amounts held in the database, never from the browser
-- - verified Stripe payments and manual payments (cash, bank transfer) share one confirmation path
-- - the photographer is notified of every payment

alter table public.payments
  add column method      text not null default 'stripe' check (method in ('stripe', 'manual')),
  add column note        text check (length(note) <= 500),
  add column recorded_by uuid;

alter table public.bookings add column pay_token_hash bytea unique;

-- ---------------------------------------------------------------- internal helpers (no grants)

-- A new payment link token for a booking. Returns the token once; only its hash is kept.
create function public.new_pay_token(b_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare token text;
begin
  token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');  -- 64 hex characters, 244 random bits
  update public.bookings set pay_token_hash = sha256(convert_to(token, 'UTF8')) where id = b_id;
  return token;
end;
$$;

create function public.booking_for_token(token text) returns public.bookings
language sql stable security definer set search_path = public as $$
  select * from public.bookings
   where token ~ '^[0-9a-f]{64}$' and pay_token_hash = sha256(convert_to(token, 'UTF8'));
$$;

-- Confirms a booking after a retainer or full payment. Raises if the date filled up meanwhile.
create function public.confirm_after_payment(b_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = b_id for update;
  if b.status in ('approved', 'awaiting_payment', 'expired') then
    update public.bookings set status = 'confirmed', hold_expires_at = null where id = b_id;
    insert into public.outbox (template, to_email, booking_id, dedupe_key)
    select 'booking_confirmed', c.email, b_id, 'booking_confirmed:' || b_id from public.clients c where c.id = b.client_id
    on conflict (dedupe_key) do nothing;
    insert into public.calendar_sync (booking_id, desired_state) values (b_id, 'present')
    on conflict (booking_id) do update set desired_state = 'present', updated_at = now();
  end if;
end;
$$;

-- ---------------------------------------------------------------- approve: now issues the payment link
create or replace function public.approve_booking(b_id uuid, total integer default null) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare s public.settings; b public.bookings; token text;
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
   where id = b_id;
  token := public.new_pay_token(b_id);
  select * into b from public.bookings where id = b_id;
  insert into public.outbox (template, to_email, booking_id, dedupe_key, payload)
  select 'booking_approved', c.email, b.id, 'booking_approved:' || b.id, jsonb_build_object('pay_token', token)
    from public.clients c where c.id = b.client_id;
  return b;
end;
$$;

-- ---------------------------------------------------------------- payment page (visitor with the link)
create function public.get_payment_page(token text)
returns table (
  booking_id uuid, reference text, first_name text, service_name text, package_name text, quantity numeric, price_type public.price_type,
  starts_at timestamptz, ends_at timestamptz, status public.booking_status, total_cents integer, retainer_cents integer,
  paid_cents bigint, balance_cents bigint, hold_expires_at timestamptz,
  can_pay_retainer boolean, can_pay_full boolean, can_pay_balance boolean
)
language plpgsql stable security definer set search_path = public as $$
declare b public.bookings; paid bigint; holding boolean;
begin
  b := public.booking_for_token(token);
  if b.id is null then return; end if;
  select coalesce(sum(p.amount_cents) filter (where p.status = 'succeeded'), 0) into paid from public.payments p where p.booking_id = b.id;
  holding := b.status in ('approved', 'awaiting_payment') and b.hold_expires_at > now() + interval '30 minutes';
  return query
  select b.id, b.reference, split_part(c.full_name, ' ', 1), sv.name, pk.name, b.quantity, pk.price_type,
         b.starts_at, b.ends_at, b.status, b.total_cents, b.retainer_cents,
         paid, greatest(coalesce(b.total_cents, 0) - paid, 0),
         b.hold_expires_at,
         holding and paid = 0,
         holding and paid = 0 and b.total_cents > b.retainer_cents,
         b.status in ('confirmed', 'rescheduled', 'completed') and coalesce(b.total_cents, 0) - paid > 0
    from public.clients c, public.packages pk join public.services sv on sv.id = pk.service_id
   where c.id = b.client_id and pk.id = b.package_id;
end;
$$;

-- What the server needs to open Stripe Checkout (service role only). Amounts come from here.
create function public.checkout_details(token text, p_kind public.payment_kind)
returns table (booking_id uuid, amount_cents integer, email text, description text, pay_by timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare pg record; b public.bookings;
begin
  select * into pg from public.get_payment_page(token);
  if pg.booking_id is null then raise exception 'INVALID_LINK' using errcode = 'P0001'; end if;
  b := public.booking_for_token(token);
  if (p_kind = 'retainer' and not pg.can_pay_retainer) or (p_kind = 'full' and not pg.can_pay_full) or (p_kind = 'balance' and not pg.can_pay_balance) then
    raise exception 'NOT_PAYABLE' using errcode = 'P0001';
  end if;
  return query
  select b.id,
         case p_kind when 'retainer' then b.retainer_cents when 'full' then b.total_cents else pg.balance_cents::integer end,
         c.email,
         pg.service_name || ': ' || pg.package_name || ' (' || b.reference || ') · ' ||
           case p_kind when 'retainer' then 'retainer' when 'full' then 'payment in full' else 'balance' end,
         case when p_kind in ('retainer', 'full') then b.hold_expires_at end
    from public.clients c where c.id = b.client_id;
end;
$$;

-- ---------------------------------------------------------------- Stripe (service role, after signature check)
create or replace function public.record_stripe_payment(
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

  select * into b from public.bookings where id = b_id;
  if not found then
    update public.stripe_events set error = 'UNKNOWN_BOOKING' where event_id = ev_id;
    return 'unknown_booking';
  end if;

  insert into public.payments (booking_id, kind, amount_cents, status, method, stripe_checkout_session_id, stripe_payment_intent_id, paid_at)
  values (b_id, p_kind, amount, 'succeeded', 'stripe', checkout_session, payment_intent, now())
  on conflict (stripe_checkout_session_id) do update
     set status = 'succeeded', stripe_payment_intent_id = excluded.stripe_payment_intent_id,
         paid_at = coalesce(payments.paid_at, now());

  insert into public.outbox (template, to_email, booking_id, dedupe_key, payload)
  values ('payment_received_admin', 'admin', b_id, 'payment_received_admin:' || coalesce(checkout_session, ev_id),
          jsonb_build_object('amount_cents', amount, 'kind', p_kind, 'method', 'stripe'))
  on conflict (dedupe_key) do nothing;

  if p_kind in ('retainer', 'full') then
    begin
      perform public.confirm_after_payment(b_id);
    exception when others then
      -- e.g. a late payment after the date filled up: keep the money record, flag for the photographer
      update public.stripe_events set error = sqlerrm where event_id = ev_id;
      insert into public.outbox (template, to_email, booking_id, dedupe_key, payload)
      values ('payment_needs_attention', 'admin', b_id, 'payment_needs_attention:' || ev_id, jsonb_build_object('error', sqlerrm));
      return 'paid_but_not_confirmed';
    end;
  end if;

  insert into public.outbox (template, to_email, booking_id, dedupe_key, payload)
  select 'payment_receipt', c.email, b_id, 'payment_receipt:' || coalesce(checkout_session, ev_id), jsonb_build_object('amount_cents', amount, 'kind', p_kind)
    from public.clients c where c.id = b.client_id
  on conflict (dedupe_key) do nothing;
  update public.stripe_events set processed_at = now() where event_id = ev_id;
  return 'recorded';
end;
$$;

-- ---------------------------------------------------------------- photographer tools
-- A payment received outside Stripe (cash, bank transfer). A retainer or full payment confirms the booking.
create function public.record_manual_payment(b_id uuid, p_kind public.payment_kind, amount integer, note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare b public.bookings; p_id uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if amount is null or amount <= 0 or amount > 10000000 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  select * into b from public.bookings where id = b_id for update;
  if not found or b.status in ('pending', 'declined', 'cancelled') then raise exception 'NOT_PAYABLE' using errcode = 'P0001'; end if;
  insert into public.payments (booking_id, kind, amount_cents, status, method, note, recorded_by, paid_at)
  values (b_id, p_kind, amount, 'succeeded', 'manual', nullif(trim(note), ''), auth.uid(), now())
  returning id into p_id;
  if p_kind in ('retainer', 'full') then perform public.confirm_after_payment(b_id); end if;
  insert into public.outbox (template, to_email, booking_id, dedupe_key, payload)
  select 'payment_receipt', c.email, b_id, 'payment_receipt:manual:' || p_id, jsonb_build_object('amount_cents', amount, 'kind', p_kind)
    from public.clients c where c.id = b.client_id;
  return p_id;
end;
$$;

-- A fresh payment link (the old one stops working). Emailed to the client; shown once to the photographer.
create function public.issue_payment_link(b_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare b public.bookings; token text; paid bigint;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into b from public.bookings where id = b_id for update;
  if not found then raise exception 'NOT_PAYABLE' using errcode = 'P0001'; end if;
  select coalesce(sum(amount_cents) filter (where status = 'succeeded'), 0) into paid from public.payments where booking_id = b_id;
  if not ((b.status in ('approved', 'awaiting_payment') and b.hold_expires_at > now())
          or (b.status in ('confirmed', 'rescheduled', 'completed') and coalesce(b.total_cents, 0) > paid)) then
    raise exception 'NOT_PAYABLE' using errcode = 'P0001';
  end if;
  token := public.new_pay_token(b_id);
  insert into public.outbox (template, to_email, booking_id, dedupe_key, payload)
  select case when b.status in ('approved', 'awaiting_payment') then 'payment_link' else 'balance_due' end,
         c.email, b_id, 'payment_link:' || b_id || ':' || left(token, 12), jsonb_build_object('pay_token', token)
    from public.clients c where c.id = b.client_id;
  return token;
end;
$$;

-- Admin list of payments with how they were made.
create view public.admin_payments with (security_invoker = true) as
select p.id, p.booking_id, p.kind, p.amount_cents, p.status, p.method, p.note, p.paid_at, p.created_at, p.stripe_payment_intent_id
  from public.payments p;

-- Lock down every function again (new functions are executable by everyone by default),
-- then grant back only what each role needs. Keep this block at the end of every migration.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_availability(date, date)                to anon, authenticated;
grant execute on function public.get_open_times(date, text, numeric)         to anon, authenticated;
grant execute on function public.request_booking(jsonb)                      to anon, authenticated;
grant execute on function public.submit_enquiry(jsonb)                       to anon, authenticated;
grant execute on function public.get_payment_page(text)                      to anon, authenticated;
grant execute on function public.approve_booking(uuid, integer)              to authenticated;
grant execute on function public.decline_booking(uuid, text)                 to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamp)         to authenticated;
grant execute on function public.cancel_booking(uuid, text)                  to authenticated;
grant execute on function public.record_manual_payment(uuid, public.payment_kind, integer, text) to authenticated;
grant execute on function public.issue_payment_link(uuid)                    to authenticated;
grant execute on function public.reorder_portfolio_photos(uuid, uuid[])      to authenticated;
grant execute on function public.is_admin(), public.current_client_id(), public.can_view_gallery(uuid),
                  public.uses_capacity(public.booking_status, timestamptz), public.day_capacity(date),
                  public.holds_time(public.booking_status, timestamptz),
                  public.session_minutes(public.packages, numeric), public.valid_quantity(public.packages, numeric)
  to anon, authenticated;
-- Server-only (service role): Stripe and scheduled jobs.
grant execute on function public.checkout_details(text, public.payment_kind),
                  public.record_stripe_payment(text, text, jsonb, text, text, integer, uuid, public.payment_kind),
                  public.expire_holds()
  to service_role;
