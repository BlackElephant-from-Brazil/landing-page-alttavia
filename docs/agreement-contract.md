# Service agreement contract (2026-09-21)

The fifth design round: the contract for legal services the client receives
after paying. It replaces section 6 of `documents-contract.md`, which was
written before the firm sent its models. Where this file and the older ones
disagree, this file wins. It describes the code as built and reviewed on
2026-09-21.

Vocabulary: in code the feature is `contract` / `contracts`; in client facing
copy it is the **service agreement**, so it never reads like a second thing
to buy. House rules for copy apply (no dashes as punctuation, no "problem",
"trap", "free", "refund", "money back", "video call", "run by lawyers"; short
sentences; US friendly English in the client area).

## 1. The models

`docs/terms/` holds the firm's four Word models, English only:

| File | Template id | Used by |
|---|---|---|
| `MODELO - Contract for Legal Services - NIF (blank fields).docx` | `nif` | `nif-only` |
| `MODELO - Contract for Legal Services - Bank Account (blank fields).docx` | `bank` | `bank-only` |
| `MODELO - Contract for Legal Services - NIF + Bank Account Package (blank fields).docx` | `package` | `bundle` |
| `MODELO - Annex I - Immediate Commencement and Withdrawal (blank fields).docx` | appended to every contract | all |

There is **no model for the Couple package** (one First Party per contract,
no joint wording). `couple` ships with no template: nothing is generated,
nothing is asked. It is one select away in the admin editor once the firm
decides (use `package` with the buyer as Client, or send a fourth model).

Nothing in the wording is ours to change. The text is never retyped: a script
reads the `.docx` files and writes the TypeScript module the generator uses
(section 3), so the PDF says what the model says, including the models' own
numbering gaps (NIF: Seventh Clause 1, 2, 4 and Ninth Clause 1, 2, 4; Bank:
Ninth Clause 1, 3, 4), which are reported to the firm, not fixed here.

Each model also carries a Word **letterhead** (a header with the firm's logo
and one line: phone, email, a URL and the Av. António Augusto Aguiar
address; a footer drawing). The generator exports the header's text as
`CONTRACT_LETTERHEAD` and warns that the images are not reproduced. The PDF
draws no letterhead until the firm says whether the client copy carries one.

## 2. Variables

Every bracketed token in the models, and where its value comes from. A token
with no value prints as the model's own bracket, so an unfilled contract
reads as a template.

| Token | Source |
|---|---|
| `[FULL NAME]` | `user_service_applicants.full_name` (applicant 0) |
| `[PLACE OF BIRTH]` | `birth_place` |
| `[DATE OF BIRTH]` | `birth_date`, printed `12 March 2026` |
| `[PASSPORT NO.]` | `passport_number` |
| `[PASSPORT ISSUING AUTHORITY]` | `passport_issuer` |
| `[DATE OF ISSUE]` / `[EXPIRY DATE]` | `passport_issued_on` / `passport_expires_on`, same date format |
| `[TAX RESIDENCE ADDRESS]` | `tax_address` |
| `[EMAIL]` | the account email (`users.email`), not editable in the form |
| `[TOTAL FEE]` | `user_services.total_cents`, printed `149` (or `149.50`, never a thousands separator) after the model's own euro sign |
| `[FEE IN WORDS]` | the same amount in English words, `one hundred and forty-nine`; cents read as a decimal (`point five zero`) because the model prints `([FEE IN WORDS] euros)` |
| `[REPRESENTATION PERIOD]` | firm constant, `12 (twelve) months` (the landing sells 12 months); only in `nif` and `package` |
| `[NUMBER OF BANKS]` | firm constant, `1 (one)`, **to be confirmed by the firm**; only in `bank` and `package` |
| `[DAY] [MONTH] [YEAR]` | the payment date (`paid_at`) in Europe/Lisbon: `21 September 2026` |
| `[SERVICE: NIF / BANK ACCOUNT / NIF + BANK ACCOUNT PACKAGE]` | by template: `NIF`, `BANK ACCOUNT`, `NIF + BANK ACCOUNT PACKAGE` |
| `[EMAIL OF THE SECOND PARTY]` | firm constant, `CONTACT.email` from `src/content/bank-nif.ts` |
| `[PLACE]` (Annex I, Part A) | optional form field "City and country you are in today"; empty prints a blank rule to fill by hand |
| Annex I tick boxes | an online purchase is "at a distance": first box drawn ticked, second empty |

The firm constants live in `FIRM_CONSTANTS` in
`src/content/contracts/variables.ts`, under a header saying they are the
firm's to confirm. The same nine applicant fields feed the powers of
attorney, so the client is asked once.

**What the documents can print.** The PDF fonts are WinAnsi. A value holding
a letter WinAnsi lacks is folded **as a whole** to plain ASCII, the way a
passport's machine readable line spells it (`Łukasz Żółć` prints
`Lukasz Zolc`, never a mix of accented and bare letters). A value in a script
that cannot be folded at all (Cyrillic, Chinese, Arabic) is refused by the
applicant validation with "Use Latin letters, as in the machine readable
line of your passport." The tables live in `src/lib/pdf/characters.ts`,
which imports no PDF library so the browser can use them too.

