-- 0007_one_unit_poa.sql
--
-- The fourth design round, docs/documents-contract.md. Five things:
--
--   1. One unit per purchase: services.supports_quantity and
--      user_services.quantity go. The view that exposes the order row is
--      dropped and recreated without the column (create or replace cannot
--      remove one).
--   2. Pendencies and notes go: user_service_notes and the view's
--      open_pendencies column.
--   3. Powers of attorney: service_docs.template names the deed a slot
--      generates; user_service_applicants holds the principal's details the
--      deed is filled with, one row per order and applicant.
--   4. NIF + Bank Account and Couple package take the stages, documents and
--      deliverables Patrícia defined on NIF only and Bank Account only.
--   5. Every service gets its deed slot(s) at the end of its document list.
--
-- Idempotent where it can be: guards on drops and adds, upserts on the data.
-- Stages are never deleted (user_services.stage_key references them);
-- positions are moved before rows are inserted between them because
-- (service_id, position) is unique.

-- ---------------------------------------------------------------------------
-- 1 + 2. The view first: it depends on user_services.quantity and reads
-- user_service_notes. Same columns as 0006 minus quantity and open_pendencies.
-- ---------------------------------------------------------------------------

drop view if exists public.admin_order_summary;

alter table public.user_services drop column if exists quantity;
alter table public.services drop column if exists supports_quantity;

drop table if exists public.user_service_notes;

create view public.admin_order_summary
with (security_invoker = true) as
select
  s.id,
  s.user_id,
  s.service_id,
  s.submission_id,
  s.answers_snapshot,
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
    select count(*)
    from public.user_documents ud
    join public.service_docs d on d.id = ud.service_doc_id
    where ud.user_service_id = s.id and ud.status = 'approved' and d.required
  )::integer as docs_approved,
  (
    select count(*) from (
      select distinct on (ud.service_doc_id, ud.applicant_index) ud.status
      from public.user_documents ud
      where ud.user_service_id = s.id
      order by ud.service_doc_id, ud.applicant_index, (ud.status = 'pending'), ud.created_at desc
    ) latest
    where latest.status = 'uploaded'
  )::integer as docs_uploaded,
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
  ) as last_event_at
from public.user_services s
join public.users u on u.id = s.user_id
join public.services sv on sv.id = s.service_id;

revoke all on public.admin_order_summary from anon;
grant select on public.admin_order_summary to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Deeds
-- ---------------------------------------------------------------------------

alter table public.service_docs
  add column if not exists template text
  check (template in ('poa_nif', 'poa_bank'));

create table if not exists public.user_service_applicants (
  id                   uuid primary key default gen_random_uuid(),
  user_service_id      uuid not null references public.user_services(id) on delete cascade,
  applicant_index      integer not null check (applicant_index in (0, 1)),
  full_name            text not null check (length(full_name) between 2 and 200),
  gender               text not null check (gender in ('f', 'm')),
  birth_place          text not null check (length(birth_place) between 2 and 200),
  birth_date           date not null,
  passport_number      text not null check (length(passport_number) between 3 and 40),
  passport_issuer      text not null check (length(passport_issuer) between 2 and 200),
  passport_issued_on   date not null,
  passport_expires_on  date not null,
  tax_address          text not null check (length(tax_address) between 5 and 400),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_service_id, applicant_index)
);

drop trigger if exists set_updated_at on public.user_service_applicants;
create trigger set_updated_at before update on public.user_service_applicants
  for each row execute function public.set_updated_at();

alter table public.user_service_applicants enable row level security;

-- Clients read their own; admins read all; nobody writes through PostgREST.
-- The project's default privileges hand new tables to the API roles, so the
-- write grants are revoked here the way 0006 did for the older tables.
drop policy if exists user_service_applicants_select_own on public.user_service_applicants;
create policy user_service_applicants_select_own on public.user_service_applicants
  for select to authenticated
  using (
    exists (
      select 1 from public.user_services s
      where s.id = user_service_id and s.user_id = auth.uid()
    )
  );

drop policy if exists user_service_applicants_select_admin on public.user_service_applicants;
create policy user_service_applicants_select_admin on public.user_service_applicants
  for select to authenticated
  using (public.is_admin());

revoke all on public.user_service_applicants from anon, authenticated;
grant select on public.user_service_applicants to authenticated;

