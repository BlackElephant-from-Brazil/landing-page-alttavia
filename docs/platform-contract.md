# Platform contract: accounts, orders, payment, documents

Written 2026-09-11. This is the agreement every part of the checkout platform
is built against. Change it here first, then in code.

Read before writing any code:

- `AGENTS.md` and `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`,
  `.../16-proxy.md`, `.../03-api-reference/04-functions/cookies.md`. This is
  Next.js 16: `proxy.ts` replaces middleware, `cookies()`, `params` and
  `searchParams` are Promises.
- `src/content/bank-nif.ts` header: the seven house rules for copy. They apply
  to every string on the dashboard, in emails and in error messages. No dashes
  as punctuation, never "run by lawyers", no "problem" or "trap", no money
  back or "free", no VAT next to prices, no video call, keep it short.
- `src/lib/apply/recommend.ts`, `steps.ts`, `types.ts`: the decision engine
  and the answer shape. They stay the source of truth for what is sold.

## 1. What is being built

1. After the result screen of `/en/apply`, the visitor creates an account
   with an email and a 6 digit code (two screens), then lands on
   `/en/dashboard`.
2. The dashboard shows the chosen service, a summary of the answers and a
   Pay button that opens Stripe's hosted checkout. After payment it shows the
   confirmation and one upload slot per required document.
3. Data lives in Supabase (Postgres + Auth). Files live in Cloudflare R2
   (private bucket, EU jurisdiction, presigned uploads from the browser).
4. Questions, services, required documents and each service's lifecycle come
   from the database, seeded from what the code has today, with the code's
   copies kept as fallbacks so the site still works if the database is
   unreachable.

## 2. Decisions already taken

- **Stripe Checkout Sessions, created server side**, replace the hosted
  Payment Links for the buy button. Same Stripe page for the buyer. Reasons:
  the session carries `client_reference_id = user_services.id`, locks the
  buyer's email to the account and lets `success_url` point at localhost in
  test mode. `line_items` is one price at `quantity: 1`: every service sells
  one unit per purchase (0007), so a second NIF is a second purchase. The
  Payment Link URLs stay in `services` as a fallback for a mode that has no
  price id yet (live has none until `stripe:setup --live`).
