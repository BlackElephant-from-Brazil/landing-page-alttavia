# Admin contract: the firm's side of the platform

Written 2026-09-11, on top of `docs/platform-contract.md` (read that first; its
rules, house rules and file conventions all still apply). This document adds
the administrator role, the screens Patrícia uses to run a service from
payment to delivery, the client's order gallery, and the service editor.

## 1. What is being built

1. **Admin sign in with a password** at `/admin/login` (Supabase Auth
   `signInWithPassword`), separate from the client's email code. Only users
   with `public.users.role = 'admin'` get past `/admin/*`; a client who signs
   in there is sent to `/en/dashboard`. Since 2026-09-21 only a session
   opened with a password counts as admin (section 2), and "Forgot your
   password?" on the same page resets it with a 6 digit code (section 7).
2. **Admin area** at `/admin` (overview with KPIs, filters and charts),
   `/admin/orders` (every order, filters, search, a **centered modal** with the
   order's details and every action), `/admin/services` (create and edit
   services, their lifecycle stages, required documents and deliverables) and
   `/admin/settings` (change password). The initial questions form is **not
   editable** from the admin, by decision. `/admin/users` came on
   2026-09-12 and `/admin/feedback`, with a Feedback button on every admin
   page, on 2026-09-21 (section 7).
3. **Full service lifecycle**, both sides: review documents (approve, reject
   with a reason), move the order through its stages, upload deliverables
   and a report, close the order. The client sees rejections and re-uploads,
   sees deliverables and the report when the order is complete. (Pendencies
   and notes were part of this round and were removed on 2026-09-14,
   `docs/documents-contract.md` section 2; this file no longer describes
   them.)
4. **Client order gallery** at `/en/dashboard/orders`: the client's orders,
   plus every active service with a Buy button that creates an order
   **without the questions** and goes straight to Stripe. `/en/dashboard/orders/[id]`
   shows any of the client's orders with the same view the dashboard uses.
5. Transactional emails through Resend for the two moments a client must
   come back: a document was rejected, the order is complete (the first time
   only, since 2026-09-21). Best effort: failures are logged, never block the
   action. Since 2026-09-21 the platform also sends "Payment received" to
   the client and three notices to the team inbox (`EMAIL_TEAM_INBOX`): "New
   paid order", "Documents ready to review" and "Paid amount does not match
   the order" (`src/lib/orders/notify.ts`, `docs/platform-contract.md`
   section 8, "Emails about an order"); feedback notes go to `FEEDBACK_TO`
   (section 7).

## 2. Decisions already taken

- Roles live in **`public.users.role`** (`client` | `admin`). A `security
  definer` function `public.is_admin()` reads it for RLS. Server code checks
  the same column through `requireAdmin()`. No JWT custom claims, so a role
  change takes effect on the next request, not the next token.
- Admin powers need a session opened with a password (2026-09-21). The app
  reads the standard `amr` claim in `requireAdmin()`; since
  `0011_admin_password_session.sql` `is_admin()` asks the same of the JWT, so
  an admin account's emailed code session reads only its own rows through
  PostgREST too. `npm run authz:matrix` probes both sessions. The reason: an
  admin account is an email address like any other, and the client area
  signs people in with a code sent to it, so anyone reading the firm's inbox
  could otherwise open `/admin` from `/en/login`. A code, a recovery code or
  a magic link session of an admin account is a client session everywhere;
  the admin pages send it to `/admin/login`, which asks for the password.
