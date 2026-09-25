-- 0017_couple_contract.sql
--
-- One service agreement for the Couple package (Patrícia's answer of
-- 2026-09-24: one contract naming both people). 0009 left the couple service
-- without a model because the firm had none for two parties; the model now
-- exists as the template `couple`, which src/lib/contracts/ensure.ts prepares
-- only once applicant 0 and applicant 1 both have their details on the order.
--
--   1. services.contract_template accepts 'couple'. 0009 declared the check
--      inline on the column, so Postgres named it; every single column check
--      on that column is dropped by what the catalogue says, whatever its
--      name, and one named check is added back with the four models.
--   2. user_service_contracts.template accepts 'couple' the same way: the
--      row ensure.ts inserts for a couple order carries it, and 0009's check
--      would refuse that insert.
--   3. The couple service (slug 'couple') uses the model.
--
-- No row level security or grant change. Orders and agreements that exist
-- keep their values: every model 0009 allowed is still allowed.
--
-- Idempotent: the checks are dropped before they are added again, and the
-- update writes the same value on a second run.

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.conrelid = 'public.services'::regclass
      and con.contype = 'c'
      and array_length(con.conkey, 1) = 1
      and att.attname = 'contract_template'
  loop
    execute format('alter table public.services drop constraint %I', c.conname);
  end loop;

  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.conrelid = 'public.user_service_contracts'::regclass
      and con.contype = 'c'
      and array_length(con.conkey, 1) = 1
      and att.attname = 'template'
  loop
    execute format('alter table public.user_service_contracts drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.services
  add constraint services_contract_template_check
  check (contract_template in ('nif', 'bank', 'package', 'couple'));

alter table public.user_service_contracts
  add constraint user_service_contracts_template_check
  check (template in ('nif', 'bank', 'package', 'couple'));

update public.services
  set contract_template = 'couple'
  where slug = 'couple' and contract_template is distinct from 'couple';
