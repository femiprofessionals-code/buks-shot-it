-- Rule tests for the Buks Shot It schema. Run as a superuser on a throwaway database
-- after 00_supabase_stubs.sql, the migration and 01_grants.sql.
-- Each check prints PASS or FAIL. Any FAIL makes run_tests.sh exit non-zero.
\set ON_ERROR_STOP on
set client_min_messages = notice;

create table public._results (n serial, name text, ok boolean, detail text);
grant insert, select on public._results to anon, authenticated;
grant usage on sequence public._results_n_seq to anon, authenticated;

create function public._check(cond boolean, name text, detail text default null) returns void
language plpgsql as $$
begin
  insert into public._results (name, ok, detail) values (name, coalesce(cond, false), detail);
  raise notice '% %', case when coalesce(cond,false) then 'PASS' else 'FAIL' end, name;
end $$;

-- Runs sql as the current role and checks that it fails with a message containing pattern.
create function public._expect_error(sql text, pattern text, name text) returns void
language plpgsql as $$
begin
  execute sql;
  perform public._check(false, name, 'no error raised');
exception when others then
  perform public._check(sqlerrm ilike '%' || pattern || '%' or sqlstate = pattern, name, sqlstate || ' ' || sqlerrm);
end $$;
grant execute on function public._check(boolean, text, text), public._expect_error(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------- seed data
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'client.a@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'client.b@example.com');
insert into public.profiles (id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'client'),
  ('00000000-0000-0000-0000-0000000000c2', 'client');

insert into public.services (kind, name, slug) values
  ('wedding','Wedding Photography','wedding-photography'), ('event','Event Photography','event-photography'),
  ('product','Product Photography','product-photography'), ('portrait','Portrait Photography','portrait-photography')
on conflict (kind) do nothing;  -- the booking-engine migration seeds these

insert into public.packages (id, service_id, name, slug, price_type, price_cents, coverage_minutes, capacity_units) values
  ('11111111-0000-0000-0000-000000000001', 1, 'Classic',   'classic',   'fixed',  300000, 360, 1),
  ('11111111-0000-0000-0000-000000000002', 1, 'Signature', 'signature', 'fixed',  420000, 480, 2),
  ('11111111-0000-0000-0000-000000000003', 2, 'Hourly Coverage', 'hourly', 'hourly', 10000, null, 1),
  ('11111111-0000-0000-0000-000000000004', 3, 'Brand Content', 'brand-content', 'quote', null, 240, 1),
  ('11111111-0000-0000-0000-000000000005', 3, 'Standard Product Package', 'standard-product', 'fixed', 35000, 180, 1);

-- ---------------------------------------------------------------- 1. visitors
set role anon;
select public._check((select count(*) from public.packages) = 14, 'Visitor can read active packages (9 seeded + 5 test)');
select public._check(r.reference is not null, 'Visitor can send a booking request')
  from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000001","email":"Jordan@Example.com","full_name":"Jordan Example","starts_at":"2027-06-12 10:00-04","location":"Example venue"}') r;
select public._check((select count(*) from public.bookings) = 0, 'Visitor cannot read any bookings (RLS)');
select public._check((select count(*) from public.clients) = 0, 'Visitor cannot read client records (RLS)');
select public._expect_error($$select public.approve_booking((select '00000000-0000-0000-0000-000000000000'::uuid))$$, '42501', 'Visitor cannot call admin functions');
select public._expect_error($$insert into public.bookings (client_id, package_id, session_date, starts_at, ends_at, location) values (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', '2027-06-13', '2027-06-13 10:00-04', '2027-06-13 12:00-04', 'x')$$, 'row-level security', 'Visitor cannot insert bookings directly');
select public._expect_error($$select * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000001","email":"not-an-email","full_name":"X","starts_at":"2027-06-14 10:00-04","location":"x"}')$$, 'clients_email_check', 'Invalid email is rejected by the server');
select public._expect_error($$select * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000001","email":"a@example.com","full_name":"X","starts_at":"2020-01-01 10:00-04","location":"x"}')$$, 'INVALID_DATE', 'Past date is rejected');
select public._check(
  (select r1.booking_id = r2.booking_id
     from public.request_booking('{"idempotency_key":"9d4a3c3e-7c43-4d77-9c3e-6f1c1d6c0001","package_id":"11111111-0000-0000-0000-000000000005","email":"shop@example.com","full_name":"Example Shop","starts_at":"2027-07-01 10:00-04","location":"Studio"}') r1,
          public.request_booking('{"idempotency_key":"9d4a3c3e-7c43-4d77-9c3e-6f1c1d6c0001","package_id":"11111111-0000-0000-0000-000000000005","email":"shop@example.com","full_name":"Example Shop","starts_at":"2027-07-01 10:00-04","location":"Studio"}') r2),
  'Repeated request with the same key creates one booking');
reset role;

-- ---------------------------------------------------------------- 2. non-admin signed-in user
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public._expect_error($$select public.approve_booking((select '00000000-0000-0000-0000-000000000000'::uuid))$$, 'FORBIDDEN', 'Client cannot approve bookings');
reset role;

-- ---------------------------------------------------------------- 3. capacity
-- Three requests on 2027-08-07 at different times.
set role anon;
create temp table r as select 1 as n, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"2","email":"e1@example.com","full_name":"E One","starts_at":"2027-08-07 09:00-04","location":"Hall"}');
insert into r select 2, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"2","email":"e2@example.com","full_name":"E Two","starts_at":"2027-08-07 13:00-04","location":"Hall"}');
insert into r select 3, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"2","email":"e3@example.com","full_name":"E Three","starts_at":"2027-08-07 17:00-04","location":"Hall"}');
reset role;
grant select on r to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public._check((select status from public.approve_booking((select booking_id from r where n = 1))) = 'awaiting_payment', 'First booking on a day can be approved');
select public._check((select status from public.approve_booking((select booking_id from r where n = 2))) = 'awaiting_payment', 'Second booking on the same day can be approved');
select public._expect_error($$select public.approve_booking((select booking_id from r where n = 3))$$, 'CAPACITY_EXCEEDED', 'Third booking on the same day is refused');
reset role;
set role anon;
select public._expect_error($$select * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"1","email":"e4@example.com","full_name":"E Four","starts_at":"2027-08-07 20:00-04","location":"Hall"}')$$, 'DATE_FULL', 'New requests for a full day are refused');
reset role;
select public._check((select count(*) from public.bookings where session_date = '2027-08-07' and public.uses_capacity(status, hold_expires_at)) = 2, 'Day holds exactly 2 sessions');

-- Direct admin update cannot bypass the rule either.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public._expect_error($$update public.bookings set status = 'awaiting_payment', hold_expires_at = now() + interval '1 day', total_cents = 1 where id = (select booking_id from r where n = 3)$$, 'CAPACITY_EXCEEDED', 'Direct table update cannot exceed capacity');
select public._expect_error($$update public.bookings set status = 'completed' where id = (select booking_id from r where n = 3)$$, 'INVALID_TRANSITION', 'Invalid status jump is refused');
reset role;

-- ---------------------------------------------------------------- 4. long bookings and overlaps
set role anon;
insert into r select 4, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"3","email":"e5@example.com","full_name":"E Five","starts_at":"2027-09-04 09:00-04","location":"Hall"}');
insert into r select 5, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000002","email":"w1@example.com","full_name":"W One","starts_at":"2027-09-04 14:00-04","location":"Venue"}');
insert into r select 6, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"3","email":"e6@example.com","full_name":"E Six","starts_at":"2027-09-11 09:00-04","location":"Hall"}');
insert into r select 7, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"2","email":"e7@example.com","full_name":"E Seven","starts_at":"2027-09-11 11:00-04","location":"Hall"}');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.approve_booking((select booking_id from r where n = 4));
select public._expect_error($$select public.approve_booking((select booking_id from r where n = 5))$$, 'CAPACITY_EXCEEDED', 'A 2-unit booking cannot join a day that already has a session');
select public.approve_booking((select booking_id from r where n = 6));
select public._expect_error($$select public.approve_booking((select booking_id from r where n = 7))$$, 'bookings_no_overlap', 'Overlapping times on the same day are refused (double booking)');
reset role;

