-- 0004_hardening.sql
--
-- Constraints and indexes the first review asked for. Every statement is
-- idempotent, so the file can run again without harm.
--
--   a. Orders and answers outlive a deleted profile row: the two user_id
--      foreign keys go from `on delete cascade` to `on delete restrict`, so a
--      profile with money on it cannot vanish by accident.
--   b. Profiles for auth users created before the mirror trigger existed.
--   c. RLS on the migrations ledger (no policies: the API key never reads it).
--   d. One live upload per document slot: at most one row per order, document
--      and applicant may be uploaded or approved at a time.
--   e. stage_key must be a stage of the order's own service.
--   f. Events are read per order in time order.

-- a. user_id foreign keys: restrict instead of cascade.
alter table public.user_services drop constraint if exists user_services_user_id_fkey;
alter table public.user_services
  add constraint user_services_user_id_fkey
  foreign key (user_id) references public.users (id) on delete restrict;

alter table public.user_answers drop constraint if exists user_answers_user_id_fkey;
alter table public.user_answers
  add constraint user_answers_user_id_fkey
  foreign key (user_id) references public.users (id) on delete restrict;

-- b. Backfill profiles for auth users the trigger never saw.
insert into public.users (id, email)
select id, email from auth.users where email is not null
on conflict (id) do nothing;

-- c. The ledger is server side only.
alter table public.schema_migrations enable row level security;

-- d. One live document per slot.
create unique index if not exists user_documents_live_slot_idx
  on public.user_documents (user_service_id, service_doc_id, applicant_index)
  where status in ('uploaded', 'approved');

-- e. stage_key belongs to the order's service.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_services_stage_fkey'
      and conrelid = 'public.user_services'::regclass
  ) then
    alter table public.user_services
      add constraint user_services_stage_fkey
      foreign key (service_id, stage_key) references public.service_stages (service_id, key);
  end if;
end
$$;

-- f. Events per order, oldest first.
create index if not exists user_service_events_order_idx
  on public.user_service_events (user_service_id, created_at);
