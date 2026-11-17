#!/usr/bin/env bash
# Concurrency test: many simultaneous approvals for one date.
# Expects exactly 2 to succeed (the daily limit) and the rest to be refused.
set -euo pipefail
DB=bsi_test
ADMIN="set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);"
psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public._race (n int primary key, booking_id uuid);
-- Ten 1-hour sessions two hours apart need the whole day: open booking hours from midnight for this test.
update public.settings set earliest_start_minutes = 0;
truncate public._race;
do $$
declare i int; b uuid;
begin
  for i in 1..10 loop
    select booking_id into b from public.request_booking(jsonb_build_object(
      'package_id','11111111-0000-0000-0000-000000000003','quantity','1',
      'email','race'||i||'@example.com','full_name','Race '||i,
      'starts_at', ('2027-10-02 00:00-04'::timestamptz + make_interval(hours => 2*(i-1)))::text,
      'location','Hall'));
    insert into public._race values (i, b);
  end loop;
end $$;
grant select on public._race to authenticated;
SQL
pids=()
for i in $(seq 1 10); do
  ( psql -U postgres -d $DB -qAt -c "$ADMIN select pg_sleep(0.05 * (random())); select status from public.approve_booking((select booking_id from public._race where n=$i));" >/tmp/pgtest_bsi/race_$i.out 2>&1 || true ) &
  pids+=($!)
done
wait "${pids[@]}"
ok=$(grep -lx "awaiting_payment" /tmp/pgtest_bsi/race_*.out | wc -l)
refused=$(grep -l "CAPACITY_EXCEEDED" /tmp/pgtest_bsi/race_*.out | wc -l)
held=$(psql -U postgres -d $DB -Atc "select count(*) from public.bookings where session_date='2027-10-02' and public.uses_capacity(status, hold_expires_at)")
echo "10 simultaneous approvals: approved=$ok refused=$refused sessions_on_day=$held"
[ "$ok" = "2" ] && [ "$refused" = "8" ] && [ "$held" = "2" ] && echo "PASS Concurrent approvals never exceed the daily limit" || { echo "FAIL Concurrent approvals"; exit 1; }

# Lock-ordering check: a slow transaction holds the date while a second one waits, then is refused.
psql -U postgres -d $DB -qAt -c "truncate public._race" >/dev/null
psql -U postgres -d $DB -q <<'SQL'
do $$
declare i int; b uuid;
begin
  for i in 1..3 loop
    select booking_id into b from public.request_booking(jsonb_build_object(
      'package_id','11111111-0000-0000-0000-000000000003','quantity','1',
      'email','slow'||i||'@example.com','full_name','Slow '||i,
      'starts_at', ('2027-10-09 08:00-04'::timestamptz + make_interval(hours => 2*i))::text, 'location','Hall'));
    insert into public._race values (i, b);
  end loop;
end $$;
SQL
psql -U postgres -d $DB -qAt -c "$ADMIN select public.approve_booking((select booking_id from public._race where n=1));" >/dev/null
( psql -U postgres -d $DB -qAt -c "begin; $ADMIN select public.approve_booking((select booking_id from public._race where n=2)); select pg_sleep(3); commit;" >/tmp/pgtest_bsi/slow_a.out 2>&1 ) &
sleep 1
start=$(date +%s.%N)
psql -U postgres -d $DB -qAt -c "$ADMIN select public.approve_booking((select booking_id from public._race where n=3));" >/tmp/pgtest_bsi/slow_b.out 2>&1 || true
end=$(date +%s.%N)
wait
waited=$(python3 -c "print(round($end-$start,1))")
if grep -q CAPACITY_EXCEEDED /tmp/pgtest_bsi/slow_b.out && python3 -c "import sys; sys.exit(0 if $waited >= 1.5 else 1)"; then
  echo "PASS Second approval waited ${waited}s for the first to commit, then was refused"
else
  echo "FAIL Lock ordering (waited ${waited}s)"; cat /tmp/pgtest_bsi/slow_b.out; exit 1
fi
