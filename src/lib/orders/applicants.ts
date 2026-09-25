import type { PrincipalDetails } from "@/content/power-of-attorney";
import type { Db } from "@/lib/db/queries";
import type { PoaTemplate, UserServiceApplicantRow, UserServiceRow } from "@/lib/db/types";
import { asciiLetters } from "@/lib/pdf/characters";

import type { ApplicantInput } from "./applicant-rules";

/**
 * The principal's details a power of attorney is filled with. Contract
 * (docs/documents-contract.md) section 3, "Server".
 *
 *   validateApplicantInput(body)                 -> { ok, value } | { ok: false, status: 422, message }
 *   upsertApplicant(admin, orderId, index, value) -> the row, on (user_service_id, applicant_index)
 *   findApplicant(admin, orderId, index)         -> the row or null
 *   findPrefill(admin, userId, index, serviceId) -> the user's newest row for that index on an order of another service
 *   toPrincipal(row)                             -> what the deed builder takes
 *   poaFileName(kind, fullName, secondName?)     -> the download's file name (two names on the joint bank deed)
 *
 * The rules themselves (lengths, letters the documents can print, real
 * dates, an adult, a current passport by Lisbon's calendar) live in
 * ./applicant-rules.ts, a pure module the form runs too before it saves;
 * validateApplicantInput is re-exported from here so the routes keep one
 * import. What stays in this file talks to the database.
 */

export { validateApplicantInput, type ApplicantInput, type ApplicantValidation } from "./applicant-rules";

// ---------------------------------------------------------------------------
// Reads and the one write, all with the admin client after the route has
// checked the session and the order's owner.
// ---------------------------------------------------------------------------

/** One order by id, whoever owns it: the route decides whether the caller may see it. */
export async function findOrder(admin: Db, id: string): Promise<UserServiceRow | null> {
  const { data, error } = await admin.from("user_services").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`findOrder: ${error.message}`);
  return (data as UserServiceRow | null) ?? null;
}

/** The details entered for one applicant of one order, or null. */
export async function findApplicant(
  admin: Db,
  userServiceId: string,
  applicantIndex: 0 | 1,
): Promise<UserServiceApplicantRow | null> {
  const { data, error } = await admin
    .from("user_service_applicants")
    .select("*")
    .eq("user_service_id", userServiceId)
    .eq("applicant_index", applicantIndex)
    .maybeSingle();
  if (error) throw new Error(`findApplicant: ${error.message}`);
  return (data as UserServiceApplicantRow | null) ?? null;
}

/** Writes the details, replacing what the same slot held before. Returns the row as stored. */
export async function upsertApplicant(
  admin: Db,
  userServiceId: string,
  applicantIndex: 0 | 1,
  value: ApplicantInput,
): Promise<UserServiceApplicantRow> {
  const { data, error } = await admin
    .from("user_service_applicants")
    .upsert(
      { user_service_id: userServiceId, applicant_index: applicantIndex, ...value },
      { onConflict: "user_service_id,applicant_index" },
    )
    .select("*")
    .single();
  if (error || !data) throw new Error(`upsertApplicant: ${error?.message ?? "no row returned"}`);
  return data as UserServiceApplicantRow;
}

/**
 * The newest details the user entered for that applicant index on one of
 * their orders for a different service, so a second purchase opens the form
 * filled in. Orders of the same service are skipped: a second NIF on the
 * same account is by definition for another person (the engine's
 * `secondNif` note), so its form must not open with the account holder's
 * passport. Joins through user_services; null when nothing qualifies.
 */
export async function findPrefill(
  admin: Db,
  userId: string,
  applicantIndex: 0 | 1,
  excludeServiceId: string,
): Promise<UserServiceApplicantRow | null> {
  const { data, error } = await admin
    .from("user_service_applicants")
    .select("*, user_services!inner(user_id, service_id)")
    .eq("user_services.user_id", userId)
    .neq("user_services.service_id", excludeServiceId)
    .eq("applicant_index", applicantIndex)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findPrefill: ${error.message}`);
  if (!data) return null;
  // The embedded join rides along in the result; the caller gets the row alone.
  const row = { ...(data as UserServiceApplicantRow & { user_services?: unknown }) };
  delete row.user_services;
  return row;
}

// ---------------------------------------------------------------------------
// From the row to the deed
// ---------------------------------------------------------------------------

/** The stored columns in the shape buildPowerOfAttorney() takes. */
export function toPrincipal(row: UserServiceApplicantRow): PrincipalDetails {
  return {
    fullName: row.full_name,
    gender: row.gender,
    birthPlace: row.birth_place,
    birthDate: row.birth_date,
    passportNumber: row.passport_number,
    passportIssuer: row.passport_issuer,
    passportIssueDate: row.passport_issued_on,
    passportExpiryDate: row.passport_expires_on,
    taxAddress: row.tax_address,
  };
}

const SLUG_MAX_LENGTH = 60;

/** A name folded to ASCII and hyphens, cut at 60 characters; empty when nothing of it survives. */
function nameSlug(fullName: string): string {
  return asciiLetters(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}

/**
 * `power-of-attorney-nif-jane-alice-doe.pdf` or `…-bank-…`: the name folded
 * to ASCII and hyphens, cut at 60 characters. Letters are spelled the way
 * the deed prints them (asciiLetters: "Łukasz" is "lukasz"). A name with
 * nothing to keep (not one Latin letter or digit) drops the suffix rather
 * than end in a dash.
 *
 * The couple's joint bank deed passes the second person too and reads
 * `power-of-attorney-bank-<first>-and-<second>.pdf`, each name cut on its
 * own; a name with nothing to keep is left out with its "and".
 */
export function poaFileName(kind: PoaTemplate, fullName: string, secondName?: string): string {
  const deed = kind === "poa_bank" ? "bank" : "nif";
  const slug = [fullName, secondName]
    .filter((name): name is string => typeof name === "string")
    .map(nameSlug)
    .filter(Boolean)
    .join("-and-");
  return slug ? `power-of-attorney-${deed}-${slug}.pdf` : `power-of-attorney-${deed}.pdf`;
}
