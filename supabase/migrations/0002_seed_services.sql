-- 0002_seed_services.sql
--
-- The four services the landing sells, with their lifecycle, the documents
-- each one needs and what the client gets back. Seeded from what the code
-- has today so the site works the same whether it reads the database or its
-- own fallbacks:
--
--   name, tagline, includes, timeline   src/content/apply.ts (PRODUCTS), which
--                                       reads the pricing cards and TIMES in
--                                       src/content/bank-nif.ts
--   description                         scripts/stripe-setup.mjs (CATALOGUE),
--                                       the text Stripe shows at checkout
--   price_cents                         src/content/bank-nif.ts (PRICE_CENTS)
--   documents                           src/lib/apply/documents.ts
--   stripe_payment_link_live            LIVE_CHECKOUT_LINKS in bank-nif.ts
--   stripe_price_id_test,               .env.local (STRIPE_PRICE_*,
--   stripe_payment_link_test            NEXT_PUBLIC_CHECKOUT_*), identifiers
--                                       of test mode objects, not secrets
--
-- Live price ids stay null until `npm run stripe:setup -- --live` prints
-- them. Every insert is `on conflict do update`, so running the file again
-- refreshes the copy without touching ids that orders already point at.
--
-- The seven house rules in the bank-nif.ts header apply to every string
-- here. `**bold**` markers are rendered by <RichText />.

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------

insert into public.services (
  slug, name, tagline, description, price_cents, currency, includes, timeline,
  supports_quantity, stripe_price_id_test, stripe_price_id_live,
  stripe_payment_link_test, stripe_payment_link_live, position, active
) values
  (
    'nif-only',
    'NIF only',
    'The tax number, filed for you.',
    'Portuguese tax number, filed with Finanças, with 12 months of tax representation included.',
    14900,
    'eur',
    '[
      "Official NIF, filed directly with Finanças",
      "12 months of tax representation **included**",
      "Every Finanças letter forwarded, Portal password included",
      "Renewal €99 a year, optional, cancel once you are resident"
    ]'::jsonb,
    'NIF in 3 to 5 business days',
    true,
    'price_1UBL8VAZCU7R8Zhpg8WmzVR2',
    null,
    'https://buy.stripe.com/test_3cI9AS1Hx2sE0xY9oS63K00',
    'https://buy.stripe.com/7sY3cu2LB3wIgwW9oS63K0h',
    1,
    true
  ),
  (
    'bundle',
    'NIF + Bank Account',
    'Both, in the right order, from one checkout.',
    'Portuguese tax number and a Portuguese bank account, sequenced correctly, with 12 months of tax representation included.',
    49700,
    'eur',
    '[
      "Everything in both services, sequenced correctly",
      "12 months of tax representation **included**",
      "**€50 credit toward your Relocation Strategy Session**",
      "NIF in 3 to 5 business days · IBAN in 1 to 3 weeks"
    ]'::jsonb,
    'NIF in 3 to 5 business days · IBAN in 1 to 3 weeks',
    false,
    'price_1UBL8XAZCU7R8ZhpDpzXQBnC',
    null,
    'https://buy.stripe.com/test_9B6cN4ae38R25Si58C63K01',
    'https://buy.stripe.com/14AeVcdqf1oA0xY44y63K0i',
    2,
    true
  ),
  (
    'bank-only',
    'Bank Account only',
    'Already have a NIF? This one is yours.',
    'Portuguese bank account with Novo Banco for someone who already holds a NIF.',
    39900,
    'eur',
    '[
      "An account with **Novo Banco**, one of our banking partners",
      "Limited power of attorney prepared for you",
      "Compliance file built in Portuguese for you",
      "IBAN, debit card and online banking"
    ]'::jsonb,
    'IBAN in 1 to 3 weeks',
    false,
    'price_1UBL8ZAZCU7R8ZhpZoXA0mQS',
    null,
    'https://buy.stripe.com/test_dRm4gy5XNc3e1C2dF863K02',
    'https://buy.stripe.com/28EaEWcmb6IUa8yeJc63K0j',
    3,
    true
  ),
  (
    'couple',
    'Couple package',
    'Two NIFs and one joint account, from one checkout.',
    'Two Portuguese tax numbers and one joint bank account, from one checkout.',
    59700,
    'eur',
    '[
      "Two official NIFs, filed directly with Finanças",
      "12 months of tax representation **included** for both of you",
      "One joint account with **Novo Banco**, two holders",
      "Limited power of attorney and compliance file prepared for each of you"
    ]'::jsonb,
    'NIFs in 3 to 5 business days · IBAN in 1 to 3 weeks',
    false,
    'price_1UBL8cAZCU7R8Zhpu6lelevR',
    null,
    'https://buy.stripe.com/test_bJebJ0ae3gju3Ka1Wq63K03',
    'https://buy.stripe.com/00w7sKgCr9V61C27gK63K0k',
    4,
    true
  )
