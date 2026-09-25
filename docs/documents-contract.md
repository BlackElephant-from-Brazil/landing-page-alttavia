# Documents contract (2026-09-14)

The fourth design round. It amends `platform-contract.md` and
`admin-contract.md`; where this file and those disagree, this file wins, and
the two older files are brought in line at the end of the round.

Five changes, one migration (`supabase/migrations/0007_one_unit_poa.sql`;
`0008_view_grants.sql` only tightens the view's grants after the review):

1. Every service sells **one unit per purchase**. The quantity concept is gone
   from the database, the engine, the checkout and every label.
2. **Pendencies and notes are gone** (`user_service_notes`, the routes, the
   email, the client and admin panels).
3. The **documents stage generates powers of attorney**: the client downloads
   a deed filled with their passport details, signs it by hand and uploads the
   signed copy into the same slot. NIF services carry the NIF deed, bank
   services the bank deed, the bundle and the couple package both.
4. **NIF + Bank Account** and **Couple package** are re-aligned with the
   definitions Patrícia gave NIF only and Bank Account only in the editor.
5. The purchase drawer says **"By purchasing you accept the Terms"** with a
   link to `/en/service-terms` (replaced on 2026-09-25 by the line every Pay
   button carries, section 5). The post-payment contract was pending the
   firm's models when this was written; it was built on 2026-09-21, see
   `agreement-contract.md` (section 6 here is only a pointer now).

The delivery round of 2026-09-25 (section 7) added two things to the
documents stage: a required slot for the **signed service agreement**, and
**one joint bank deed** for the couple package in place of one per person.

House rules for copy still apply: no dashes as punctuation, no "problem",
"trap", "free", "refund", "money back", "video call", "run by lawyers"; short
sentences; US friendly English in the client area.

---

## 1. One unit per purchase

### Database

```sql
alter table public.services drop column supports_quantity;
alter table public.user_services drop column quantity;   -- view recreated first
```

`user_services.applicants` stays (1, or 2 for the couple package, which is one
unit for two people). `joint` stays. `total_cents` is `price_cents`.

### Engine (`src/lib/apply`)

- `Recommendation` (kind `product`) loses `quantity`. `totalCents(product)`
  takes one argument. `applicantsFor(order)` is `order.joint ? 2 : 1`.
- Decision table row **2 / nobody / none** (two adults, neither has a NIF, no
  account) now recommends `nif-only` for one person, reason `bothNeedNif`,
  with a new note `secondNif`: *"One NIF per purchase. Your partner's NIF is a
  second purchase from your dashboard, right after checkout."* The order is
  `applicants = 1`, `joint = false`. The dashboard already lets a client buy
  NIF only again, so nothing else is needed for the second person.
- Row **2 / nobody / joint, non EEA, no visa** (bank refused) falls into the
  same rule: `nif-only`, one unit, notes `bankUnlikely` + `secondNif`.
- `quantityFor()` in `src/content/apply.ts` is deleted; `alternativeFor()`
  prices every alternative as one unit; `includesFor()` keeps only the
  `joint` rewrite; `PRODUCTS[*].supports_quantity` is gone; `checkoutUrl()`
  no longer checks a quantity. `trackRecommendation(product, totalCents)`.
- Tests in `recommend.test.ts`, `checkout.test.ts`, `questions.test.ts`
  follow: the `x2` expectations become one unit with the `secondNif` note.

### Checkout and orders

- `POST /api/orders` body is `{ serviceSlug }`. A `quantity` key, if sent, is
  ignored (no 422 any more: there is nothing to reject).
- `POST /api/apply/submit` writes no `quantity`; `total_cents = price_cents`.
- `src/lib/stripe/checkout.ts`: `line_items: [{ price, quantity: 1 }]`; the
  Payment Link fallback no longer has a quantity guard.
- `confirm.ts` is unchanged (it compares `amount_total` with `total_cents`).

### Labels

Every `order.quantity === 2 ? "… x2" : …` expression goes: admin overview
and orders tables, admin order modal, admin user modal, client service card,
order modal, in-progress slider, purchases table. The name is the service
name.

### Admin services editor

The checkbox "Can be ordered twice on one order" and the `x1 or x2` hint in
the services table are removed; `editor-model.ts`, `services-admin.ts`
(`validateServiceInput`) and their tests drop `supports_quantity`.
`client-queries.ts` no longer fabricates the field.

---

## 2. Pendencies and notes removed

### Database

```sql
drop table public.user_service_notes;   -- after the view is recreated without open_pendencies
```

`admin_order_summary` is recreated with the same columns as 0006 minus
`quantity` and `open_pendencies`.

### Code removed

- `src/lib/orders/notes.ts` and `notes.test.ts`
- `src/app/api/admin/orders/[id]/notes/route.ts`, `src/app/api/admin/notes/[id]/resolve/route.ts`
- `src/components/admin/order/note-actions.tsx`
- `src/components/dashboard/pendencies.tsx`
- `pendencyEmail` / `sendPendencyEmail` in `src/lib/email/{templates,send}.ts`

### Code trimmed

- `types.ts`: `NoteAudience`, `UserServiceNoteRow`, `AdminOrderDetail.notes`,
  `AdminOrderRow.open_pendencies`, `Overview.kpis.openPendencies`.
- `order-status.ts`: `splitNotes` and `NextStepInput.openPendencies` go;
  `nextStep` priorities become pay, re-send rejected, sign and upload the
  deed(s) still missing, upload what is missing, download, nothing.
- `admin-queries.ts` (`getOrderDetail`, `getOverview`, `listOrders` columns),
  `client-queries.ts` (no notes fetch), `order-view.tsx`, `order-modal.tsx`
  (admin), `in-progress-slider.tsx`, `src/app/admin/{page,orders/page}.tsx`
  (no "Pendencies" column or KPI), `orders/[id]/page.tsx`.
- `user_service_events.note` (the free text on a stage change) and
  `user_services.report` (the closing report) **stay**: they are not
  pendencies.

---

## 3. Powers of attorney

### The models

`docs/power of attorney/MODELO - Procuracao NIF (campos em branco).docx` and
`… Conta Bancaria (campos em branco).docx` are the firm's current models,
bilingual, Portuguese paragraph then English paragraph. Both open with the
same identification paragraph, then differ in the powers granted. Both are
transcribed word for word into `src/content/power-of-attorney.ts`; nothing
in the wording is ours to change.

The attorney block, as in both models:

> Exma. Senhora Dra. Patrícia Soares Viana, advogada, inscrita na Ordem dos
> Advogados sob o n.º 65755L do Conselho Regional de Lisboa, contribuinte
> fiscal n.º 295970677, com domicílio profissional na Av. António Augusto
> Aguiar, 24, 1.º Direito, Escritório 3, 1050-016, Lisboa, telefone
> +351 934 548 395 e endereço de correio eletrónico
> patriciaviana-65755L@adv.oa.pt

(The older transcription in the same file, with the Elias Garcia address and
a nationality field, is replaced.)

### Dynamic fields

Both deeds use the same placeholders, each once in Portuguese and once in
English:

| Placeholder (PT / EN) | Field | Type |
|---|---|---|
| `[NOME COMPLETO]` | `full_name` | text, as in the passport |
| `[NASCIDO/NASCIDA]`, `[HIS/HER]`, `[HE/SHE]` | `gender` | `f` or `m`; drives *nascida/nascido* and *her/his*, *she/he* |
| `[LOCAL DE NASCIMENTO]` / `[PLACE OF BIRTH]` | `birth_place` | text, city and country |
| `[DATA DE NASCIMENTO]` / `[DATE OF BIRTH]` | `birth_date` | date |
| `[N.º DO PASSAPORTE]` | `passport_number` | text |
| `[ENTIDADE EMISSORA DO PASSAPORTE]` / `[PASSPORT ISSUING AUTHORITY]` | `passport_issuer` | text |
| `[DATA DE EMISSÃO]` / `[DATE OF ISSUE]` | `passport_issued_on` | date |
| `[DATA DE VALIDADE]` / `[EXPIRY DATE]` | `passport_expires_on` | date |
| `[MORADA FISCAL]` / `[TAX RESIDENCE ADDRESS]` | `tax_address` | text, full address with postal code, city and country |
| `[DIA] de [MÊS] de [ANO]` / `[DAY] of [MONTH], [YEAR]` | signing date | filled at download time with today's date in Europe/Lisbon; the client downloads again for a fresh date |
| `[NOME COMPLETO]` under the signature line | `full_name` | |

Dates print as `12 de março de 2026` in Portuguese and `12 March 2026` in
English. The firm's models leave dates free form; this is the one house
choice.

### Database

```sql
-- Which deed a document slot generates. Null for an ordinary upload.
-- 0013 (2026-09-25) widens the check to ('poa_nif','poa_bank','agreement').
alter table public.service_docs
  add column template text check (template in ('poa_nif','poa_bank'));

-- The principal's details, one row per order and applicant. Written only
-- through PUT /api/orders/[id]/applicants/[index]; clients read their own,
-- admins read all, nobody writes through PostgREST (0006 revoked writes).
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
```

Seed rows (same migration): every service gets its deed slots at the end of
its document list, `per_applicant = true` (the couple's bank deed became a
shared slot on 2026-09-25, section 7), `required = true`, default mime list
(pdf, jpeg, png), default size:

| Service | key | label | note | template |
|---|---|---|---|---|
| nif-only, bundle, couple | `poa_nif` | Power of attorney for the NIF | We prepare it with your passport details. Download it, sign by hand, then upload a scan or a photo of the signed pages. | `poa_nif` |
| bank-only, bundle, couple | `poa_bank` | Power of attorney for the bank account | Same wording. | `poa_bank` |

The note was rewritten on 2026-09-22, after Patrícia said a deed signed with
another hand comes back: "We prepare it with your passport details. Download
it and sign by hand, with the same signature as in your passport. Then upload
a scan or a photo of the signed pages." Finanças and the bank compare the
signature with the passport, so the slot has to say it before the client
signs. The client reads the note from `service_docs`, so the change is a
migration, `supabase/migrations/0012_deed_signature_note.sql`: one idempotent
update of every row with `template in ('poa_nif', 'poa_bank')`, whatever the
service. `DEED_SIGNATURE_NOTE` in `src/lib/apply/documents.ts` is the seed
source and `documents.test.ts` pins the two to each other by reading the
migration. The live project ran 0012 on 2026-09-22, so the deed rows carry
the new note.

### Row types (`src/lib/db/types.ts`)

`ServiceDocRow.template: DocTemplate | null` with
`type PoaTemplate = "poa_nif" | "poa_bank"` and, since 2026-09-25,
`type DocTemplate = PoaTemplate | "agreement"` (section 7; the guards
`isDeedTemplate` and `isAgreementTemplate` live in
`src/lib/documents/templates.ts`), and

```ts
export type UserServiceApplicantRow = {
  id: string; user_service_id: string; applicant_index: 0 | 1;
  full_name: string; gender: "f" | "m"; birth_place: string; birth_date: string;
  passport_number: string; passport_issuer: string; passport_issued_on: string;
  passport_expires_on: string; tax_address: string; created_at: Timestamp; updated_at: Timestamp;
};
```

`AdminOrderDetail.applicants: UserServiceApplicantRow[]`; the client order
view receives the same list.

### Generator (`src/content/power-of-attorney.ts`, `src/lib/poa/generate.ts`)

- `buildPowerOfAttorney(kind: PoaTemplate, principal: PrincipalDetails, signedOn: SigningDate): PoaBlock[]`.
  `PrincipalDetails` has the nine fields above in camelCase, all optional;
  a missing one prints the model's own bracketed placeholder so a blank deed
  reads as a template. `gender` missing prints `nascido(a)`, `his/her`,
  `he/she`.
- `generatePowerOfAttorney(kind, principal?, signedOn?)` returns the PDF
  bytes. The NIF deed still fits one A4 page (test pinned); the bank deed
  fits two (test pinned). Bank items are lettered `a)` to `e)`; the
  declaration paragraph and the lapse paragraph follow.
- The sanitiser keeps folding curly quotes and dashes; a name with a
  character outside WinAnsi is folded to its closest plain form rather than
  thrown on (existing behaviour, documented).
- `npm run poa:preview -- --bank` writes the bank deed; without the flag the
  NIF deed. The preview file stays gitignored.
- Since 2026-09-25 the bank deed also takes two principals
  (`JointPrincipals`, a pair in applicant order) for the couple's joint deed:
  both identification clauses in the opening, joined with ", e " and
  ", and ", the plural forms of `JOINT_VOICE` (section 7) and two signature
  lines. The single deeds print exactly what they printed before. `-- --joint`
  (implies `--bank`, with `--filled` for a sample couple) previews it.

### Server (`src/lib/orders/applicants.ts` and routes)

- `validateApplicantInput(body)` returns `{ ok, value | error }`: trims, checks
  lengths and the `gender` set, parses dates as `YYYY-MM-DD`, requires
  `passport_expires_on > passport_issued_on`, `birth_date` in the past and
  at least 18 years before today (the deed says "maior de idade"),
  `passport_expires_on` today or later. Error messages are one short line
  each.
- `GET /api/orders/[id]/applicants/[index]`: owner or admin. 200 with the
  row; 404 `{ error: "No details yet." }` when none, with `prefill` when the
  same user has a row on another order for the same index (newest
  `updated_at`), so the form opens filled in. Orders of the **same service**
  are skipped as a source: a second NIF only order on one account is for
  another person by definition (the engine's `secondNif` note), so it must
  not open with the account holder's passport. The form's copy is neutral
  for a one applicant order ("Details for the power of attorney", "If this
  order is for someone else, enter that person's details").
- Both routes answer 403 "Not your order." to a non admin whether the order
  is missing or belongs to someone else (same rule as the documents routes);
  admins get 404 for a missing order. The PUT refuses bodies over 16 KB.
- `PUT /api/orders/[id]/applicants/[index]`: owner only (an admin corrects
  through the client for now), order must exist and `index` must be below
  `applicants`. Upsert on `(user_service_id, applicant_index)`. 200 with the
  row; 422 with the first validation message; 401/403/404 as elsewhere.
- `GET /api/orders/[id]/poa/[docId]?applicant=0`: owner or admin. Checks the
  doc belongs to the order's service and has a deed template (`poa_nif` or
  `poa_bank`; since 2026-09-25 the `agreement` slot never yields a deed, 404),
  `applicant` below `applicants`, the order is paid
  (`409 { error: "Payment first." }`), and an applicant row exists
  (`409 { error: "details_missing", applicant }`, the index naming whose
  details are missing since 2026-09-25). Returns `application/pdf`,
  `Content-Disposition: attachment; filename="power-of-attorney-nif-<name>.pdf"`
  (or `-bank-`), `Cache-Control: no-store`. The signing date is today in
  Europe/Lisbon. The couple's joint bank deed ignores `?applicant` and needs
  both rows (section 7).
- The upload of the signed copy uses the existing slot flow
  (`/api/documents/upload-url` then `confirm`), unchanged: a deed slot is a
  document slot with a template. It followed that flow through its rewrite of
  2026-09-22 as well, the same origin fallback and the Remove button
  included (`docs/platform-contract.md` section 10).

### Client UI (documents stage)

`document-slot.tsx` gains `template`, `applicantRow` (present or not) and a
`prefill` prop. When `template` is set the card reads, top to bottom:

1. label and note, status pill as today;
2. a primary button **Download to sign** and, once details exist, a quiet
   link **Edit your details**, with the line "Sign exactly as you signed your
   passport." under that row (2026-09-22, the short form of the slot's note);
3. the upload control labelled **Upload the signed copy**, the file name and
   View link as today.

"Download to sign" fetches the deed first: a `details_missing` answer opens
the form, any other error is shown in the slot's message line, and a PDF is
saved through a temporary download link, so the dashboard never navigates
to a JSON error page. The deed row is hidden once the signed copy is
approved, or as soon as the order leaves the documents stage; since
2026-09-22 a copy that is only waiting for review no longer hides it, since
the client may still replace that file (`docs/platform-contract.md` section
10, "Sending a file"). A deed slot keeps its own wording, "Upload the signed
copy", where an ordinary slot would say "Replace file".

With no applicant row the button opens
**the details form** in a centred `<dialog>` (same pattern as `modal.tsx`: `showModal`, Esc, backdrop,
focus return). Fields in this order, one column: Full name (as in the
passport), The deed refers to you as (radio: *She* / *He*, stored `f`/`m`),
Place of birth, Date of birth, Passport number, Issuing authority, Date of
issue, Expiry date, Tax residence address (textarea). Save posts the PUT;
on success the dialog closes, the page refreshes, and the download starts
(`window.location.assign` of the PDF URL). With details present the button
downloads at once. For the couple package the NIF deed's form is per
applicant, and the second person's card says *Your partner* the way the
other slots do; the bank deed is one slot for both since 2026-09-25 and asks
for both sets of details (section 7).

The order view's "what to do next" line counts a deed slot like any
required slot: `nextStep` says **Sign and upload 1 document** when the only
missing slots are deeds, otherwise the existing wording.

### Admin UI

- Order modal, Documents section: a deed slot shows **Download deed** (same
  route, admin allowed) next to the review controls, and, when details
  exist, a small read-only block with the nine fields; when they do not, the
  line *The client has not entered their details yet*.
- Since 2026-09-22 every client file on that list carries **Download**, and
  **View** as well when a browser can render it (a PDF or an image, which is
  what clients send). The slot list is built by the same pure module the
  stage refusal reads, so the order cannot leave the documents stage while a
  required slot has no approved file (`docs/admin-contract.md` section 7).
- Services editor: each document row gets a select **Generated deed**: *None*,
  *Power of attorney (NIF)*, *Power of attorney (bank account)*.
  `validateServiceInput` accepts `template` as one of the two keys or null.
  The four wizard slugs stay editable here (only slug and price are locked).
  Since 2026-09-25 the select reads **Document to sign** and also offers
  *Signed service agreement* (`agreement`); its refusal reads "Choose a
  document to sign or none.", and an `agreement` slot on a service with no
  contract is refused with 422 (`docs/agreement-contract.md` section 5).

---

## 4. Bundle and couple re-aligned

The union of what Patrícia set on NIF only and Bank Account only, in this
order. Applied by the same migration with updates and inserts keyed on
`(service_id, key)`; no stage in use is deleted (order `1ea44ea6` sits on
`account_open`, order `ce7523d6` on `awaiting_payment`).

**Stages** (bundle and couple, identical):

| # | key | label | terminal |
|---|---|---|---|
| 1 | awaiting_payment | Awaiting payment | |
| 2 | documents | Documents | |
| 3 | awaiting_financas | Submitted | |
| 4 | nif_ready | NIF ready | |
| 5 | financas_access_ready | Finanças access ready | |
| 6 | awaiting_bank | With the bank | |
| 7 | issued_documents_delivery | Issued documents delivery | |
| 8 | account_open | Account open | yes |

**Documents** (bundle and couple; couple is `per_applicant` throughout, as
today): passport (NIF only's note), proof of address (NIF only's note: the
three month rule is the stricter of the two), tax identification number from
your country, bank statements or annual income statement, proof of
profession, power of attorney for the NIF, power of attorney for the bank
account. `nif_document` is not asked: the bundle produces the NIF. Since
2026-09-25 both also end on the signed service agreement (one per order),
and the couple's bank deed is one shared slot (section 7).

**Deliverables** (bundle and couple): Your Portuguese NIF (kept: a live
deliverable points at it), Finanças access (added from NIF only), Your
Portuguese IBAN (kept). The `summary` report template is removed (neither
source service has one).

Open points for Patrícia, reported, not decided here: Bank Account only has
no deliverable template at all since her edit (the IBAN one was removed);
the bank deed's clause d) names a single holder account (*conta de titular
único, tipo 01*) while the couple package sells a joint account. Her answer
of 2026-09-24 kept the wording ("same wording") and asked for one deed with
both persons; since then the clause sits in a deed both people sign, so the
point is still open (section 7).

---

## 5. Terms

- The page a purchase accepts already exists: `/en/service-terms`
  (`src/app/[locale]/service-terms/page.tsx`, "what you are buying", noindex),
  linked from the landing footer as "Service terms". No new page. The firm's
  contract models arrived on 2026-09-21 (`docs/terms`); whether the contract
  replaces this page or lives beside it is an open point for the firm.
- `purchase-drawer.tsx`, under the Confirm button and above "Not now":
  *By purchasing you accept the <a href="/en/service-terms" target="_blank">Terms</a>.*
  The drawer also stops sending `quantity`.
- Replaced on 2026-09-25 (Patrícia: the terms are accepted before paying).
  The drawer and every Pay button carry the same line, *By paying you accept
  the service terms and your service agreement.*, with "service terms"
  opening `/en/service-terms` in a new tab (`pay-terms-note.tsx`, the words
  in `src/content/terms-version.ts`). The click is the acceptance: the body
  of `POST /api/checkout` carries `acceptTerms: true`, a body without it is
  refused with 422 "Accept the terms to continue.", and the order records
  `terms_accepted_at` and `terms_version` (0014,
  `docs/agreement-contract.md` section 9).
- The footer's "Terms" entry keeps pointing at the main site's terms of use.

---

## 6. The service contract

Built on 2026-09-21, after the firm sent its four models (`docs/terms/`).
The design is `docs/agreement-contract.md`, which replaces what this section
used to sketch; read that file, not this one. Two things differ from the
sketch: the agreement is never generated on the payment path (the client
asks for it after paying, by confirming their details), and the R2 key
carries a version (`contracts/{orderId}/v{n}.pdf`; since 2026-09-25
`v{n}-{nonce}.pdf`, so two attempts at one version never share a key).

---

## 7. The signed agreement and the joint bank deed (2026-09-25)

Patrícia's answers of 2026-09-24, built in the delivery round and applied to
the live project on 2026-09-25 with migrations 0013 and 0016.

### The signed service agreement slot

`supabase/migrations/0013_signed_agreement_slot.sql` widens the check on
`service_docs.template` to `('poa_nif','poa_bank','agreement')` and appends
one row to every service with a contract (nif-only, bank-only, bundle,
couple):

| key | label | note | template | per_applicant | required |
|---|---|---|---|---|---|
| `signed_agreement` | Signed service agreement | Download your service agreement, sign it by hand with the same signature as in your passport, then upload a scan or a photo of the signed pages. | `agreement` | false | true |

Default file types and size, at the end of the list. A service that already
has the key keeps its row. The seed source is `SIGNED_AGREEMENT_SLOT` in
`src/lib/apply/documents.ts`, pinned to the migration by
`signed-agreement-slot.test.ts`.

- **What the slot hands the client** is the order's service agreement, not
  a document of its own: "Download to sign" opens
  `GET /api/orders/[id]/contract` in a new tab, inline. The slot has no
  details dialog; the agreement card above the list prepares the agreement
  (`docs/agreement-contract.md` section 6). The line under the button is
  "Sign exactly as you signed your passport.", or on a couple order "Both of
  you sign it, each exactly as you signed your own passport.", and the input
  reads "Upload the signed copy". The rule is `slotControls` in
  `src/components/dashboard/documents/slot-controls.ts`.
- **Before the agreement exists** the slot shows no input, only "Confirm
  your details first, above, and your agreement appears here.", and
  `POST /api/documents/upload-url` refuses a request for that slot with 409
  "Your agreement is not ready yet. Confirm your details first."
- **Once per order.** `per_applicant = false`, so a couple order has one
  slot under "For both of you", one paper both sign.
- **The team hears of it.** Every confirmed upload in the slot, through
  either upload route, calls `notifySignedAgreement`: "Signed service
  agreement received" to `EMAIL_TEAM_INBOX`, once per review round, with the
  file attached only for an order paid with real money and up to 8 MB
  (`docs/platform-contract.md` section 8).
- **The documents stage holds the order** until the slot is approved, like
  any required slot. Orders already past that stage when 0013 ran are not
  held; their new slot stays closed and empty. Orders still on the
  documents stage, the demo and training orders on staging included, now
  wait for a signed agreement before they can move on.
- **Admin side.** The slot's row in the order modal carries "Download
  agreement" (the prepared agreement) once it exists; the signed copy is
  viewed, approved or rejected like any file. `validateServiceInput` and
  `upsertService` refuse an `agreement` slot on a service with no contract
  (422), since it could never open.
- **Guards.** `isDeedTemplate` and `isAgreementTemplate`
  (`src/lib/documents/templates.ts`) keep the two kinds apart: the deed
  route answers 404 for an `agreement` slot, and the admin's services table
  counts only deeds as deeds.

### The couple's joint bank deed

The couple package opens one joint account, and Patrícia asked for one bank
power of attorney carrying the data of both persons, signed by both, with
clause d) unchanged. `supabase/migrations/0016_couple_joint_bank_deed.sql`
makes the couple's `poa_bank` slot shared (`per_applicant = false`) and adds
"Both of you sign the same document." at the end of its note. The couple's
NIF deed stays per applicant: a NIF is personal. Bank Account only and the
bundle keep their single deed.