- **One unit per purchase** (2026-09-14, `0007_one_unit_poa.sql`,
  `docs/documents-contract.md` section 1). `services.supports_quantity` and
  `user_services.quantity` are gone; `total_cents = price_cents`;
  `applicants` is 2 only for the couple package (`applicantsFor(order)` is
  `order.joint ? 2 : 1`). In `recommend()` the row two adults / nobody has a
  NIF / no account yields `nif-only` for one person with the `secondNif`
  note ("One NIF per purchase. Your partner's NIF is a second purchase from
  your dashboard, right after checkout."); the same rule applies when the
  bank is refused for a non EEA couple without a visa (`bankUnlikely` +
  `secondNif`). Nothing says "x2" any more.
- **No pendencies or notes** (2026-09-14). `user_service_notes`, its routes,
  its email and its panels were removed; `user_service_events.note` and
  `user_services.report` stay.
- **Service agreement after payment** (2026-09-21,
  `0009_service_contracts.sql`, `docs/agreement-contract.md`). A service
  names one of the firm's three contract models in
  `services.contract_template` (`nif`, `bank`, `package`; null for none, as
  the couple package has today). On a paid order the client confirms their
  details, the server generates the PDF once, stores it in R2, records it in
  `user_service_contracts` and emails it. Nothing on the payment path
  (`markOrderPaid`, `confirmCheckoutSession`, the webhook) calls the
  contract module: a contract hook must not be able to turn a payment into
  a 500. In client facing copy the feature is the "service agreement".
- **Auth is Supabase email OTP**, 6 digits, 10 minutes, sent through Resend
  SMTP from `Alttavia Relocation <hello@send.alttavia-relocation.com>`. Both
  Supabase templates (Confirm signup and Magic Link) already contain
  `{{ .Token }}`; `signInWithOtp` picks one depending on whether the user
  exists. Already configured and tested end to end on 2026-09-11.
- **Supabase keys**: the new style `sb_publishable_` (browser, in
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and `sb_secret_` (server only, in
  `SUPABASE_SECRET_KEY`). Never import the admin client from a client
  component.
- **Rows that carry money or status are written only by the server with the
  secret key** after the server has verified the user and computed the
  values. Users can `select` their own rows through RLS and nothing else.
- **`public.users`** is the profile table (the user asked for this name).
  `auth.users` is authentication only. A trigger mirrors new auth users.
- Dashboard sidebar has two entries: Dashboard and Orders. Orders is a
  placeholder page ("under construction") for now.
- Locale: everything under `/en/...`; other locales redirect to `/en` like the
  existing pages do.

## 3. Environment variables

Already present in `.env.local` (gitignored) and to be documented in
`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://dgdbrnvgrpixsslgvmns.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...            # server only
SUPABASE_ACCESS_TOKEN=sbp_...                # scripts and the MCP server only
STRIPE_SECRET_KEY=sk_test_...                # mode is detected from the prefix
STRIPE_WEBHOOK_SECRET=                       # empty locally (no Stripe CLI)
STRIPE_PRICE_NIF_ONLY / _BUNDLE / _BANK_ONLY / _COUPLE   # test mode price ids
S3_ENDPOINT / S3_REGION=auto / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
EMAIL_API_KEY / EMAIL_FROM / EMAIL_REPLY_TO  # Resend, for app emails later
NEXT_PUBLIC_SITE_URL=                        # empty locally: use request origin
```

`scripts/stripe-setup.mjs` shows how scripts read `.env.local` (a small
parser, CRLF safe). Reuse that pattern; never add `dotenv`.

## 4. Database schema

Files: `supabase/migrations/0001_schema.sql`, `0002_seed_services.sql`,
`0003_seed_questions.sql`. Applied by `npm run db:migrate`
(`scripts/db-migrate.mjs`), which posts each file to the Supabase Management
API `POST /v1/projects/{ref}/database/query` with the access token and records
it in `public.schema_migrations(name text primary key, applied_at timestamptz)`.
Idempotent: skips files already recorded. Project ref
`dgdbrnvgrpixsslgvmns`.

Conventions: `uuid` primary keys with `gen_random_uuid()`, `timestamptz`,
`created_at` / `updated_at` with a shared `set_updated_at()` trigger, snake
case, `text` with `check` constraints instead of enums (easier to extend).

```sql
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
  -- supports_quantity was here until 0007: one unit per purchase, no flag.
  -- 0009: the firm's contract model the service uses; null for a service
  -- with no contract (nothing is generated, nothing is asked).
  contract_template         text check (contract_template in ('nif','bank','package')),
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
  -- 0007: the deed this slot generates for the client to sign; null for an
  -- ordinary upload. A deed slot is still an upload slot for the signed copy.
  template       text check (template in ('poa_nif','poa_bank')),
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

-- One row per service a user asked for. This is the order. One unit per
-- purchase (0007 dropped `quantity`): `applicants` is 2 only for the couple
-- package, `total_cents = price_cents`.
create table public.user_services (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.users(id) on delete cascade,
  service_id                  uuid not null references public.services(id),
  submission_id               uuid,
  answers_snapshot            jsonb not null,          -- the Answers object at order time
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

-- 0007. The principal's details a power of attorney is filled with, one row
-- per order and applicant. Written only through PUT /api/orders/[id]/applicants/[index].
create table public.user_service_applicants (
  id                   uuid primary key default gen_random_uuid(),
  user_service_id      uuid not null references public.user_services(id) on delete cascade,
  applicant_index      integer not null check (applicant_index in (0, 1)),
  full_name            text not null check (length(full_name) between 2 and 200),
  gender               text not null check (gender in ('f','m')),
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

-- 0009. The service agreement of an order, one row per order at most.
-- Written only by src/lib/contracts/ensure.ts through the admin client.
create table public.user_service_contracts (
  id               uuid primary key default gen_random_uuid(),
  user_service_id  uuid not null unique references public.user_services(id) on delete cascade,
  template         text not null check (template in ('nif','bank','package')),
  version          integer not null default 1 check (version >= 1),
  storage_key      text not null unique,        -- contracts/{orderId}/v{version}.pdf
  file_name        text not null,               -- service-agreement-<template>-<name>.pdf
  size_bytes       integer not null check (size_bytes > 0),
  variables        jsonb not null,              -- token -> value, exactly what was printed
  generated_at     timestamptz not null default now(),
  emailed_at       timestamptz,                 -- null until the sender accepted the email
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
```

Also `create table public.schema_migrations (name text primary key, applied_at timestamptz not null default now());`
in the migrate script itself, before anything else (with RLS enabled and no policies).

Amended by `0004_hardening.sql` after the 2026-09-11 review: `user_services.user_id`
and `user_answers.user_id` reference `public.users(id)` **on delete restrict**
(deleting an account that has orders must fail loudly; anonymise the profile
instead), `user_services (service_id, stage_key)` is a foreign key into
`service_stages`, a partial unique index keeps one live document per slot
(`status in ('uploaded','approved')`). Seed migrations (`*_seed_*.sql`) run
**once** like every other file; `npm run db:migrate -- --seed` re-runs them,
which overwrites whatever the admin service editor changed, so use it only on
a fresh project. Since 2026-09-11 the services table is the source of truth
for services (edited at `/admin/services`); the four application form slugs
keep slug and price locked, because `recommend()` and the landing page price
them from code. `0006_admin_hardening.sql` revokes every write grant from
`anon` and `authenticated` (only `update (full_name, phone)` on `users`
remains), so RLS is no longer the only thing between a client and a write.
`0007_one_unit_poa.sql` (2026-09-14) drops `services.supports_quantity`,
`user_services.quantity` and `user_service_notes`, recreates the
`admin_order_summary` view without `quantity` and `open_pendencies`, adds
`service_docs.template` and `user_service_applicants`, re-aligns the bundle
and couple stages, documents and deliverables with NIF only and Bank Account
only, and appends a deed slot to every service (section "Seeds" below).
`0009_service_contracts.sql` (2026-09-21, `docs/agreement-contract.md`
section 4) is additive: the nullable `services.contract_template`, set to
`nif` on `nif-only`, `bank` on `bank-only` and `package` on `bundle`
(`couple` stays null, the firm has no model for two parties), and the table
`user_service_contracts` with its `set_updated_at` trigger, RLS and the
write grants revoked as in 0006. The migrations run from `0001` to `0009`.

### Row level security

Enable RLS on every table above. Policies, and nothing beyond them:

| table | anon | authenticated |
|---|---|---|
| users | none | `select` own (`id = auth.uid()`); `update` own, but `revoke update on public.users from authenticated; grant update (full_name, phone) on public.users to authenticated;` so email cannot be edited |
| questions, services, service_stages, service_docs, service_deliverables | `select` where `active` (for the two tables that have it) | same |
| user_answers | none | `select` own |
| user_services | none | `select` own |
| user_service_events | none | `select` where the order is own |
| user_documents | none | `select` where the order is own |
| user_service_deliverables | none | `select` where the order is own |
| user_service_applicants (0007) | none | `select` where the order is own; admins `select` all through `public.is_admin()`; all write grants revoked, so nothing is written through PostgREST |
| user_service_contracts (0009) | none (every grant revoked) | `select` where the order is own (`user_service_contracts_select_own`); admins `select` all through `public.is_admin()` (`user_service_contracts_select_admin`); only `select` is granted, so nothing is written through PostgREST |

All inserts and updates on `user_answers`, `user_services`, `user_documents`,
`user_service_events`, `user_service_applicants`, `user_service_contracts` happen through the admin client in route handlers,
after the handler has checked the session. "Own" for child tables is
`exists (select 1 from public.user_services s where s.id = user_service_id and s.user_id = auth.uid())`.

### Seeds

`0002_seed_services.sql` (foundation agent): four services from
`src/content/apply.ts` (`PRODUCTS`) and `src/content/bank-nif.ts`
(`PRICE_CENTS`, pricing card features, `TIMES`). Test price ids from
`.env.local` `STRIPE_PRICE_*` (they are identifiers, not secrets). Live payment links from `LIVE_CHECKOUT_LINKS` in
`bank-nif.ts`; test payment links from `.env.local` `NEXT_PUBLIC_CHECKOUT_*`.
Live price ids stay null.

Stages:

| service | stages in order |
|---|---|
| nif-only | awaiting_payment, documents, awaiting_financas, nif_ready (terminal) |
| bank-only | awaiting_payment, documents, awaiting_bank, account_open (terminal) |
| bundle, couple | awaiting_payment, documents, awaiting_financas, nif_ready, awaiting_bank, account_open (terminal) |

Labels in English, short: "Awaiting payment", "Documents", "With Finanças",
"NIF ready", "With the bank", "Account open".

Documents from `src/lib/apply/documents.ts` (`NIF_DOCUMENTS`,
`BANK_DOCUMENTS`, `EMPLOYMENT_DOCUMENTS`), mapped per service:

| service | docs (key) |
|---|---|
| nif-only | passport, proof_of_address |
| bank-only | passport, nif_document, origin_tax_number, proof_of_address, bank_statements, employment_proof |
| bundle, couple | passport, proof_of_address, origin_tax_number, bank_statements, employment_proof |

`employment_proof` note should say the two accepted forms (employer statement
or payslip; for self employed the commercial register excerpt, validated tax
return and proof of services). Keep `note` under 200 characters each.

Deliverables: nif-only → `nif_certificate` (document), `summary` (report);
bank-only → `account_confirmation` (document), `summary` (report);
bundle/couple → all three.

The tables above are the 2026-09-11 seed, kept as history. The live rows
have moved on: Patrícia reshaped NIF only and Bank Account only in
`/admin/services`, and `0007_one_unit_poa.sql` (2026-09-14) brought bundle
and couple in line with them: eight stages (awaiting_payment, documents,
awaiting_financas relabelled "Submitted", nif_ready, financas_access_ready,
awaiting_bank, issued_documents_delivery, account_open terminal; no stage in
use was deleted), NIF only's notes on the passport and proof of address
slots, three deliverables (`nif_certificate`, `financas_access`,
`account_confirmation`; the `summary` report template is deleted unless a
live deliverable still points at it). The same migration appends the deed
slots at the end of every document list, `per_applicant`, `required`,
default mime list and size: `poa_nif` "Power of attorney for the NIF" on
nif-only, bundle and couple; `poa_bank` "Power of attorney for the bank
account" on bank-only, bundle and couple. Current counts per service are in
`docs/admin-contract.md` section 7. `npm run db:migrate -- --seed` would put
the 2026-09-11 rows back, so never run it against the live project.

`0003_seed_questions.sql` (wizard agent): the six questions, generated from
`SEED_QUESTIONS` in `src/lib/apply/questions.ts` by
`scripts/generate-questions-seed.mjs` so the two cannot drift.

## 5. Files and ownership

Stage 1, foundation (one agent, must finish first):

```
supabase/migrations/0001_schema.sql, 0002_seed_services.sql
scripts/db-migrate.mjs                      npm run db:migrate
src/lib/db/types.ts                         Row types for every table (hand written, snake_case fields)
src/lib/db/queries.ts                       see section 7
src/lib/supabase/client.ts                  createBrowserClient (publishable key)
src/lib/supabase/server.ts                  createServerClient bound to cookies() for RSC and route handlers
src/lib/supabase/admin.ts                   createClient with SUPABASE_SECRET_KEY, `import "server-only"`
src/lib/supabase/user.ts                    getUser(): Promise<{ id, email } | null> for server code
src/proxy.ts                                refresh the session cookie on every request; redirect
                                            unauthenticated /en/dashboard* to /en/login?next=<path>
src/lib/apply/summary.ts                    summarizeAnswers(answers, questions) -> { label, value }[]
.env.example                                document the new variables (values empty)
package.json                                "db:migrate" script
```

Stage 2 (three agents in parallel, disjoint files):

```
stripe agent
  src/lib/stripe/client.ts                  new Stripe(STRIPE_SECRET_KEY); isLiveMode()
  src/lib/stripe/checkout.ts                createCheckoutForOrder(userServiceId, userId, origin) -> { url }
  src/lib/stripe/confirm.ts                 confirmCheckoutSession(sessionId, userId) -> ConfirmResult
  src/lib/orders/mark-paid.ts               markOrderPaid(userServiceId, { sessionId, paymentIntentId, amountCents, currency }) idempotent
  src/app/api/checkout/route.ts             POST { userServiceId } -> { url }
  src/app/api/stripe/webhook/route.ts       POST, signature verified, checkout.session.completed -> markOrderPaid
  src/components/dashboard/pay-button.tsx   client: POST /api/checkout then window.location.assign(url)

upload agent
  src/lib/r2/client.ts                      S3Client for R2 (server-only)
  src/lib/r2/keys.ts                        buildStorageKey(order, docKey, applicantIndex, ext); extensionFor(mime)
  src/app/api/documents/upload-url/route.ts POST -> { documentId, url }
  src/app/api/documents/confirm/route.ts    POST { documentId } -> { document }
  src/app/api/documents/[id]/route.ts       GET -> presigned download of own document (302)
  src/components/dashboard/documents/document-slot.tsx      client: one slot (file input, progress, status pill)
  src/components/dashboard/documents/document-list.tsx      server: builds slots from service_docs x applicants and user_documents

auth ui agent
  src/components/auth/email-step.tsx        client: email form, calls supabase.auth.signInWithOtp
  src/components/auth/code-step.tsx         client: 6 digit input, verifyOtp, resend with 60 s cooldown,
                                            the spam folder hint, error copy
  src/components/auth/sign-out-button.tsx   client: POST /api/auth/signout
  src/app/api/auth/signout/route.ts         POST -> supabase.auth.signOut(), redirect /en
  src/app/[locale]/login/page.tsx           standalone email -> code -> redirect ?next or /en/dashboard
```

Stage 3 (two agents in parallel):

```
wizard agent
  src/lib/apply/questions.ts                QuestionRow seed (SEED_QUESTIONS), buildSteps(rows), evaluateRule()
  src/lib/apply/steps.ts                    keep every export; STEPS = buildSteps(SEED_QUESTIONS)
  src/lib/apply/questions.test.ts           rule evaluator + equivalence with the old hardcoded steps
  scripts/generate-questions-seed.mjs       writes supabase/migrations/0003_seed_questions.sql
  supabase/migrations/0003_seed_questions.sql
  src/app/api/apply/submit/route.ts         POST { answers, product? } -> { userServiceId } (section 8)
  src/app/[locale]/apply/page.tsx           fetch questions + services server side, fallback to seeds
  src/components/apply/**                   consume question rows and service rows; add email/code stages
                                            after the result using the auth components; price every
                                            alternative as one unit (section 8)
  src/content/apply.ts                      keep as fallback copy; remove nothing that tests import

dashboard agent
  src/app/[locale]/dashboard/layout.tsx     auth guard + shell (sidebar: Dashboard, Orders; sign out)
  src/app/[locale]/dashboard/page.tsx       section 9
  src/app/[locale]/dashboard/orders/page.tsx  "Under construction" placeholder
  src/components/dashboard/*.tsx            sidebar, order card, stage timeline, answers summary,
                                            confirmation banner (everything except documents/ and pay-button)
```

Documents round (2026-09-14, `docs/documents-contract.md`):

```
supabase/migrations/0007_one_unit_poa.sql   one unit, no notes, deeds, bundle and couple re-aligned
src/content/power-of-attorney.ts            the two deeds transcribed from docs/power of attorney/*.docx;
                                            ATTORNEY, PrincipalDetails, SigningDate, PoaBlock, formatDeedDate,
                                            signingDateFor, buildPowerOfAttorney(kind, principal?, signedOn?)
src/lib/poa/generate.ts                     generatePowerOfAttorney(kind, principal?, signedOn?) -> PDF bytes
src/lib/dates/lisbon.ts                     lisbonCalendarDate(date), lisbonIsoDate(date?) in Europe/Lisbon
src/lib/orders/applicants.ts                validateApplicantInput, findOrder, findApplicant, upsertApplicant,
                                            findPrefill, toPrincipal, poaFileName
src/app/api/orders/[id]/applicants/[index]/route.ts   GET, PUT (section 8)
src/app/api/orders/[id]/poa/[docId]/route.ts          GET (section 8)
src/components/dashboard/documents/applicant-details-form.tsx   the nine field dialog (section 10)
```

Agreement round (2026-09-21, `docs/agreement-contract.md`):

```
supabase/migrations/0009_service_contracts.sql   services.contract_template, user_service_contracts
docs/terms/*.docx                           the firm's four models (NIF, bank account, package, Annex I)
scripts/generate-contracts.mjs              npm run contracts:generate (-- --check exits 1 when stale,
                                            -- --stdout prints): reads the .docx files, no dependency
src/content/contracts/models.generated.ts   GENERATED, never edited by hand: CONTRACT_MODELS (nif, bank,
                                            package, annex), CONTRACT_MODEL_FILES, ContractBlock
src/content/contracts/variables.ts          FIRM_CONSTANTS, KNOWN_TOKENS, buildContractValues,
                                            contractServiceLabel, contractFileName, ContractValues
src/lib/pdf/layout.ts                       A4 page cursor, word wrap, hanging indents, WinAnsi folding;
                                            shared by src/lib/poa/generate.ts and the contracts
src/lib/contracts/generate.ts               generateContractPdf(template, values, { reference? }) -> PDF bytes
src/lib/contracts/words.ts                  euroAmount(cents), euroWords(cents)
src/lib/contracts/ensure.ts                 contractState, parseSigningPlace, contractStorageKey,
                                            ensureContract, regenerateContract, ContractError
scripts/contract-preview.mjs                npm run contract:preview (-- --bank | --package, -- --filled)
src/app/api/orders/[id]/contract/route.ts   POST, GET (section 8)
src/app/api/admin/orders/[id]/contract/route.ts   POST, regenerate (docs/admin-contract.md section 6)
src/components/dashboard/contract/contract-gate.tsx   client: the card under "Payment received" (section 9)
src/components/dashboard/contract/fresh-payment.ts    isFreshPayment(paidAt, nowMs), FRESH_PAYMENT_MS = 15 min
src/components/dashboard/documents/applicant-details-form.tsx   gains purpose: "contract" (accountEmail, onPrepared)
src/components/dashboard/order-view.tsx     takes accountEmail, renders the gate by contractState
```

The same round extended, without changing what they already did:
`src/lib/r2/client.ts` (`putObject`, `getObjectBytes`, `presignDownload`
takes `disposition: "inline" | "attachment"`), `src/lib/email/send.ts`
(optional `attachments: { filename, content: Uint8Array }[]`, sent to Resend
as base64), `src/lib/email/templates.ts` (`serviceAgreement`),
`src/lib/db/queries.ts` (`getOrderContract`), `client-queries.ts`
(`OrderViewData.contract`), `admin-queries.ts` (`AdminOrderDetail.contract`),
`src/lib/orders/services-admin.ts` (`contract_template`) and
`src/lib/poa/generate.ts`, which now draws through `src/lib/pdf/layout.ts`
with the deeds' output unchanged (their page pins stay green).

Nobody edits another agent's files. Shared files that more than one stage
touches (`package.json`, `.env.example`, `CLAUDE.md`) are edited only by the
foundation agent and by the orchestrator.

## 6. Question rows and the rule grammar

```ts
export type QuestionKind =
  | "country"                 // one select of countries; answer is ISO code
  | "choice"                  // radio cards; options: { value, label, description? }[]
  | "per-person-yes-no"       // one yes/no row per applicant; answer is boolean[]
  | "per-person-country"      // one country select per applicant; answer is string[]
  | "choice-by-household";    // options: { one: Option[], two: Option[] }; answer is one value

export type Rule =
  | null
  | { all: Condition[] }
  | { any: Condition[] };
export type Condition =
  | { field: keyof Answers; op: "eq" | "neq"; value: unknown }
  | { field: keyof Answers; op: "in" | "notIn"; value: unknown[] }
  | { pred: "anyNonEeaPassport" };   // named predicates for what fields cannot express
```

`extras` per kind: `choice` may carry
`{ childrenCheckbox: { key: "childrenNifs", label, help } }` (the "who"
question); per-person kinds carry `{ personLabels: ["You", "Your partner"] }`.

`buildSteps(rows)` must reproduce today's `STEPS` exactly for the seed:
`visibleWhen` from `visible_when`, `isValid` from `kind` (country: valid
code; choice: value in options; per-person: one valid value per applicant;
choice-by-household: value in the household's options). The seed for the six
questions encodes today's rules:

| key | answer_key | kind | visible_when |
|---|---|---|---|
| residence | residence | country | null |
| who | applicants | choice (+ childrenCheckbox) | null |
| has-nif | hasNif | per-person-yes-no | `{all:[{field:"applicants",op:"neq",value:"more"}]}` |
| bank | bank | choice-by-household | same |
| passport | passport | per-person-country | `{all:[{field:"applicants",op:"neq",value:"more"},{field:"bank",op:"neq",value:"separate"}]}` |
| visa | visa | choice | `{all:[{field:"applicants",op:"neq",value:"more"},{field:"bank",op:"in",value:["yes","joint"]},{pred:"anyNonEeaPassport"}]}` |

Honest limit, to document in code: a new question added in the database will
be asked and stored, but `recommend()` only reads the six known answer keys.

## 7. Shared query helpers (`src/lib/db/queries.ts`)

All take a Supabase client as first argument so they work with the user
client (RLS) and the admin client alike.

```ts
getActiveQuestions(db): Promise<QuestionRow[]>          // position asc
getActiveServices(db): Promise<ServiceRow[]>            // position asc
getServiceBySlug(db, slug): Promise<ServiceRow | null>
getServiceStages(db, serviceId): Promise<ServiceStageRow[]>
getServiceDocs(db, serviceId): Promise<ServiceDocRow[]>
getLatestUserService(db, userId): Promise<UserServiceRow | null>
getUserService(db, id, userId): Promise<UserServiceRow | null>
getUserDocuments(db, userServiceId): Promise<UserDocumentRow[]>
getOrderContract(db, userServiceId): Promise<UserServiceContractRow | null>   // 0009, one row per order at most
getUserServiceEvents(db, userServiceId): Promise<UserServiceEventRow[]>
```

Return typed rows from `src/lib/db/types.ts`. Throw on database errors (the
callers decide whether to fall back).

## 8. Order creation and payment

`POST /api/apply/submit` (wizard agent), body `{ answers: Answers, product?: ProductId }`:

1. Require a session (`getUser()`), else 401.
2. `sanitizeAnswers` then `pruneAnswers`, run `recommend()`. If `kind === "exit"`, 422.
3. If `product` is given it must be in `rec.valid`, else 422. The order for
   that product is **one unit**: `total_cents = price_cents`, `applicants =
   applicantsFor(order)` (2 only when `joint`). Two adults without NIFs and
   no account get `nif-only` for one person with the `secondNif` note; the
   partner's NIF is a second purchase from the dashboard. (Until 2026-09-14
   this step carried a quantity of 2 for that case.)
4. Look the service up by slug. Insert `user_answers` (one row per answered
   question, one `submission_id`) and one `user_services` row
   (`awaiting_payment`, `answers_snapshot`, `joint`, `applicants`,
   `total_cents`) with the admin client. Insert a `user_service_events` row
   `(null -> awaiting_payment)`.
5. Return `{ userServiceId }`. The client then navigates to `/en/dashboard`.

`POST /api/checkout` (stripe agent), body `{ userServiceId }`:

1. Require a session; load the order with the admin client and check
   `user_id` matches and `paid_at is null`, else 403/409.
2. Mode from the key prefix. If the service has a price id for this mode:
   `stripe.checkout.sessions.create({ mode: "payment", line_items: [{ price, quantity: 1 }],
   client_reference_id: order.id, customer_email, success_url:
   `${origin}/en/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
   cancel_url: `${origin}/en/dashboard?checkout=cancelled`,
   metadata: { user_service_id, user_id, service_slug } })`, store the session
   id on the order, return `{ url: session.url }`.
   Otherwise return the payment link for this mode with
   `?client_reference_id=<order.id>&prefilled_email=<email>`.
3. `origin` comes from `NEXT_PUBLIC_SITE_URL` when set, else the request's
   origin header.

`confirmCheckoutSession(sessionId, userId)` (stripe agent): retrieve the
session, require `payment_status === "paid"`, `client_reference_id` to be an
order owned by `userId`, `amount_total === order.total_cents` and matching
currency; then `markOrderPaid`. Returns `{ ok: true, userServiceId }` or
`{ ok: false, reason }`. Never throws for a bad session.

`markOrderPaid` (stripe agent): idempotent. Sets `paid_at`, the Stripe ids,
moves `stage_key` to the second stage of the service (`service_stages`
position 2, whatever its key), writes a `user_service_events` row.

Webhook: `checkout.session.completed` → `markOrderPaid` by
`client_reference_id`, verifying amount as above. Unknown events → 200.
Missing `STRIPE_WEBHOOK_SECRET` → 503 with a clear message.

### Client routes added since

| route | body | effect |
|---|---|---|
| `POST /api/orders` | `{ serviceSlug }` | one unit of that service for the signed-in user, without the questions: `answers_snapshot = {}`, `joint` and `applicants = 2` only for `couple`, `total_cents = price_cents`, events row; a `quantity` key is ignored; returns `{ userServiceId }` |
| `GET /api/orders/[id]/applicants/[index]` | | owner or admin; `index` 0 or 1 and below `applicants`; 200 `{ applicant }`, or 404 `{ error: "No details yet.", prefill }` where `prefill` is the owner's newest row for the same index on another of their orders (null for an admin) |
| `PUT /api/orders/[id]/applicants/[index]` | the nine fields, camelCase or column names | owner only (an admin gets 403 and corrects through the client); `validateApplicantInput` (lengths and the gender set as in the SQL checks, `YYYY-MM-DD` dates, 18 or older, issue date not in the future, expiry after issue and today or later by Lisbon's calendar); upsert on `(user_service_id, applicant_index)`; 200 `{ applicant }` or 422 with the first message |
| `GET /api/orders/[id]/poa/[docId]?applicant=0\|1` | | owner or admin; `docId` must be a `service_docs` row of the order's service with a `template` (404 otherwise), `applicant` below `applicants` (422), the order paid (409 `Payment first.`), a row present (409 `details_missing`, the code the slot reacts to by opening the form). Returns `application/pdf`, `Content-Disposition: attachment; filename="power-of-attorney-nif-<name>.pdf"` (or `-bank-`), `Cache-Control: no-store`, dated today in Europe/Lisbon; nothing is stored, a new download gets a fresh date. No session redirects to `/en/login` because the URL is opened by a click |
| `POST /api/orders/[id]/contract` | optional `{ signingPlace?: string }` (no body at all is fine) | owner only, 2026-09-21; calls `ensureContract` (`src/lib/contracts/ensure.ts`), which prepares the order's service agreement once and is safe to call again. `signingPlace` is the city and country printed in Annex I: line breaks become a space, control characters are dropped, at most 120 characters (422 with a line for the form; 400 when it is not text; 413 for a body over 4 KB). 200 `{ status: "ready" }`; 409 `{ error: "details_missing" }` while applicant 0 has no row, the code the form reacts to; 409 `Payment first.`; 404 `This order has no service agreement.` when the service has no `contract_template`; 401 signed out; 403 `This order is not yours.` for a stranger's or a missing order; an admin gets 403 here (404 for a missing order) and regenerates through `POST /api/admin/orders/[id]/contract` |
| `GET /api/orders/[id]/contract` | | owner or admin; streams the stored PDF from R2 through the route (200 `application/pdf`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`), so the tab stays on our URL and a refresh keeps working. `inline` by default so the browser tab shows it, `?download=1` answers `attachment`. 404 `{ error: "No agreement yet." }` when none was prepared. It generates and sends nothing. No session redirects to `/en/login?next=/en/dashboard/orders/{id}` (to `/en/dashboard` when the id is not a UUID) because the URL is opened by a click |