-- ---------------------------------------------------------------------------
-- 4. NIF + Bank Account and Couple package, aligned with NIF only and
--    Bank Account only.
-- ---------------------------------------------------------------------------

do $$
declare
  svc record;
begin
  for svc in select id from public.services where slug in ('bundle', 'couple') loop
    -- Stages. Existing keys keep their rows; two are inserted between them.
    -- The two that move are parked at 106 and 108 first, so the inserts at
    -- 105 and 107 and the final numbering never collide with a live row.
    update public.service_stages set label = 'Submitted'
      where service_id = svc.id and key = 'awaiting_financas';
    update public.service_stages set position = 108
      where service_id = svc.id and key = 'account_open';
    update public.service_stages set position = 106
      where service_id = svc.id and key = 'awaiting_bank';
    insert into public.service_stages (service_id, key, label, position, is_terminal)
    values
      (svc.id, 'financas_access_ready',     'Finanças access ready',     105, false),
      (svc.id, 'issued_documents_delivery', 'Issued documents delivery', 107, false)
    on conflict (service_id, key) do update
      set label = excluded.label, is_terminal = excluded.is_terminal;
    update public.service_stages set position = 8 where service_id = svc.id and key = 'account_open';
    update public.service_stages set position = 7 where service_id = svc.id and key = 'issued_documents_delivery';
    update public.service_stages set position = 6 where service_id = svc.id and key = 'awaiting_bank';
    update public.service_stages set position = 5 where service_id = svc.id and key = 'financas_access_ready';

    -- Documents: NIF only's notes on the two shared slots.
    update public.service_docs
      set note = 'Photograph of the full page with all four corners visible.'
      where service_id = svc.id and key = 'passport';
    update public.service_docs
      set note = 'Utility bill, bank statement, landline, water, electricity or waste, issued within the last 3 months.'
      where service_id = svc.id and key = 'proof_of_address';

    -- Deliverables: NIF only's two, the IBAN kept, the report template gone
    -- unless a live deliverable still points at it.
    insert into public.service_deliverables (service_id, key, label, kind, position)
    values
      (svc.id, 'nif_certificate',      'Your Portuguese NIF',  'document', 1),
      (svc.id, 'financas_access',      'Finanças access',      'document', 2),
      (svc.id, 'account_confirmation', 'Your Portuguese IBAN', 'document', 3)
    on conflict (service_id, key) do update
      set label = excluded.label, kind = excluded.kind, position = excluded.position;
    delete from public.service_deliverables sd
      where sd.service_id = svc.id and sd.key = 'summary'
        and not exists (
          select 1 from public.user_service_deliverables d where d.service_deliverable_id = sd.id
        );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Deed slots, at the end of each document list.
-- ---------------------------------------------------------------------------

insert into public.service_docs (service_id, key, label, note, per_applicant, required, position, template)
select s.id, v.key, v.label, v.note, true, true,
       (select coalesce(max(d.position), 0) from public.service_docs d where d.service_id = s.id) + v.offset,
       v.template
from (
  values
    ('nif-only',  'poa_nif',  'Power of attorney for the NIF',          'We prepare it with your passport details. Download it, sign by hand, then upload a scan or a photo of the signed pages.', 'poa_nif',  1),
    ('bank-only', 'poa_bank', 'Power of attorney for the bank account', 'We prepare it with your passport details. Download it, sign by hand, then upload a scan or a photo of the signed pages.', 'poa_bank', 1),
    ('bundle',    'poa_nif',  'Power of attorney for the NIF',          'We prepare it with your passport details. Download it, sign by hand, then upload a scan or a photo of the signed pages.', 'poa_nif',  1),
    ('bundle',    'poa_bank', 'Power of attorney for the bank account', 'We prepare it with your passport details. Download it, sign by hand, then upload a scan or a photo of the signed pages.', 'poa_bank', 2),
    ('couple',    'poa_nif',  'Power of attorney for the NIF',          'We prepare it with your passport details. Download it, sign by hand, then upload a scan or a photo of the signed pages.', 'poa_nif',  1),
    ('couple',    'poa_bank', 'Power of attorney for the bank account', 'We prepare it with your passport details. Download it, sign by hand, then upload a scan or a photo of the signed pages.', 'poa_bank', 2)
) as v(slug, key, label, note, template, "offset")
join public.services s on s.slug = v.slug
on conflict (service_id, key) do update
  set label = excluded.label, note = excluded.note, template = excluded.template;
