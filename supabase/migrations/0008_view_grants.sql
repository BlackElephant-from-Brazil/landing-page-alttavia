-- 0008_view_grants.sql
--
-- One line the review of 0007 asked for: admin_order_summary kept the
-- insert, update and delete grants Supabase hands every new relation, and
-- 0005 to 0007 only revoked them from anon. A three table join view cannot
-- be written through anyway and the base tables have no write grants, so
-- nothing was exploitable; the grant is dropped so the view reads like the
-- tables (0006): select only, authenticated only.

revoke all on public.admin_order_summary from anon, authenticated;
grant select on public.admin_order_summary to authenticated;
