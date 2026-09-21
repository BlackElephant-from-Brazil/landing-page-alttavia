# /en/service-terms: sentences that are no longer true

**Status:** PROPOSAL for Patrícia Viana to approve by **Thursday, September 24, 2026, 12:00 Lisbon time**. The page is not edited: this file only proposes text. Written on September 21, 2026.

This is a factual draft prepared by the developer for the lawyer's review. It is not legal advice from us.

The page is `src/app/[locale]/service-terms/page.tsx` (unchanged since `f126e38`). It is compared with the platform as built and with the firm's service agreement models (`docs/terms/`, generated into `src/content/contracts/models.generated.ts`; "the agreement" below). Clause and paragraph numbers are the NIF model's. The three models share the same seventeen clauses; only the lettered items of the Second Clause differ, and the bank model's letter is named where it matters. Proposed text is US English and follows the house rules. **[TO CONFIRM]** marks what the firm must check.

## 1. No longer true

### 1.1 "What we need from you": when and what

**Now:** "A valid passport and a proof of address, uploaded at checkout. For a bank account, proof of income or source of funds."

**Why:** Nothing is uploaded at checkout. Stripe takes the payment; documents are uploaded afterwards in the client area, one slot per document. The list is also longer. Bank account and package orders ask for the tax number from the client's country, bank statements or an annual income statement, and proof of profession; a bank account alone also asks for the Portuguese NIF document; every service asks for the signed powers of attorney. Since September 21 the client also confirms their details for the service agreement after paying.

**Proposed:** "After payment, you confirm your details for your service agreement and upload your documents in your client area. For a NIF: your passport, a proof of address, and the power of attorney we prepare, signed by hand. For a bank account, also the tax number from your country, bank statements or an annual income statement, and proof of your profession, plus your NIF document if you already have a NIF. Your client area shows the exact list for your order."

### 1.2 "What we need from you": the third sentence

**Now:** the sentence names the one thing house rule 6 in `src/content/bank-nif.ts` says the copy never mentions, then adds "and no appointment".

**Why:** it breaks a house rule, and the agreement mentions meetings and calls (Eighth Clause, 2 and 3), so a flat "none" is no longer safe.

**Proposed:** drop it, and add the step the agreement does require (Ninth Clause, 1): "You do not need to travel to Portugal. If Finanças or the bank asks for the power of attorney to be notarized or apostilled, that is done at your cost, and we tell you when it is needed." [TO CONFIRM: how often this happens in practice.]

### 1.3 "What we need from you": missing documents

**Now:** "If a document is missing or unreadable we ask you once, in writing, and the timeline pauses until it arrives."

**Why:** the firm can reject a document, with a reason, as many times as needed; each rejection shows the reason in the client area and sends an email. The agreement also lets the firm pause the service after 30 days without the requested documents and end it after 60 (Sixth Clause, 5).

**Proposed:** "If a document is missing or unreadable, we tell you why in your client area and by email, and the timeline pauses until a new one arrives. After 30 days without it we may pause your file, and after 60 days we may close it, as your service agreement sets out."

### 1.4 "What you are buying": the bank account

**Now:** "…and open an account with one of our banking partners. You receive an IBAN, a debit card and online banking access."

**Why:** the agreement says the firm does not guarantee the opening, the bank's approval, or the cards and access codes (First Clause, 4, bank and package models). It passes on what the bank issues, when the bank makes it available (Second Clause, 2 h in the bank model).

**Proposed:** "Bank account: we prepare a limited power of attorney, build your compliance file in Portuguese, and submit it to one of our banking partners. The bank decides after its own review. When it opens the account, we pass on the IBAN, card and online banking access it issues."

### 1.5 "Approval"

**Now:** "A NIF is issued to any applicant with a valid passport and proof of address."

**Why:** the agreement says the firm does not and cannot guarantee the assignment of the NIF or its timing (First Clause, 4), and that the fee pays for the work, not the outcome (First Clause, 6; Fourth Clause, 3). The landing FAQ makes the same claim (section 3 below).

**Proposed:** "Finanças assigns the NIF, and the bank decides on the account after its own compliance review. Neither decision is ours, so we promise the work and not the outcome. Your fee pays for that work, whatever the decision." The rest of the paragraph stays: it is still true that the form warns before purchase when an account is unlikely.

### 1.6 "Cancellation"

**Now:** "Tell us before we begin work on your file and the order is cancelled. Once your documents have been submitted to Finanças or to a bank, the work has been performed and cannot be withdrawn."

**Why:** work starts right after payment (Fourth Clause, 2; Fifth Clause, 8), so there is no window before work begins. A consumer who buys online may withdraw within 14 days of the agreement (Fifth Clause, 1; Annex I, Part B). Having asked for an immediate start, they pay in proportion to the phases already started (Fifth Clause, 4; Eleventh Clause). The right ends when the service is fully performed (Fifth Clause, 5 and 6), not when documents are submitted.

**Proposed:** "If you buy as a consumer, you can withdraw within 14 days of your service agreement, without giving a reason, by writing to info@alttavia-relocation.com. Work starts right after payment, at your request. If you withdraw after it has started, you pay for the phases already started, as your agreement sets out. Once the service is fully delivered, the right to withdraw ends. Annex I of your agreement explains all of this and includes a withdrawal form." See questions 4 and 8.

### 1.7 "Your documents"

**Now:** "Uploaded over an encrypted connection, handled under GDPR and professional confidentiality, used only for the service you ordered, and deleted after completion on request."

