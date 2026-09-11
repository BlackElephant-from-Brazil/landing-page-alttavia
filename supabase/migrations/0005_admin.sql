-- 0005_admin.sql
--
-- The administrator role and what the firm's side of the platform needs, as
-- written in docs/admin-contract.md section 3: the `role` column, the
-- `is_admin()` function RLS reads, pendencies (`user_service_notes`), the
-- upload columns on deliverables, the overview indexes, and the admin RLS
-- policies. Then one view, `admin_order_summary`, documented at the bottom,
-- that src/lib/db/admin-queries.ts reads for the orders table.
--
-- Every statement is idempotent (if not exists, create or replace, drop
-- policy if exists before create policy, DO blocks for constraints), because
-- seeds and hardening may run this file again.

-- ---------------------------------------------------------------------------
-- Role
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists role text not null default 'client'
  check (role in ('client','admin'));

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Pendencies and messages on an order. audience 'client' rows are visible to
-- the client; 'internal' rows only to admins.
-- ---------------------------------------------------------------------------

create table if not exists public.user_service_notes (
  id               uuid primary key default gen_random_uuid(),
  user_service_id  uuid not null references public.user_services(id) on delete cascade,
  author_id        uuid references public.users(id),
  audience         text not null default 'client' check (audience in ('client','internal')),
  body             text not null check (length(body) between 1 and 4000),
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists user_service_notes_order_idx on public.user_service_notes (user_service_id, created_at);

-- ---------------------------------------------------------------------------
-- Deliverables gain the columns an upload needs.
-- ---------------------------------------------------------------------------

alter table public.user_service_deliverables
  add column if not exists status text not null default 'pending' check (status in ('pending','ready')),
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes integer,
  add column if not exists uploaded_by uuid references public.users(id),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_service_deliverables_storage_key_key'
      and conrelid = 'public.user_service_deliverables'::regclass
  ) then
    alter table public.user_service_deliverables
      add constraint user_service_deliverables_storage_key_key unique (storage_key);
  end if;
end
$$;

-- The table now has updated_at, so it gets the shared trigger like the others.
drop trigger if exists set_updated_at on public.user_service_deliverables;
create trigger set_updated_at before update on public.user_service_deliverables
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Admin overview indexes.
-- ---------------------------------------------------------------------------

create index if not exists user_services_paid_idx on public.user_services (paid_at desc) where paid_at is not null;
create index if not exists user_services_stage_idx on public.user_services (stage_key);
create index if not exists user_services_created_idx on public.user_services (created_at desc);
create index if not exists user_documents_status_idx on public.user_documents (status) where status = 'uploaded';

-- ---------------------------------------------------------------------------
-- Row level security additions (contract section 3, "RLS additions").
--
-- All `to authenticated`: the anon role never evaluates is_admin(), which it
-- cannot execute. No insert, update or delete policy for anyone: writes stay
-- behind route handlers that use the secret key.
-- ---------------------------------------------------------------------------

alter table public.user_service_notes enable row level security;

-- users: admins see every profile; clients keep users_select_own.
drop policy if exists users_select_admin on public.users;
create policy users_select_admin on public.users
  for select to authenticated
  using (public.is_admin());

-- Orders and their history: admins see everything.
drop policy if exists user_services_select_admin on public.user_services;
create policy user_services_select_admin on public.user_services
  for select to authenticated
  using (public.is_admin());

drop policy if exists user_answers_select_admin on public.user_answers;
create policy user_answers_select_admin on public.user_answers
  for select to authenticated
  using (public.is_admin());

drop policy if exists user_service_events_select_admin on public.user_service_events;
create policy user_service_events_select_admin on public.user_service_events
  for select to authenticated
  using (public.is_admin());

drop policy if exists user_documents_select_admin on public.user_documents;
create policy user_documents_select_admin on public.user_documents
  for select to authenticated
  using (public.is_admin());

drop policy if exists user_service_deliverables_select_admin on public.user_service_deliverables;
create policy user_service_deliverables_select_admin on public.user_service_deliverables
  for select to authenticated
  using (public.is_admin());

-- Notes: the client sees 'client' rows on own orders; admins see all.
drop policy if exists user_service_notes_select on public.user_service_notes;
create policy user_service_notes_select on public.user_service_notes
  for select to authenticated
  using (
    (
      audience = 'client'
      and exists (
        select 1 from public.user_services s
        where s.id = user_service_id and s.user_id = auth.uid()
      )
    )
    or public.is_admin()
  );

-- Deliverables: the client only sees files that are ready. Replaces the
-- own-select policy from 0001.
drop policy if exists user_service_deliverables_select_own on public.user_service_deliverables;
create policy user_service_deliverables_select_own on public.user_service_deliverables
  for select to authenticated
  using (
    status = 'ready'
    and exists (
      select 1 from public.user_services s
      where s.id = user_service_id and s.user_id = auth.uid()
    )
  );

-- Catalogue: admins read inactive rows too (the editor needs them).
drop policy if exists services_select_admin on public.services;
create policy services_select_admin on public.services
  for select to authenticated
  using (public.is_admin());

drop policy if exists service_stages_select_admin on public.service_stages;
create policy service_stages_select_admin on public.service_stages
  for select to authenticated
  using (public.is_admin());

drop policy if exists service_docs_select_admin on public.service_docs;
create policy service_docs_select_admin on public.service_docs
  for select to authenticated
  using (public.is_admin());

drop policy if exists service_deliverables_select_admin on public.service_deliverables;
create policy service_deliverables_select_admin on public.service_deliverables
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- admin_order_summary
--
-- One row per order with what the admin orders table shows next to it, so
-- listOrders in src/lib/db/admin-queries.ts is a single query with filters,
-- ordering and a count, and never one query per row:
--
--   user_email, service_name, service_slug   joined from users and services
--   docs_required    slots the service asks for: required docs, one per
--                    applicant when per_applicant, else one
--   docs_approved    documents with status approved (at most one per slot,
--                    see user_documents_live_slot_idx in 0004)
--   docs_uploaded    documents waiting for review (status uploaded)
--   docs_rejected    slots whose newest upload was rejected and has not been
--                    replaced yet
--   last_event_at    newest user_service_events row, null for none
--   open_pendencies  audience 'client' notes without resolved_at
--
-- security_invoker: the view runs with the caller's rights, so row level
-- security on the base tables still applies. The admin client (secret key)
-- sees everything; the user client sees what the policies above allow, which
-- for an admin is everything and for a client their own orders. Column order
-- follows user_services so `select *` maps onto UserServiceRow first.
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
  (
    select count(*) from public.user_documents ud
    where ud.user_service_id = s.id and ud.status = 'approved'
  )::integer as docs_approved,
  (
    select count(*) from public.user_documents ud
    where ud.user_service_id = s.id and ud.status = 'uploaded'
  )::integer as docs_uploaded,
  (
    select count(*) from (
      select distinct on (ud.service_doc_id, ud.applicant_index) ud.status
      from public.user_documents ud
      where ud.user_service_id = s.id
      order by ud.service_doc_id, ud.applicant_index, ud.created_at desc
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
