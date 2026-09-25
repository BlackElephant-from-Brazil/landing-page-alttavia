-- 0014_terms_acceptance.sql
--
-- The record that the client accepted the service terms and the service
-- agreement before paying (Patrícia's answer of 2026-09-24: the client
-- accepts the terms before paying and receives a copy of the agreement).
--
--   1. user_services.terms_accepted_at: when the client clicked Pay with the
--      acceptance line under the button. Written by POST /api/checkout
--      through the admin client on every Pay click while the order is unpaid,
--      with a conditional update (`where paid_at is null`), so the record is
--      the click that paid and a paid order's record never moves.
--   2. user_services.terms_version: which wording was accepted, the value of
--      TERMS_VERSION in src/content/terms-version.ts at that moment
--      ("2026-09-25" for the first one). Bumped there whenever the service
--      terms or the agreement models change.
--   3. A check that the two are set together: a date without a version, or
--      the reverse, would be a record nobody can read back.
--
-- No row level security or grant change: the table keeps its select grant
-- for authenticated (clients read their own orders, admins read all through
-- is_admin()), and no API role has a write grant on it since 0006. Orders
-- paid before this migration keep both columns null.
--
-- Idempotent: the columns are added only when missing and the check is
-- dropped before it is added again.

alter table public.user_services
  add column if not exists terms_accepted_at timestamptz;

alter table public.user_services
  add column if not exists terms_version text;

alter table public.user_services
  drop constraint if exists user_services_terms_pair;

alter table public.user_services
  add constraint user_services_terms_pair
  check ((terms_accepted_at is null) = (terms_version is null));

comment on column public.user_services.terms_accepted_at is
  'When the client accepted the service terms and the service agreement, on the Pay click that paid. Set by POST /api/checkout on every Pay click while unpaid.';
comment on column public.user_services.terms_version is
  'TERMS_VERSION (src/content/terms-version.ts) the client accepted. Set with terms_accepted_at.';
