-- 0012_deed_signature_note.sql
--
-- The signature the bank and Finanças compare. A power of attorney signed
-- with a hand that does not match the passport is sent back, so the slot has
-- to say it before the client signs, not after.
--
-- One update, on every deed slot of every service (template 'poa_nif' or
-- 'poa_bank'), whatever the service. Nothing else changes: same slots, same
-- templates, same positions. The same sentence lives in
-- src/lib/apply/documents.ts, the seed source, and a shorter line sits under
-- "Download to sign" in src/components/dashboard/documents/document-slot.tsx.
--
-- Idempotent: running it again writes the same text.

update public.service_docs
  set note = 'We prepare it with your passport details. Download it and sign by hand, with the same signature as in your passport. Then upload a scan or a photo of the signed pages.'
  where template in ('poa_nif', 'poa_bank');