-- Gap between sessions and the 6-hour rule.
set role anon;
insert into r select 8, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"2","email":"g1@example.com","full_name":"G One","starts_at":"2027-09-18 09:00-04","location":"Hall"}');
insert into r select 9, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"2","email":"g2@example.com","full_name":"G Two","starts_at":"2027-09-18 11:30-04","location":"Hall"}');
insert into r select 10, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"2","email":"g3@example.com","full_name":"G Three","starts_at":"2027-09-18 12:00-04","location":"Hall"}');
insert into r select 11, * from public.request_booking('{"package_id":"11111111-0000-0000-0000-000000000003","quantity":"6","email":"g4@example.com","full_name":"G Four","starts_at":"2027-09-25 09:00-04","location":"Hall"}');
reset role;
select public._check((select capacity_units from public.bookings where id = (select booking_id from r where n = 11)) = 2, 'A 6-hour booking uses the whole day');
select public._check((select capacity_units from public.bookings where id = (select booking_id from r where n = 8)) = 1, 'A 2-hour booking uses one session');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.approve_booking((select booking_id from r where n = 8));
select public._expect_error($$select public.approve_booking((select booking_id from r where n = 9))$$, 'bookings_no_overlap', 'A session starting 30 minutes after another ends is refused (60-minute gap)');
select public._check((select status from public.approve_booking((select booking_id from r where n = 10))) = 'awaiting_payment', 'A session starting 60 minutes after another ends is allowed');
reset role;

