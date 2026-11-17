-- Booking engine tests (Deliverable 9). Runs after 02_rules.sql (uses its helpers and test users).
-- Dates are in September 2027 (Eastern Daylight Time, UTC-4), which no other test uses.
\set ON_ERROR_STOP on
reset role;

-- Helper: request -> approve -> paid retainer, as the website, the photographer and Stripe would.
create function public._confirmed(slug text, starts text, qty numeric default null) returns uuid
language plpgsql as $$
declare b uuid;
begin
  select r.booking_id into b from public.request_booking(jsonb_build_object(
    'package_slug', slug, 'quantity', qty, 'email', 'conf.' || replace(starts, ' ', '') || '@example.com',
    'full_name', 'Confirmed Client', 'starts_at', starts, 'location', 'Venue')) r;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  perform public.approve_booking(b);
  perform public.record_stripe_payment('evt_' || b, 'checkout.session.completed', '{}', 'cs_' || b, 'pi_' || b, 1, b, 'retainer');
  perform set_config('request.jwt.claim.sub', '', true);
  return b;
end $$;

-- ---------------------------------------------------------------- catalogue
select public._check((select count(*) from public.packages where slug like 'wedding-%' or slug like 'event-%' or slug like 'product-%') = 9, 'Catalogue: 9 bookable packages seeded');
select public._check((select price_cents from public.packages where slug = 'wedding-classic') = 300000
                 and (select price_cents from public.packages where slug = 'wedding-signature') = 420000
                 and (select price_cents from public.packages where slug = 'event-full-day') = 180000
                 and (select price_type from public.packages where slug = 'event-hourly') = 'hourly'
                 and (select price_type from public.packages where slug = 'product-simple') = 'per_image'
                 and (select price_type from public.packages where slug = 'product-brand') = 'quote',
                 'Catalogue: prices and price types match the approved list');
select public._check(not exists (select 1 from public.packages p join public.services s on s.id = p.service_id where s.kind = 'portrait'),
                 'Catalogue: no portrait packages until prices are supplied');
select public._check((select count(*) from public.addons) = 5, 'Catalogue: 5 add-ons seeded');

-- ---------------------------------------------------------------- open times
set role anon;
select public._check((select count(*) from public.get_open_times('2027-09-15', 'wedding-classic')) = 23,
                 'Open times: 7:00 to 18:00 every 30 minutes for a 6-hour wedding on an empty day');
select public._check((select min(t) from public.get_open_times('2027-09-15', 'wedding-classic') t) = '2027-09-15 07:00-04'
                 and (select max(t) from public.get_open_times('2027-09-15', 'wedding-classic') t) = '2027-09-15 18:00-04',
                 'Open times: first start 7:00, last start leaves the session ending by midnight (Eastern Time)');
select public._check((select count(*) from public.get_open_times('2027-09-15', 'event-hourly')) = 0,
                 'Open times: hourly coverage needs a number of hours');
select public._check((select count(*) from public.get_open_times('2027-09-15', 'event-hourly', 13)) = 0
                 and (select count(*) from public.get_open_times('2027-09-15', 'event-hourly', 2.5)) = 0,
                 'Open times: hours must be whole, 1 to 12');
select public._check((select count(*) from public.get_open_times('2027-09-15', 'event-hourly', 3)) = 29,
                 'Open times: 3 hours of event coverage');
select public._check((select count(*) from public.get_open_times(current_date, 'event-hourly', 1)) = 0,
                 'Open times: nothing within 24 hours');
select public._check((select count(*) from public.get_open_times('2026-01-01', 'event-hourly', 1)) = 0,
                 'Open times: nothing in the past');
select public._check((select count(*) from public.get_open_times('2027-09-15', 'no-such-package')) = 0,
                 'Open times: unknown package returns nothing');
reset role;

