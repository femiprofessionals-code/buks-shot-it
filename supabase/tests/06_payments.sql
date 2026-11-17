-- Payment tests (Deliverable 10). Runs after 05_booking_engine.sql. Dates in November 2027.
\set ON_ERROR_STOP on
reset role;

create table public._tok (name text primary key, token text, booking uuid);
grant select, insert, update on public._tok to anon, authenticated, service_role;
grant insert, select on public._results to service_role;
grant usage on sequence public._results_n_seq to service_role;
grant execute on function public._check(boolean, text, text), public._expect_error(text, text, text) to service_role;

-- A request for an 8-hour event ($750, retainer $262.50), approved by the photographer.
set role anon;
insert into public._tok (name, booking)
select 'event', r.booking_id from public.request_booking('{"package_slug":"event-half-day","email":"payer@example.com","full_name":"Pat Payer","starts_at":"2027-11-03 10:00-04","location":"Hall"}') r;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.approve_booking((select booking from public._tok where name = 'event'));
reset role;
update public._tok set token = (select payload->>'pay_token' from public.outbox where template = 'booking_approved' and booking_id = public._tok.booking) where name = 'event';

select public._check((select token ~ '^[0-9a-f]{64}$' from public._tok where name = 'event'), 'Link: approving a request issues a 64-character payment link token');
select public._check((select pay_token_hash = sha256(convert_to(t.token, 'UTF8')) and position(convert_to(t.token, 'UTF8') in pay_token_hash) = 0
                        from public.bookings b, public._tok t where t.name = 'event' and b.id = t.booking),
                 'Link: only a hash of the token is stored on the booking');

-- ---------------------------------------------------------------- payment page
set role anon;
select public._check((select first_name = 'Pat' and retainer_cents = 26250 and total_cents = 75000 and can_pay_retainer and can_pay_full and not can_pay_balance
                        from public.get_payment_page((select token from public._tok where name = 'event'))),
                 'Page: shows the retainer ($262.50) and pay-in-full ($750) options, first name only');
select public._check((select count(*) from public.get_payment_page(repeat('a', 64))) = 0, 'Page: a wrong token shows nothing');
select public._check((select count(*) from public.get_payment_page('x'' or 1=1 --')) = 0, 'Page: a malformed token shows nothing');
select public._check((select count(*) from public.bookings) = 0, 'Page: visitors still cannot read bookings');
select public._expect_error($$select * from public.checkout_details((select token from public._tok where name = 'event'), 'retainer')$$, 'permission denied',
                 'Checkout: visitors cannot read checkout details (server only)');
select public._expect_error($$select public.record_stripe_payment('evt_x', 't', '{}', 'cs_x', 'pi_x', 100, (select booking from public._tok where name = 'event'), 'retainer')$$, 'permission denied',
                 'Stripe: visitors cannot record payments');
reset role;

set role service_role;
select public._check((select amount_cents from public.checkout_details((select token from public._tok where name = 'event'), 'retainer')) = 26250
                 and (select amount_cents from public.checkout_details((select token from public._tok where name = 'event'), 'full')) = 75000
                 and (select email from public.checkout_details((select token from public._tok where name = 'event'), 'full')) = 'payer@example.com',
                 'Checkout: amounts come from the database (retainer $262.50, full $750)');
select public._expect_error($$select * from public.checkout_details((select token from public._tok where name = 'event'), 'balance')$$, 'NOT_PAYABLE',
                 'Checkout: no balance payment before the retainer');
select public._expect_error($$select * from public.checkout_details(repeat('b', 64), 'retainer')$$, 'INVALID_LINK', 'Checkout: a wrong token is refused');

-- ---------------------------------------------------------------- Stripe confirms the retainer
select public._check(public.record_stripe_payment('evt_p1', 'checkout.session.completed', '{}', 'cs_p1', 'pi_p1', 26250, (select booking from public._tok where name = 'event'), 'retainer') = 'recorded',
                 'Stripe: a verified retainer payment is recorded');
select public._check(public.record_stripe_payment('evt_p1', 'checkout.session.completed', '{}', 'cs_p1', 'pi_p1', 26250, (select booking from public._tok where name = 'event'), 'retainer') = 'duplicate_event',
                 'Stripe: the same event delivered twice is ignored');
reset role;
select public._check((select status from public.bookings where id = (select booking from public._tok where name = 'event')) = 'confirmed'
                 and (select count(*) from public.payments where booking_id = (select booking from public._tok where name = 'event')) = 1,
                 'Stripe: the booking is confirmed, with one payment');
select public._check((select count(*) from public.outbox where booking_id = (select booking from public._tok where name = 'event')
                        and template in ('booking_confirmed', 'payment_receipt', 'payment_received_admin')) = 3,
                 'Stripe: confirmation and receipt to the client, notice to the photographer');
set role anon;
select public._check((select not can_pay_retainer and not can_pay_full and can_pay_balance and balance_cents = 48750
                        from public.get_payment_page((select token from public._tok where name = 'event'))),
                 'Page: after the retainer, only the $487.50 balance can be paid');