on conflict (slug) do update set
  name                     = excluded.name,
  tagline                  = excluded.tagline,
  description              = excluded.description,
  price_cents              = excluded.price_cents,
  currency                 = excluded.currency,
  includes                 = excluded.includes,
  timeline                 = excluded.timeline,
  supports_quantity        = excluded.supports_quantity,
  stripe_price_id_test     = excluded.stripe_price_id_test,
  stripe_price_id_live     = coalesce(public.services.stripe_price_id_live, excluded.stripe_price_id_live),
  stripe_payment_link_test = excluded.stripe_payment_link_test,
  stripe_payment_link_live = excluded.stripe_payment_link_live,
  position                 = excluded.position,
  active                   = excluded.active;

-- ---------------------------------------------------------------------------
-- Stages, in lifecycle order. The first is always awaiting_payment; payment
-- moves the order to the second one.
-- ---------------------------------------------------------------------------

insert into public.service_stages (service_id, key, label, position, is_terminal)
select s.id, v.key, v.label, v.position, v.is_terminal
from (values
  ('nif-only',  'awaiting_payment', 'Awaiting payment', 1, false),
  ('nif-only',  'documents',        'Documents',        2, false),
  ('nif-only',  'awaiting_financas','With Finanças',    3, false),
  ('nif-only',  'nif_ready',        'NIF ready',        4, true),

  ('bank-only', 'awaiting_payment', 'Awaiting payment', 1, false),
  ('bank-only', 'documents',        'Documents',        2, false),
  ('bank-only', 'awaiting_bank',    'With the bank',    3, false),
  ('bank-only', 'account_open',     'Account open',     4, true),

  ('bundle',    'awaiting_payment', 'Awaiting payment', 1, false),
  ('bundle',    'documents',        'Documents',        2, false),
  ('bundle',    'awaiting_financas','With Finanças',    3, false),
  ('bundle',    'nif_ready',        'NIF ready',        4, false),
  ('bundle',    'awaiting_bank',    'With the bank',    5, false),
  ('bundle',    'account_open',     'Account open',     6, true),

  ('couple',    'awaiting_payment', 'Awaiting payment', 1, false),
  ('couple',    'documents',        'Documents',        2, false),
  ('couple',    'awaiting_financas','With Finanças',    3, false),
  ('couple',    'nif_ready',        'NIF ready',        4, false),
  ('couple',    'awaiting_bank',    'With the bank',    5, false),
  ('couple',    'account_open',     'Account open',     6, true)
) as v(slug, key, label, position, is_terminal)
join public.services s on s.slug = v.slug
on conflict (service_id, key) do update set
  label       = excluded.label,
  position    = excluded.position,
  is_terminal = excluded.is_terminal;

-- ---------------------------------------------------------------------------
-- Documents each service needs. Labels and notes from
-- src/lib/apply/documents.ts. Requirements are set by Finanças and by the
-- bank, so an entry is not softened or trimmed without asking the firm.
--
-- The NIF proof of address must be dated within 3 months and the bank's
-- within 6, so services that include the NIF carry the stricter note and
-- the same bill satisfies both.
-- ---------------------------------------------------------------------------

