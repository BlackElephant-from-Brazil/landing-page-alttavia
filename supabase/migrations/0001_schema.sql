-- 0001_schema.sql
--
-- The tables behind accounts, orders, payment and documents, as written in
-- docs/platform-contract.md section 4. The schema block is copied from there
-- verbatim; the triggers, the row level security and the users column grant
-- follow the "Row level security" subsection of the same document.
--
-- Applied by `npm run db:migrate` (scripts/db-migrate.mjs), which creates
-- public.schema_migrations before this file runs and records it afterwards.
-- Conventions: uuid primary keys, timestamptz, created_at / updated_at with a
-- shared set_updated_at() trigger, snake case, text with check constraints
-- instead of enums.

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Schema (contract section 4, verbatim)
-- ---------------------------------------------------------------------------

-- Profiles. auth.users is authentication only.
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index users_email_idx on public.users (lower(email));

-- Mirror new auth users and keep the email in sync.
create function public.handle_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
create trigger on_auth_user_change
  after insert or update of email on auth.users
  for each row execute function public.handle_auth_user();

-- The questions of the initial form. The wizard renders them in `position`
-- order; `kind` picks the component; `visible_when` is the rule grammar in
-- section 6; `answer_key` is the field of the Answers object they fill.
create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,            -- residence, who, has-nif, bank, passport, visa
  answer_key    text not null,                   -- residence, applicants, hasNif, bank, passport, visa
  position      integer not null,
  kind          text not null check (kind in
                  ('country','choice','per-person-yes-no','per-person-country','choice-by-household')),
  title         text not null,
  help          text,
  options       jsonb not null default '[]'::jsonb,
  extras        jsonb not null default '{}'::jsonb,
  visible_when  jsonb,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- History of answers: one row per question per submission, never updated.
create table public.user_answers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  submission_id  uuid not null,
  question_key   text not null references public.questions(key),
  answer         jsonb not null,
  created_at     timestamptz not null default now()
);
create index user_answers_user_idx on public.user_answers (user_id, created_at desc);
create index user_answers_submission_idx on public.user_answers (submission_id);