- A **support admin**, `business+admin@guyshore.com` (the developer's inbox,
  never the firm's), exists for scripts and test runs, since the admin area
  takes a password session only. `npm run admin:create -- --support` sets a
  new password on every run and writes `ADMIN_SUPPORT_EMAIL` and
  `ADMIN_SUPPORT_PASSWORD` into `.env.local` only; it never prints the
  password, the site never reads the two variables, and they are never set
  on Netlify.
- Every admin write goes through a route handler under `/api/admin/*` that
  calls `requireAdmin()` first and then uses the admin client. RLS admin
  policies exist so admin **pages** can read with the user client, nothing
  more.
- Patrícia's first account: `info@alttavia-relocation.com`, created by
  `scripts/create-admin.mjs` with a generated password that is printed once
  and never stored in the repo or in `.env.local`. She changes it at
  `/admin/settings`. MFA is a follow-up item, not built now.
- The order detail on the admin side is a **modal** (`<dialog>`, centered,
  focus trapped, Esc closes) driven by the URL (`?order=<id>`) so a refresh or
  a shared link reopens it.
- Charts are inline SVG components, no charting dependency. Since 2026-09-12
  the plots are small client components (`"use client"`, the server passes
  the rows) so a hovered or focused column, marker, slice or legend row
  shows a tooltip; the geometry is pure (`charts/geometry.ts`, tested).
  Every chart has a visually hidden table with the same numbers.
- Direct purchases (gallery) store `answers_snapshot = '{}'`; the dashboard
  hides the answers section when it is empty. One unit per purchase and no
  quantity anywhere (`0007_one_unit_poa.sql`, 2026-09-14): `couple` stores
  `applicants = 2` and `joint`, everything else `applicants = 1`;
  `total_cents = price_cents`.
- Stage transitions are Patrícia's call. Advancing out of `documents` with
  unapproved required documents shows a warning in the modal and still works.
  Reaching the terminal stage sets `completed_at`; moving back clears it.
  Since 2026-09-21 a move onto the terminal stage asks for confirmation
  first, and the completion email goes out only the first time the order
  reaches that stage (section 6, the stage route).
- A deliverable sent by mistake can be removed (2026-09-21): the object in
  R2 goes first, then the row, and the client stops seeing it on the next
  load.

## 3. Database: `supabase/migrations/0005_admin.sql`

```sql
alter table public.users
  add column if not exists role text not null default 'client'
  check (role in ('client','admin'));

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Deliverables gain the columns an upload needs.
alter table public.user_service_deliverables
  add column if not exists status text not null default 'pending' check (status in ('pending','ready')),
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes integer,
  add column if not exists uploaded_by uuid references public.users(id),
  add column if not exists updated_at timestamptz not null default now();
alter table public.user_service_deliverables
  add constraint user_service_deliverables_storage_key_key unique (storage_key);

-- Admin overview indexes.
create index if not exists user_services_paid_idx on public.user_services (paid_at desc) where paid_at is not null;
create index if not exists user_services_stage_idx on public.user_services (stage_key);
create index if not exists user_services_created_idx on public.user_services (created_at desc);
create index if not exists user_documents_status_idx on public.user_documents (status) where status = 'uploaded';
```

RLS additions (append to the same file, all `create policy ... to authenticated`):

| table | new policy |
|---|---|
| users | `select` where `public.is_admin()` (admins see every profile; clients still only their own) |
| user_services, user_answers, user_service_events, user_documents, user_service_deliverables | `select` where `public.is_admin()` |
| user_service_deliverables | client `select` own where `status = 'ready'` (replace the existing own-select policy) |
| services, service_stages, service_docs, service_deliverables | `select` where `public.is_admin()` regardless of `active` (the editor needs inactive rows) |
| user_service_applicants (0007) | client `select` own through `user_services`; `select` where `public.is_admin()` |
| user_service_contracts (0009) | client `select` own through `user_services`; `select` where `public.is_admin()`; only `select` is granted to `authenticated`, nothing to `anon` |
| admin_feedback (0010) | `select` where `public.is_admin()` (`admin_feedback_select_admin`); clients read nothing; only `select` is granted to `authenticated`, nothing to `anon` |

No insert/update/delete policies for anyone: writes stay behind route handlers.

`0005_admin.sql` as written also created `user_service_notes` (pendencies);
`0007_one_unit_poa.sql` dropped it, dropped `services.supports_quantity` and
`user_services.quantity`, and recreated `admin_order_summary` without
`quantity` and `open_pendencies`. The view now carries the `user_services`
columns plus `user_email`, `service_name`, `service_slug`, `docs_required`,
`docs_approved`, `docs_uploaded`, `docs_rejected`, `last_event_at`.

`0009_service_contracts.sql` (2026-09-21, `docs/agreement-contract.md`) adds
`services.contract_template` and the table `user_service_contracts`. The
view is untouched: the order modal reads the contract row through
`getOrderDetail`.

`0010_admin_feedback.sql` (2026-09-21, additive) adds the notes sent with
the Feedback button (section 7):

```sql
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
```

with an index on `created_at desc`, the `set_updated_at` trigger, RLS, the
admin select policy above and every write grant revoked, so it is written
only by `/api/admin/feedback` through the admin client.

`0011_admin_password_session.sql` (2026-09-21) redefines `is_admin()` so the
database asks what `requireAdmin()` asks (section 2):

```sql
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin')
    and coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method":"password"}]'::jsonb;
$$;
```

Supabase writes `amr` as `[{ "method": ..., "timestamp": ... }]` and keeps
it across token refreshes; a second factor adds its own entry, so password
plus TOTP still passes. A code, magic link or recovery session, or no JWT,
answers false. `aal2` is not asked for (no MFA yet). Every `*_select_admin`
policy (0005, 0007, 0009, 0010) and the `admin_order_summary` view
(`security_invoker`) go through the function, so they all follow without
being touched; the secret key bypasses RLS and is not affected. The grants
are stated again: execute revoked from `public` and `anon`, granted to
`authenticated`. Both migrations were applied to the live project on
2026-09-21, after a `db:dump`.

The trigger that mirrors `auth.users` needs no change; `role` defaults to
`client`. `scripts/create-admin.mjs` then runs
`update public.users set role = 'admin' where email = ...` through the
Management API after `auth.admin.createUser`.

## 4. Server helpers and shared modules (stage 1)

```
src/lib/supabase/admin-user.ts   requireAdmin(): Promise<SessionUser & { role: 'admin' }>  throws AdminAuthError(401|403)
                                 getUserWithRole(): Promise<(SessionUser & { role, needsPassword }) | null>
                                 since 2026-09-21: role is "admin" only when public.users.role is admin AND the
                                 session's verified claims (getClaims(), `sub` matching) list `amr` method
                                 "password" (hasPasswordMethod); otherwise "client", with needsPassword true for
                                 an admin account; fails closed. requireAdmin() then throws 403
                                 "Sign in with your password." (PASSWORD_REQUIRED)
src/lib/db/admin-queries.ts      see section 5
src/lib/db/types.ts              add role to UserRow; extend UserServiceDeliverableRow; since 0007 PoaTemplate,
                                 ServiceDocRow.template and UserServiceApplicantRow; since 0009 ContractTemplate,
                                 ServiceRow.contract_template, UserServiceContractRow and AdminOrderDetail.contract
src/lib/email/send.ts            sendEmail({ to, subject, html, text, attachments? }) via POST https://api.resend.com/emails
                                 with EMAIL_API_KEY, from EMAIL_FROM, reply_to EMAIL_REPLY_TO; returns { ok, id? }; never
                                 throws; attachments are { filename, content: Uint8Array }[], sent as base64 (2026-09-21)
src/lib/email/templates.ts       documentRejected({ docLabel, reason, dashboardUrl }),
                                 orderCompleted({ serviceName, dashboardUrl }) and, since 2026-09-21,
                                 serviceAgreement({ serviceName, dashboardUrl }) -> { subject, html, text }; house rules; same
                                 visual language as the Supabase code email (Georgia, navy, gold eyebrow); since
                                 2026-09-21 also paymentReceived (client) and newPaidOrder, documentsReady,
                                 paymentMismatch (team inbox), docs/platform-contract.md section 8
src/lib/email/send.ts            since 2026-09-21 skips any `.invalid` recipient (isReservedAddress) and answers { ok: true }
src/lib/orders/notify.ts         2026-09-21: the payment and documents emails, docs/platform-contract.md section 8
src/lib/email/feedback.ts        2026-09-21: FEEDBACK_PRIORITIES / _STATUSES and their labels (the only copy; the client
                                 components get them as props), AdminFeedbackRow, isSitePath, sendFeedbackEmail (to
                                 FEEDBACK_TO, best effort, never throws; unset, the note is still saved)
src/lib/contracts/ensure.ts      regenerateContract(admin, orderId, { origin? }) -> { contract, emailed }; throws
                                 ContractError(404|409) with a line the admin may read (2026-09-21, section 6)
src/lib/orders/lifecycle.ts      advanceStage(orderId, actorId, { direction: 'forward'|'back' } | { stageKey })
                                 -> { stageKey, completed, firstCompletion }
                                 (uses service_stages positions, writes user_service_events, sets/clears completed_at).
                                 firstCompletion (2026-09-21) is true only when this move lands on the terminal stage
                                 and no earlier user_service_events row has that stage as `to_stage` (read before
                                 this move's own row; a review on the terminal stage writes such a row too, and
                                 counts). No column records it. Back and forward again is never a first time.
src/lib/orders/deliverables.ts   since 2026-09-21 deleteDeliverable(id): refuses a key outside
                                 `deliverables/{orderId}/`, deletes the R2 object (a missing key is not an error),
                                 then the row; answers the row for the audit line; 404 when there is none
src/lib/r2/client.ts             since 2026-09-21 deleteObject(key)
src/components/admin/order/completion.ts   completedBefore(order, stages, events): the same test for the modal
                                 (true also when completed_at is set)
src/proxy.ts                     add: unauthenticated /admin and /admin/* (except /admin/login) -> /admin/login?next=
src/app/admin/layout.tsx         server: getUserWithRole(); no user, or needsPassword (2026-09-21) -> /admin/login;
                                 role !== 'admin' -> /en/dashboard; shell with sidebar (Overview, Orders, Users,
                                 Services, Feedback, Settings), email, sign out, and the Feedback button
src/app/(admin-login)/admin/login/page.tsx   a route group, so the layout's guard does not wrap it. Email + password
                                 form (client island `components/admin/login-form.tsx`), signInWithPassword, then
                                 router.push(next) + refresh; signed-in admin visiting it -> next (default /admin);
                                 signed-in client -> /en/dashboard; an admin account in a code session stays, the
                                 form opens with "Sign in with your password." and the email filled in. Since
                                 2026-09-21 also "Forgot your password?" (section 7)
scripts/create-admin.mjs         creates the auth user (email_confirm: true) with a 20 character random password, sets the
                                 role, prints the password ONCE; refuses to run if the user already exists (prints how to
                                 reset instead: `--reset-password`; a reset on a client account also needs `--promote`).
                                 Since 2026-09-21 `--support`: the support admin business+admin@guyshore.com, a new 24
                                 character password (letters and digits) on every run, written with ADMIN_SUPPORT_EMAIL
                                 into .env.local (other lines untouched), never printed; implies --reset-password and
                                 --promote. Run it without --support in your own terminal only, never through an agent
scripts/auth-config.mjs          2026-09-21, `npm run auth:config`: dry run by default, `-- --apply` writes. Builds the
                                 Supabase recovery email (mailer_subjects_recovery, mailer_templates_recovery_content)
                                 from the project's magic link template, with `{{ .Token }}`, so the reset email carries
                                 the 6 digit code; the expiry in the copy comes from mailer_otp_exp. PATCHes those two
                                 keys only through the Management API (SUPABASE_ACCESS_TOKEN), reads the config back,
                                 prints only those two keys. A second run finds nothing to change
```

## 5. Admin queries (`src/lib/db/admin-queries.ts`)

All take the admin client. Types in `types.ts`.

```ts
type OrderFilters = { status?: 'open'|'paid'|'completed'|'all'; serviceSlug?: string; q?: string;
                      from?: string; to?: string; page?: number; pageSize?: number }
listOrders(db, filters): Promise<{ rows: AdminOrderRow[]; total: number }>
   // AdminOrderRow = UserServiceRow + { user_email, service_name, service_slug, docs_required, docs_approved,
   //                docs_uploaded, docs_rejected, last_event_at }   (the admin_order_summary view, section 3)
getOrderDetail(db, id): Promise<AdminOrderDetail | null>
   // order, user (email, full_name, phone), service, stages, docs (service_docs), documents (user_documents, all),
   // events, applicants (user_service_applicants, by applicant_index), contract (the user_service_contracts row
   // or null, since 0009), deliverables (service_deliverables + user_service_deliverables), answers summary rows
getOverview(db, range: { from: string; to: string }): Promise<Overview>
   // kpis: openOrders (created in range, unpaid), paidOrders (paid in range, any stage), inProgressOrders (paid,
   //       not complete, any date), completedOrders, revenueCents, documentsAwaitingReview
   // ordersByMonth: { month: 'YYYY-MM', paid, open, revenueCents }[]   (last 6 months, zero filled; open = created
   //       that month, still unpaid; bucketing in src/lib/db/overview-months.ts)
   // ordersByStage: { stageKey, label, count }[]
   // ordersByService: { slug, name, count, revenueCents }[]   (every active service, zero filled)
listPendingReviews(db): Promise<AdminDocumentRow[]>   // status = 'uploaded', oldest first
listUsers(db, { q, page, pageSize }): Promise<{ rows: AdminUserRow[]; total: number }>
   // every profile with orders_count, paid_count, last_order_at, sorted by last activity; q matches the email
getUserDetail(db, id): Promise<AdminUserDetail | null>
   // user, orders (admin_order_summary rows, newest first), stage labels of their services
listServicesForAdmin(db): Promise<ServiceWithConfig[]>   // includes inactive; stages, docs, deliverables nested
getServiceForAdmin(db, id): Promise<ServiceWithConfig | null>
```

## 6. Admin routes (`src/app/api/admin/**`), every one starts with `requireAdmin()`

| route | body | effect |
|---|---|---|
| `POST /api/admin/documents/[id]/review` | `{ decision: 'approve'\|'reject', reason?: string }` | status, reviewed_at, reviewed_by; reason required on reject (422 otherwise); event row; on reject email the client |
| `POST /api/admin/orders/[id]/stage` | `{ direction: 'forward'\|'back' }` or `{ stageKey }` | `advanceStage`; on terminal set completed_at. Answers `{ stageKey, completed, emailed?, warning? }`. Since 2026-09-21 the client gets the "all done" email only when `advanceStage` says `firstCompletion`; back to an earlier stage and forward again, or a later jump to the terminal stage, completes the order without a second email. `emailed` is present only when that email was due: `true` when Resend accepted it, `false` when it did not go out (lookup failed, no address, send failed; the move stands and nothing after it can turn the answer into a 500). Its absence tells the modal to say nothing about an email |
| `PATCH /api/admin/orders/[id]` | `{ report?: string }` | update report (markdown allowed, rendered with the existing RichText) |
| `POST /api/admin/orders/[id]/contract` | none | "Regenerate and resend" (2026-09-21, `docs/agreement-contract.md` sections 5 and 7). `regenerateContract` prepares the service agreement again from the client's details as they are now, as a new version under a new R2 key (`contracts/{orderId}/v{n}.pdf`; the file of the version before stays in the bucket), updates the row (`emailed_at` back to null) and emails the client again. The place printed in Annex I is carried over from the row's `variables`. The template is the service's, or the row's own when the service lost its template. An order with no agreement yet gets its first version. 200 `{ contract, emailed }`; 404 `Order not found.` or `This service has no contract.`; 409 `Payment first.`, `The client has not entered their details yet.`, or, when two regenerations race (the update names the version it replaces, so one wins), `This agreement was regenerated a moment ago. Refresh and try again.` Audit line `contract.regenerate` |
| `POST /api/admin/deliverables/upload-url` | `{ userServiceId, label, serviceDeliverableId?, fileName, mimeType, sizeBytes }` | pending row + presigned PUT (key `deliverables/{orderId}/{uuid}.{ext}`), same mime and 20 MB limit rules as documents |
| `POST /api/admin/deliverables/confirm` | `{ deliverableId }` | HeadObject, status ready |
| `GET /api/admin/deliverables/[id]` | | presigned download of a returned file, any status but pending, 120 s, as a 302 |
| `DELETE /api/admin/deliverables/[id]` | | 2026-09-21: takes back a file sent by mistake through `deleteDeliverable` (the R2 object, then the row, whatever its status); `{ deleted: true }`; 404 "This file is not on record." for an id with no row; audit line `deliverable.delete` |
| `POST /api/admin/password` | `{ currentPassword, newPassword }` | 2026-09-21, the change on `/admin/settings`. `requireAdmin()` first, so only a password session gets here. The current password is checked with a sign in on a separate client (publishable key, nothing persisted), signed out at once; the new one is then set with the admin's own cookie session, because Supabase keeps only the session that made the change, so this device stays signed in and every other one needs the new password. 200 `{ ok: true }`; 400 body not the two strings; 422 "Your current password is not right.", fewer than 12 or more than 72 characters, the same as the current one, or rejected as weak; 429 on Supabase's rate limit; 401 when the session ends before the update. Neither password is logged; audit line `password.change` |
| `POST /api/admin/feedback` | `{ pageUrl?, expected?, happened?, priority }` | 2026-09-21. Saves one `admin_feedback` row for the signed in admin: text trimmed, control characters dropped (line breaks kept in the two answers), `expected` and `happened` at most 2000 characters each and one of them required, `pageUrl` at most 500, `priority` one of `blocks`, `should_change`, `nice_to_have`. Then `sendFeedbackEmail` to `FEEDBACK_TO`, best effort. 201 `{ id }`; 400 wrong shape; 422 a value out of bounds |
| `PATCH /api/admin/feedback` | `{ id, status }` | 2026-09-21. `status` one of `open`, `planned`, `done`, `wont_do`. 200 `{ feedback: { id, status } }`; 404 "Note not found."; 422 "Choose a status." |
| `GET /api/admin/documents/[id]` | | presigned download of any document |
| `GET /api/admin/services` / `POST` | service fields + `stages[]`, `docs[]`, `deliverables[]` | create; slug unique, lower kebab |
| `PATCH /api/admin/services/[id]` | same | update; stages/docs/deliverables upserted by key; a stage removed while an order sits on it -> 409 with the count |

Client routes added:

| route | body | effect |
|---|---|---|
| `POST /api/orders` | `{ serviceSlug }` | one unit of that service for the signed-in user, `answers_snapshot = {}`, `applicants = 2` and `joint` only for `couple`, `total_cents = price_cents`, events row; a `quantity` key is ignored; returns `{ userServiceId }` |
| `GET /api/deliverables/[id]` | | presigned download of a `ready` deliverable on an own order |
| `GET`/`PUT /api/orders/[id]/applicants/[index]`, `GET /api/orders/[id]/poa/[docId]?applicant=` | | the applicant details and the generated deed (2026-09-14); admins may `GET` both; payloads in `docs/platform-contract.md` section 8 |
| `POST`/`GET /api/orders/[id]/contract` | | the service agreement (2026-09-21); the `POST` is the client's alone (an admin gets 403 "Use the order's admin page to prepare the agreement."), the `GET` is the download an admin may open too (the PDF streamed through the route, `?download=1` for `attachment`, one `contract.download` line in the server log); payloads in `docs/platform-contract.md` section 8 |

Validation and error shape as in the platform contract: JSON `{ error }`, one
line, house rules, no provider internals.

## 7. Screens

### `/admin` overview (admin-ui agent)
Range selector (`?range=week|month|3m|6m|year`, default month) and a custom
`from`/`to`. Six KPI tiles: Open orders, Paid, In progress (a queue, not
range scoped), Completed, Revenue, Documents to review. Four charts in a
two column grid: **Orders by month** (stacked columns, paid in navy, not
paid in wheat, legend under it), **Revenue by month** (gold line, euro
axis), **Orders by stage** and **Orders by service** (donuts, total in the
centre, legend with count and percent, empty items greyed out). Two tables:
**In progress** (paid, not completed: client, service, paid on, stage,
documents x/y) and **Awaiting review** (documents with status
uploaded). Row click opens the order modal (`?order=<id>`). No recent
activity list.

### `/admin/users`
Every `public.users` row (email, name, joined on, Admin pill, orders, paid,
last order), newest activity first, searched by email (`?q=`), paginated.
Row click sets `?user=<id>`, which opens the same centered modal with the
profile and the person's orders; each order links to
`/admin/orders?order=<id>`.

### `/admin/orders`
Filters (status, service, range, search by email) in the URL, paginated
table, CSV export link is out of scope. Row click opens the same modal.

### Order modal (`src/components/admin/order-modal.tsx`)
Header: client email, service, amount, paid on, current stage. Sections:
stage timeline with **Back / Forward** buttons and a jump select; documents
list with Approve / Reject (reason textarea) and a download link per file,
plus history of previous versions per slot; deliverables (list with
download, upload slot, label); report textarea with Save; events log. Every
action is a small client component posting to the routes above and calling
`router.refresh()`; the modal stays open because the URL still carries
`?order=`. Since 2026-09-14 a deed slot (a `service_docs` row with
`template`) shows **Download deed** next to the review controls (the same
`GET /api/orders/[id]/poa/[docId]?applicant=` route, admin allowed) and,
below it, a read-only block with the applicant's nine fields from
`AdminOrderDetail.applicants`, or the line "The client has not entered their
details yet." when there is no row.

Since 2026-09-21 (`order/stage-controls.tsx`, `order/completion.ts`,
`order/deliverable-remove.tsx`):

- A move onto the terminal stage (Forward from the stage before it, or a
  jump to it) asks first, inline: "This marks the order complete and emails
  the client. Continue?" with Confirm and Cancel. When `completedBefore`
  (an earlier event took the order to the terminal stage, or `completed_at`
  is set; the route's own test) it reads "This marks the order complete.
  The client was emailed the first time, so no email goes out. Continue?".
  After the move the line under the controls says "Order completed.", plus
  "The email to the client could not be sent." only when the route answers
  `emailed: false`. The modal remounts the controls on the new stage, so
  the outcome is handed to the new instance through a module level map read
  once on mount.
- Every returned file has **Remove** next to Download. It asks first,
  inline: "Remove this file? The client stops seeing it." with "Yes, remove"
  and Cancel, then `DELETE /api/admin/deliverables/[id]` and a refresh; the
  "Still to send" line picks the template up again. A failure keeps the
  question open with the route's line, so it can be pressed again.

Since 2026-09-21 the modal also carries a **Service agreement** section
(`AgreementSection` in `order-modal.tsx`, `docs/agreement-contract.md`
section 7), fed by `AdminOrderDetail.contract` and the service's
`contract_template`. The heading carries the state: "Not required" (the
service has no template), "After payment" (a template, not paid yet),
"Waiting for the client's details" (paid, a template, no row yet; the body
says so when the client already typed details for a deed) or "Prepared".
With a row it shows the model's label, "version N", the file name and size,
"Prepared {date and time}", then "Emailed {date and time}" or "Not emailed
yet" with a green or amber pill, and a **Download** link
(`GET /api/orders/[id]/contract?download=1`, the client's route, admin
allowed, new tab). The action (`order/contract-actions.tsx`) shows only when
the order is paid and applicant 0's details exist: **Regenerate and resend**
with a row, **Prepare and send** without one (the same route prepares the
first version). It asks for confirmation first, in place, then posts to
`POST /api/admin/orders/[id]/contract` (section 6) and refreshes the modal.
The line under it reads "Prepared and emailed to the client." or "Prepared,
but the email did not go out. Try again in a moment.", or the route's own
404 or 409 line. The first version is normally the client's doing: they
confirm their details after paying.

### `/admin/services` (admin-services agent)
List (name, slug, price, active, orders count) with New service. Editor page
`/admin/services/[id]` and `/admin/services/new`: fields per `services`
columns (Stripe ids and links included; since 2026-09-21 the note explains
where to find a price id in Stripe instead of naming `stripe:setup`),
`includes` as one line per item, then three repeatable
lists: stages (key, label, description, terminal flag; order by drag is out
of scope, use position inputs), documents (key, label, note, accepted types
as checkboxes, max size, per applicant, required, and since 2026-09-14 a
**Generated deed** select: None, Power of attorney (NIF), Power of attorney
(bank account), written to `service_docs.template`; `validateServiceInput`
accepts `null` or one of `poa_nif`, `poa_bank`), deliverables (key, label,
kind). No quantity flag: the "Can be ordered twice on one order" checkbox
and the table's `x1 or x2` hint went with `supports_quantity`. Save posts
the whole thing. Deactivating hides the service from the client gallery and
the wizard but keeps history. The four wizard slugs keep slug and price
locked and everything else editable.

Since 2026-09-21 the service's main fields include a select **Service
contract**: None, NIF, Bank account, NIF + Bank account package, written to
`services.contract_template` (`null`, `nif`, `bank`, `package`), with the
hint "The agreement the client confirms their details for and receives right
after paying. With None, nothing is prepared or asked." The labels live in
`CONTRACT_TEMPLATE_LABELS` (`editor-model.ts`); the services list shows
"Agreement: NIF" (or the other label) under the name of a service that has
one. The four wizard slugs may change it. `validateServiceInput` leaves the column
alone when the key is missing, clears it on an explicit `null`, accepts one of
the three ids, and answers anything else with 422 "Choose a contract or none.".
The editor always sends the key. A service set to
None generates nothing and asks the client nothing; an agreement already
prepared for an order stays viewable. On 2026-09-21 NIF only holds `nif`,
Bank Account only `bank`, NIF + Bank Account `package` and the Couple
package none, because the firm has no model for two parties.

Since 2026-09-21 every line of the services screens reads without
developer words (Patrícia edits the catalogue herself). The copy lives in
`src/components/admin/services/copy.ts` (`editorCopy`, `listsCopy`,
`tableCopy`), and the field messages in `messages` of `editor-model.ts`;
`copy.test.ts` holds all of it to the house rules and keeps scripts, slugs,
kebab or snake case and "the wizard" off the screen. A slug is a "Short
code", a key a "Code" (the table's column too), the wizard "the application
form", the gallery "the client's Services page"; `awaiting_payment` is
"Awaiting payment, with the code awaiting_payment". The description hint
says clients do not see it, the price hint that changing the price does
not change what Stripe charges (a new price needs a new Stripe price id),
the Stripe block says how to copy a price id from Stripe's "Product
catalog" in each mode, and the price id and payment link fields gained a
hint each (the links are an optional backup used only when the price id
is empty). Only copy and hints changed; no field or validation rule did.

What the four services hold on 2026-09-14 (Patrícia's edits to NIF only and
Bank Account only, `0007_one_unit_poa.sql` for the other two; the 2026-09-11
seed in `docs/platform-contract.md` is history):

| service | stages | documents | deliverables |
|---|---|---|---|
| NIF only | 5 | 3: 2 uploads + NIF deed | 2 |
| Bank Account only | 5 | 7: 6 uploads + bank deed | 0 |
| NIF + Bank Account | 8 | 7: 5 uploads + NIF deed + bank deed | 3 |
| Couple package | 8 | 7: 5 uploads + NIF deed + bank deed, all per applicant | 3 |

Bank Account only having no deliverable template, and the bank deed's
clause d) naming a single holder account while the couple package sells a
joint one, are open points for Patrícia (`docs/documents-contract.md`
section 4).

### `/admin/settings`
Change password, and a short note recommending MFA. Since 2026-09-21 the
form asks for the current password first, then the new one (12 to 72
characters, different from the current one) typed twice, and posts to
`POST /api/admin/password` (section 6) instead of calling
`supabase.auth.updateUser` from the browser, so a session left open on a
shared screen is not enough to take the account over. The route's lines
show as they are; a wrong current password empties that field. A hidden
`username` field carries the email so a password manager files the new
password under the right account.

### `/admin/login`: forgot password (2026-09-21)
"Forgot your password?" switches the form, at the same URL (so
`src/proxy.ts` needs no exception), to the email, then
`resetPasswordForEmail`: the recovery email carries a 6 digit code, set up
by `npm run auth:config` (section 4). Whatever Auth answers, the screen says
"If this email has an account, a code is on its way.", so it never tells a
stranger which addresses exist; only a network failure reads as an error.
Then the code and a new password typed twice (at least 12 characters):
`verifyOtp` with type `recovery`, `updateUser`, and `signOut` with the
global scope, which ends every session of the account; the form returns to
sign in and asks for the new password. A code is used once, so after it is
accepted a rejected password is retried without it; resend after 60 s.
These two steps run on their own client (publishable key, implicit flow,
session in memory only, storage key `alttavia-admin-recovery`), not on the
cookie client: Supabase refuses a recovery code verified in the PKCE flow
the cookie client uses (tested 2026-09-21: `otp_expired` on a fresh code),
and the recovery session never reaches the cookies. A recovery session is
not a password session, so it never opens the admin area by itself.

### `/admin/feedback` and the Feedback button (2026-09-21)
`AdminShell` renders a **Feedback** button fixed in the bottom right corner
of every admin page (`components/admin/feedback-button.tsx`). It opens
`FeedbackDialog` (`feedback-dialog.tsx`, a centred `<dialog>` like the
others) with "Which screen" prefilled from the current path and query (an
open order modal's `?order=` included; editable), "What did you expect",
"What happened" and a priority: Blocks my work, Should change, Nice to
have. An open order modal makes the page behind it inert, the button
included, so a note about it is sent after closing the modal. It
posts to `POST /api/admin/feedback`, which saves the note and emails it to
`FEEDBACK_TO`. `/admin/feedback` (sidebar entry Feedback, between Services
and Settings) lists the newest 500 notes with priority, sender, time, a
link back to the screen when it is a path on this site, both answers and a
status select (Open, Planned, Done, Won't do; `PATCH /api/admin/feedback`);
`?status=` filters, with counts. Read with the user client, RLS
`is_admin()` deciding. The labels live only in `src/lib/email/feedback.ts`
and reach the client components as props.

### Client `/en/dashboard/orders` (client-orders agent)
"Your orders" table (service, date, status, link to
`/en/dashboard/orders/[id]`), then "Order another service": a card per active
service (name, tagline, price, first three includes, timeline) with a Buy
button, one unit each. Buy posts `/api/orders`, then `/api/checkout`, then
`window.location.assign(url)`. The purchase drawer that replaced the cards
on 2026-09-12 says "By purchasing you accept the Terms", linking to
`/en/service-terms` (`docs/platform-contract.md` section 12).

### Client order view
Extract the current dashboard body into `src/components/dashboard/order-view.tsx`
(props: everything the page loads) and use it from both `/en/dashboard`
(current order) and `/en/dashboard/orders/[id]`. Add to it: rejected
documents with the reason and the replacement slot (already supported by
upload-url), deliverables with download links and the report when
`completed_at` is set, and a "Completed" state on the timeline. Since
2026-09-14 it also receives the order's `applicants` rows for the deed slots
(`docs/platform-contract.md` section 10, "Deed slots").

## 8. File ownership

Stage 1 (one agent): everything in section 4, the migration, `types.ts`
additions, `admin-queries.ts`, `.env.example` (no new variables expected),
`package.json` script `admin:create`.

Stage 2 (four agents in parallel, disjoint):

```
admin-api agent      src/app/api/admin/** (all routes), src/lib/orders/review.ts (approve/reject + email),
                     src/lib/orders/deliverables.ts, src/lib/orders/services-admin.ts (validation +
                     upsert of a service with its config), tests for the pure parts
admin-ui agent       src/app/admin/page.tsx, src/app/admin/orders/page.tsx, src/app/admin/settings/page.tsx,
                     src/components/admin/** except services/*, charts in src/components/admin/charts/*
admin-services agent src/app/admin/services/**, src/components/admin/services/**
client-orders agent  src/app/api/orders/route.ts, src/app/api/deliverables/[id]/route.ts,
                     src/app/[locale]/dashboard/orders/**, src/app/[locale]/dashboard/page.tsx (refactor to OrderView),
                     src/components/dashboard/** (order-view.tsx, gallery, deliverables; not documents/, not
                     pay-button.tsx)
```

Nobody edits another agent's files. Route payloads are fixed by section 6;
build against them even if the other side is not there yet.

## 9. Security rules to hold

- `requireAdmin()` in every `/api/admin/*` handler before any read.
- Admin means `role = 'admin'` **and** a session opened with a password, in
  the app (`requireAdmin()`, `amr` claim) and in the database (`is_admin()`
  since 0011). Never widen either check to another authentication method.
- Admin pages read with the **user** client (RLS `is_admin()`), writes only through routes.
- `/api/admin/documents/[id]` and deliverable downloads: presigned URLs of 120 s.
- A client hitting `/admin/*` gets `/en/dashboard`; a client hitting `/api/admin/*` gets 403 with no detail.
- Document ids, order ids and deed slot ids from the client are validated as UUIDs and always joined to the caller.
- Client emails go only to the order owner's `public.users.email`; team
  notices only to `EMAIL_TEAM_INBOX` and feedback notes only to
  `FEEDBACK_TO` (2026-09-21). No address comes from a request body.
- A deliverable is deleted only under its own order's `deliverables/{orderId}/`
  prefix, so a damaged row can never take a client's document with it.
- The password change checks the current password server side; neither
  password is ever logged or echoed.
- No role change endpoint exists. Roles change through SQL or the script.

## 10. Verification each agent runs

Same as the platform contract section 11, plus: for routes, a table of
(role, route, expected status) covering anon, client and admin. Since
2026-09-21 `npm run authz:matrix` builds that table for every route, with
the admin code session as a fifth column and PostgREST probes after it
(`docs/platform-contract.md` section 13); it needs `npm run demo:seed` and
the support admin.
