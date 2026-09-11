-- 0006_admin_hardening.sql
--
-- Three things the adversarial review of the admin area asked for. Every
-- statement is idempotent, so the file can run again without harm.
--
--   a. The API roles lose every write privilege on public tables. Row level
--      security already had no insert, update or delete policy for anyone,
--      but the table grants Supabase hands out by default still allowed the
--      statements to be attempted; now they are refused before RLS is even
--      consulted. The one write a browser does, its own full_name and
--      phone, keeps its column grant (0001). Every other write goes through
--      a route handler with the service role. The select grants stay as they
--      were.
--   b. `is_admin()` is callable by authenticated only: anon and public lose
--      execute (0005 revoked public; anon is spelled out here).
--   c. `admin_order_summary` is recreated so its counts read the way the
--      modal reads them: docs_approved counts only approved documents on
--      slots the service marks required (docs_required counts the same
--      slots, so "x of y" compares like with like), and the per slot status
--      behind docs_uploaded and docs_rejected ignores a `pending` row (an
--      upload that never finished) whenever the slot has a finished row,
--      the same rule as latestDocument() in src/components/dashboard/order-status.ts.
--      security_invoker and the grants are kept.

-- ---------------------------------------------------------------------------
-- a. Table privileges
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

grant update (full_name, phone) on public.users to authenticated;

-- ---------------------------------------------------------------------------
-- b. is_admin()
-- ---------------------------------------------------------------------------

revoke execute on function public.is_admin() from anon, public;

-- ---------------------------------------------------------------------------
-- c. admin_order_summary
--
-- Same columns in the same order as 0005 (create or replace view demands
-- it). See the 0005 comment for what each column is; the three counts that
-- changed are marked.
-- ---------------------------------------------------------------------------

create or replace view public.admin_order_summary
with (security_invoker = true) as
select
  s.id,
  s.user_id,
  s.service_id,
  s.submission_id,
  s.answers_snapshot,
  s.quantity,
  s.joint,
  s.applicants,
  s.total_cents,
  s.currency,
  s.stage_key,
  s.stripe_checkout_session_id,
  s.stripe_payment_intent_id,
  s.paid_at,
  s.completed_at,
  s.report,
  s.created_at,
  s.updated_at,
  u.email as user_email,
  sv.name as service_name,
  sv.slug as service_slug,
  coalesce((
    select sum(case when d.per_applicant then s.applicants else 1 end)
    from public.service_docs d
    where d.service_id = s.service_id and d.required
  ), 0)::integer as docs_required,
  -- changed: approved documents on required slots only
  (
    select count(*)
    from public.user_documents ud
    join public.service_docs d on d.id = ud.service_doc_id
    where ud.user_service_id = s.id and ud.status = 'approved' and d.required
  )::integer as docs_approved,
  -- changed: the slot's status is its newest finished row; a pending row
  -- only counts when it is the only row of the slot
  (
    select count(*) from (
      select distinct on (ud.service_doc_id, ud.applicant_index) ud.status
      from public.user_documents ud
      where ud.user_service_id = s.id
      order by ud.service_doc_id, ud.applicant_index, (ud.status = 'pending'), ud.created_at desc
    ) latest
    where latest.status = 'uploaded'
  )::integer as docs_uploaded,
  -- changed: same rule
  (
    select count(*) from (
      select distinct on (ud.service_doc_id, ud.applicant_index) ud.status
      from public.user_documents ud
      where ud.user_service_id = s.id
      order by ud.service_doc_id, ud.applicant_index, (ud.status = 'pending'), ud.created_at desc
    ) latest
    where latest.status = 'rejected'
  )::integer as docs_rejected,
  (
    select max(e.created_at) from public.user_service_events e
    where e.user_service_id = s.id
  ) as last_event_at,
  (
    select count(*) from public.user_service_notes n
    where n.user_service_id = s.id and n.audience = 'client' and n.resolved_at is null
  )::integer as open_pendencies
from public.user_services s
join public.users u on u.id = s.user_id
join public.services sv on sv.id = s.service_id;

revoke all on public.admin_order_summary from anon;
grant select on public.admin_order_summary to authenticated;