`ensureContract(admin, orderId, { signingPlace?, origin? })`, in order: the
order (`off`, reason `order_not_found`); an existing row (`ready`, and when
`emailed_at` is null the stored file is read back from R2 and the email is
tried again, generating nothing); the service's template and the payment
(`off`, reasons `no_template` and `unpaid`); applicant 0's details
(`needs_details`). Only then anything is written: values from
`buildContractValues`, the PDF from `generateContractPdf`, `putObject` under
`contracts/{orderId}/v1.pdf`, then the insert. `unique (user_service_id)`
settles a race: the loser's insert fails on the duplicate key, it reads the
winner's row and sends nothing. The email (`serviceAgreement`, subject "Your
service agreement", the PDF attached, a button to
`/en/dashboard/orders/{id}`) goes to `users.email` after the row exists, and
`emailed_at` is stamped only when Resend accepted it. A failed email never
fails the call. Nothing on the payment path calls this module.

## 9. Dashboard page behaviour

`/en/dashboard` (server component, dynamic):

1. `searchParams` is a Promise. If `session_id` is present, call
   `confirmCheckoutSession`, then `redirect("/en/dashboard")` so a refresh
   does not repeat the call. If `checkout=cancelled`, show a quiet notice.
2. Load the latest order for the user with its service, stages, docs and
   uploaded documents. No order yet → a short empty state with a link to
   `/en/apply`.
