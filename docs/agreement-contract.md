# Service agreement contract (2026-09-21, amended 2026-09-25)

The fifth design round: the contract for legal services the client receives
after paying. It replaces section 6 of `documents-contract.md`, which was
written before the firm sent its models. Where this file and the older ones
disagree, this file wins. It describes the code as built and reviewed on
2026-09-21, amended on 2026-09-25 by the delivery round, which built
Patrícia's answers of 2026-09-24 to the open points of section 8: the models
edited, a fifth model for the Couple package, the letterhead, the firm's
signature, the signed copy coming back as a document and the terms accepted
before paying.

Vocabulary: in code the feature is `contract` / `contracts`; in client facing
copy it is the **service agreement**, so it never reads like a second thing
to buy. House rules for copy apply (no dashes as punctuation, no "problem",
"trap", "free", "refund", "money back", "video call", "run by lawyers"; short
sentences; US friendly English in the client area).

## 1. The models

`docs/terms/` holds the firm's models, English only. The four the firm sent
on 2026-09-21 are kept untouched in `docs/terms/originais-2026-09-21/`; since
2026-09-25 the files in `docs/terms/` itself are written from them (below).

| File | Template id | Used by |
|---|---|---|
| `MODELO - Contract for Legal Services - NIF (blank fields).docx` | `nif` | `nif-only` |
| `MODELO - Contract for Legal Services - Bank Account (blank fields).docx` | `bank` | `bank-only` |
| `MODELO - Contract for Legal Services - NIF + Bank Account Package (blank fields).docx` | `package` | `bundle` |
| `MODELO - Contract for Legal Services - Couple Package (blank fields).docx` | `couple` | `couple` (since 2026-09-25) |
| `MODELO - Annex I - Immediate Commencement and Withdrawal (blank fields).docx` | appended to every contract | all |

**The edits of 2026-09-25.** `scripts/edit-contract-models.mjs`
(`npm run contracts:edit`; `-- --check` exits 1 when `docs/terms` differs
from what it would write, `-- --dry-run` prints the changes and writes
nothing) applies Patrícia's answers to the originals:

- The Second Party's registered office, "Av. Elias Garcia, 123-A, 1050-098
  Lisbon, Portugal", becomes "Av. António Augusto Aguiar, 24, 1st floor
  right, Office 3, 1050-016 Lisbon, Portugal", in the parties paragraph of
  the three contracts and in the addressee line of Annex I, Part C. The
  contracts, their letterhead and the powers of attorney now give one
  address.
- The Fourth Clause's "plus VAT at the legal rate where applicable under
  Portuguese tax law" becomes "VAT included": the site's prices include VAT,
  and `[TOTAL FEE]` prints what Stripe charged.
- The numbering gaps are closed (NIF: Seventh and Ninth Clauses; bank: Ninth
  Clause). Only the leading number of each paragraph moves.
- The Couple package model is derived from the package model: "Couple
  Package" in the subtitle, a First Party paragraph naming two persons with
  the partner's tokens (section 2) and ending "both with email address
  [EMAIL], hereinafter jointly referred to as the First Party or Client",
  and a second First Party signature line. **Our drafting**, for the firm to
  read (section 8).

Every change states how many times it applies in each model, and the script
stops when an original does not match: a changed original is a reason to
look again, not to guess. `word/document.xml` is edited as text, never
parsed and written back, so what the script does not touch stays byte for
byte, and the zip is rewritten deterministically (`scripts/lib/zip.mjs`).
Then `npm run contracts:generate` reads the five models, as before. To change
the wording again, change the originals or the script, run both commands and
commit the `.docx` files with the generated modules.

Beyond those edits, nothing in the wording is ours to change. The text is
never retyped: a script reads the `.docx` files and writes the TypeScript
module the generator uses (section 3), so the PDF says what the model says.

