-- 0015_admin_mfa.sql
--
-- A second factor for the admin, in the database too: enrolled means
-- required.
--
-- Since 2026-09-25 an admin can add a code from an authenticator app
-- (Supabase Auth TOTP) at /admin/settings, and the admin login asks for it
-- right after the password. Once the code is verified, the session's JWT
-- carries `"aal": "aal2"` and its `amr` gains a `totp` entry next to the
-- `password` one. The app (src/lib/supabase/admin-user.ts) refuses an admin
-- who has a verified factor but a session still at aal1: the password step
-- already writes the session cookies, so otherwise typing /admin in the
-- address bar would skip the code. RLS must say the same, or that aal1
-- token, sent straight to PostgREST with the publishable key, would still
-- read every profile, order, applicant row, document row and agreement.
--
-- `is_admin()` now asks three things:
--
--   1. `public.users.role` is 'admin' (0005);
--   2. the JWT's `amr` lists a password sign in (0011);
--   3. the user has no verified factor, or the JWT's `aal` is 'aal2' (new).
--
-- Rule 3 cannot lock anyone out: an admin who never set a factor up passes
-- it at aal1, exactly as before this file. An unverified factor (a set up
-- left halfway) does not count. The stricter "every admin at aal2" mode
-- lives in the app only (ADMIN_REQUIRE_MFA=1), so it can be turned on and
-- off from the host's environment without a migration.
--
-- The function is security definer and runs as its owner, the role that
-- created it through the Management API in 0005 and 0011 (postgres), which
-- may read `auth.mfa_factors`; the caller never needs a grant on the auth
-- schema. `auth.uid()` and `auth.jwt()` still read the caller's request.
-- `search_path` stays `public`, so `auth.mfa_factors` is named in full.
--
-- Every `*_select_admin` policy (0005, 0007, 0009, 0010) and the
-- `admin_order_summary` view (security_invoker) go through this function,
-- so they all follow without being touched. The secret key bypasses RLS and
-- is not affected.
--
-- Idempotent: `create or replace` keeps the function's ACL; the grants of
-- 0005, 0006 and 0011 are stated again anyway, so the file can run again as
-- is.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin')
    and coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method":"password"}]'::jsonb
    and (
      coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      )
    );
$$;

revoke all on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;