insert into public.service_docs (service_id, key, label, note, per_applicant, required, position)
select s.id, v.key, v.label, v.note, true, true, v.position
from (values
  -- nif-only
  ('nif-only',  'passport',          'Passport',
    'Photograph of the full page with all four corners visible.', 1),
  ('nif-only',  'proof_of_address',  'Proof of address',
    'Utility bill, bank statement, landline, water, electricity or waste, issued within the last 3 months.', 2),

  -- bank-only: the client already holds a NIF, so the bank asks for it
  ('bank-only', 'passport',          'Passport',
    null::text, 1),
  ('bank-only', 'nif_document',      'Portuguese tax identification number',
    'Issued by the Portuguese tax administration.', 2),
  ('bank-only', 'origin_tax_number', 'Tax identification number from your country',
    'Issued by the tax authority where you live.', 3),
  ('bank-only', 'proof_of_address',  'Proof of address',
    'Domestic bill issued within the last 6 months, for example water, electricity or telephone.', 4),
  ('bank-only', 'bank_statements',   'Bank statements or annual income statement',
    'The last 3 months of statements, or your annual income statement.', 5),
  ('bank-only', 'employment_proof',  'Proof of profession',
    'Employer statement or payslip issued within the last 6 months. If self employed: commercial register excerpt, validated annual tax return and proof of services provided.', 6),

  -- bundle: we supply the Portuguese NIF, so it is not asked for
  ('bundle',    'passport',          'Passport',
    'Photograph of the full page with all four corners visible.', 1),
  ('bundle',    'proof_of_address',  'Proof of address',
    'Utility bill, bank statement, landline, water, electricity or waste, issued within the last 3 months.', 2),
  ('bundle',    'origin_tax_number', 'Tax identification number from your country',
    'Issued by the tax authority where you live.', 3),
  ('bundle',    'bank_statements',   'Bank statements or annual income statement',
    'The last 3 months of statements, or your annual income statement.', 4),
  ('bundle',    'employment_proof',  'Proof of profession',
    'Employer statement or payslip issued within the last 6 months. If self employed: commercial register excerpt, validated annual tax return and proof of services provided.', 5),

  -- couple: same list as the bundle, one of each per applicant
  ('couple',    'passport',          'Passport',
    'Photograph of the full page with all four corners visible.', 1),
  ('couple',    'proof_of_address',  'Proof of address',
    'Utility bill, bank statement, landline, water, electricity or waste, issued within the last 3 months.', 2),
  ('couple',    'origin_tax_number', 'Tax identification number from your country',
    'Issued by the tax authority where you live.', 3),
  ('couple',    'bank_statements',   'Bank statements or annual income statement',
    'The last 3 months of statements, or your annual income statement.', 4),
  ('couple',    'employment_proof',  'Proof of profession',
    'Employer statement or payslip issued within the last 6 months. If self employed: commercial register excerpt, validated annual tax return and proof of services provided.', 5)
) as v(slug, key, label, note, position)
join public.services s on s.slug = v.slug
on conflict (service_id, key) do update set
  label         = excluded.label,
  note          = excluded.note,
  per_applicant = excluded.per_applicant,
  required      = excluded.required,
  position      = excluded.position;

-- ---------------------------------------------------------------------------
-- Deliverables: what lands in the client's inbox when the service is done.
-- Labels from the hero deliverables card in src/content/bank-nif.ts.
-- ---------------------------------------------------------------------------

insert into public.service_deliverables (service_id, key, label, kind, position)
select s.id, v.key, v.label, v.kind, v.position
from (values
  ('nif-only',  'nif_certificate',      'Your Portuguese NIF',  'document', 1),
  ('nif-only',  'summary',              'Summary',              'report',   2),

  ('bank-only', 'account_confirmation', 'Your Portuguese IBAN', 'document', 1),
  ('bank-only', 'summary',              'Summary',              'report',   2),

  ('bundle',    'nif_certificate',      'Your Portuguese NIF',  'document', 1),
  ('bundle',    'account_confirmation', 'Your Portuguese IBAN', 'document', 2),
  ('bundle',    'summary',              'Summary',              'report',   3),

  ('couple',    'nif_certificate',      'Your Portuguese NIF',  'document', 1),
  ('couple',    'account_confirmation', 'Your Portuguese IBAN', 'document', 2),
  ('couple',    'summary',              'Summary',              'report',   3)
) as v(slug, key, label, kind, position)
join public.services s on s.slug = v.slug
on conflict (service_id, key) do update set
  label    = excluded.label,
  kind     = excluded.kind,
  position = excluded.position;