-- ---------------------------------------------------------------- 5. hold expiry
-- Simulate the 72-hour hold on booking 1 running out (test-only shortcut past the trigger).
set session_replication_role = replica;
update public.bookings set hold_expires_at = now() - interval '1 minute' where id = (select booking_id from r where n = 1);
set session_replication_role = origin;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public._check((select status from public.approve_booking((select booking_id from r where n = 3))) = 'awaiting_payment', 'An expired hold frees its place for the next booking');
reset role;
select public._check((select status from public.bookings where id = (select booking_id from r where n = 1)) = 'expired', 'The expired hold is marked expired');

-- ---------------------------------------------------------------- 6. payments
select public._check(public.record_stripe_payment('evt_1', 'checkout.session.completed', '{}', 'cs_1', 'pi_1', 7000, (select booking_id from r where n = 2), 'retainer') = 'recorded', 'Verified payment is recorded');
select public._check(public.record_stripe_payment('evt_1', 'checkout.session.completed', '{}', 'cs_1', 'pi_1', 7000, (select booking_id from r where n = 2), 'retainer') = 'duplicate_event', 'Duplicate webhook delivery is ignored');
select public._check((select count(*) from public.payments where booking_id = (select booking_id from r where n = 2)) = 1, 'Only one payment row after duplicate webhook');
select public._check((select status from public.bookings where id = (select booking_id from r where n = 2)) = 'confirmed', 'Booking is confirmed after payment');
select public._check((select count(*) from public.outbox where dedupe_key = 'booking_confirmed:' || (select booking_id from r where n = 2)) = 1, 'Exactly one confirmation email queued');
-- Late payment for the expired hold on a day that has since filled.
select public._check(public.record_stripe_payment('evt_2', 'checkout.session.completed', '{}', 'cs_2', 'pi_2', 7000, (select booking_id from r where n = 1), 'retainer') = 'paid_but_not_confirmed', 'Late payment on a full day is kept and flagged, not over-booked');
select public._check((select count(*) from public.bookings where session_date = '2027-08-07' and public.uses_capacity(status, hold_expires_at)) = 2, 'Day still holds exactly 2 sessions after late payment');