## 3. Content and PDF

- `scripts/generate-contracts.mjs` (`npm run contracts:generate`, with
  `-- --check` and `-- --stdout`) opens each `.docx` as a zip (central
  directory + `zlib.inflateRawSync`, no dependency), walks
  `word/document.xml` tag by tag and writes
  `src/content/contracts/models.generated.ts`: for `nif`, `bank`, `package`
  and `annex`, an array of blocks `{ kind, text }` plus optional facts read
  from the model's own formatting (`bold` character ranges, `center`,
  `small`, `indent`, `breakBefore`, `ruleAbove`). Kinds: `title`,
  `subtitle`, `plain`, `clause`, `clauseTitle`, `numbered`, `lettered`,
  `partHeading`, `checkbox` (text without the ballot box; the PDF draws it),
  `signatureHeading`, `signatureLabel`, `signatureName`, `formLine`. 525
  blocks in all (157, 161, 175, 32). It stops with an error on anything it
  cannot read (a table, automatic numbering, a field) instead of dropping
  text. The file header says it is generated and must not be edited by hand.
- `models.test.ts` pins the block counts, that every token in the generated
  text is a known token of `variables.ts` and the reverse (a new placeholder
  in a future model fails loudly), the real numbering sequences, the
  letterhead text, and, when `docs/terms` is present, that regenerating
  produces the committed file byte for byte (CRLF normalised).
- `src/lib/pdf/layout.ts`: the page cursor, word wrap, hanging indents and
  folding extracted from the deeds, plus a rich path for mixed bold and
  regular text with justification. The deeds' page streams are byte
  identical to before the refactor.
- `src/lib/contracts/generate.ts`:
  `generateContractPdf(template, values, opts?: { reference?: string })`.
  A4, Times 10 pt, justified like the models with the models' own bold,
  clause headings centred, numbered paragraphs and lettered items hanging,
  the signature block kept on one page with the "Done in duplicate" line, no
  heading left alone at the foot of a page, Annex I on a new page and its
  parts B and C each on their own page as the model's page breaks say, the
  two tick boxes as vector squares, a footer on every page with
  `Reference: <order id>` and `Page x of y`. 11 pages for `nif` and `bank`,
  12 for `package`, blank or filled. Also exports `substituteBlocks`,
  `contractBlocks`, `hasValues`, `BLANK_RULE` for the tests.
- `src/lib/contracts/words.ts`: `euroAmount(cents)` and `euroWords(cents)`.
- `npm run contract:preview -- [--bank|--package] [--filled]` writes a
  gitignored `contract-preview[-bank|-package][-filled].pdf`.

## 4. Data

`supabase/migrations/0009_service_contracts.sql`, additive only:

```sql
alter table public.services
  add column contract_template text check (contract_template in ('nif','bank','package'));
-- nif-only -> nif, bank-only -> bank, bundle -> package, couple stays null

create table public.user_service_contracts (
  id               uuid primary key default gen_random_uuid(),
  user_service_id  uuid not null unique references public.user_services(id) on delete cascade,
  template         text not null check (template in ('nif','bank','package')),
  version          integer not null default 1,
  storage_key      text not null unique,
  file_name        text not null,
  size_bytes       integer not null check (size_bytes > 0),
  variables        jsonb not null,          -- exactly what was printed
  generated_at     timestamptz not null default now(),
  emailed_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
```

RLS on; clients select their own (through `user_services.user_id`), admins
select all, nobody writes through PostgREST (grants revoked as in 0006).

Row types in `src/lib/db/types.ts`: `ContractTemplate`,
`ServiceRow.contract_template`, `UserServiceContractRow`.
`OrderViewData.contract` and `AdminOrderDetail.contract` carry the row or
`null`.

## 5. Server

- `src/lib/r2/client.ts`: `putObject({ key, body, contentType })` and
  `getObject(key)`. Keys: `contracts/{orderId}/v{version}.pdf`.
- `src/lib/email/send.ts`: optional `attachments` (Resend takes base64).
  `templates.ts`: `serviceAgreement({ serviceName, dashboardUrl })`, subject
  "Your service agreement", one short paragraph, the PDF attached, a button
  to the order.
- `src/lib/contracts/state.ts` (pure, safe to import anywhere):
  `contractState(...)` → `"off"` (no template, or unpaid), `"needs_details"`,
  `"ready"` (a row exists; a row wins over a template lost later).
- `src/lib/contracts/ensure.ts`:
  - `ensureContract(admin, orderId, opts?)`: idempotent. Loads order,
    service, applicant 0, user. Generates once: PDF, `putObject`, insert the
    row (`unique (user_service_id)` settles a race: the loser re-reads),
    then sends the email once and stamps `emailed_at`. A failed email never
    fails the call; while `emailed_at` is null the next call retries the
    email only.
  - `regenerateContract(admin, orderId)`: admin only, new version and key,
    row updated, email sent again. Creates version 1 when the client typed
    details for a deed and never confirmed the agreement form.
  - `parseSigningPlace(raw)`: trimmed, control characters stripped,
    characters the documents cannot print refused, max 120.
  - Never called from the payment path: a contract hook must not be able
    to turn a Stripe webhook into a 500.
