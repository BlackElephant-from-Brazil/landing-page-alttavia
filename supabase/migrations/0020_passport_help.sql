-- 0020_passport_help.sql
--
-- The help line of the passport screen of the application form. The wizard
-- reads it from public.questions, so the copy in src/content/apply.ts
-- (steps.passport.help) reaches visitors only through this row. The live row
-- still said "The bank's rules depend on nationality", written by 0003
-- before the 2026-09-22 correction (the bank assesses by tax residence), and
-- it now sits above the country block messages of 2026-10-01 (some passports
-- are outside the service, see BLOCKED_COUNTRIES in src/lib/apply/rules.ts).
--
-- One update, on the one row. Nothing else changes. A test in
-- src/lib/apply/blocked-countries.test.ts pins this text to the code's.
--
-- Idempotent: running it again writes the same text.

update public.questions
  set help = 'The service is not available to holders of some passports, and we tell you as soon as you choose one. For the account, the bank assesses each case by tax residence.'
  where key = 'passport';
