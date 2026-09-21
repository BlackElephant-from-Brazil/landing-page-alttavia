-- 0009_service_contracts.sql
--
-- The contract for legal services a client receives after paying, as designed
-- in docs/agreement-contract.md. Additive only: one nullable column and one
-- new table, so nothing that exists changes meaning.
--
--   1. services.contract_template names the firm's model a service uses
--      ('nif', 'bank', 'package'). Null means the service has no contract:
--      nothing is generated, nothing is asked. The Couple package stays null
--      because the firm has no model for two parties yet.
--   2. user_service_contracts holds one row per order: where the PDF lives in
--      R2, which version it is, exactly which values were printed, and when
--      it was emailed. Written only by the admin client (route handlers).
--
-- Idempotent: guards on the column and the table, updates keyed on slug.

alter table public.services
  add column if not exists contract_template text
  check (contract_template in ('nif', 'bank', 'package'));

update public.services set contract_template = 'nif'     where slug = 'nif-only'  and contract_template is null;
update public.services set contract_template = 'bank'    where slug = 'bank-only' and contract_template is null;
update public.services set contract_template = 'package' where slug = 'bundle'    and contract_template is null;

create table if not exists public.user_service_contracts (
  id               uuid primary key default gen_random_uuid(),
  user_service_id  uuid not null unique references public.user_services(id) on delete cascade,
  template         text not null check (template in ('nif', 'bank', 'package')),
  version          integer not null default 1 check (version >= 1),
  storage_key      text not null unique,
  file_name        text not null,
  size_bytes       integer not null check (size_bytes > 0),
  variables        jsonb not null,
  generated_at     timestamptz not null default now(),
  emailed_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.user_service_contracts;
create trigger set_updated_at before update on public.user_service_contracts
  for each row execute function public.set_updated_at();

alter table public.user_service_contracts enable row level security;

-- Clients read the contract of their own orders; admins read all; nobody
-- writes through PostgREST. New tables get the API roles' default grants, so
-- the write grants are revoked here the way 0006 did for the older tables.
drop policy if exists user_service_contracts_select_own on public.user_service_contracts;
create policy user_service_contracts_select_own on public.user_service_contracts
  for select to authenticated
  using (
    exists (
      select 1 from public.user_services s
      where s.id = user_service_id and s.user_id = auth.uid()
    )
  );

drop policy if exists user_service_contracts_select_admin on public.user_service_contracts;
create policy user_service_contracts_select_admin on public.user_service_contracts
  for select to authenticated
  using (public.is_admin());

revoke all on public.user_service_contracts from anon, authenticated;
grant select on public.user_service_contracts to authenticated;