**Why:** nothing in the product deletes a client's document; deletion is manual. Rejected files stay stored. The agreement keeps documents as long as legal, tax, professional and deontological duties require (Sixteenth Clause, 3), which a request cannot shorten.

**Proposed:** "You upload them in your client area over an encrypted connection. They are kept in private storage in the European Union, handled under professional confidentiality, and used only for the service you ordered. Our privacy notice explains how long we keep them and how to ask for a copy or their deletion." ("privacy notice" links to `/en/privacy`, see `privacy-proposal.md`.)

### 1.8 "Getting in touch"

**Now:** "…from the address or number used on the order. We reply within one business day."

**Why:** an order records the account email only. No phone number is collected, so there is no "number used on the order". "Within one business day" is a promise the agreement does not make (Eighth Clause, 1: timely, on business days and during business hours).

**Proposed:** "Write to info@alttavia-relocation.com from the email address on your account, or message +351 934 548 395 on WhatsApp. We reply on business days." [TO CONFIRM: keep "within one business day" if the firm wants to promise it.]

### 1.9 The date line under the title

**Now:** "Applies to all orders placed through this page"

**Why:** no order is placed through this page. Orders are placed through the application form and the client area.

**Proposed:** "Last updated: {publication date}"

## 2. True, but not in step with the agreement

### 2.1 "What you are buying": the NIF

**Now:** "Twelve months of tax representation are included, along with every letter Finanças sends and your Portal das Finanças access password. Renewal after the first year is €99 and is optional."

**Why:** the agreement counts the representation from the day the NIF is assigned (Fourth Clause, 5), limits it to receiving notifications and says the firm does not manage the client's assets (Second Clause, 2 e; Ninth Clause, 2). It calls the renewal "a separate fee" without an amount.

**Proposed:** "…Twelve months of tax representation are included, counted from the day the NIF is assigned. As your tax representative we receive Finanças letters for you and pass them on; we do not manage your assets. You also get your Portal das Finanças access. Renewal after the first year is €99 and is optional." [TO CONFIRM: €99 is still the renewal price.]

### 2.2 "Timelines"

The paragraphs are consistent with the agreement (Second Clause, 3; Seventh Clause). One nuance: "working your file continuously and telling you where it stands whenever the position changes" promises a little more than the Eighth Clause ("updates at the relevant stages"). No change proposed unless the firm prefers the agreement's wording.

## 3. The same claims elsewhere (not on this page, not changed here)

- `src/content/bank-nif.ts`, FAQ "Can my NIF application be rejected?": the answer says a NIF is issued with a valid passport and proof of address. Same as 1.5.
- Same file, the FAQ entry about calls: "you upload two documents, and you sign the power of attorney we prepare. That is the last thing we need from you." Bank orders ask for more, and the client now also confirms details for the agreement.
- Same file, FAQ "What documents do I need to provide?": the answer is shorter than the list in 1.1.
- Same file: "One checkout, one upload" (final call to action), "Documents uploaded in the same flow, encrypted." and "Pay and upload in the same flow". Documents are uploaded after payment, in the client area.
- Same file, footer: "Privacy" links to the main site's general policy and "Terms" to the main site's terms of use. Neither describes this platform.

## 4. Where the service agreement and Annex I meet this page: questions

1. **Which text governs?** The purchase drawer says "By purchasing you accept the Terms" and links this page. The agreement is prepared after payment. Proposal: this page becomes a short summary that says "Your service agreement is the contract between us. Where this page and the agreement differ, the agreement prevails." Yes or no?
2. **Should the client read the agreement before paying?** Today the client pays first and sees the agreement afterwards. Option: link the blank models (NIF, bank account, package, each with Annex I) from this page, so the full text is available before payment. The generator can already produce blank PDFs (`npm run contract:preview`).
3. **Where does the client accept?** Only the drawer under "Services" in the client area shows the acceptance line. The first purchase, from the application form, pays through the Pay button with no link to any terms (acceptance at Pay is planned for Wednesday, September 23). Should that line also name the agreement, for example "By purchasing you accept the Service terms and ask us to start right away, as Annex I of your service agreement sets out"?
4. **How is Annex I, Part A given?** Part A says it is "to be signed by the Client before any work begins". The platform delivers the agreement unsigned and records no signature and no click. Options: a tick box before payment, recorded with date and time; the client signs the agreement and uploads it like the deeds; another way. The "Cancellation" text in 1.6 depends on the answer.
5. **When is the service "fully performed"?** Fifth Clause, 6 ties it to delivery **by email** of the NIF document and the Finanças access (and the bank details for the bank and package models). The platform delivers those files in the client area and sends an "order completed" email with a link. Does that count, or should the files travel by email?
6. **Couple package.** There is no agreement model for two people, yet this page sells the package. What governs it until a model exists?
7. **VAT.** The agreement says "plus VAT at the legal rate where applicable". This page and the prices say nothing about VAT (house rule 5). Is the site price VAT inclusive?
8. **House rule 4 and Annex I, Part B.** The statutory information in Part B says what happens to the payment when a consumer withdraws. House rule 4 forbids promises about returning payments. The proposal in 1.6 points to Annex I instead of repeating it on the page. Acceptable?
9. **Registered office.** The agreement models and the Part C withdrawal form print Av. Elias Garcia, 123-A, 1050-098 Lisbon; the letterhead and the powers of attorney print Av. António Augusto Aguiar, 24, 1050-016 Lisbon. Which one is correct?
10. **Consumer information.** If it applies (see `fatos-para-patricia.md`), should this page carry the link to the Livro de Reclamações Eletrónico and the name of the consumer dispute resolution entity (entidade RAL)?
