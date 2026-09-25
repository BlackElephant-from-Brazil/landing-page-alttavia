-- 0013_signed_agreement_slot.sql
--
-- The signed service agreement comes back as a document (Patrícia's answer
-- of 2026-09-24, approved by the owner): the client downloads the agreement,
-- signs it by hand and uploads the signed copy, like the powers of attorney.
-- The firm gets the upload by email (src/lib/orders/notify.ts,
-- notifySignedAgreement) and approves it in the order modal like any other
-- file.
--
--   1. service_docs.template accepts a third value, 'agreement': the slot
--      whose "Download to sign" opens the order's service agreement
--      (GET /api/orders/[id]/contract) rather than a deed of its own.
--   2. Every service that has a contract gets one required slot for it,
--      once per order (per_applicant false): the couple package signs one
--      paper, both of them on it, so it is one slot under "For both of you".
--      Same file types and size limit as every other slot (the column
--      defaults of 0001), at the end of the service's list.
--
-- The documents stage holds an order until every required slot is approved
-- (src/components/admin/order/required-docs.ts), so from here on an order
-- leaves it only once the signed agreement is approved. Orders already past
-- the documents stage are not held; their new slot stays closed and empty.
--
-- The seed source is SIGNED_AGREEMENT_SLOT in src/lib/apply/documents.ts;
-- src/lib/apply/signed-agreement-slot.test.ts pins the two to each other.
--
-- Idempotent: the check is dropped by what it checks, not by a guessed name,
-- and recreated; a service that already has the key keeps its row as it is
-- (an admin may have edited the label or the note since).

-- ---------------------------------------------------------------------------
-- 1. The template check. 0007 added it inline, so Postgres named it; every
--    check on service_docs that reads `template` goes, then the new one.
-- ---------------------------------------------------------------------------

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.service_docs'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%template%'
  loop
    execute format('alter table public.service_docs drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.service_docs
  add constraint service_docs_template_check
  check (template in ('poa_nif', 'poa_bank', 'agreement'));

-- ---------------------------------------------------------------------------
-- 2. One slot per service with a contract, after its last row.
-- ---------------------------------------------------------------------------

insert into public.service_docs
  (service_id, key, label, note, accepted_mime, max_bytes, per_applicant, required, position, template)
select
  s.id,
  'signed_agreement',
  'Signed service agreement',
  'Download your service agreement, sign it by hand with the same signature as in your passport, then upload a scan or a photo of the signed pages.',
  '{application/pdf,image/jpeg,image/png}'::text[],
  10485760,
  false,
  true,
  (select coalesce(max(d.position), 0) from public.service_docs d where d.service_id = s.id) + 1,
  'agreement'
from public.services s
where s.slug in ('nif-only', 'bank-only', 'bundle', 'couple')
  and not exists (
    select 1 from public.service_docs d
    where d.service_id = s.id and d.key = 'signed_agreement'
  )
on conflict (service_id, key) do nothing;