-- A confirmed 10:00-12:00 session: the 60-minute gap applies before and after it.
select public._confirmed('event-hourly', '2027-09-16 10:00-04', 2);
set role anon;
select public._check(exists (select 1 from public.get_open_times('2027-09-16', 'event-hourly', 1) t where t = '2027-09-16 08:00-04'),
                 'Open times: 8:00-9:00 is free (ends an hour before the 10:00 session)');
select public._check(not exists (select 1 from public.get_open_times('2027-09-16', 'event-hourly', 1) t where t = '2027-09-16 08:30-04'),
                 'Open times: 8:30 is taken (no hour gap before the 10:00 session)');
select public._check(not exists (select 1 from public.get_open_times('2027-09-16', 'event-hourly', 1) t where t = '2027-09-16 12:30-04'),
                 'Open times: 12:30 is taken (inside the hour gap after the session)');
select public._check(exists (select 1 from public.get_open_times('2027-09-16', 'event-hourly', 1) t where t = '2027-09-16 13:00-04'),
                 'Open times: 13:00 is free (an hour after the session ends)');
select public._check((select count(*) from public.get_open_times('2027-09-16', 'wedding-classic')) = 0,
                 'Open times: a whole-day package does not fit a day that already has a session');
reset role;

-- A 6-hour wedding takes the whole day.
select public._confirmed('wedding-classic', '2027-09-17 12:00-04');
set role anon;
select public._check((select count(*) from public.get_open_times('2027-09-17', 'event-hourly', 1)) = 0,
                 'Open times: nothing else on a day with a 6-hour session');
reset role;

-- Blocked date.
insert into public.blocked_dates (day, reason) values ('2027-09-18', 'Away');
set role anon;
select public._check((select count(*) from public.get_open_times('2027-09-18', 'event-hourly', 1)) = 0, 'Open times: blocked dates have none');
select public._check((select capacity from public.get_availability('2027-09-18', '2027-09-18')) = 0, 'Calendar: blocked date shows no capacity');

-- ---------------------------------------------------------------- requests
select public._check(r.reference is not null, 'Request: by package name at an open time')
  from public.request_booking('{"package_slug":"event-hourly","quantity":"2","email":"slug@example.com","full_name":"Slug Test","starts_at":"2027-09-20 15:00-04","location":"Hall"}') r;
select public._expect_error($$select * from public.request_booking('{"package_slug":"event-hourly","quantity":"2","email":"a@example.com","full_name":"A","starts_at":"2027-09-20 15:15-04","location":"Hall"}')$$,
                 'TIME_UNAVAILABLE', 'Request: a start time off the 30-minute grid is refused');
select public._expect_error($$select * from public.request_booking('{"package_slug":"event-hourly","quantity":"1","email":"a@example.com","full_name":"A","starts_at":"2027-09-16 11:00-04","location":"Hall"}')$$,
                 'TIME_UNAVAILABLE', 'Request: a time overlapping a confirmed session is refused');
select public._expect_error($$select * from public.request_booking('{"package_slug":"event-hourly","quantity":"1","email":"a@example.com","full_name":"A","starts_at":"2027-09-20 06:00-04","location":"Hall"}')$$,
                 'TIME_UNAVAILABLE', 'Request: a time before booking hours is refused');
select public._expect_error($$select * from public.request_booking('{"package_slug":"event-hourly","email":"a@example.com","full_name":"A","starts_at":"2027-09-20 15:00-04","location":"Hall"}')$$,
                 'INVALID_QUANTITY', 'Request: hourly coverage without hours is refused');
select public._expect_error($$select * from public.request_booking('{"package_slug":"event-hourly","quantity":"20","email":"a@example.com","full_name":"A","starts_at":"2027-09-20 15:00-04","location":"Hall"}')$$,
                 'INVALID_QUANTITY', 'Request: more than 12 hours is refused');
