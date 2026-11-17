# Database (Supabase / PostgreSQL)

- `migrations/20261117000000_initial_schema.sql`: full schema, capacity and status rules, payment
  idempotency, Row Level Security policies and function permissions.
- `tests/`: rule tests run against a throwaway local PostgreSQL 16 database.
  - `00_supabase_stubs.sql` stands in for Supabase's `auth` schema and roles (test only).
  - `02_rules.sql`: 38 checks (access, capacity, overlaps, holds, payments, gallery privacy, portfolio).
  - `03_concurrency.sh`: 10 simultaneous approvals for one date; exactly 2 must succeed.

Run (with a local PostgreSQL superuser `postgres`):

    PGHOST=/path/to/socket PGPORT=5432 supabase/tests/run_tests.sh
    PGHOST=/path/to/socket PGPORT=5432 supabase/tests/03_concurrency.sh

Last run: 17 Nov 2026, PostgreSQL 16.15: 38/38 rule checks and 2/2 concurrency checks passed.
