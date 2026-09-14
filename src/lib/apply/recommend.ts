import { PRICE_CENTS } from "@/content/bank-nif";
import { isEea } from "./countries";
import { BANK_ACCEPTED_VISAS, BANK_UNSUPPORTED_NATIONALITIES } from "./rules";
import type {
  Answers,
  NoteId,
  ProductId,
  ReasonId,
  Recommendation,
} from "./types";

/**
 * Turns the wizard's answers into the product the visitor should buy.
 *
 * Pure function: no DOM, no React, no I/O. The apply wizard calls it on the
 * client to render the result screen, and the future checkout route will call
 * it again on the server so the price is never taken from the browser.
 *
 * Decision table (people / who already has a NIF / account wanted):
 *
 *   1 / nobody   / yes    -> bundle
 *   1 / nobody   / no     -> nif-only
 *   1 / you      / yes    -> bank-only
 *   1 / you      / no     -> exit, nothing to buy
 *   2 / nobody   / joint  -> couple
 *   2 / nobody   / none   -> nif-only, one person, note secondNif
 *   2 / both     / joint  -> bank-only, joint
 *   2 / one      / joint  -> bundle, joint
 *   2 / one      / none   -> nif-only
 *   2 / both     / none   -> exit, nothing to buy
 *
 * Every service sells one unit per purchase. Two adults who both need a NIF
 * and no account buy NIF only for one of them here; the `secondNif` note
 * says the partner's NIF is a second purchase from the dashboard.
 *
 * Exits that short circuit everything: living in Portugal, more than two
 * adults, two separate accounts.
 *
 * A non EEA applicant with no visa in progress gets the NIF product and a
 * `bankUnlikely` note instead of the account, because the partner bank asks
 * for proof of a visa process before opening a file. When that happens to
 * two adults without NIFs, the same one unit rule applies: `nif-only` with
 * the `bankUnlikely` and `secondNif` notes.
 */
export function recommend(a: Answers): Recommendation {
  const notes: NoteId[] = [];
  if (a.childrenNifs) notes.push("childrenNifs");

  if (a.residence === "PT") return { kind: "exit", exit: "portugal", notes };
  if (a.applicants === "more") return { kind: "exit", exit: "too-many", notes };
  if (a.bank === "separate") return { kind: "exit", exit: "separate-accounts", notes };

  const people = a.applicants === "two" ? 2 : 1;
  const hasNif = Array.from({ length: people }, (_, i) => a.hasNif?.[i] === true);
  const missingNif = hasNif.filter((has) => !has).length;
  const joint = a.bank === "joint";
  let wantsBank = a.bank === "yes" || joint;

  // The bank's own gates. Applied before routing so the recommendation never
  // sells an account the bank would refuse to open.
  const passports = Array.from({ length: people }, (_, i) => a.passport?.[i]).filter(
    (p): p is string => typeof p === "string",
  );
  const anyNonEea = passports.some((p) => !isEea(p));
  const unsupported = passports.some((p) => BANK_UNSUPPORTED_NATIONALITIES.includes(p));
  const visaMissing = anyNonEea && (a.visa === "none" || (a.visa !== undefined && !BANK_ACCEPTED_VISAS.includes(a.visa)));

  if (wantsBank && unsupported) {
    notes.push("nationalityUnsupported");
    wantsBank = false;
  } else if (wantsBank && visaMissing) {
    notes.push("bankUnlikely");
    wantsBank = false;
  }

  if (missingNif === 0 && !wantsBank) {
    return { kind: "exit", exit: "nothing-to-buy", notes };
  }

  let product: ProductId;
  const reasons: ReasonId[] = [];

  if (people === 1) {
    if (missingNif === 1) {
      reasons.push("needsNif");
      product = wantsBank ? "bundle" : "nif-only";
    } else {
      reasons.push("hasNif");
      product = "bank-only";
    }
  } else if (missingNif === 2) {
    reasons.push("bothNeedNif");
    product = wantsBank ? "couple" : "nif-only";
    // One NIF per purchase: the partner's is a second purchase from the dashboard.
    if (!wantsBank) notes.push("secondNif");
  } else if (missingNif === 1) {
    reasons.push(hasNif[0] ? "partnerNeedsNif" : "needsNif");
    product = wantsBank ? "bundle" : "nif-only";
  } else {
    reasons.push("bothHaveNif");
    product = "bank-only";
  }

  if (wantsBank) {
    reasons.push(joint ? "wantsJointAccount" : "wantsAccount");
    if (product === "bundle" || product === "couple") reasons.push("sequenced");
  } else {
    reasons.push("noAccount");
  }

  // Tax representation is only compulsory for people living outside the EEA.
  if (includesNif(product)) {
    notes.push(isEea(a.residence) ? "taxRepOptional" : "taxRepRequired");
  }

  const valid = validProducts(people, missingNif);
  const ordered: ProductId[] = [product, ...valid.filter((p) => p !== product)];

  const preselected =
    a.preselected && a.preselected !== product && ordered.includes(a.preselected)
      ? a.preselected
      : undefined;

  return {
    kind: "product",
    product,
    totalCents: totalCents(product),
    joint: wantsBank && joint,
    valid: ordered,
    reasons,
    notes,
    preselected,
  };
}

/** Products that make sense for this household, regardless of what they asked for. */
export function validProducts(people: 1 | 2, missingNif: number): ProductId[] {
  if (people === 1) return missingNif === 1 ? ["bundle", "nif-only"] : ["bank-only"];
  if (missingNif === 2) return ["couple", "nif-only"];
  if (missingNif === 1) return ["bundle", "nif-only"];
  return ["bank-only"];
}

/** The price of one unit of `product`, which is what every order is. */
export function totalCents(product: ProductId): number {
  return {
    "nif-only": PRICE_CENTS.nifOnly,
    bundle: PRICE_CENTS.bundle,
    "bank-only": PRICE_CENTS.bankOnly,
    couple: PRICE_CENTS.couple,
  }[product];
}

export function includesNif(product: ProductId): boolean {
  return product !== "bank-only";
}

/**
 * How many people send documents for this order: two for any joint account
 * (the couple package included: the bank wants both holders' files), one
 * otherwise. The result screen and the dashboard both read it, so the
 * partner's document list appears in the same cases on both.
 */
export function applicantsFor(order: Pick<Extract<Recommendation, { kind: "product" }>, "joint">): 1 | 2 {
  return order.joint ? 2 : 1;
}

export function includesBank(product: ProductId): boolean {
  return product !== "nif-only";
}
