-- 0010_admin_feedback.sql
--
-- The notes Patricia sends from the Feedback button in the admin area while
-- she tests the platform. One row per note: which screen, what she expected,
-- what happened, how much it matters, and where it stands. Written only by
-- POST and PATCH /api/admin/feedback through the admin client; read by the
-- /admin/feedback page through the user client, which RLS limits to admins.
--
-- Additive only: one new table, nothing that exists changes meaning.
-- Idempotent: guards on the table, the trigger and the policy.

create table if not exists public.admin_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  page_url    text check (page_url is null or char_length(page_url) <= 500),
  expected    text check (expected is null or char_length(expected) <= 2000),
  happened    text check (happened is null or char_length(happened) <= 2000),
  priority    text not null check (priority in ('blocks', 'should_change', 'nice_to_have')),
  status      text not null default 'open' check (status in ('open', 'planned', 'done', 'wont_do')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint admin_feedback_has_text check (expected is not null or happened is not null)
);

create index if not exists admin_feedback_created_idx on public.admin_feedback (created_at desc);

drop trigger if exists set_updated_at on public.admin_feedback;
create trigger set_updated_at before update on public.admin_feedback
  for each row execute function public.set_updated_at();

alter table public.admin_feedback enable row level security;

-- Admins read every note; clients read nothing (no policy for them); nobody
-- writes through PostgREST. New tables get the API roles' default grants, so
-- the write grants are revoked here the way 0006 and 0009 did.
drop policy if exists admin_feedback_select_admin on public.admin_feedback;
create policy admin_feedback_select_admin on public.admin_feedback
  for select to authenticated
  using (public.is_admin());

revoke all on public.admin_feedback from anon, authenticated;
grant select on public.admin_feedback to authenticated;
