-- 0016_couple_joint_bank_deed.sql
--
-- One bank power of attorney for the couple, carrying both persons.
--
-- The couple package opens one joint account. Patrícia (2026-09-24, approved
-- by the owner) wants the bank deed with the same wording, but ONE deed with
-- the data of both persons, signed by both. Until now the couple's bank deed
-- slot was per applicant, so each person got a deed of their own.
--
-- The couple's poa_bank slot becomes a shared slot (per_applicant = false):
-- the order has one bank deed slot, the counts of 0007's admin view and of
-- the dashboards count it once, and /api/orders/[id]/poa/[docId] builds the
-- joint deed for it (src/lib/poa/joint.ts: template poa_bank, not per
-- applicant, two applicants). Its note gains "Both of you sign the same
-- document." at the end of whatever it says today (0012's sentence on a
-- project that ran it).
--
-- Nothing else changes. The couple's poa_nif slot stays per applicant: a NIF
-- is personal and each person signs their own. Bank Account only and the
-- bundle keep their single deeds.
--
-- Idempotent: per_applicant is simply set again, and the sentence is added
-- only to a note that does not end with it yet.
--
-- Data already on a couple order is left alone. A signed copy uploaded for
-- the second person (applicant_index 1) on this slot before the migration is
-- no longer one of the order's slots and is not shown to the client (an
-- approved one still counts in admin_order_summary.docs_approved, which
-- counts approved rows, not slots); the firm asks those couples for the
-- joint deed instead. To see them:
--
--   select ud.user_service_id, ud.status, ud.storage_key
--     from public.user_documents ud
--     join public.service_docs d on d.id = ud.service_doc_id
--     join public.services s on s.id = d.service_id
--    where s.slug = 'couple' and d.template = 'poa_bank' and ud.applicant_index = 1;

update public.service_docs d
   set per_applicant = false,
       note = case
         when coalesce(d.note, '') like '%Both of you sign the same document.' then d.note
         else btrim(coalesce(d.note, '') || ' Both of you sign the same document.')
       end
  from public.services s
 where s.id = d.service_id
   and s.slug = 'couple'
   and d.template = 'poa_bank';