reset role;
set role service_role;
select public._check((select amount_cents from public.checkout_details((select token from public._tok where name = 'event'), 'balance')) = 48750, 'Checkout: balance amount from the database');
select public._expect_error($$select * from public.checkout_details((select token from public._tok where name = 'event'), 'retainer')$$, 'NOT_PAYABLE', 'Checkout: the retainer cannot be paid twice');
select public._check(public.record_stripe_payment('evt_p2', 'checkout.session.completed', '{}', 'cs_p2', 'pi_p2', 48750, (select booking from public._tok where name = 'event'), 'balance') = 'recorded',
                 'Stripe: the balance payment is recorded');
select public._check(public.record_stripe_payment('evt_p3', 'checkout.session.completed', '{}', 'cs_p3', 'pi_p3', 100, '00000000-0000-0000-0000-000000000000', 'balance') = 'unknown_booking',
                 'Stripe: a payment for an unknown booking is kept aside, not applied');
reset role;
set role anon;
select public._check((select balance_cents = 0 and not can_pay_balance from public.get_payment_page((select token from public._tok where name = 'event'))),
                 'Page: nothing left to pay once the balance is paid');
reset role;

-- ---------------------------------------------------------------- manual payments and new links
set role anon;
insert into public._tok (name, booking)
select 'cash', r.booking_id from public.request_booking('{"package_slug":"product-standard","email":"cash@example.com","full_name":"Casey Cash","starts_at":"2027-11-04 10:00-04","location":"Studio"}') r;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public._expect_error($$select public.record_manual_payment((select booking from public._tok where name = 'cash'), 'retainer', 12250, 'Zelle')$$, 'NOT_PAYABLE',
                 'Manual: a request not yet approved cannot take a payment');
select public.approve_booking((select booking from public._tok where name = 'cash'));
select public._expect_error($$select public.record_manual_payment((select booking from public._tok where name = 'cash'), 'retainer', 0, 'x')$$, 'INVALID_AMOUNT', 'Manual: amount must be positive');
select public._check(public.record_manual_payment((select booking from public._tok where name = 'cash'), 'retainer', 12250, 'Zelle') is not null, 'Manual: the photographer records a retainer paid by Zelle');
select public._check((select status from public.bookings where id = (select booking from public._tok where name = 'cash')) = 'confirmed'
                 and (select method || ':' || note from public.payments where booking_id = (select booking from public._tok where name = 'cash')) = 'manual:Zelle',
                 'Manual: the booking is confirmed and the payment marked manual');
select public._check((select balance_cents from public.admin_bookings where id = (select booking from public._tok where name = 'cash')) = 22750,
                 'Manual: the outstanding balance is $227.50');
update public._tok set token = public.issue_payment_link((select booking from public._tok where name = 'cash')) where name = 'cash';
select public._check(exists (select 1 from public.outbox where template = 'balance_due' and booking_id = (select booking from public._tok where name = 'cash')),
                 'New link: a balance request email is queued');
select public._expect_error($$select public.issue_payment_link((select booking from public._tok where name = 'event'))$$, 'NOT_PAYABLE', 'New link: none for a booking paid in full');
reset role;
set role anon;
select public._check((select can_pay_balance and balance_cents = 22750 from public.get_payment_page((select token from public._tok where name = 'cash'))), 'New link: the new link opens the balance payment');
select public._expect_error($$select public.record_manual_payment((select booking from public._tok where name = 'cash'), 'balance', 100, 'x')$$, 'permission denied', 'Manual: visitors cannot record payments');
select public._expect_error($$select public.issue_payment_link((select booking from public._tok where name = 'cash'))$$, 'permission denied', 'New link: visitors cannot issue links');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public._expect_error($$select public.record_manual_payment((select booking from public._tok where name = 'cash'), 'balance', 100, 'x')$$, '42501', 'Manual: signed-in clients cannot record payments');
reset role;

-- An old link stops working once a new one is issued.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public._tok (name, token) values ('cash-old', (select token from public._tok where name = 'cash'));
update public._tok set token = public.issue_payment_link((select booking from public._tok where name = 'cash')) where name = 'cash';
select public._check(
  (select count(*) from public.get_payment_page((select token from public._tok where name = 'cash'))) = 1
  and (select count(*) from public.get_payment_page((select token from public._tok where name = 'cash-old'))) = 0,
  'New link: issuing a new link retires the old one');
reset role;

-- An expired hold cannot be paid online.
set role anon;
insert into public._tok (name, booking)
select 'late', r.booking_id from public.request_booking('{"package_slug":"product-standard","email":"late@example.com","full_name":"Lee Late","starts_at":"2027-11-05 10:00-04","location":"Studio"}') r;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.approve_booking((select booking from public._tok where name = 'late'));
reset role;
update public._tok set token = (select payload->>'pay_token' from public.outbox where template = 'booking_approved' and booking_id = public._tok.booking) where name = 'late';
update public.bookings set status = 'expired' where id = (select booking from public._tok where name = 'late');
set role anon;
select public._check((select not can_pay_retainer and not can_pay_full from public.get_payment_page((select token from public._tok where name = 'late'))),
                 'Page: once the 72-hour hold runs out, the retainer can no longer be paid online');
reset role;