-- ---------------------------------------------------------------- 7. gallery privacy
insert into public.clients (id, email, full_name, user_id) values
  ('22222222-0000-0000-0000-0000000000a1', 'client.a@example.com', 'Client A', '00000000-0000-0000-0000-0000000000c1'),
  ('22222222-0000-0000-0000-0000000000b1', 'client.b@example.com', 'Client B', '00000000-0000-0000-0000-0000000000c2');
insert into public.client_galleries (id, title, status) values
  ('33333333-0000-0000-0000-0000000000a1', 'A gallery', 'delivered'),
  ('33333333-0000-0000-0000-0000000000b1', 'B gallery', 'delivered'),
  ('33333333-0000-0000-0000-0000000000a2', 'A draft', 'draft');
insert into public.client_gallery_members values
  ('33333333-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000a1'),
  ('33333333-0000-0000-0000-0000000000a2', '22222222-0000-0000-0000-0000000000a1'),
  ('33333333-0000-0000-0000-0000000000b1', '22222222-0000-0000-0000-0000000000b1');
insert into public.client_photos (gallery_id, storage_key, filename, bytes, width, height) values
  ('33333333-0000-0000-0000-0000000000a1', 'a/1.jpg', '1.jpg', 100, 10, 10),
  ('33333333-0000-0000-0000-0000000000a1', 'a/2.jpg', '2.jpg', 100, 10, 10),
  ('33333333-0000-0000-0000-0000000000b1', 'b/1.jpg', '1.jpg', 100, 10, 10),
  ('33333333-0000-0000-0000-0000000000a2', 'a/draft.jpg', 'd.jpg', 100, 10, 10);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public._check((select count(*) from public.client_photos) = 2, 'Client A sees only their 2 delivered photos');
select public._check((select count(*) from public.client_photos where gallery_id = '33333333-0000-0000-0000-0000000000b1') = 0, 'Client A cannot see Client B photos by ID');
select public._check((select count(*) from public.client_galleries where id = '33333333-0000-0000-0000-0000000000a2') = 0, 'Draft gallery is hidden from its client');
select public._check((select count(*) from public.bookings) = 0, 'Client A sees no bookings of other people');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select public._check((select count(*) from public.client_photos) = 1, 'Client B sees only their own photo');
reset role;
update public.client_galleries set status = 'revoked' where id = '33333333-0000-0000-0000-0000000000a1';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public._check((select count(*) from public.client_photos) = 0, 'Revoked access hides the gallery immediately');
reset role;

-- Gallery tied to a booking with an unpaid balance stays locked.
update public.client_galleries set status = 'delivered', booking_id = (select booking_id from r where n = 2) where id = '33333333-0000-0000-0000-0000000000a1';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public._check((select count(*) from public.client_photos) = 0, 'Gallery stays locked while a balance is owed');
reset role;

-- Once the balance is paid in full, the gallery opens.
select public.record_stripe_payment('evt_3', 'checkout.session.completed', '{}', 'cs_3', 'pi_3', 13000, (select booking_id from r where n = 2), 'balance');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public._check((select count(*) from public.client_photos) = 2, 'Gallery opens once the balance is paid');
reset role;

-- ---------------------------------------------------------------- 8. portfolio
select public._expect_error($$insert into public.portfolio_galleries (slug, title, category, published) values ('x', 'X', 'wedding', true)$$, 'check', 'A gallery cannot be published without client permission');
insert into public.portfolio_galleries (slug, title, category, published, permission_confirmed) values ('hidden', 'Hidden', 'event', false, true);
set role anon;
select public._check((select count(*) from public.portfolio_galleries) = 0, 'Unpublished portfolio galleries are hidden from visitors');
reset role;

-- ---------------------------------------------------------------- summary
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from public._results;
select name, detail from public._results where not ok;
