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
- **Emails when an order moves** (2026-09-21, `src/lib/orders/notify.ts`,
  section 8 "Emails about an order"). The first payment sends "Payment
  received" to the client and "New paid order" to the team inbox
  (`EMAIL_TEAM_INBOX`); the upload that fills the last required slot sends
  "Documents ready to review" to the team; a paid session for the wrong
  amount sends "Paid amount does not match the order" to the team. Best
  effort: nothing in `notify.ts` throws, so an email can never undo a
  payment or an upload, and `notify.ts` imports nothing from the contract
  code.
- **A client changes a file while the order sits on the documents stage,
  and only there** (2026-09-22, section 10 "Sending a file"). A file waiting
  for review can be replaced or removed there; an approved one cannot; once
  the order moves on every slot closes, empty and rejected ones included,
  and the admin walks the order back when a client has to send something
  again. The firm's counterpart is that the documents stage now holds the
  order until every required slot is approved
  (`docs/admin-contract.md` section 7).
- **The bank assesses each case by tax residence, not by nationality**
  (2026-09-22, Patrícia's correction). The wizard's passport help
  (`src/content/apply.ts`) and the landing FAQ "Do you work with my
  nationality?" (`src/content/bank-nif.ts`) say so; the NIF is still open to
  every nationality. Copy only: `recommend()` still reads the passport
  country against `BANK_UNSUPPORTED_NATIONALITIES` in
  `src/lib/apply/rules.ts`, which is an empty list today, so nobody is
  turned away by it.
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
- Dashboard sidebar (since 2026-09-12): Dashboard, Services and My
  purchases (`src/components/dashboard/paths.ts`). `/en/dashboard/orders`
  redirects to My purchases; `/en/dashboard/orders/[id]` stays as the full
  page the emails link to.
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
STRIPE_SECRET_KEY=sk_test_...                # mode from the prefix: sk_live_ and rk_live_ are live
STRIPE_WEBHOOK_SECRET=                       # empty locally (no Stripe CLI)
STRIPE_PRICE_NIF_ONLY / _BUNDLE / _BANK_ONLY / _COUPLE   # test mode price ids
S3_ENDPOINT / S3_REGION=auto / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
EMAIL_API_KEY / EMAIL_FROM / EMAIL_REPLY_TO  # Resend
EMAIL_TEAM_INBOX=                            # 2026-09-21: team notices, one address; locally the test inbox
FEEDBACK_TO=                                 # 2026-09-21: admin feedback notes; locally the test inbox
ADMIN_SUPPORT_EMAIL / ADMIN_SUPPORT_PASSWORD # 2026-09-21: .env.local only, written by admin:create -- --support
NEXT_PUBLIC_SITE_URL=                        # empty locally: use request origin; REQUIRED on Netlify production
```

`EMAIL_TEAM_INBOX` unset skips the team emails with one log line (the
client email still goes); `FEEDBACK_TO` unset skips the feedback email (the
note is still saved). The site never reads `ADMIN_SUPPORT_EMAIL` and
`ADMIN_SUPPORT_PASSWORD`: they are for scripts and test runs
(`docs/admin-contract.md` section 4) and are never set on Netlify.
`CONTEXT` is set by Netlify on every build and function (`production`,
`deploy-preview`, `branch-deploy`, `dev`), never by hand and never in
`.env.local`; only `production` changes behaviour, by making
`NEXT_PUBLIC_SITE_URL` required (section 13).

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
write grants revoked as in 0006. `0010_admin_feedback.sql` and
`0011_admin_password_session.sql` (2026-09-21, applied to the live project
the same day, after a `db:dump`) belong to the admin side: the
`admin_feedback` table, and an `is_admin()` that also wants a session
opened with a password (`docs/admin-contract.md` section 3).
`0012_deed_signature_note.sql` (written 2026-09-22) changes no schema at
all: it rewrites `service_docs.note` on every deed slot so it asks for the
passport signature (section 10, "Deed slots"). It is the one migration in
the folder that the live project has not run yet. The migrations run from
`0001` to `0012`.

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

Monday round (2026-09-21, commit `0a7cd67`; the admin side of it is in
`docs/admin-contract.md`):

```
src/lib/orders/notify.ts                    notifyOrderPaid, notifyDocumentsReady, completesDossier,
                                            notifyPaymentMismatch (section 8, "Emails about an order")
src/lib/email/templates.ts                  gains paymentReceived, newPaidOrder, documentsReady, paymentMismatch;
                                            the layout gains `facts` rows and `audience: "team"`
src/lib/email/send.ts                       gains isReservedAddress: a `.invalid` recipient is skipped, { ok: true }
src/lib/site-url.ts                         siteOrigin(request), siteOriginFrom(origin), configuredSiteOrigin,
                                            browsableOrigin (section 13)
src/app/error.tsx, src/app/global-error.tsx the error pages (section 13)
scripts/db-dump.mjs                         npm run db:dump (section 13, as are the four below)
scripts/db-restore.mjs                      npm run db:restore
scripts/seed-demo.mjs                       npm run demo:seed (runs under tsx)
scripts/purge-test-data.mjs                 npm run db:purge
scripts/authz-matrix.mjs                    npm run authz:matrix
docs/legal/*.md, docs/treinamento/roteiro-sessao-1.md   drafts for Patrícia (section 13)
```

The same round changed, on the client side: `src/lib/stripe/confirm.ts`
(`settleVerifiedSession` sends the payment emails, `verifyPaidSession`
answers `mismatchedOrder`), `src/lib/stripe/checkout.ts` (the price check and
`site-url.ts`), `src/lib/stripe/client.ts` (`rk_live_`),
`src/app/api/stripe/webhook/route.ts` (the mismatch email),
`src/app/api/documents/confirm/route.ts` (the documents email),
`src/app/robots.ts`, the cookie options of `src/lib/supabase/client.ts`,
`server.ts` and `src/proxy.ts`, and the login redirects of the download
routes (`site-url.ts`).

Review round (2026-09-22, from Patrícia's morning on the staging; the admin
side of it is in `docs/admin-contract.md`):

```
src/lib/documents/stage.ts                  DOCUMENTS_STAGE on its own, so the browser may read it
src/lib/documents/upload-client.ts          readFileBytes, sendBytes: the browser's half of every upload
src/lib/documents/direct-upload.ts          DIRECT_UPLOAD_MAX_BYTES, directUploadLimit, checkDirectUpload,
                                            requireDeclaredLength, contentLengthOf, the shared refusal lines
src/lib/documents/confirm.ts                loadOwnDocument, loadServiceDoc, confirmDocumentUpload,
                                            deleteOwnDocument, isOrderFile, DocumentError and its lines
src/lib/deliverables/receive.ts             openDeliverableUpload, receiveDeliverableBytes (the admin's twin)
src/app/api/documents/upload/route.ts       POST ?documentId= -> { document }, the same origin fallback
src/app/api/admin/deliverables/upload/route.ts   POST ?deliverableId= -> { deliverable }
supabase/migrations/0012_deed_signature_note.sql   the deed slots' note (section 10)
```

The same round changed: `src/app/api/documents/upload-url/route.ts` (the
stage rule and the pending takeover), `api/documents/confirm/route.ts` (down
to the shared module), `api/documents/[id]/route.ts` (gains `DELETE`),
`documents/document-slot.tsx` and `document-list.tsx` (Replace, Remove, the
stage), `admin/order/deliverable-upload.tsx` (the shared mechanism),
`src/lib/orders/notify.ts` (the documents email fires on the move to a
complete set), `src/app/[locale]/dashboard/page.tsx`,
`dashboard/in-progress-slider.tsx`, `pay-button.tsx`, `order-status.ts`,
`order-view.tsx`, `purchase-drawer.tsx` and `client-queries.ts` (section 9,
"The home page"; `dashboard/answers-summary.tsx` is deleted),
`src/lib/apply/documents.ts` (`DEED_SIGNATURE_NOTE`), `src/content/apply.ts`
and `src/content/bank-nif.ts` (section 2, the nationality lines).

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
   Since 2026-09-21, before a session is created or an open one reused,
   `stripe.prices.retrieve(priceId)` must cost what the order costs
   (`unit_amount === total_cents`, same currency); otherwise 409 "This
   service cannot be paid for right now. Write to us and we will sort it
   out." (`PRICE_MISMATCH`) and one log line naming both amounts. Both checks
   that mark an order paid compare the session with the order, so a price id
   that costs something else would take the money and leave the order
   unpaid with the Pay button still there. The Payment Link fallback is not
   checked this way.
3. The success and cancel URLs are built on `siteOrigin(request)`
   (`src/lib/site-url.ts`, section 13, since 2026-09-21):
   `NEXT_PUBLIC_SITE_URL` when set, else the origin the browser used, never
   `0.0.0.0`. On Netlify's production deploy a missing
   `NEXT_PUBLIC_SITE_URL` throws before Stripe is called, and the route
   answers 500.

`confirmCheckoutSession(sessionId, userId)` (stripe agent): retrieve the
session, require `payment_status === "paid"`, `client_reference_id` to be an
order owned by `userId`, `amount_total === order.total_cents` and matching
currency; then `markOrderPaid`. Returns `{ ok: true, userServiceId }` or
`{ ok: false, reason }`. Never throws for a bad session.

`markOrderPaid` (stripe agent): idempotent. Sets `paid_at`, the Stripe ids,
moves `stage_key` to the second stage of the service (`service_stages`
position 2, whatever its key), writes a `user_service_events` row. Answers
`changed: true` only for the call whose conditional update (`paid_at is
null`) won.

`settleVerifiedSession` in `confirm.ts` is the one funnel the dashboard
return and the webhook share. Since 2026-09-21 it also starts the payment
emails when `markOrderPaid` answers `changed: true` (below, "Emails about
an order").

Webhook: `checkout.session.completed` → `markOrderPaid` by
`client_reference_id`, verifying amount as above. Unknown events → 200.
Missing `STRIPE_WEBHOOK_SECRET` → 503 with a clear message. A paid session
that names a known order but paid another amount or currency is still
ignored with 200 (retrying would never pass), and since 2026-09-21
`verifyPaidSession` hands that order back as `mismatchedOrder` so the
webhook emails the team "Paid amount does not match the order". Only the
webhook sends it, once per Stripe event, never the dashboard return.

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

### Emails about an order (2026-09-21)

`src/lib/orders/notify.ts` sends the emails that tell people an order moved
without anyone opening `/admin`. Content in `src/lib/email/templates.ts`,
sent through `sendEmail`. The admin's own two (a rejected document, a
completed order) are in `docs/admin-contract.md` section 6, the service
agreement in section 8 above.

| email (template) | to | when | sent by |
|---|---|---|---|
| "Payment received for your {service} order" (`paymentReceived`) | the owner's `users.email` | the order is paid for the first time | `notifyOrderPaid`, from `settleVerifiedSession` |
| "New paid order: {service}, {amount}" (`newPaidOrder`) | `EMAIL_TEAM_INBOX` | the same moment | the same call |
| "Documents ready to review: {service}, {client email}" (`documentsReady`) | `EMAIL_TEAM_INBOX` | a confirmed upload fills the last required slot and the set was not complete already | `notifyDocumentsReady`, from the shared confirm step (`src/lib/documents/confirm.ts`), whichever upload route finished the file |
| "Paid amount does not match the order: {service}, {client email}" (`paymentMismatch`) | `EMAIL_TEAM_INBOX` | Stripe reports a paid session for a known order with another amount or currency | `notifyPaymentMismatch`, from the webhook only |

- **Best effort.** Nothing in `notify.ts` throws: a failed lookup, a missing
  address or a failed send is one log line, and the payment or the upload
  that triggered it stands. The caller only waits for the lookups and the
  send.
- **Once per order.** `settleVerifiedSession` calls `notifyOrderPaid` only
  when `markOrderPaid` answers `changed: true`. That flag comes from the
  conditional update, so of the two callers (dashboard return and webhook)
  exactly one sends, and a repeat sends nothing.
- **Loaded lazily.** `confirm.ts` loads `notify.ts` with
  `await import("@/lib/orders/notify")` on a first payment only, and a failed
  load is caught like a failed send. The reason is the import graph guard in
  `src/lib/contracts/state.test.ts`: the dashboard pages
  (`app/[locale]/dashboard/page.tsx`, `purchases/page.tsx`,
  `orders/[id]/page.tsx`) import `confirm.ts`, and the test fails when their
  static graph reaches anything under `@/lib/email/`, pdf-lib, the R2 client
  or the contract generator. A static import of `notify.ts` would pull the
  email sender into those pages. The test follows `import` and
  `export ... from` statements only, so the dynamic `import()` stays out of
  the graph it checks.
- **The payment path rule holds.** `notify.ts` imports nothing from
  `src/lib/contracts` or `src/content/contracts`. Whether a service has an
  agreement, which changes the second line of both payment emails ("Next,
  confirm your details for the service agreement, then upload your
  documents."), is read from the column `services.contract_template`.
- **Documents ready** counts slots as `documentCounts` does (one per
  applicant when `per_applicant`, the newest non pending row deciding); only
  an upload into a required slot can complete the set, and an optional slot
  filled later does not count. The email gives the number of files waiting
  for a review and "Applicants: 2" on a couple order. A replacement after a
  rejection completes the set again and sends again, on purpose: the set
  waits for a review again. The no-op path of `confirm` (a row already
  `uploaded`) sends nothing. Since 2026-09-22 it is the **move from an
  incomplete set to a complete one** that sends: `confirmDocumentUpload`
  answers whether this upload superseded a file that was already waiting for
  review, and when it did, nothing goes out, since the slot was filled
  before and the firm already has the set in its queue. Without that rule a
  client repeating upload, remove and upload would post the firm an email
  each time.
- **Team inbox.** `EMAIL_TEAM_INBOX` is one address. Unset, every team email
  is skipped with one warn line and the client email still goes. Locally it
  points at the test inbox so development mail never reaches the firm.
- **Layout.** Team emails use `audience: "team"`: a table of facts (service,
  amount or files to review, client email, order id), the signature
  "Alttavia Relocation client platform. Sent to the team inbox only." with
  no invitation to reply, and a button to `/admin/orders?order=<id>`. Client
  emails keep "Reply to this email if you have a question." and link to
  `/en/dashboard/orders/<id>`. Every value a person typed, email addresses
  included, is escaped.
- **Links.** `dashboardUrl(origin, path)`: `NEXT_PUBLIC_SITE_URL` when set,
  else the production site in a production build, else the request's
  origin. A production build without `NEXT_PUBLIC_SITE_URL`, such as the
  staging branch deploy (section 13), therefore links its emails to the
  production site.
- **Reserved addresses.** `sendEmail` skips any recipient on the `.invalid`
  top level domain (RFC 2606) with one info line and answers `{ ok: true }`,
  so the demo accounts on `demo.alttavia.invalid` (section 13) never hard
  bounce off the sending domain, and the admin reads as it would for a real
  client. This covers every email the platform sends; a service agreement
  prepared or regenerated for a demo order gets its `emailed_at` stamped
  although nothing left.

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
   (`document-list.tsx`). The answers summary that stood at the end of this
   list was removed on 2026-09-22 (below, "The home page").
4. The payment step description under the Pay button says the same thing the
   result screen says today: secure payment through Stripe, documents come
   right after.

Design: reuse the landing's tokens and fonts (navy, gold, paper; Spectral for
headings, Inter for body) and the existing `ui/` primitives (`Button`,
`ButtonLink`, `EyebrowSolo`). Sidebar on the left on `lg`, a top bar with the
two links on small screens. Keep it calm: this is a lawyer's client area,
not a SaaS dashboard.

### The home page (2026-09-22)

From Patrícia's review of the staging that morning: a client who has just
created an account should see one thing to do, not a table with one row in
it. `/en/dashboard` now carries the "In progress" slider and, under it,
three services to get.

- The "Your purchases" table is gone from the home. The full list stays on
  `/en/dashboard/purchases`, which the slider links to.
- The slider takes unpaid orders too (`showsInProgress` in
  `order-status.ts`; `isInProgress` keeps its old meaning, paid and running,
  because the rest of the client area and its tests read it that way). An
  unpaid card carries the "Awaiting payment" pill, "Ordered on {date}"
  instead of repeating the stage label, and a row aligned right with **See
  more** (outline) and **Pay {price}** (primary). `pay-button.tsx` takes
  `size`, `align` and `wide` for that second shape; the refusal line follows
  the alignment.
- "Add a service" is now **Get a service**, on the home page and as the
  purchase drawer's eyebrow. It is hidden while the account's only orders
  are awaiting payment (`showGetAService`): the first order is chosen before
  the account exists, and until it is paid this page asks for that payment
  and nothing else. An account with no order at all still gets the empty
  state and the service cards. Nothing is read for the cards that are not
  drawn: the document labels behind them are skipped as well.
- The heading is "Welcome." until the account has paid for something, then
  "Welcome back." (`welcomeHeading`, `WELCOME`).
- The order view no longer repeats the wizard's answers.
  `dashboard/answers-summary.tsx` is deleted, `hasAnswers` with it,
  `OrderViewData` lost its `questions` field and `getOrderViewData` stopped
  reading `getActiveQuestions`, so the client pages make one query fewer.
  `summarizeAnswers` stays, read by `getOrderDetail` alone: the client typed
  the answers, the firm reads them in the admin modal.
- The applicant details dialog puts its primary button on the right, with
  Cancel to its left (Cancel first in the markup, both aligned to that edge).

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
  Since 2026-09-21 the confirm step then calls `notifyDocumentsReady`, which
  emails the team when that upload filled the last required slot (section 8,
  "Emails about an order"); a failed email never fails the upload.
- Which slot takes a file is decided by the order's stage and by the latest
  row on the slot, rewritten 2026-09-22 (below, "Sending a file"). The rule
  it replaced: an `uploaded`, `approved` or `pending` row closed the slot on
  any stage, a `rejected` one opened it, and a `pending` row older than
  fifteen minutes opened it again.
- The R2 bucket CORS allows `PUT` from `http://localhost:3000`,
  `http://192.168.1.173:3000`, the production origin and, since 2026-09-21,
  the staging origin `https://staging--bank-and-nif-in-portugal.netlify.app`
  (section 13). The R2 token cannot set it (403); it is done in the
  Cloudflare dashboard.

### Sending a file (2026-09-22)

Patrícia's review of the staging that morning opened on an upload that
failed and could not be retried: a proof of address was picked, the browser
asked for an upload URL, the PUT to the bucket never arrived, `HeadObject`
found nothing, and every new attempt was then answered "This slot already
has a file." because the `pending` row held the slot for fifteen minutes. A
passport from the same browser had gone through seconds earlier, so the one
request was lost, not the file, the type or CORS. What came out of it is
below, and the admin's deliverable upload follows the same rules.

**The browser reads the file first.** `src/lib/documents/upload-client.ts`
is the shared mechanism for the client's slot
(`documents/document-slot.tsx`) and the admin's deliverable upload
(`admin/order/deliverable-upload.tsx`): `readFileBytes(file)` before
anything else, so a file the browser cannot read, because it was moved,
renamed or synced away since the picker listed it, fails with "We could not
read this file. Save a new copy or take a new photo, then try again." and no
row is left waiting for bytes that will never come. `sizeBytes` is then the
bytes in hand, and what goes to the bucket is a Blob of them with the signed
type, not the File object. `sendBytes` keeps XHR, the only way to move the
progress bar, and turns a refusal's own `{ error }` line into what the slot
shows.

**Same origin fallback.** When the direct PUT fails for any reason the same
bytes are posted to our own origin, which already carries the session:
`POST /api/documents/upload?documentId=` for a client,
`POST /api/admin/deliverables/upload?deliverableId=` for an admin, raw body,
the row's own type as `Content-Type`. The route writes them with `putObject`
and finishes the row itself, so the browser does not call `confirm`
afterwards (`sendBytes` answers `via: "server"`, and the slot says "Sending
through our server" while it happens). Nothing about the object comes from
the request: the key, the type and the size are the row's. The rules are
`src/lib/documents/direct-upload.ts`, which the browser imports too so both
sides refuse in the same words: `DIRECT_UPLOAD_MAX_BYTES = 4_500_000`
(a Netlify function takes about 6 MB of request payload, so anything near it
fails at the edge with nothing worth reading), 411 when the request declares
no `Content-Length` (otherwise a signed in caller's body would be pulled
into memory before anyone could measure it), 413 over the cap or over the
slot's own `max_bytes`, 415 for a type that is not the row's, 422 when the
declared length or the bytes that arrived are not the size the row promised.
The direct PUT has no such cap, so a large file still uploads the usual way.
The admin side is `src/lib/deliverables/receive.ts`
(`openDeliverableUpload`, `receiveDeliverableBytes`), which finishes through
`confirmDeliverable`, the function the ordinary confirm route calls: a file
that came this way is in every respect a file that came the other way. It
was a 526 KB image that needed it on the admin side.

**A pending row is taken over, not blocked.** `PENDING_GRACE_MS` is gone. A
new attempt on a slot whose latest row is `pending` updates that row in
place (conditional on its id, `status = 'pending'` and the key it was read
with; 409 "This slot changed a moment ago. Refresh the page and try again."
when nothing matches), keeping its key when the file type has not changed
and dropping the old object, best effort, when it has. The row is reused
rather than deleted and written again because `buildStorageKey` ends in a
fresh uuid: a new row per attempt would let one client hold any number of
presigned URLs, PUT a full sized file to each of them and leave every object
but the last with no row pointing at it, storage nobody can see and nobody
can remove.

**One module finishes an upload.** `src/lib/documents/confirm.ts` is what
both `POST /api/documents/confirm` and the fallback route call, so they
cannot drift: `loadOwnDocument` (404 for a row nothing holds, 403 for a
stranger's), then `confirmDocumentUpload`, which answers a row already
`uploaded` as it is so a retry never fails, does the `HeadObject` and the
size comparison (422 "Upload incomplete."), **drops the file this one
replaces**, flips `pending` → `uploaded` with a conditional update, and only
then tells the team. The drop comes before the flip because
`user_documents_live_slot_idx` (0004_hardening.sql) allows one `uploaded` or
`approved` row per slot: a replacement used to answer 500 and, through the
fallback route, leave its bytes in the bucket under a stale `pending` row.
The superseded row goes only while it is still `uploaded` (the delete
carries the status and answers which rows it took), so a file approved in
the meantime refuses the replacement instead of being destroyed, and its
object is removed only after its row has really gone. Refusals are
`DocumentError` with a status and one line the slot shows as it is:
`APPROVED_LOCKED` "This file was approved and cannot be changed.",
`REVIEW_LOCKED` "This file can no longer be changed.", `STAGE_CLOSED` "This
order has moved on. Write to us if you still need to send a file.",
`SLOT_FILLED` "Another file reached this slot first. Refresh the page."

**What a slot accepts, and when.** `DOCUMENTS_STAGE` (`documents`) lives in
`src/lib/documents/stage.ts` on its own, so the browser reads it without
pulling the admin client and the bucket in with it. On that stage a slot
takes a file unless its latest row is `approved`: nothing sent yet,
`pending` (taken over), `rejected` (as before), and now `uploaded` as well,
so a file still waiting for review may be replaced. On every other stage the
slot takes nothing at all, an empty or a rejected one included, and the
client is told to write to us; an order is walked **back** to the documents
stage by the admin when someone has to send a file again.
`DELETE /api/documents/[id]` takes a file back under the same rule (the
order is the caller's, paid, on the documents stage, and the row is
`uploaded` or `pending`): the row goes first, carrying the status the route
read, and the object only once it has, so an approval that landed in between
refuses the delete instead of destroying an approved file. An approved file
answers `APPROVED_LOCKED`, a rejected one "Send a new file for this document
instead.", since its slot is open anyway.

**In the slot.** On the documents stage a file waiting for review shows
**Replace file** (the same upload again, the old file dropped once the new
one is confirmed) and **Remove**, which asks "Remove this file?" in place,
with "Yes, remove" and Cancel. A deed slot keeps "Upload the signed copy"
while it waits for the signed copy, rejected or not. `document-list.tsx`
passes `orderStage` to every slot for this, and the routes check it again.

### Deed slots (2026-09-14)

A `service_docs` row with `template` set is a deed slot: the same upload
slot, with a generated document in front of it. On the documents stage the
slot card shows the label, note and status pill, then a primary button
**Download to sign** (`GET /api/orders/[id]/poa/[docId]?applicant=`), a quiet
**Edit your details** link once details exist, the line "Sign exactly as you
signed your passport." under that row (2026-09-22), and the upload control
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

The note on both deed slots was rewritten on 2026-09-22, after Patrícia
said a deed signed with another hand comes back from Finanças and from the
bank: "We prepare it with your passport details. Download it and sign by
hand, with the same signature as in your passport. Then upload a scan or a
photo of the signed pages." The client reads it from `service_docs`, so
`supabase/migrations/0012_deed_signature_note.sql` is what changes it: one
idempotent update of every row with `template in ('poa_nif', 'poa_bank')`,
whatever the service. `DEED_SIGNATURE_NOTE` in `src/lib/apply/documents.ts`
is the seed source and `documents.test.ts` pins the two to each other by
reading the migration. **Written 2026-09-22 and not applied yet**: the six
deed rows on the live project still carry 0007's older line, so run
`npm run db:migrate` before telling anyone the slot says it.

## 11. Verification each agent runs before finishing

```
npm run typecheck
npm run lint
npm test
grep -rnE "—|–|\bproblem\b|\btrap\b|refund|money back|\bfree\b|video call" <your files>   # must be empty
```

If typecheck fails in a file you do not own, wait a minute and rerun; other
agents may be mid write. Report it if it persists. Never edit their files.

Since 2026-09-21, a change to a route or to RLS also runs
`npm run authz:matrix` against a running dev server with the demo data
seeded (section 13); it exits 1 on any LEAK.

## 12. Terms

The purchase drawer says "By purchasing you accept the Terms"; "Terms" links
to `/en/service-terms` (`src/app/[locale]/service-terms/page.tsx`, what is
delivered and on what timeline, noindex, also in the landing footer as
"Service terms"). The firm's contract models arrived on 2026-09-21
(`docs/terms/`, three contracts and Annex I) and the post-payment contract
was built on them the same day: `docs/agreement-contract.md`, and section 9
above for the flow. The `/en/service-terms` page itself is unchanged;
`docs/legal/service-terms-changes.md` (2026-09-21, section 13) lists the
sentences on it that are no longer true and proposes new ones, for the firm
to approve.

## 13. Environments, hardening and operations (2026-09-21)

### Production and staging

- **Production** is the Netlify project `bank-and-nif-in-portugal` (team
  guiblackelephant), serving `bank-nif-portugal.alttavia-relocation.com`.
  **Auto publishing of production is locked since 2026-09-21**: a push
  still builds, but nothing goes live until a deploy is published by hand.
  The published deploy is `571eb64`, the landing as it was before the client
  platform (the platform starts at `738d730`).
- **Staging** is a Netlify branch deploy of the branch `staging`, at
  `https://staging--bank-and-nif-in-portugal.netlify.app`. Branch deploys
  are limited to `staging`. It shares with production the one Supabase
  project (`dgdbrnvgrpixsslgvmns`), so a service edited on staging is edited
  for the launch and every staging order is a row in the live database
  (`db:purge -- --tests` clears Stripe test mode orders); the R2 bucket,
  whose CORS lists the staging origin (section 10); and the Supabase Auth
  redirect allow list, which lists the staging origin too. Stripe runs in
  test mode there, with its own test mode webhook endpoint. The owner
  imported the environment variables into Netlify with the context "Branch
  deploys" only, so none of them reaches production. There `CONTEXT` is
  `branch-deploy`: `site-url.ts` keeps the request fallback, and email links
  go to the production site unless `NEXT_PUBLIC_SITE_URL` is set to the
  staging URL in that context (section 8, "Links").
- **Backup.** The code as it stood before the Monday round is the branch
  `backup/platform-2026-09-21` on `origin`, at `f126e38` (the agreement
  round).

### Hardening

- **Session cookies** are SameSite lax and, in a production build, Secure,
  with the same `cookieOptions` in `src/lib/supabase/client.ts`, `server.ts`
  and `src/proxy.ts` (keep the three in step, so a cookie written by one is
  never weaker than one written by another). Development stays without
  Secure: a phone on the LAN opens `http://192.168.x.y`, where a browser
  drops Secure cookies.
- **`src/lib/site-url.ts`** is the one place absolute URLs start from:
  `siteOrigin(request)` and, for a caller holding only an origin string,
  `siteOriginFrom(origin)`. `NEXT_PUBLIC_SITE_URL` wins when set (it must be
  an http or https URL; it is reduced to its origin). Without it, the origin
  the browser used: the forwarded host and protocol, then the Host header,
  then the request URL, with `0.0.0.0` and `[::]` mapped to `localhost` (a
  dev server started with `-H 0.0.0.0` sees every request on an address no
  browser can open) and a LAN host kept as it is. On Netlify's production
  deploy (`CONTEXT=production`) a missing `NEXT_PUBLIC_SITE_URL` throws at
  the moment an origin is needed instead of guessing from a header; deploy
  previews and branch deploys keep the fallback. Used by the Stripe return
  URLs (section 8) and by the login redirects of the routes opened by a
  click: `GET /api/documents/[id]`, `/api/deliverables/[id]`,
  `/api/orders/[id]/poa/[docId]` and `/api/orders/[id]/contract`. Email
  links follow their own rule, `dashboardUrl` (section 8).
- **`src/app/robots.ts`** also disallows `/admin`, `/api`, `/en/dashboard`
  and `/en/login`, next to `/pt`, `/es`, `/en/service-terms` and
  `/en/apply`. Robots only asks: the pages themselves are noindex or behind
  a session.
- **Stripe mode**: `sk_live_` and `rk_live_` (a restricted key, which
  production may hold) are live, anything else is test
  (`src/lib/stripe/client.ts`). `scripts/stripe-setup.mjs` still recognises
  `sk_live_` only.
- **Price check** at checkout, section 8.
- **Error pages.** `src/app/error.tsx`, for anything below the root layout
  (landing, wizard, client area and admin alike): the logo, "Something did
  not load.", a line with the contact email, **Try again** (`unstable_retry`
  of Next.js 16.2, `reset` as the fallback) and a link to `/en`. No message
  and no stack trace reach the screen; a server error's digest is shown
  small as a "Reference" the person can quote, matching the server log.
  `src/app/global-error.tsx` renders the same component inside its own
  `<html>` when the root layout itself fails.

### Operations scripts

All read `.env.local` with the `readEnvFile` pattern of
`scripts/stripe-setup.mjs` (an explicit environment variable wins) and
never print a secret, a key or a row.

- **`npm run db:dump`** (`scripts/db-dump.mjs`) writes one folder per run,
  named by its start time, **outside the repo**, under
  `%USERPROFILE%\alttavia-backups\` (`ALTTAVIA_BACKUP_DIR` overrides the
  parent; `.gitignore` also lists `alttavia-backups/` in case it is pointed
  inside): `manifest.json`, `tables/<table>.json` for every public table
  (discovered from PostgREST's OpenAPI description, so a new table is dumped
  without editing the script; views skipped; a fixed list when the
  description cannot be read), `auth-users.json`, and with `--with-files`
  every object of the R2 bucket. Read only. The folder holds personal data:
  keep it on this machine and delete old ones.
- **`npm run db:restore`** (`scripts/db-restore.mjs`) is a **dry run by
  default**: `-- <folder>` or `-- --latest` prints what would be written, in
  which order; `--apply` inserts only the rows the target is missing;
  `--apply --overwrite` also overwrites existing rows (rolls back everything
  changed since the dump; `users.role` is never written);
  `--replace-catalogue` deletes the target's conflicting services first, only
  when no order points at them. It never deletes a row, never restores auth
  users (the Auth admin API gives no password hashes and no way to set an
  id: a profile comes back only when an auth user with its id exists), never
  restores files or `schema_migrations` (run `db:migrate` on a new project
  first).
- **`npm run demo:seed`** (`scripts/seed-demo.mjs`, under tsx) writes four
  client accounts on the reserved domain `demo.alttavia.invalid` (ana, ben,
  carla, dora) and seven orders across the four services, each at a
  different point of its life (complete, documents under review with one
  rejection, awaiting payment, issued documents delivery, couple with two
  applicants, awaiting the bank). The agreements are real ones from the
  platform's generator; every other file is a one page placeholder under a
  key containing `/demo/`. Row ids derive from fixed names, so a rerun
  updates the same rows and resets them. Nobody can sign in as these
  accounts by email, and `sendEmail` skips `.invalid` recipients (section 8),
  so training on them sends nothing.
- **`npm run db:purge`** (`scripts/purge-test-data.mjs`) is a **dry run by
  default**; `--apply` deletes. `--demo` takes every account on
  `@demo.alttavia.invalid` with all its orders. `--tests` takes every order
  whose Stripe session starts with `cs_test_`, unpaid orders without a
  session only when their owner is a known test client (`TEST_USER_EMAILS`
  in the script) or an admin, and then those test client accounts. It holds
  back and lists anything near live data: another person's unpaid order
  without a session (a prospect paying through a Payment Link has no
  session until the webhook runs) goes only with `--i-know`; an admin
  account is never deleted; an account still named on rows that stay is
  kept. With an order go its events, documents, applicant details,
  agreement, deliverables, answers and its files under `orders/<id>/`,
  `deliverables/<id>/` and `contracts/<id>/`. Run `db:dump` first when in
  doubt.
- **`npm run authz:matrix`** (`scripts/authz-matrix.mjs`) calls every route
  under `src/app/api` (discovered from the file tree, so a new route is
  called too, with a generic probe until one is written for it) against a
  running server (`--base`, default `http://localhost:3000`) as five
  callers: anon, own (Ana on her rows), other (Ana on Ben's), admin (the
  support admin with its password) and admin-code (the same account with an
  emailed code session). Then both admin sessions go straight to PostgREST
  with the publishable key: the code session must see only its own rows.
  Needs `demo:seed`, and `ADMIN_SUPPORT_EMAIL` / `ADMIN_SUPPORT_PASSWORD`
  for the admin columns (skipped with a warning without them). Probes only
  read, stop on a check before any write, or write to the demo accounts'
  own rows. Prints a route by role table and exits 1 on any LEAK.
- Also added the same day, on the admin side: `npm run auth:config` and
  `npm run admin:create -- --support` (`docs/admin-contract.md` section 4).

### Drafts for the firm

Written 2026-09-21 from the code, for Patrícia to approve by Thursday
24 September 2026, 12:00 Lisbon time. Nothing in them is wired into a page.

- `docs/legal/privacy-proposal.md`: a privacy notice for a future
  `/en/privacy`, with **[TO CONFIRM]** on assumptions and **PROPOSAL** on
  what only the firm decides (retention periods among them). The footer's
  "Privacy" link still points at the main site's general policy.
- `docs/legal/service-terms-changes.md`: the sentences of `/en/service-terms`
  that are no longer true, the proposed text, and questions on how the page
  relates to the agreement and Annex I.
- `docs/legal/fatos-para-patricia.md`: the facts behind both, in Portuguese
  (what data, where it lives, who handles it).
- `docs/treinamento/roteiro-sessao-1.md`: the script of the first training
  session (Tuesday 22 September 2026, 09:00 to 10:30 Lisbon, recorded, on
  staging with Stripe in test mode), in Portuguese.
