# Privacy notice for /en/privacy: proposal

**Status:** PROPOSAL for Patrícia Viana to approve by **Thursday, September 24, 2026, 12:00 Lisbon time**. Not wired into any page. Written on September 21, 2026 from the code on branch `main-split-bank-and-nif` (commit `f126e38` plus this round's working tree).

This is a factual draft prepared by the developer for the lawyer's review. It is not legal advice from us.

How to read it:

- **[TO CONFIRM]** marks an assumption, or a fact outside the code, that the firm must check before publishing.
- **PROPOSAL** marks a value only the firm can decide. Retention periods are all PROPOSAL.
- Everything else describes what the platform does today. The source of each statement is listed in the last section.
- The section "The notice" is the page as it would be published: US English, house rules for copy, short sentences.
- Once approved, the landing footer's "Privacy" link (today `https://alttavia-relocation.com/en/privacy-policy`, the main site's general policy, which does not describe this platform) should point to `/en/privacy`. That change is outside this file.

## The notice

# Privacy notice

Last updated: [publication date]

This notice explains what personal data we collect through this site and your client area, why we need it, who handles it, how long we keep it, and what you can ask of us.

### Who we are

ALTTAVIA RELOCATION, Unipessoal Lda., NIPC 518 856 984, with registered office at [TO CONFIRM: Av. Elias Garcia, 123-A, 1050-098 Lisbon, as the service agreement says, or Av. António Augusto Aguiar, 24, 1050-016 Lisbon, as the letterhead and the powers of attorney say], Portugal.

We decide how your data is used. Under the GDPR, that makes us the controller.

For anything in this notice, write to info@alttavia-relocation.com. [TO CONFIRM: no data protection officer is named today. The firm decides whether one is required.]

### What we collect and why

**The application form.** The country on your proof of address, how many adults are applying, whether children also need a NIF (yes or no, nothing else), whether each adult already has a NIF, the bank account you want, the country of each passport, and your visa type. Until you create an account, these answers stay in your browser tab. We use them to suggest a service and prepare your order. Legal basis: steps you ask for before a contract (GDPR Article 6(1)(b)).

**Your account.** Your first name and your email address. We use them to open your client area and send your sign in codes. Legal basis: contract (Article 6(1)(b)).

**Your payment.** The service, the price, the payment date and Stripe's payment references. You enter your card details on Stripe's page. We never see or store them. Legal basis: contract, and our legal duty to keep accounting and tax records (Article 6(1)(c)).

**Your documents.** Depending on the service: passport, proof of address, the tax number from your country, bank statements or an annual income statement, proof of your profession, your Portuguese NIF document (bank account only), and the powers of attorney you sign. We use them to apply for your NIF or open your account. Legal basis: contract. [TO CONFIRM: also a legal obligation, if Portuguese anti money laundering law applies to the bank account service.]

**Your details for the documents we prepare.** Full name, whether the documents should refer to you as she or he, place and date of birth, passport number, issuing authority, issue and expiry dates, tax residence address and, if you give it, the city and country you are in when you confirm them. We print them on your powers of attorney and on your service agreement, and we keep a copy of the agreement as it was prepared. Legal basis: contract.

**What we deliver.** Your NIF document, your Portal das Finanças access, your IBAN confirmation and a closing report. Legal basis: contract.

**Messages.** Emails between us, and WhatsApp messages if you choose to write to us there. Legal basis: contract, or steps before a contract.

**Technical records.** The IP address and browser of each sign in session, and server error logs that can include your email address or your account number. We use them to keep the service secure and working. Legal basis: our legitimate interest (Article 6(1)(f)).

We do not sell your data and we do not use it for advertising.

No decision about you is made by automated means alone. The form suggests a service from your answers, you choose what to buy, and our team reviews every document.

We do not rely on your consent for anything today. If we ever add analytics or marketing, we will ask first, and you can withdraw that consent at any time.

The service is for adults. The details form accepts only people aged 18 or over, and this site collects no data about children.

### Who receives your data

- **Finanças** (Autoridade Tributária e Aduaneira), for your NIF, and **the bank** that reviews your account opening. Each acts under its own legal duties.
- **Our team**, bound by professional confidentiality. [TO CONFIRM: one administrator account exists today; list who else at the firm will have access.]
- **The service providers below**, who handle data only on our instructions.

### Service providers and where your data is stored