Each model also carries a Word **letterhead**: a header with the firm's logo
and four lines (+351 934 548 395, `patriciaviana-65755L@adv.oa.pt`,
`https://visas.vianaconsultancy.com/` and the Av. António Augusto Aguiar
address), and a footer drawing. Since 2026-09-25 the PDF draws the logo and
the four lines on the first page (section 3), as Patrícia asked; the icon
column and the footer drawing are not reproduced.

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
| `[FULL NAME 2]` to `[TAX RESIDENCE ADDRESS 2]` | Couple package only (2026-09-25): the same eight fields of applicant 1, the partner (`PARTNER_TOKENS`: the first person's token with " 2" before the closing bracket) |
| `[EMAIL]` | the account email (`users.email`), not editable in the form; on the Couple package both persons share it |
| `[TOTAL FEE]` | `user_services.total_cents`, printed `149` (or `149.50`, never a thousands separator) after the model's own euro sign; VAT included since 2026-09-25 (section 1) |
| `[FEE IN WORDS]` | the same amount in English words, `one hundred and forty-nine`; cents read as a decimal (`point five zero`) because the model prints `([FEE IN WORDS] euros)` |
| `[REPRESENTATION PERIOD]` | firm constant, `12 (twelve) months`, confirmed by the firm on 2026-09-24; in `nif`, `package` and `couple` |
| `[NUMBER OF BANKS]` | firm constant, `1 (one)`, confirmed by the firm on 2026-09-24; in `bank`, `package` and `couple` |
| `[DAY] [MONTH] [YEAR]` | the payment date (`paid_at`) in Europe/Lisbon: `21 September 2026` |
| `[SERVICE: NIF / BANK ACCOUNT / NIF + BANK ACCOUNT PACKAGE]` | by template: `NIF`, `BANK ACCOUNT`, `NIF + BANK ACCOUNT PACKAGE`, `COUPLE PACKAGE` |
| `[EMAIL OF THE SECOND PARTY]` | firm constant, `CONTACT.email` from `src/content/bank-nif.ts` |
| `[PLACE]` (Annex I, Part A) | optional form field "City and country you are in today"; empty prints a blank rule to fill by hand |
| Annex I tick boxes | an online purchase is "at a distance": first box drawn ticked, second empty |

The firm constants live in `FIRM_CONSTANTS` in
`src/content/contracts/variables.ts`; Patrícia confirmed the first two on
2026-09-24. Change them there and nowhere else. The same nine applicant
fields feed the powers of attorney, so the client is asked once.
`KNOWN_TOKENS` holds the 27 tokens the five models use: the 19 of
2026-09-21 and the partner's eight.

`buildContractValues({ order, service, applicants, email, signingPlace })`
fills them. It throws `ContractValuesError` for a service with no template,
and for a Couple package without applicant 1: a contract for two persons is
never printed with one. A missing applicant 0 is not an error there (the
contract keeps its brackets); `ensureContract` asks for the details before
it generates anything. `buildContractValuesFromFields` takes the same facts
one by one, for the seed scripts and the tests.

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
  `src/content/contracts/models.generated.ts`: for `nif`, `bank`, `package`,
  `couple` and `annex`, an array of blocks `{ kind, text }` plus optional
  facts read from the model's own formatting (`bold` character ranges,
  `center`, `small`, `indent`, `breakBefore`, `ruleAbove`). Kinds: `title`,
  `subtitle`, `plain`, `clause`, `clauseTitle`, `numbered`, `lettered`,
  `partHeading`, `checkbox` (text without the ballot box; the PDF draws it),
  `signatureHeading`, `signatureLabel`, `signatureName`, `formLine`. 701
  blocks in all (157, 161, 175, 176, 32). It stops with an error on anything
  it cannot read (a table, automatic numbering, a field) instead of dropping
  text. The file header says it is generated and must not be edited by hand.
  Since 2026-09-25 it also writes
  `src/content/contracts/letterhead.generated.ts`, the logo of the models'
  header (`word/media/image3.png`, 2639 x 1830 pixels) shrunk by 6 to
  440 x 305 through `scripts/lib/png.mjs`, as base64; `--check` covers both
  files.
- `models.test.ts` pins the block counts, that every token in the generated
  text is a known token of `variables.ts` and the reverse (a new placeholder
  in a future model fails loudly), that the partner's tokens appear in the
  Couple package and nowhere else, Patrícia's answers in every model (the new
  address, VAT included), that the Couple package differs from the package
  model only in its title, parties and signatures, that every clause numbers
  its paragraphs 1, 2, 3 with no gap, the letterhead text, and, when
  `docs/terms` is present, that regenerating produces the committed files
  byte for byte (CRLF normalised) and that the models are the originals with
  Patrícia's changes.