- Routes:
  - `POST /api/orders/[id]/contract` (owner): optional JSON
    `{ signingPlace }`, body over 4 KB is 413. 200 `{ status: "ready" }`,
    409 `{ error: "details_missing" }`, 409 "Payment first.", 404 when the
    service has no template, 403 "This order is not yours." as the other
    order routes.
  - `GET /api/orders/[id]/contract` (owner or admin): **streams the PDF**
    from R2 through the route, `inline` by default so the browser shows it
    and a refresh keeps working, `?download=1` for `attachment`;
    `Cache-Control: private, no-store`. Anonymous visitors go to
    `/en/login?next=/en/dashboard/orders/{id}`. 404 "No agreement yet."
  - `POST /api/admin/orders/[id]/contract` (`requireAdmin`): regenerate.
- `validateServiceInput`: `contract_template` absent leaves the column
  alone, `null` clears it, one of the three sets it, anything else is 422
  "Choose a contract or none."

## 6. Client

The flow the owner asked for: pay, a form appears, the agreement opens in a
new tab, arrives by email, and stays downloadable on the order.

- `src/components/dashboard/contract/contract-gate.tsx`, rendered by
  `order-view.tsx` right under the "Payment received" notice when the order
  is paid and the service has a template (the modal and the full page both
  render `order-view.tsx`, so both get it):
  - no contract row: a card "Your service agreement" with one line
    ("Confirm your details and we prepare it. It opens in a new tab and a
    copy goes to {email}.") and a button "Confirm my details". **Right
    after payment the details dialog opens by itself**: the dashboard
    arrives at `?order=<id>` from Stripe, and the gate opens the dialog once
    per mount when the order was paid less than 15 minutes ago
    (`fresh-payment.ts`, tolerant of a browser clock slightly behind). A
    later visit shows the card without the dialog jumping out. A completed
    order is not asked.
  - contract row: "Prepared on {date}. A copy was sent to {email}." with two
    actions, **View** (new tab, inline) and **Download** (`?download=1`).
    This is the download button in the order details. While `emailed_at` is
    null the gate POSTs once per mount to retry the email.
- The dialog is `applicant-details-form.tsx` with `purpose: "contract"`:
  title "Your details for the service agreement", the nine applicant fields
  (prefilled from the order's row, else from the account's other orders), a
  read only line "Your agreement is sent to {email}", the optional field
  "City and country you are in today", the button "Confirm and open my
  agreement". The fields are validated in the browser with the same pure
  rules the server uses (`src/lib/orders/applicant-rules.ts`), so a refusal
  never opens a tab.
- Submit: `window.open("", "_blank")` runs synchronously inside the click so
  no popup blocker interferes; then PUT the applicant, POST the contract,
  point the new tab at `GET /api/orders/[id]/contract`, close the dialog and
  `router.refresh()`. On a failure the blank tab is closed and the route's
  one line shows under the form. If the browser still refused the tab (the
  in-app preview pane does), the card says "Your agreement is ready. Open it
  below."
- Every dialog that locks the page scroll uses one counted lock
  (`src/components/ui/scroll-lock.ts`), so two dialogs closing in the same
  commit cannot leave the page frozen.
- The deed slots keep working as today; after this form they find the
  details already there.

## 7. Admin

- Order modal, "Service agreement" block: the state (not required / after
  payment / waiting for the client's details / prepared, version, file,
  emailed on or not emailed yet), a **Download** link, and **Regenerate and
  resend** (or **Prepare and send** when no version exists yet), which asks
  for confirmation. When the client changed their details after the version
  was prepared, an amber line says so: the deeds print the live details, the
  agreement prints what it had. The comparison is on the printed values
  (`contractDrift` in `variables.ts`), never on timestamps.
- Services editor: a select **Service contract** (None, NIF, Bank account,
  NIF + Bank account package); the services table shows "Agreement: …". The
  four wizard slugs may change it (only slug and price are locked).

## 8. Open points for the firm

1. **How the client signs.** The models end in signature lines and Annex I,
   Part A, is "to be signed by the Client before any work begins". Today
   the PDF is delivered unsigned; nothing records a signature or a click.
2. `[NUMBER OF BANKS]` and `[REPRESENTATION PERIOD]` values.
3. **VAT.** The Fourth Clause reads "€[TOTAL FEE] (…), plus VAT at the legal
   rate where applicable". `[TOTAL FEE]` prints everything Stripe charged.
   Is the site price VAT inclusive, and should the contract print the net
   amount for clients VAT applies to?
4. **Addresses.** The contracts give the registered office as Av. Elias
   Garcia, 123-A; the Word letterhead of the same files and the powers of
   attorney give Av. António Augusto Aguiar, 24. Both print as the models
   say.
5. **Letterhead.** Should the client copy carry the firm's letterhead, and
   with which address and URL (the header cites
   `visas.vianaconsultancy.com`)?
6. The numbering gaps listed in section 1.
7. The Couple package has no model.
8. Whether a copy of the email goes to the firm.
