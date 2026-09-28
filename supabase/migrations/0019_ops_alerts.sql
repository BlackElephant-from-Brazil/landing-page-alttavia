-- 0019_ops_alerts.sql
--
-- The throttle behind the operations alerts (src/lib/ops/alerts.ts and
-- src/lib/ops/throttle.ts): the emails about a server error or a refused
-- Stripe webhook. Netlify runs the site as many short lived instances, so
-- the rule "one email per alert every 30 minutes (6 hours for the webhook
-- refusals anyone can set off), at most 20 an hour and 30 a day" has to
-- live here, where every instance sees it.
--
-- One row per alert key, `<environment>:<kind>:<key>` (for instance
-- `production:server_error:route:/api/checkout`), plus the slots of each
-- environment's caps: `cap:<environment>:00` to `:19` for the hour and
-- `day:<environment>:00` to `:29` for the day.
-- `last_sent_at` is when the key last claimed an email; `suppressed` counts
-- the occurrences held since, which the next email reports and resets. A
-- claim is one conditional insert or update, so of two instances only one
-- wins. No personal data: keys are route paths and fixed names.
--
-- Written and read only by the server through the admin client (secret
-- key). Row level security is on with no policy, and the API roles lose the
-- default grants, so neither a visitor nor a signed in client or admin can
-- read or write it through PostgREST.
--
-- Additive only: one new table, nothing that exists changes meaning.
-- Idempotent: guards on the table; the rest can run twice.
--
-- Apply it before the code that uses it is deployed, staging included.
-- Without it, a server error or a payment that could not be recorded is
-- throttled only in each instance's memory (a burst that starts many
-- instances sends one email per instance), and the webhook's signature and
-- secret refusals, which anyone can set off, are logged and never emailed.

create table if not exists public.ops_alerts (
  key           text primary key,
  last_sent_at  timestamptz not null,
  suppressed    integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.ops_alerts enable row level security;

revoke all on public.ops_alerts from anon, authenticated;