-- What Alttavia sells. `slug` matches ProductId in src/lib/apply/types.ts.
create table public.services (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique,
  name                      text not null,
  tagline                   text,
  description               text,
  price_cents               integer not null check (price_cents > 0),
  currency                  text not null default 'eur',
  includes                  jsonb not null default '[]'::jsonb,   -- string[]
  timeline                  text,
  supports_quantity         boolean not null default false,      -- nif-only can be x2
  stripe_price_id_test      text,
  stripe_price_id_live      text,
  stripe_payment_link_test  text,
  stripe_payment_link_live  text,
  position                  integer not null default 0,
  active                    boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Lifecycle of each service, in order. The first stage is always
-- awaiting_payment; payment moves the order to the second one.
create table public.service_stages (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null references public.services(id) on delete cascade,
  key          text not null,
  label        text not null,
  description  text,
  position     integer not null,
  is_terminal  boolean not null default false,
  unique (service_id, key),
  unique (service_id, position)
);

-- Documents each service needs from the client.
create table public.service_docs (
  id             uuid primary key default gen_random_uuid(),
  service_id     uuid not null references public.services(id) on delete cascade,
  key            text not null,
  label          text not null,
  note           text,
  accepted_mime  text[] not null default '{application/pdf,image/jpeg,image/png}',
  max_bytes      integer not null default 10485760,
  per_applicant  boolean not null default true,
  required       boolean not null default true,
  position       integer not null default 0,
  unique (service_id, key)
);

-- What the client gets back when the service is done (template).
create table public.service_deliverables (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.services(id) on delete cascade,
  key         text not null,
  label       text not null,
  kind        text not null check (kind in ('report','document')),
  position    integer not null default 0,
  unique (service_id, key)
);

-- One row per service a user asked for. This is the order.
create table public.user_services (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.users(id) on delete cascade,
  service_id                  uuid not null references public.services(id),
  submission_id               uuid,
  answers_snapshot            jsonb not null,          -- the Answers object at order time
  quantity                    integer not null default 1 check (quantity between 1 and 2),
  joint                       boolean not null default false,
  applicants                  integer not null default 1 check (applicants between 1 and 2),
  total_cents                 integer not null check (total_cents > 0),
  currency                    text not null default 'eur',
  stage_key                   text not null default 'awaiting_payment',
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text,
  paid_at                     timestamptz,
  completed_at                timestamptz,
  report                      text,                    -- final report, written by staff
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index user_services_user_idx on public.user_services (user_id, created_at desc);

-- Audit trail of stage changes.
create table public.user_service_events (
  id               uuid primary key default gen_random_uuid(),
  user_service_id  uuid not null references public.user_services(id) on delete cascade,
  from_stage       text,
  to_stage         text not null,
  note             text,
  actor_id         uuid references public.users(id),
  created_at       timestamptz not null default now()
);

-- Files the client uploaded. One row per upload attempt; status tells the rest.
create table public.user_documents (
  id                uuid primary key default gen_random_uuid(),
  user_service_id   uuid not null references public.user_services(id) on delete cascade,
  service_doc_id    uuid not null references public.service_docs(id),
  applicant_index   integer not null default 0 check (applicant_index in (0, 1)),
  storage_key       text not null unique,
  file_name         text not null,
  mime_type         text not null,
  size_bytes        integer not null check (size_bytes > 0),
  status            text not null default 'pending'
                    check (status in ('pending','uploaded','approved','rejected')),
  rejection_reason  text,
  uploaded_at       timestamptz,
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index user_documents_order_idx on public.user_documents (user_service_id);

-- Files and reports returned to the client.
create table public.user_service_deliverables (
  id                      uuid primary key default gen_random_uuid(),
  user_service_id         uuid not null references public.user_services(id) on delete cascade,
  service_deliverable_id  uuid references public.service_deliverables(id),
  label                   text not null,
  storage_key             text,
  created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers, one per table that has the column
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.questions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_services
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security (contract section 4, "Row level security")
--
-- Every table has RLS on. Only the policies below exist: users read their own
-- rows, everyone reads the catalogue, and nothing else. Inserts and updates
-- on the order tables happen through the admin client (secret key), which
-- bypasses RLS, after a route handler has checked the session.
-- ---------------------------------------------------------------------------

alter table public.users                     enable row level security;
alter table public.questions                 enable row level security;
alter table public.user_answers              enable row level security;
alter table public.services                  enable row level security;
alter table public.service_stages            enable row level security;
alter table public.service_docs              enable row level security;
alter table public.service_deliverables      enable row level security;
alter table public.user_services             enable row level security;
alter table public.user_service_events       enable row level security;
alter table public.user_documents            enable row level security;
alter table public.user_service_deliverables enable row level security;

-- users: select own, update own. The column grant below keeps the update to
-- full_name and phone, so the email cannot be edited from the browser.
create policy users_select_own on public.users
  for select to authenticated
  using (id = auth.uid());
create policy users_update_own on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
revoke update on public.users from authenticated;
grant update (full_name, phone) on public.users to authenticated;

-- Catalogue: readable by anyone, active rows only where the column exists.
create policy questions_select_active on public.questions
  for select to anon, authenticated
  using (active);
create policy services_select_active on public.services
  for select to anon, authenticated
  using (active);
create policy service_stages_select on public.service_stages
  for select to anon, authenticated
  using (true);
create policy service_docs_select on public.service_docs
  for select to anon, authenticated
  using (true);
create policy service_deliverables_select on public.service_deliverables
  for select to anon, authenticated
  using (true);

-- Orders and their history: select own.
create policy user_answers_select_own on public.user_answers
  for select to authenticated
  using (user_id = auth.uid());
create policy user_services_select_own on public.user_services
  for select to authenticated
  using (user_id = auth.uid());

-- Child tables: select where the order is own.
create policy user_service_events_select_own on public.user_service_events
  for select to authenticated
  using (exists (
    select 1 from public.user_services s
    where s.id = user_service_id and s.user_id = auth.uid()
  ));
create policy user_documents_select_own on public.user_documents
  for select to authenticated
  using (exists (
    select 1 from public.user_services s
    where s.id = user_service_id and s.user_id = auth.uid()
  ));
create policy user_service_deliverables_select_own on public.user_service_deliverables
  for select to authenticated
  using (exists (
    select 1 from public.user_services s
    where s.id = user_service_id and s.user_id = auth.uid()
  ));
