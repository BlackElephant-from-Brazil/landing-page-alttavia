-- 0018_close_trigger_functions.sql
--
-- What the Supabase security advisor still flagged on 2026-09-28, closed
-- where it can be. Every statement is idempotent, so the file can run again
-- without harm.
--
--   a. `handle_auth_user()` (0001) is security definer and, like every
--      function created in public, came with EXECUTE for PUBLIC, anon and
--      authenticated (the grants Supabase's default privileges hand out).
--      It is the trigger `on_auth_user_change` on auth.users that mirrors a
--      new auth user into public.users and keeps the email in sync; nobody
--      has a reason to call it by hand. The grants go.
--
--      The trigger keeps working. PostgreSQL checks EXECUTE on a trigger
--      function once, when CREATE TRIGGER runs (in 0001, by the function's
--      owner), and never when the trigger fires. So Supabase Auth's inserts
--      into auth.users, made as supabase_auth_admin, still run it, and it
--      still runs as its owner because it is security definer.
--
--      PostgREST leaves functions returning `trigger` out of its schema
--      cache (rpc/handle_auth_user answered 404 PGRST202 before this file),
--      so the API could not reach it. The grant was there all the same, and
--      the advisor is right that it should not be.
--
--   b. `rls_auto_enable()` is the function behind the event trigger
--      `ensure_rls` (ddl_command_end), which turns row level security on for
--      every table created in public. It is not in our migrations: Supabase
--      created it. Security definer, search_path pg_catalog, and the same
--      EXECUTE for PUBLIC, anon and authenticated. PostgREST does expose
--      functions returning `event_trigger`: rpc/rls_auto_enable reached the
--      database and failed there with 0A000 before this file. Same revoke,
--      same reason why it is safe: an event trigger function is not checked
--      for EXECUTE when its event trigger fires either.
--
--      It was owned by postgres on 2026-09-28, but it is not ours, so the
--      revoke sits in a DO block that skips a missing function and turns a
--      refusal (insufficient_privilege) into a NOTICE: this file must never
--      fail on it. A REVOKE by a role that holds no grant option can also
--      succeed while revoking nothing (a WARNING, not an error), so the
--      block checks the result and says so in a NOTICE.
--
--      Should Supabase or the dashboard create the function again, it comes
--      back with the default grants. `npm run authz:matrix` probes
--      rpc/rls_auto_enable as anon and as a client and reports that as a
--      LEAK.
--
--   c. `set_updated_at()` (0001) had no fixed search_path (advisor: Function
--      Search Path Mutable). It is not security definer, so this is hygiene
--      rather than privilege. Its whole body is `new.updated_at = now();`
--      then `return new;`: `now()` lives in pg_catalog, which PostgreSQL
--      searches first even when search_path is empty, and `new` is the
--      trigger's row, so nothing in it needs a schema. It gets
--      search_path = ''.

-- ---------------------------------------------------------------------------
-- a. handle_auth_user()
-- ---------------------------------------------------------------------------

revoke execute on function public.handle_auth_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- b. rls_auto_enable(), which is not ours
-- ---------------------------------------------------------------------------

do $$
declare
  fn       regprocedure := to_regprocedure('public.rls_auto_enable()');
  fn_owner text;
begin
  if fn is null then
    raise notice '0018: public.rls_auto_enable() does not exist, nothing to revoke';
    return;
  end if;

  select pg_get_userbyid(p.proowner) into fn_owner from pg_catalog.pg_proc p where p.oid = fn;

  begin
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  exception
    when insufficient_privilege then
      raise notice '0018: % may not revoke EXECUTE on public.rls_auto_enable() (owner %), left as it was',
        current_user, fn_owner;
      return;
  end;

  if has_function_privilege('anon', fn::oid, 'EXECUTE')
     or has_function_privilege('authenticated', fn::oid, 'EXECUTE') then
    raise notice '0018: anon or authenticated can still execute public.rls_auto_enable(); revoke it as its owner (%)',
      fn_owner;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- c. set_updated_at()
-- ---------------------------------------------------------------------------

alter function public.set_updated_at() set search_path = '';

-- ---------------------------------------------------------------------------
-- What stays on purpose
-- ---------------------------------------------------------------------------
--
--   * `is_admin()` keeps EXECUTE for authenticated. Every `*_select_admin`
--     policy (0005, 0007, 0009, 0010) and the `admin_order_summary` view
--     call it as the requesting user, so without the grant every read by a
--     signed in client or admin would fail. It answers true only to an admin
--     account on a password session at the right assurance level (0011,
--     0015). anon lost EXECUTE in 0006. The advisor's line about
--     authenticated calling a security definer function is expected here.
--
--   * `public.schema_migrations` has row level security on and no policy
--     (0004). The advisor reports that as INFO; it is the intended state:
--     nobody reads the ledger through the API, only `npm run db:migrate`
--     with the access token.
--
--   * Leaked password protection (Supabase Auth checking new passwords
--     against HaveIBeenPwned) is a feature of the Pro plan and the project
--     is on the free plan, so it stays off. Turn it on in the Auth settings
--     if the plan changes.
--
--   * `set_updated_at()` keeps its default EXECUTE grants: it is not
--     security definer, runs with the rights of whoever updates the row, and
--     PostgREST does not expose functions returning `trigger`.
