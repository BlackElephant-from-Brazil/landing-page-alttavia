# Admin contract: the firm's side of the platform

Written 2026-09-11, on top of `docs/platform-contract.md` (read that first; its
rules, house rules and file conventions all still apply). This document adds
the administrator role, the screens Patrícia uses to run a service from
payment to delivery, the client's order gallery, and the service editor.

## 1. What is being built

1. **Admin sign in with a password** at `/admin/login` (Supabase Auth
   `signInWithPassword`), separate from the client's email code. Only users
   with `public.users.role = 'admin'` get past `/admin/*`; a client who signs
   in there is sent to `/en/dashboard`.
2. **Admin area** at `/admin` (overview with KPIs, filters and charts),
   `/admin/orders` (every order, filters, search, a **centered modal** with the
   order's details and every action), `/admin/services` (create and edit
   services, their lifecycle stages, required documents and deliverables) and
   `/admin/settings` (change password). The initial questions form is **not
   editable** from the admin, by decision.
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
   come back: a document was rejected, the order is complete. Best effort:
   failures are logged, never block the action.

## 2. Decisions already taken

- Roles live in **`public.users.role`** (`client` | `admin`). A `security
  definer` function `public.is_admin()` reads it for RLS. Server code checks
  the same column through `requireAdmin()`. No JWT custom claims, so a role
  change takes effect on the next request, not the next token.
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

No insert/update/delete policies for anyone: writes stay behind route handlers.

`0005_admin.sql` as written also created `user_service_notes` (pendencies);
`0007_one_unit_poa.sql` dropped it, dropped `services.supports_quantity` and
`user_services.quantity`, and recreated `admin_order_summary` without
`quantity` and `open_pendencies`. The view now carries the `user_services`
columns plus `user_email`, `service_name`, `service_slug`, `docs_required`,
`docs_approved`, `docs_uploaded`, `docs_rejected`, `last_event_at`.

The trigger that mirrors `auth.users` needs no change; `role` defaults to
`client`. `scripts/create-admin.mjs` then runs
`update public.users set role = 'admin' where email = ...` through the
Management API after `auth.admin.createUser`.

## 4. Server helpers and shared modules (stage 1)

```
src/lib/supabase/admin-user.ts   requireAdmin(): Promise<SessionUser & { role: 'admin' }>  throws AdminAuthError(401|403)
                                 getUserWithRole(): Promise<(SessionUser & { role }) | null>
src/lib/db/admin-queries.ts      see section 5
src/lib/db/types.ts              add role to UserRow; extend UserServiceDeliverableRow; since 0007 PoaTemplate,
                                 ServiceDocRow.template and UserServiceApplicantRow
src/lib/email/send.ts            sendEmail({ to, subject, html, text }) via POST https://api.resend.com/emails with
                                 EMAIL_API_KEY, from EMAIL_FROM, reply_to EMAIL_REPLY_TO; returns { ok, id? }; never throws
src/lib/email/templates.ts       documentRejected({ docLabel, reason, dashboardUrl }) and
                                 orderCompleted({ serviceName, dashboardUrl }) -> { subject, html, text }; house rules; same
                                 visual language as the Supabase code email (Georgia, navy, gold eyebrow)
src/lib/orders/lifecycle.ts      advanceStage(orderId, actorId, { direction: 'forward'|'back' } | { stageKey }) -> { stageKey, completed }
                                 (uses service_stages positions, writes user_service_events, sets/clears completed_at)
src/proxy.ts                     add: unauthenticated /admin and /admin/* (except /admin/login) -> /admin/login?next=
src/app/admin/layout.tsx         server: getUserWithRole(); no user -> /admin/login; role !== 'admin' -> /en/dashboard;
                                 shell with sidebar (Overview, Orders, Users, Services, Settings), email, sign out
src/app/admin/login/page.tsx     email + password form (client island), signInWithPassword, then router.push(next) + refresh;
                                 signed-in admin visiting it -> /admin; signed-in client -> /en/dashboard
scripts/create-admin.mjs         creates the auth user (email_confirm: true) with a 20 character random password, sets the
                                 role, prints the password ONCE; refuses to run if the user already exists (prints how to
                                 reset instead: `--reset-password`)
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
   // events, applicants (user_service_applicants, by applicant_index), deliverables (service_deliverables +
   // user_service_deliverables), answers summary rows
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
| `POST /api/admin/orders/[id]/stage` | `{ direction: 'forward'\|'back' }` or `{ stageKey }` | `advanceStage`; on terminal set completed_at and email the client |
| `PATCH /api/admin/orders/[id]` | `{ report?: string }` | update report (markdown allowed, rendered with the existing RichText) |
| `POST /api/admin/deliverables/upload-url` | `{ userServiceId, label, serviceDeliverableId?, fileName, mimeType, sizeBytes }` | pending row + presigned PUT (key `deliverables/{orderId}/{uuid}.{ext}`), same mime and 20 MB limit rules as documents |
| `POST /api/admin/deliverables/confirm` | `{ deliverableId }` | HeadObject, status ready |
| `GET /api/admin/documents/[id]` | | presigned download of any document |
| `GET /api/admin/services` / `POST` | service fields + `stages[]`, `docs[]`, `deliverables[]` | create; slug unique, lower kebab |
| `PATCH /api/admin/services/[id]` | same | update; stages/docs/deliverables upserted by key; a stage removed while an order sits on it -> 409 with the count |

Client routes added:

| route | body | effect |
|---|---|---|
| `POST /api/orders` | `{ serviceSlug }` | one unit of that service for the signed-in user, `answers_snapshot = {}`, `applicants = 2` and `joint` only for `couple`, `total_cents = price_cents`, events row; a `quantity` key is ignored; returns `{ userServiceId }` |
| `GET /api/deliverables/[id]` | | presigned download of a `ready` deliverable on an own order |
| `GET`/`PUT /api/orders/[id]/applicants/[index]`, `GET /api/orders/[id]/poa/[docId]?applicant=` | | the applicant details and the generated deed (2026-09-14); admins may `GET` both; payloads in `docs/platform-contract.md` section 8 |

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

### `/admin/services` (admin-services agent)
List (name, slug, price, active, orders count) with New service. Editor page
`/admin/services/[id]` and `/admin/services/new`: fields per `services`
columns (Stripe ids and links included, with a note that live ids come from
`stripe:setup --live`), `includes` as one line per item, then three repeatable
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
Change password (current session, `supabase.auth.updateUser({ password })`,
minimum 12 characters, confirm field), and a short note recommending MFA.

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
- Admin pages read with the **user** client (RLS `is_admin()`), writes only through routes.
- `/api/admin/documents/[id]` and deliverable downloads: presigned URLs of 120 s.
- A client hitting `/admin/*` gets `/en/dashboard`; a client hitting `/api/admin/*` gets 403 with no detail.
- Document ids, order ids and deed slot ids from the client are validated as UUIDs and always joined to the caller.
- Emails go only to the order owner's `public.users.email`.
- No role change endpoint exists. Roles change through SQL or the script.

## 10. Verification each agent runs

Same as the platform contract section 11, plus: for routes, a table of
(role, route, expected status) covering anon, client and admin.