3. Render, in this order: heading with the user's email; the service card
   (name, tagline, price, includes, timeline); the stage timeline (all
   stages, current one marked); **if unpaid**: the Pay button
   (`pay-button.tsx`) with "Pay {price} and start"; **if paid**: a
   confirmation banner ("Payment received") and the documents section
   (`document-list.tsx`); then the answers summary (`summarizeAnswers`).
4. The payment step description under the Pay button says the same thing the
   result screen says today: secure payment through Stripe, documents come
   right after.

Design: reuse the landing's tokens and fonts (navy, gold, paper; Spectral for
headings, Inter for body) and the existing `ui/` primitives (`Button`,
`ButtonLink`, `EyebrowSolo`). Sidebar on the left on `lg`, a top bar with the
two links on small screens. Keep it calm: this is a lawyer's client area,
not a SaaS dashboard.

### After payment: the service agreement (2026-09-21)

Design in `docs/agreement-contract.md` section 6. The flow: pay, confirm
your details, the agreement opens in a new tab, a copy arrives by email, and
it stays downloadable on the order.

1. Payment is confirmed as above and the dashboard lands on
   `?order=<paid id>`. No agreement exists yet: the payment path never
   generates one.
2. `order-view.tsx` (a server component, it takes the new `accountEmail`
   prop) renders `contract/contract-gate.tsx` under the "Payment received"
   notice when the order is paid and its service has a `contract_template`
   (`contractState` answers `needs_details`). The card reads "Your service
   agreement" with the button "Confirm my details". When the order was paid
   less than 15 minutes ago (`isFreshPayment` in
   `contract/fresh-payment.ts`, tested, tolerant of a browser clock that
   runs behind) the details dialog opens by itself, once per mount, from a
   300 ms timer so that inside the order modal it lands above the modal's
   own `<dialog>`; a later visit shows the card only. A completed order
   that never had an agreement is not asked for one.