select public._expect_error($$select * from public.request_booking('{"package_slug":"event-hourly","quantity":"1","email":"a@example.com","full_name":"A","starts_at":"2027-09-18 10:00-04","location":"Hall"}')$$,
                 'DATE_FULL', 'Request: a blocked date is refused');
select public._expect_error($$select * from public.request_booking(jsonb_build_object('package_slug','event-hourly','quantity','1','email','a@example.com','full_name','A','starts_at','2027-09-21 10:00-04','location','Hall','details', jsonb_build_object('notes', repeat('x', 5000))))$$,
                 'DETAILS_TOO_LONG', 'Request: oversized details are refused');
reset role;
select public._check((select total_cents from public.bookings b join public.clients c on c.id = b.client_id where c.email = 'slug@example.com') = 20000
                 and (select retainer_cents from public.bookings b join public.clients c on c.id = b.client_id where c.email = 'slug@example.com') = 7000,
                 'Request: 2 hours at $100 = $200 total, $70 retainer (35%)');
set role anon;
select public._check(r.reference is not null, 'Request: product images priced per image')
  from public.request_booking('{"package_slug":"product-simple","quantity":"12","email":"images@example.com","full_name":"Image Test","starts_at":"2027-09-21 10:00-04","location":"Studio"}') r;
select public._check(r.reference is not null, 'Request: a fixed-price package ignores any quantity sent')
  from public.request_booking('{"package_slug":"product-standard","quantity":"99","email":"fixed@example.com","full_name":"Fixed Test","starts_at":"2027-09-22 10:00-04","location":"Studio"}') r;
select public._check(r.reference is not null, 'Request: brand content starts as a quote')
  from public.request_booking('{"package_slug":"product-brand","email":"quote@example.com","full_name":"Quote Test","starts_at":"2027-09-23 10:00-04","location":"Studio"}') r;
select public._check(
  (select r1.booking_id from public.request_booking('{"package_slug":"product-standard","email":"idem@example.com","full_name":"Idem","starts_at":"2027-09-24 10:00-04","location":"Studio","idempotency_key":"6f1c2c1e-1d55-4a0c-9d2a-6a1f0f5a1b01"}') r1)
  = (select r2.booking_id from public.request_booking('{"package_slug":"product-standard","email":"idem@example.com","full_name":"Idem","starts_at":"2027-09-24 10:00-04","location":"Studio","idempotency_key":"6f1c2c1e-1d55-4a0c-9d2a-6a1f0f5a1b01"}') r2),
  'Request: sending the same form twice creates one booking');
reset role;
select public._check((select total_cents from public.bookings b join public.clients c on c.id = b.client_id where c.email = 'images@example.com') = 48000,
                 'Request: 12 images at $40 = $480');
select public._check((select quantity from public.bookings b join public.clients c on c.id = b.client_id where c.email = 'fixed@example.com') is null
                 and (select total_cents from public.bookings b join public.clients c on c.id = b.client_id where c.email = 'fixed@example.com') = 35000,
                 'Request: fixed package is $350 whatever quantity is sent');
select public._check((select total_cents from public.bookings b join public.clients c on c.id = b.client_id where c.email = 'quote@example.com') is null
                 and (select is_quote from public.bookings b join public.clients c on c.id = b.client_id where c.email = 'quote@example.com'),
                 'Request: a quote has no total until the photographer sets one');

-- ---------------------------------------------------------------- photographer actions
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public._expect_error($$select public.approve_booking((select b.id from public.bookings b join public.clients c on c.id = b.client_id where c.email = 'quote@example.com'))$$,
                 'TOTAL_REQUIRED', 'Approve: a quote needs a total');
select public._check((public.approve_booking((select b.id from public.bookings b join public.clients c on c.id = b.client_id where c.email = 'quote@example.com'), 120000)).retainer_cents = 42000,
                 'Approve: quote of $1,200 asks for a $420 retainer');