| Provider | What it does for us | Where the data is |
|---|---|---|
| Supabase | Database and sign in: your account, answers, orders, your details, and the records of your documents and agreement | London, United Kingdom |
| Cloudflare R2 | File storage: your documents, signed powers of attorney, service agreements and the files we deliver | European Union |
| Resend | Sends our emails: sign in codes, order updates, your service agreement as a PDF attachment, and notices to our team with your email address and the service you bought | [TO CONFIRM: region set for the sending domain] |
| Stripe | Takes your payment | [TO CONFIRM: Stripe Payments Europe, Limited, Ireland] |
| Netlify | Hosts this site and runs its server code | [TO CONFIRM: region of the server functions; Netlify's default is the United States] |
| guyshore.com | Builds and maintains the platform, with technical access to the systems above for support | [TO CONFIRM: country] |

Stripe also uses some payment data for its own purposes, such as fraud prevention, under its own privacy policy. [TO CONFIRM]

Some of these companies are based in the United States. [TO CONFIRM, for each provider: the transfer safeguard, for example certification under the EU and US Data Privacy Framework, or the Standard Contractual Clauses in the provider's data processing agreement.] The United Kingdom is covered by an EU adequacy decision. [TO CONFIRM it is in force on the publication date.] Ask us and we will send you a copy of the safeguards.

### How long we keep it

Today nothing is deleted automatically. Every deletion is made by hand. The periods below are PROPOSAL values for the firm to decide.

- **Someone who never pays:** answers and account kept for PROPOSAL 12 months after the last sign in, then deleted.
- **Your documents, your details for the documents, and the files we deliver:** kept until your service is complete, plus PROPOSAL [N] months (for example 12, the length of the tax representation), then deleted. [TO CONFIRM: longer if anti money laundering law applies.]
- **Your service agreement, payment and order records:** kept for PROPOSAL 10 years, the period Portuguese law sets for accounting records. [TO CONFIRM]
- **Emails:** kept for PROPOSAL as long as the order they belong to.
- **Technical records:** kept as long as each provider keeps them. [TO CONFIRM: the period for each provider]

When a period ends, we delete the data or make it anonymous.

### Your rights

You can ask us to:

- show you the data we hold about you and send you a copy;
- correct it;
- delete it, unless a law requires us to keep it;
- limit how we use it, or stop a use based on our legitimate interest;
- send you the data you gave us in a common format.

Write to info@alttavia-relocation.com from the email address on your account. We answer within one month. Some details you can correct yourself in your client area.

### Complaints

You can complain to the Portuguese data protection authority, the Comissão Nacional de Proteção de Dados (CNPD), at www.cnpd.pt. We would like the chance to help first, so please write to us too.

### Cookies and browser storage

This site sets only what it needs to work. There are no analytics or advertising cookies.

| Name | What it does | How long |
|---|---|---|
| `sb-dgdbrnvgrpixsslgvmns-auth-token` (sometimes split into `.0` and `.1`) | Keeps you signed in to your client area | Removed when you sign out; otherwise your browser keeps it up to 400 days |
| `sb-dgdbrnvgrpixsslgvmns-auth-token-code-verifier` | Used while you sign in with the email code | While you sign in |
| `alttavia_apply_v1`, `alttavia_apply_checkout_v1`, `alttavia_apply_name_v1` (session storage, not cookies) | Your form answers, the service you chose, and your first name until your account exists | Removed when you close the tab |

Fonts are served from this site, so your browser does not contact Google for them. The payment page is Stripe's own site, under Stripe's cookie policy.

Because all of the above is strictly necessary, we do not ask for consent to it. [TO CONFIRM] The site can load Google Tag Manager for analytics. It is switched off today, and we will ask for your consent before switching it on. [TO CONFIRM: `NEXT_PUBLIC_GTM_ID` is empty on the production deploy.]

### Security

Every page and every upload uses an encrypted connection. Files sit in private storage and are served only to their signed in owner or to our team. Each client sees only their own orders.

### Changes

When what we do changes, we update this notice and the date at the top.

## Where each statement comes from

For the reviewer. Paths are relative to the repository root.

- **Form answers.** `src/lib/apply/types.ts` (`Answers`: `residence`, `applicants`, `childrenNifs` as a boolean, `hasNif`, `bank`, `passport`, `visa`). Before sign in they live only in sessionStorage (`src/lib/apply/storage.ts`, `src/components/apply/checkout-storage.ts`). `POST /api/apply/submit` writes them to `public.user_answers` and `user_services.answers_snapshot`. The WhatsApp exits open `wa.me` with a prefilled text (number of applicants, proof of address country, visa), sent by the visitor (`whatsappMessage` in `src/content/apply.ts`).
- **Account.** "First name" and "Email address" in `src/components/auth/email-step.tsx`; the name goes to `public.users.full_name` (`src/components/apply/account-screens.tsx`). `public.users.phone` exists, but no form fills it. A client cannot change their own email (column grants in `0006_admin_hardening.sql`).
- **Payment.** `src/lib/stripe/checkout.ts` sends Stripe the account email, the order id as `client_reference_id`, and metadata (order id, user id, service slug). The order keeps `stripe_checkout_session_id`, `stripe_payment_intent_id`, `paid_at`, `total_cents`. No card data reaches our systems. While live mode has no price ids, the Payment Link fallback puts the email in the link's query string (`prefilled_email`).
- **Documents.** Live `service_docs` rows read on 2026-09-21. NIF only: passport, proof of address, NIF power of attorney. Bank Account only: passport, Portuguese tax identification number, tax identification number from your country, proof of address, bank statements or annual income statement, proof of profession, bank power of attorney. NIF + Bank Account and Couple package: passport, proof of address, tax identification number from your country, bank statements or annual income statement, proof of profession, both powers of attorney (couple: per applicant). PDF, JPEG or PNG, 10 MB each. R2 keys `orders/{orderId}/{docKey}/{applicant}/{uuid}.{ext}`. Every upload is a new row; rejected files and their rows stay.
- **Details for documents.** `public.user_service_applicants` (nine fields, adults only: `src/lib/orders/applicant-rules.ts`). Powers of attorney are generated on demand and not stored (`GET /api/orders/[id]/poa/[docId]`); the signed copy is an ordinary upload. The service agreement PDF is stored in R2 under `contracts/{orderId}/v{n}.pdf` (earlier versions stay in the bucket when the firm regenerates), the printed values are copied into `user_service_contracts.variables`, and the PDF is emailed as an attachment through Resend (`src/lib/contracts/ensure.ts`). The optional signing place is `parseSigningPlace` in `src/lib/contracts/signing-place.ts`.
- **Deliverables.** `service_deliverables`: "Your Portuguese NIF", "Finanças access", "Your Portuguese IBAN"; files in R2 under `deliverables/{orderId}/`; closing report in `user_services.report`. This round adds a way for the admin to remove a file delivered by mistake (`deleteObject` in `src/lib/r2/client.ts`, working tree).
- **Emails.** `src/lib/email/templates.ts`: document rejected, order completed, service agreement; this round adds "Payment received" to the client and "New paid order" and "Documents ready to review" to `EMAIL_TEAM_INBOX`, both carrying the client's email (`src/lib/orders/notify.ts`, working tree). Sign in codes: Supabase Auth through Resend SMTP from `hello@send.alttavia-relocation.com`. Client replies go to `EMAIL_REPLY_TO`, a mailbox on alttavia-relocation.com [TO CONFIRM: mailbox provider].
- **Technical records.** Supabase Auth stores `auth.sessions.ip`, `auth.sessions.user_agent` and `auth.audit_log_entries.ip_address` (columns checked on 2026-09-21). Server logs: `sendEmail` logs the recipient when a send fails; admin downloads of deeds and agreements log the admin id and order id.
- **Access.** Row level security: clients read only their own rows; admins read everything through `public.is_admin()`; no table accepts writes from the browser except a client's own `full_name` and `phone`. One admin account on 2026-09-21. Admin file links are presigned for 120 seconds (`src/lib/r2/client.ts`).
- **Storage places.** Supabase project `dgdbrnvgrpixsslgvmns`, region eu-west-2 (London), created in the guyshore.com organization (workspace notes). The R2 endpoint in `.env.local` is the EU jurisdiction endpoint (`*.eu.r2.cloudflarestorage.com`), bucket `alttavia-documents`. Netlify builds the production branch (workspace `CLAUDE.md`; there is no `netlify.toml` in the repo, so the functions region is set in the Netlify dashboard).
- **Deletion.** No route deletes client data. `user_services.user_id` and `user_answers.user_id` are `on delete restrict` (`0004_hardening.sql`), so an account with orders cannot be deleted, only anonymized by hand.
- **Cookies.** `@supabase/ssr` 0.12.7 defaults: path `/`, SameSite Lax, not HttpOnly, max age 400 days; the browser client uses the PKCE flow, which sets the code verifier cookie during sign in; `src/proxy.ts` refreshes the session on each request; sign out clears it (`src/app/api/auth/signout/route.ts`). `alttavia_locale` is read by `src/app/page.tsx`, but no live page sets it (only the unused `src/components/sections/navbar.tsx` renders the switcher that writes it). GTM: `src/components/analytics.tsx`, loaded only when `NEXT_PUBLIC_GTM_ID` is set; it is empty in `.env.local`. Fonts: `next/font/google` in `src/app/layout.tsx`, self hosted at build time (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`: no requests are sent to Google by the browser). The landing has no embedded third party content; press and review entries are plain links.