3. The dialog is `applicant-details-form.tsx` with `purpose: "contract"`:
   the same nine fields as the deeds (prefilled from the order's row, else
   from the account's other orders), a read only line with the account
   email, the optional field "City and country you are in today" and the
   button "Confirm and open my agreement".
4. Submit opens a blank tab before any await (so no popup blocker
   interferes; not while a field is still blank), `PUT`s applicant 0,
   `POST`s `/api/orders/[id]/contract` with `{ signingPlace }`, then points
   the tab at `GET /api/orders/[id]/contract`; the gate closes the dialog,
   turns to the ready state at once and calls `router.refresh()`. On a
   failure the blank tab is closed and the route's one line shows under the
   form. A browser that still refused the tab gets the line "Your agreement
   is ready. Open it below." and the card's View button.
5. With a row (`contractState` answers `ready`) the card shows "Prepared on
   {date}." (and "A copy was sent to {email}." once `emailed_at` is set)
   with **View** (new tab, inline) and **Download** (`?download=1`). The
   order modal and the full order page both render `order-view.tsx`, so both
   carry the download button. A row wins over everything else: an agreement
   prepared before the service lost its template still shows, on a
   completed order too. Only the date and whether the email went out cross
   to the client component, never the row with its printed variables.
6. A service with no template (`couple` today, any custom service) and an
   unpaid order answer `off`: nothing is shown, nothing is asked. The deed
   slots work as before and find the details already there.

## 10. Upload rules

- Key: `orders/{userServiceId}/{docKey}/{applicantIndex}/{uuid}.{ext}`.
- Accepted types and size come from `service_docs`. Reject anything else
  server side with a 415/413 and a one line message.
- Presigned PUT expires in 5 minutes and pins `ContentType`. After the PUT the
  browser calls `confirm`, which does a `HeadObject` to verify the object
  exists and the size matches before flipping `pending` → `uploaded`.
- A slot with an `uploaded`, `approved` or `pending` document does not accept a
  new file; a `rejected` one shows the reason and accepts a replacement (new
  row, old row stays for history).
- The R2 bucket CORS still needs `PUT` from `http://localhost:3000`,
  `http://192.168.1.173:3000` and the production origin. The R2 token cannot
  set it (403); it is done in the Cloudflare dashboard. Until then, test the
  presign and confirm routes with a script, and the browser path last.

### Deed slots (2026-09-14)

A `service_docs` row with `template` set is a deed slot: the same upload
slot, with a generated document in front of it. On the documents stage the
slot card shows the label, note and status pill, then a primary button
**Download to sign** (`GET /api/orders/[id]/poa/[docId]?applicant=`), a quiet
**Edit your details** link once details exist, and the upload control
labelled **Upload the signed copy**. The client prints the PDF, signs by hand
and uploads a scan or photo into the same slot through `upload-url` and
`confirm`, unchanged. When the order has no `user_service_applicants` row for
that applicant, the download opens the details form
(`applicant-details-form.tsx`, a centred `<dialog>` like `modal.tsx`), one
column, in this order: Full name (as in the passport), The deed refers to
you as (She / He, stored `f` / `m`), Place of birth, Date of birth, Passport
number, Issuing authority, Date of issue, Expiry date, Tax residence address.
It opens prefilled from the user's newest row on another order; Save `PUT`s
the row, the page refreshes and the download starts. The couple package has
one form per applicant, the second card reads "Your partner" like the other
slots. `nextStep` in `order-status.ts` still counts a missing deed as
"Upload N documents" (the contract says "Sign and upload N document(s)" when
only deeds are missing).

## 11. Verification each agent runs before finishing

```
npm run typecheck
npm run lint
npm test
grep -rnE "—|–|\bproblem\b|\btrap\b|refund|money back|\bfree\b|video call" <your files>   # must be empty
```

If typecheck fails in a file you do not own, wait a minute and rerun; other
agents may be mid write. Report it if it persists. Never edit their files.

## 12. Terms

The purchase drawer says "By purchasing you accept the Terms"; "Terms" links
to `/en/service-terms` (`src/app/[locale]/service-terms/page.tsx`, what is
delivered and on what timeline, noindex, also in the landing footer as
"Service terms"). The firm's contract models arrived on 2026-09-21
(`docs/terms/`, three contracts and Annex I) and the post-payment contract
was built on them the same day: `docs/agreement-contract.md`, and section 9
above for the flow. The `/en/service-terms` page itself is unchanged.