-- Reschedule a pending request: stays pending, keeps its length, date follows Eastern Time.
select public._check(
  (select x.status = 'pending' and x.starts_at = '2027-09-25 21:30-04' and x.ends_at = '2027-09-25 23:30-04' and x.session_date = '2027-09-25'
     from public.reschedule_booking((select b.id from public.bookings b join public.clients c on c.id = b.client_id where c.email = 'slug@example.com'), '2027-09-25 21:30') x),
  'Reschedule: a pending request moves, keeps its 2 hours, and stays pending');
select public._check(exists (select 1 from public.outbox o join public.bookings b on b.id = o.booking_id join public.clients c on c.id = b.client_id
                             where c.email = 'slug@example.com' and o.template = 'booking_rescheduled'),
                 'Reschedule: the client is told (email queued)');
select public._check(exists (select 1 from public.booking_events e join public.bookings b on b.id = e.booking_id join public.clients c on c.id = b.client_id
                             where c.email = 'slug@example.com' and e.note like 'Moved to %'),
                 'Reschedule: the move is recorded in the booking history');

-- Reschedule a confirmed session onto another confirmed session's time: refused.
select public._expect_error($$select public.reschedule_booking((select b.id from public.bookings b where b.session_date = '2027-09-17'), '2027-09-16 10:30')$$,
                 'TIME_TAKEN', 'Reschedule: refused when it would overlap another session');
select public._check((select status from public.reschedule_booking((select b.id from public.bookings b where b.session_date = '2027-09-17'), '2027-09-26 11:00')) = 'rescheduled',
                 'Reschedule: a confirmed session moves to a free day and is marked rescheduled');
select public._check((select desired_state from public.calendar_sync where booking_id = (select id from public.bookings where session_date = '2027-09-26')) = 'present',
                 'Reschedule: the calendar entry is queued to update');
select public._expect_error($$select public.reschedule_booking((select b.id from public.bookings b where b.session_date = '2027-09-26'), '2026-01-01 10:00')$$,
                 'INVALID_DATE', 'Reschedule: cannot move into the past');

-- Cancel.
select public._check((select status from public.cancel_booking((select id from public.bookings where session_date = '2027-09-26'), 'Client asked to cancel')) = 'cancelled',
                 'Cancel: a confirmed session can be cancelled');
select public._check(exists (select 1 from public.outbox where template = 'booking_cancelled' and booking_id = (select id from public.bookings where session_date = '2027-09-26'))
                 and (select desired_state from public.calendar_sync where booking_id = (select id from public.bookings where session_date = '2027-09-26')) = 'absent',
                 'Cancel: client email queued and calendar entry removed');
select public._expect_error($$select public.cancel_booking((select id from public.bookings where session_date = '2027-09-26'))$$,
                 'NOT_CANCELLABLE', 'Cancel: cannot cancel twice');
select public._check((select count(*) from public.get_open_times('2027-09-26', 'wedding-classic')) > 0,
                 'Cancel: the day opens up again');

-- Admin list.
select public._check((select count(*) from public.admin_bookings where full_name = 'Slug Test' and package_name = 'Hourly Coverage' and balance_cents = 20000) = 1,
                 'Admin list: shows client, package and balance');
reset role;

set role anon;
select public._check((select count(*) from public.admin_bookings) = 0, 'Admin list: visitors see nothing');
select public._expect_error($$select public.cancel_booking((select '00000000-0000-0000-0000-000000000000'::uuid))$$, 'permission denied', 'Visitors cannot cancel bookings');
select public._expect_error($$select public.reschedule_booking('00000000-0000-0000-0000-000000000000', '2027-09-27 10:00')$$, 'permission denied', 'Visitors cannot reschedule bookings');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public._expect_error($$select public.cancel_booking((select '00000000-0000-0000-0000-000000000000'::uuid))$$, '42501', 'Signed-in clients cannot cancel bookings');
select public._check((select count(*) from public.admin_bookings) = 0, 'Admin list: signed-in clients see none of it');
reset role;
