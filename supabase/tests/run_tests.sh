#!/usr/bin/env bash
# Loads the schema into a throwaway local PostgreSQL database and runs the rule tests.
# Usage: PGHOST=/path/to/socket PGPORT=5544 tests/run_tests.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=bsi_test
psql -U postgres -q -c "drop database if exists $DB" -c "create database $DB"
for f in tests/00_supabase_stubs.sql migrations/*.sql tests/01_grants.sql; do
  psql -U postgres -d $DB -v ON_ERROR_STOP=1 -q -f "$f"
done
out=$(psql -U postgres -d $DB -v ON_ERROR_STOP=1 -q -f tests/02_rules.sql 2>&1)
echo "$out" | grep -E "PASS|FAIL" | sed 's/.*NOTICE:  //'
failed=$(psql -U postgres -d $DB -Atc "select count(*) from public._results where not ok")
passed=$(psql -U postgres -d $DB -Atc "select count(*) from public._results where ok")
echo "passed=$passed failed=$failed"
[ "$failed" = "0" ]
