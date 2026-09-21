-- 0011_admin_password_session.sql
--
-- Admin powers need a session opened with a password, in the database too.
--
-- Since 2026-09-21 the app treats an admin account signed in with an emailed
-- code (/en/login) as a client: src/lib/supabase/admin-user.ts reads the
-- session's `amr` claim and wants `password` in it. RLS did not follow.
-- `is_admin()` looked at the role only, so the same code session's access
-- token, sent straight to PostgREST with the publishable key, still read
-- every profile, order, applicant row, document row and agreement as admin.
-- Anyone who can read the firm's inbox could do that without a sound.
--
-- Now `is_admin()` also asks the JWT: its `amr` claim must list a password
-- sign in. Supabase writes `amr` as `[{ "method": ..., "timestamp": ... }]`
-- and keeps it across token refreshes; a second factor adds its own entry
-- next to the first, so password plus TOTP still passes. A code, a magic
-- link, a recovery link or no JWT at all answers false. aal2 is not asked
-- for: there is no MFA yet.
--
-- Every `*_select_admin` policy (0005, 0007, 0009, 0010) and the
-- `admin_order_summary` view (security_invoker) go through this function,
-- so they all follow without being touched. The secret key bypasses RLS and
-- is not affected.
--
-- Idempotent: `create or replace` keeps the function's ACL; the grants of
-- 0005 and 0006 are stated again anyway, so the file can run again as is.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin')
    and coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method":"password"}]'::jsonb;
$$;

revoke all on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;