- `src/lib/pdf/layout.ts`: the page cursor, word wrap, hanging indents and
  folding extracted from the deeds, plus a rich path for mixed bold and
  regular text with justification. The deeds' page streams are byte
  identical to before the refactor.
- `src/lib/contracts/generate.ts`:
  `generateContractPdf(template, values, opts?: { reference?, signature?, specimen? })`.
  A4, Times 10 pt, justified like the models with the models' own bold,
  clause headings centred, numbered paragraphs and lettered items hanging,
  the signature block kept on one page with the "Done in duplicate" line
  (the Couple package's two First Party lines included), no heading left
  alone at the foot of a page, Annex I on a new page and its parts B and C
  each on their own page as the model's page breaks say, the two tick boxes
  as vector squares, a footer on every page with `Reference: <order id>` and
  `Page x of y`. At most 11 pages for `nif` and `bank`, 12 for `package` and
  13 for `couple`, blank or filled. Also exports `substituteBlocks`,
  `contractBlocks`, `annexBlocks`, `hasValues`, `BLANK_RULE`,
  `SPECIMEN_LINE`, `FIRM_SIGNATURE_MAX_PIXELS` and `SECOND_PARTY_SIGNATORY`
  for the tests.
  - **Letterhead** (2026-09-25): on the first page, the logo at the top
    left, 30 mm wide, the header's four lines right aligned at the top right
    in 8 pt, centred on the logo, and a thin rule under both; the contract
    starts under the rule.
  - **The firm's signature** (2026-09-25): `opts.signature` is Patrícia's
    digitised signature, a PNG, drawn above the Second Party's rule (the
    line printed `PATRÍCIA SOARES VIANA`), about 40 mm wide and at most 45 pt
    tall, aspect kept, the room above the rule grown to fit. A file pdf-lib
    cannot read, or one larger than 600 x 300 pixels
    (`FIRM_SIGNATURE_MAX_PIXELS`, about 380 dpi at the printed width), throws
    before anything is drawn; the caller then generates again without it.
    Without one the line stays blank for a pen.
  - **Specimen** (2026-09-25): `opts.specimen` prints `SPECIMEN_LINE`,
    "Specimen from the test environment. Not a binding agreement.", under
    the footer of every page, inside the bottom margin, so the text does not
    move. Section 5 says which agreements get it.
  - **Annex I for the Couple package** (`annexBlocks`, 2026-09-25): Annex I
    is one model shared by every contract and names one Client. For
    `couple` the opening paragraph names the partner too ("and
    [FULL NAME 2], holder of passport no. [PASSPORT NO. 2], jointly as
    Client") and Part A gets a second Client signature line. Nothing else in
    Annex I changes, and the generator throws when Annex I no longer holds
    the two lines it adapts. Our drafting.
  - The PDF's subject for `couple` reads "Portuguese Tax Identification
    Number (NIF)", singular, as the model's own subtitle does, until the
    firm settles the wording for two NIFs (section 8).
- `src/lib/contracts/words.ts`: `euroAmount(cents)` and `euroWords(cents)`.
- `npm run contract:preview -- [--bank|--package|--couple] [--filled] [--signature <png>]`
  writes a gitignored `contract-preview[-bank|-package|-couple][-filled][-signed].pdf`.
  A preview never carries the specimen line.

## 4. Data

`supabase/migrations/0009_service_contracts.sql`, additive only:

```sql
alter table public.services
  add column contract_template text check (contract_template in ('nif','bank','package'));
-- nif-only -> nif, bank-only -> bank, bundle -> package, couple stays null (until 0017)

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

`supabase/migrations/0017_couple_contract.sql` (2026-09-25) widens both
checks to `('nif','bank','package','couple')`, dropping 0009's inline checks
by what the catalogue says rather than by a guessed name, and sets
`contract_template = 'couple'` on the service `couple`. No grant or policy
changes. `0013_signed_agreement_slot.sql` and `0014_terms_acceptance.sql`
belong to this contract too (sections 6 and 9). The five migrations of the
round, 0013 to 0017, were applied to the live project on 2026-09-25.

Row types in `src/lib/db/types.ts`: `ContractTemplate` (`couple` since
0017), `ServiceRow.contract_template`, `UserServiceContractRow`.
`OrderViewData.contract` and `AdminOrderDetail.contract` carry the row or
`null`. The list of models every side reads (the editor's select, the
services route, the agreement's own checks) is `CONTRACT_TEMPLATES` in
`src/lib/contracts/templates.ts`, with `isContractTemplate` and
`contractPersons(template)`: 2 for `couple`, 1 for every other model.

## 5. Server

- `src/lib/r2/client.ts`: `putObject({ key, body, contentType })` and
  `getObjectBytes(key)`. Keys: `contracts/{orderId}/v{version}-{nonce}.pdf`
  since 2026-09-25, the nonce eight random hex characters. Every attempt at a
  version gets a key no other attempt uses, so the loser of a race can never
  overwrite the file the winner's row describes and emailed; its file stays
  in the order's folder with nothing pointing at it. (Until 2026-09-25 the
  key was `v{version}.pdf`; the demo seeds still write that shape.)
- `src/lib/email/send.ts`: optional `attachments` (Resend takes base64).
  `templates.ts`: `serviceAgreement({ serviceName, dashboardUrl })`, subject
  "Your service agreement", one short paragraph, the PDF attached, a button
  to the order.
- `src/lib/contracts/state.ts` (pure, safe to import anywhere):
  `contractState(...)` → `"off"` (no template, or unpaid), `"needs_details"`,
  `"ready"` (a row exists; a row wins over a template lost later).
  `contractStatus(...)` gives the same answer with, for `needs_details`, the
  first person the model names whose details are not on the order
  (`missing`: 0, 1 for the Couple package's partner, or null when all are
  there) and `persons`. `missingContractApplicant(template, applicants)` is
  the rule both read.
- `src/lib/contracts/ensure.ts`:
  - `ensureContract(admin, orderId, opts?)`: idempotent. Loads order,
    service, the details of every person the model names (applicant 0; for
    `couple`, applicant 1 too) and the user. A missing person answers
    `needs_details` with the index of the first one. Generates once: PDF,
    `putObject`, insert the row (`unique (user_service_id)` settles a race:
    the loser re-reads), then sends the email once and stamps `emailed_at`.
    A failed email never fails the call; while `emailed_at` is null the next
    call retries the email only.
  - **The firm's signature** (2026-09-25). Every generation reads
    `firm/signature.png` (`FIRM_SIGNATURE_KEY`) from the bucket and hands it
    to the generator, **only for an order paid with real money** (below);
    every other agreement is generated as a specimen, with no signature. A
    missing file, a bucket that does not answer, a file that is not a PNG or
    one the generator refuses is logged, and the agreement is prepared with
    a blank line: the signature never turns a request into a 500. The file
    is uploaded by hand with `npm run firm:signature -- <file.png>`
    (`--dry-run` checks only), which refuses a file over 2 MB, warns about
    a white background, shrinks an 8 bit PNG larger than 600 x 300 pixels
    by a whole factor and refuses any other larger one. An agreement
    prepared before the upload keeps its blank line until it is
    regenerated.
  - **What counts as real money** (2026-09-25), `isLiveOrder` and
    `paidWithRealMoney` in `src/lib/orders/live-payment.ts` (next to the
    orders, because `notify.ts` reads it on the payment path and must reach
    no contract code). An order with a Checkout Session is live when the
    session id starts with `cs_live_`; `cs_test_` never is. An order paid
    outside the platform (no session, an admin's `paidOutside`) is live only
    when its events hold `MANUAL_PAYMENT_LIVE_NOTE`, "Paid outside the
    platform, recorded by the admin on the live site", which
    `recordManualPayment` writes when the deploy recording the payment holds
    a live Stripe key (`holdsLiveKey()`, production only); anywhere else it
    writes the same line ending "on the test site". A payment recorded
    before 2026-09-25 carries the older note and reads as not live. An
    unpaid order is never live, and a failed read throws before anything is
    written. The reason: production, staging and development share the
    bucket and the database, and staging stays up with Stripe in test mode,
    so anyone could otherwise pay with a test card and receive an agreement
    on the firm's letterhead with Patrícia's signature. The rule reads what
    the server wrote when the payment happened, never the key of the deploy
    that renders the PDF later.
  - `regenerateContract(admin, orderId)`: admin only, new version and key,
    row updated, email sent again. Creates version 1 when the client typed
    details for a deed and never confirmed the agreement form. Reads the
    signature again, so regenerating an agreement prepared before the
    signature arrived is how it gets signed (on a real order only). For
    `couple` it waits for both persons: 409 "The client has not entered
    their partner's details yet." while applicant 1 is missing.
  - `parseSigningPlace(raw)`: trimmed, control characters stripped,
    characters the documents cannot print refused, max 120.
  - Never called from the payment path: a contract hook must not be able
    to turn a Stripe webhook into a 500.
- Routes:
  - `POST /api/orders/[id]/contract` (owner): optional JSON
    `{ signingPlace }`, body over 4 KB is 413. 200 `{ status: "ready" }`,
    409 `{ error: "details_missing", applicant: 0 | 1 }` naming the first
    person missing (1 is the Couple package's partner, since 2026-09-25),
    409 "Payment first.", 404 when the service has no template, 403 "This
    order is not yours." as the other order routes.
  - `GET /api/orders/[id]/contract` (owner or admin): **streams the PDF**
    from R2 through the route, `inline` by default so the browser shows it
    and a refresh keeps working, `?download=1` for `attachment`;
    `Cache-Control: private, no-store`. Anonymous visitors go to
    `/en/login?next=/en/dashboard/orders/{id}`. 404 "No agreement yet." It is
    also what the signed agreement slot's "Download to sign" opens
    (section 6).
  - `POST /api/admin/orders/[id]/contract` (`requireAdmin`): regenerate, or
    prepare the first version.
- `validateServiceInput`: `contract_template` absent leaves the column
  alone, `null` clears it, one of the four models sets it, anything else is
  422 "Choose a contract or none." Since 2026-09-25 a document slot with
  `template = 'agreement'` needs a contract, since without one no agreement
  is prepared and the required slot would hold every order on the documents
  stage: `validateServiceInput` answers 422 "Choose a service contract, or
  remove the signed service agreement from the documents." when the body
  names no contract, and `upsertService` answers the same when the body
  leaves the key out and the stored contract is null.
- Since 2026-09-21 the payment path sends emails of its own
  (`src/lib/orders/notify.ts`, `docs/platform-contract.md` section 8):
  "Payment received" to the client, whose second line asks them to confirm
  their details for the service agreement when the service has a template,
  and "New paid order" to the team inbox, which says the same. Both read
  `services.contract_template` as a column; `notify.ts` imports nothing from
  `src/lib/contracts` or `src/content/contracts`, so the rule above holds.
  Neither email carries the agreement. Since 2026-09-25 the client's signed
  copy reaches the team inbox (section 6, "Signed copy back"); the prepared
  agreement itself still goes to the client only.
- Since 2026-09-21 `sendEmail` skips `.invalid` recipients and answers ok.
  The demo orders of `npm run demo:seed` (accounts on
  `demo.alttavia.invalid`) carry agreements drawn by the real generator and
  seeded with `emailed_at` set; an agreement prepared or regenerated for one
  of them during training also gets `emailed_at` stamped, although nothing
  was sent. The seeded agreements are generated without the specimen line;
  one regenerated on staging carries it, since every demo order was paid
  with a test session.

## 6. Client

The flow the owner asked for: pay, a form appears, the agreement opens in a
new tab, arrives by email, and stays downloadable on the order. Since
2026-09-25 the client also signs it by hand and sends the signed copy back.

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
- **The Couple package** (2026-09-25). One agreement names both people, so
  the card needs two sets of details before the route prepares it. Its line
  reads "Confirm your details and your partner's details and we prepare
  it.", and "Confirm the details" opens the details dialog in its save only
  variant with `wording: "agreement"`: "Your details for the service
  agreement" (applicant 0), then "Your partner's details for the service
  agreement" (applicant 1), each with "Continue" and each saved on its own.
  Once both are on the order the card offers the optional "City and country
  you are in today" and a button of its own, "Open your agreement", which
  does what the one person dialog does on submit (a blank tab opened inside
  the click, then the POST, then the tab pointed at the agreement,
  `prepare-agreement.ts`). Details already on the order, typed for a deed,
  count: the card then goes straight to the button, with "Check the
  details" to walk the two dialogs again. A 409 naming an `applicant`
  opens that person's dialog. Right after payment only the first of the two
  dialogs opens by itself, and only while the two sets are not both on the
  order. This is one click more than the one person flow, on purpose: the
  tab has to open inside a click.
- Every dialog that locks the page scroll uses one counted lock
  (`src/components/ui/scroll-lock.ts`), so two dialogs closing in the same
  commit cannot leave the page frozen.
- The deed slots keep working as today; after this form they find the
  details already there.
- **Signed copy back** (2026-09-25, Patrícia's answer: "like the powers of
  attorney"). `0013_signed_agreement_slot.sql` adds one required document
  slot to every service with a contract (nif-only, bank-only, bundle,
  couple): key `signed_agreement`, label "Signed service agreement",
  `template = 'agreement'`, `per_applicant = false` (once per order; on the
  Couple package one paper under "For both of you" that both sign), the
  default file types and size, at the end of the list. Its note: "Download
  your service agreement, sign it by hand with the same signature as in your
  passport, then upload a scan or a photo of the signed pages." In the slot
  (`documents/document-slot.tsx`, the rule in `documents/slot-controls.ts`):
  - once the agreement exists (`contractReady`, a boolean `order-view.tsx`
    derives from the row), **Download to sign** is a link that opens
    `GET /api/orders/[id]/contract` in a new tab, inline; no details dialog
    and no "Edit your details" here, the details belong to the card above.
    The line under it is the deeds' "Sign exactly as you signed your
    passport.", or on a couple order "Both of you sign it, each exactly as
    you signed your own passport." The file input reads **Upload the signed
    copy**;
  - before the agreement exists the slot takes no file and says "Confirm
    your details first, above, and your agreement appears here."
    `POST /api/documents/upload-url` holds the same rule for a request made
    by hand: 409 "Your agreement is not ready yet. Confirm your details
    first.";
  - the rest is any slot's: replace or remove while it waits for review on
    the documents stage, closed once approved or once the order moves on.

  Every confirmed upload in the slot goes through `notifySignedAgreement`
  (`src/lib/orders/notify.ts`): "Signed service agreement received" to the
  team inbox, **once per review round** (the first copy, then one more after
  each copy the firm rejects; a replacement, or a removal and a new upload,
  in between sends nothing), with the file attached only for an order paid
  with real money (section 5), 8 MB or smaller, whose first bytes match its
  declared type, under the server's own name
  (`signed-agreement-<order>.<ext>`, the extension from the file's type). `docs/platform-contract.md` section 8 has
  the details. The documents stage holds the order until the slot is
  approved (`docs/admin-contract.md` section 7). Orders already past the
  documents stage when 0013 ran are not held: their new slot stays closed
  and empty.

## 7. Admin

- Order modal, "Service agreement" block: the state (not required / after
  payment / waiting for the client's details / prepared, version, file,
  emailed on or not emailed yet), a **Download** link, and **Regenerate and
  resend** (or **Prepare and send** when no version exists yet), which asks
  for confirmation. When the client changed their details after the version
  was prepared, an amber line says so: the deeds print the live details, the
  agreement prints what it had. The comparison is on the printed values
  (`contractDrift` in `variables.ts`), never on timestamps.
- For the Couple package (2026-09-25) the block waits for both persons: the
  action shows only once applicant 0 and applicant 1 have details, the body
  says "The agreement names the client and their partner. It can be prepared
  once the partner's details are entered too." while only the partner's are
  missing, the drift check compares both people's sixteen tokens, and the
  confirmation speaks of both sets of details.
- Since 2026-09-25 the block also shows the client's acceptance at checkout,
  read only: "The client accepted the service terms and the service
  agreement before paying, on {date and time} (terms of {version})."
  (section 9). Orders paid before 0014 show nothing.
- The signed agreement slot in the modal's document list carries **Download
  agreement** (the prepared agreement, `?download=1`) once it exists, and
  the client's signed copy is the slot's file, viewed, approved or rejected
  like any other. For the Couple package the "Details for the deeds" block
  lists both persons because of it.
- Services editor: a select **Service contract** (None, NIF, Bank account,
  NIF + Bank account package, and since 2026-09-25 Couple package); the
  services table shows "Agreement: …". The four wizard slugs may change it
  (only slug and price are locked). The document rows' select, renamed
  **Document to sign** on 2026-09-25, offers "Signed service agreement"
  beside the two powers of attorney.

## 8. Open points for the firm

Patrícia answered the points of 2026-09-21 on 2026-09-24, and the delivery
round built the answers on 2026-09-25. As history:

1. **How the client signs.** By hand, like the powers of attorney: the
   client downloads the agreement, signs it and uploads the signed copy into
   the required slot (section 6). The firm's side carries Patrícia's
   digitised signature on orders paid with real money (section 5), and the
   client accepts the terms before paying (section 9).
2. `[NUMBER OF BANKS]` is "1 (one)" and `[REPRESENTATION PERIOD]` "12
   (twelve) months", confirmed.
3. **VAT.** The site's prices include VAT; the Fourth Clause reads "VAT
   included" (section 1).
4. **Addresses.** One address, Av. António Augusto Aguiar, 24, in the
   contracts, the letterhead and the powers of attorney.
5. **Letterhead.** Yes, on the first page (section 3).
6. The numbering gaps are closed.
7. The Couple package has one contract naming both persons (section 1).
8. The firm receives the client's signed copy (section 6); the agreement as
   prepared still goes to the client only.

**Still open, for the firm to read (2026-09-25):**

1. **The Couple contract's body stays singular.** Only the subtitle, the
   parties paragraph and the signature lines were changed; the clauses still
   say "the Client" and "the assignment of a Portuguese Tax Identification
   Number (NIF)", although the package sells two NIFs and a joint account.
   The PDF's subject follows the subtitle. The firm reads the whole model
   (`npm run contract:preview -- --couple --filled`) and gives the wording;
   it then goes into `scripts/edit-contract-models.mjs` as counted
   replacements.
2. **Annex I, Part A, stays in the first person singular** ("I, the Client
   identified above, expressly request…") on the Couple package, while two
   people sign it. The plural, if the firm wants it, goes into
   `annexBlocks` the same way.
3. **The bank deed's clause d)** still grants a single holder account
   (*conta de titular único, tipo 01*), while the couple opens a joint one;
   since 2026-09-25 that clause sits in one deed both people sign
   (`docs/documents-contract.md` section 7). The plural wording of that
   joint deed is ours too.
4. **The signature can be extracted.** Anyone holding a PDF it is drawn on
   (every client paid with real money, and every inbox the PDF is forwarded
   to) can pull the embedded image out at the size it was embedded. The
   upload script and the generator cap it at 600 x 300 pixels, enough for
   print and no more, but the image itself travels with every signed
   agreement.
5. The letterhead cites `https://visas.vianaconsultancy.com/`, as the Word
   header does.

## 9. Accepted before paying (2026-09-25)

Patrícia's answer: the client accepts the terms before paying. Every Pay
button, and the purchase drawer's Confirm, carries the line "By paying you
accept the service terms and your service agreement." (`pay-terms-note.tsx`,
the words in `src/content/terms-version.ts`), "service terms" opening
`/en/service-terms` in a new tab; "your service agreement" is not a link,
since it is prepared after payment. The click is the acceptance:
`POST /api/checkout` refuses a body without `acceptTerms: true` with 422
"Accept the terms to continue." and writes `user_services.terms_accepted_at`
and `terms_version` (`TERMS_VERSION`, "2026-09-25" for the first wording;
0014) before it hands out any Stripe URL. The record is rewritten on every
Pay click while the order is unpaid and frozen once it is paid, so it is
the click that paid. Bump `TERMS_VERSION` on the day the service terms page
or these models change. `docs/platform-contract.md` section 8 has the route.
