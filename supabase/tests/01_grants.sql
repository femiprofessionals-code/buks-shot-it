-- Mirrors Supabase's default table privileges (RLS then restricts rows).
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