- **The rule** is `isJointDeed(doc, applicants)` in `src/lib/poa/joint.ts`:
  template `poa_bank`, not per applicant, on an order with two applicants.
  All three matter; a shared bank slot on a one person order stays a single
  deed. `jointDeedMissing(first, second)` names the first person missing.
- **The deed** names both persons in its opening, applicant 0 first, and
  ends with two signature lines. The plural forms (*constituem*,
  *conferem*, *dos outorgantes*, *Declaram os Mandantes*, *appoint*,
  *their*, *the Principals*…) are **ours**, collected in `JOINT_VOICE` in
  `src/content/power-of-attorney.ts`, for the firm to read and approve
  before a couple signs one. It fits three pages at most, four at the SQL
  maximum of every field.
- **The route** (`GET /api/orders/[id]/poa/[docId]`) ignores `?applicant`
  for the joint deed, needs both applicant rows, answers
  `409 { error: "details_missing", applicant }` naming the first one missing,
  and serves `power-of-attorney-bank-<first>-and-<second>.pdf`.
- **The client slot** downloads without `?applicant`; when a set of details
  is missing it opens the details dialog for the account holder, then for
  the partner, then downloads. Each saved set gets its own button, "Edit
  your details" and "Edit your partner's details", and the line under the
  button asks both to sign.
- **The admin modal** shows "Download deed" for the joint deed only once
  both persons have details, and lists both in "Details for the deeds".
- **Data already there.** A signed copy uploaded for the second person on
  that slot before 0016 is no longer one of the order's slots and is not
  shown to the client (an approved one still counts in
  `admin_order_summary.docs_approved`). The query to find such rows is in
  the migration's header; the firm asks those couples for the joint deed.
- **Open point for the firm:** clause d) still grants a single holder
  account (*conta de titular único, tipo 01*) in a deed two people sign for a
  joint account.
