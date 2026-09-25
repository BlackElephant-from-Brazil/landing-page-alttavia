import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { UserServiceApplicantRow } from "@/lib/db/types";

import { ApplicantDetailsForm } from "../documents/applicant-details-form";
import { ContractGate } from "./contract-gate";

/**
 * The service agreement card and its dialog as the server first renders
 * them. No browser here, so effects (the dialog opening by itself, the
 * submit) are not exercised: these pin what each state shows and where the
 * two links point.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "jane@example.com";

function gate(overrides: Partial<Parameters<typeof ContractGate>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(ContractGate, {
      orderId: ORDER_ID,
      paidAt: "2026-09-21T10:00:00.000Z",
      accountEmail: EMAIL,
      applicant: null,
      preparedAt: null,
      emailed: false,
      ...overrides,
    }),
  );
}

describe("ContractGate", () => {
  it("asks for the details while there is no agreement, with no dialog in the first render", () => {
    const html = gate();
    expect(html).toContain("Your service agreement");
    expect(html).toContain(`Confirm your details and we prepare it. It opens in a new tab and a copy goes to ${EMAIL}.`);
    expect(html).toContain("Confirm my details");
    expect(html).not.toContain("<dialog");
    expect(html).not.toContain("Download");
    expect(html).not.toContain("Your agreement is ready. Open it below.");
  });

  it("shows the date and the two links once the agreement exists", () => {
    const html = gate({ preparedAt: "2026-09-21T10:05:00.000Z", emailed: true });
    expect(html).toContain("Prepared on 21 September 2026.");
    expect(html).toContain(`A copy was sent to ${EMAIL}.`);
    expect(html).toContain(`href="/api/orders/${ORDER_ID}/contract"`);
    expect(html).toContain(`href="/api/orders/${ORDER_ID}/contract?download=1"`);
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("Confirm my details");
  });

  it("does not claim an email that did not go out", () => {
    const html = gate({ preparedAt: "2026-09-21T10:05:00.000Z", emailed: false });
    expect(html).toContain("Prepared on 21 September 2026.");
    expect(html).not.toContain("A copy was sent");
  });

  it("stays the one person card for every model but the Couple package, partner row or not", () => {
    for (const template of [null, "nif", "bank", "package"] as const) {
      const html = gate({ template, partner: row(1) });
      expect(html).toContain("Confirm my details");
      expect(html).not.toContain("partner");
    }
  });
});

function row(index: 0 | 1): UserServiceApplicantRow {
  return {
    id: index === 0 ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    user_service_id: ORDER_ID,
    applicant_index: index,
    full_name: index === 0 ? "Jane Alice Doe" : "John Robert Doe",
    gender: index === 0 ? "f" : "m",
    birth_place: "Austin, Texas, United States of America",
    birth_date: "1984-07-04",
    passport_number: index === 0 ? "X1234567" : "Y7654321",
    passport_issuer: "United States Department of State",
    passport_issued_on: "2021-03-12",
    passport_expires_on: "2031-03-11",
    tax_address: "1200 West 6th Street, Austin, TX 78703, USA",
    created_at: "2026-09-21T10:20:00.000Z",
    updated_at: "2026-09-21T10:20:00.000Z",
  };
}

describe("ContractGate for the Couple package", () => {
  it("asks for both people's details while either is missing, with no dialog in the first render", () => {
    for (const [applicant, partner] of [
      [null, null],
      [row(0), null],
      [null, row(1)],
    ] as const) {
      const html = gate({ template: "couple", applicant, partner });
      expect(html).toContain(
        `Confirm your details and your partner&#x27;s details and we prepare it. It opens in a new tab and a copy goes to ${EMAIL}.`,
      );
      expect(html).toContain("Confirm the details");
      expect(html).not.toContain("Confirm my details");
      expect(html).not.toContain("<dialog");
      expect(html).not.toContain("Open your agreement");
    }
  });

  it("offers the place and the button that opens the agreement once both sets are on the order", () => {
    const html = gate({ template: "couple", applicant: row(0), partner: row(1) });
    expect(html).toContain(
      `Your details and your partner&#x27;s details are saved. Open the agreement to finish. It opens in a new tab and a copy goes to ${EMAIL}.`,
    );
    expect(html).toContain("City and country you are in today");
    expect(html).toContain("Optional. It is printed next to the date in the annex. Leave it blank to write it in by hand.");
    expect(html).toContain('maxLength="120"');
    expect(html).toContain(">Open your agreement<");
    expect(html).toContain(">Check the details<");
    expect(html).not.toContain("<dialog");
  });

  it("shows the same ready card as everyone once the agreement exists", () => {
    const html = gate({
      template: "couple",
      applicant: row(0),
      partner: row(1),
      preparedAt: "2026-09-25T10:05:00.000Z",
      emailed: true,
    });
    expect(html).toContain("Prepared on 25 September 2026.");
    expect(html).toContain(`href="/api/orders/${ORDER_ID}/contract?download=1"`);
    expect(html).not.toContain("Open your agreement");
    expect(html).not.toContain("Confirm the details");
  });

  it("keeps to the house rules in every line it adds", () => {
    const lines = [
      gate({ template: "couple" }),
      gate({ template: "couple", applicant: row(0), partner: row(1) }),
    ].join(" ");
    expect(lines).not.toMatch(/[—–]|\s-\s/);
    expect(lines).not.toMatch(/\bproblem\b|\btrap\b|\bfree\b|refund|money back|video call|run by lawyers/i);
  });
});

describe("ApplicantDetailsForm", () => {
  const base = { userServiceId: ORDER_ID, applicantIndex: 0 as const, initial: null, onClose: () => {} };

  it("reads as the agreement's dialog with purpose contract", () => {
    const html = renderToStaticMarkup(
      createElement(ApplicantDetailsForm, { ...base, purpose: "contract", accountEmail: EMAIL, onPrepared: () => {} }),
    );
    expect(html).toContain("Your details for the service agreement");
    expect(html).toContain(
      "They are printed in the agreement and in the power of attorney as typed, so check them against the passport. " +
        "Accents our documents cannot print are left out. " +
        "If this order is for someone else, enter that person&#x27;s details.",
    );
    // The lead no longer promises what the documents cannot do.
    expect(html).not.toContain("exactly as typed");
    expect(html).toContain("Your agreement is sent to");
    expect(html).toContain(EMAIL);
    expect(html).toContain("City and country you are in today");
    expect(html).toContain("Confirm and open my agreement");
    expect(html).not.toContain("Details for the power of attorney");
  });

  it("stays the deed's dialog by default", () => {
    const html = renderToStaticMarkup(createElement(ApplicantDetailsForm, { ...base, onSaved: () => {} }));
    expect(html).toContain("Details for the power of attorney");
    expect(html).toContain(
      "They are printed in the deed as typed, so check them against the passport. " +
        "Accents our documents cannot print are left out. " +
        "If this order is for someone else, enter that person&#x27;s details.",
    );
    expect(html).not.toContain("exactly as typed");
    expect(html).toContain("The deed refers to the person as");
    expect(html).toContain(">Save<");
    expect(html).not.toContain("City and country you are in today");
    expect(html).not.toContain("Your agreement is sent to");

    const download = renderToStaticMarkup(
      createElement(ApplicantDetailsForm, { ...base, submitLabel: "Save and download", onSaved: () => {} }),
    );
    expect(download).toContain(">Save and download<");
  });

  it("reads as the agreement's for the Couple package's two steps, and still only saves", () => {
    const first = renderToStaticMarkup(
      createElement(ApplicantDetailsForm, { ...base, wording: "agreement", submitLabel: "Continue", onSaved: () => {} }),
    );
    expect(first).toContain("Your details for the service agreement");
    expect(first).toContain(
      "They are printed in the agreement and in the powers of attorney as typed, so check them against the passport.",
    );
    expect(first).toContain(">Continue<");
    expect(first).not.toContain("Details for the power of attorney");
    expect(first).not.toContain("Confirm and open my agreement");
    expect(first).not.toContain("City and country you are in today");

    const partner = renderToStaticMarkup(
      createElement(ApplicantDetailsForm, {
        ...base,
        applicantIndex: 1,
        wording: "agreement",
        submitLabel: "Continue",
        onSaved: () => {},
      }),
    );
    expect(partner).toContain("Your partner&#x27;s details for the service agreement");
    expect(partner).toContain("check them against your partner&#x27;s passport");
    expect(partner).toContain("The documents refer to your partner as");
    expect(partner).not.toContain("for the power of attorney");
    expect(`${first} ${partner}`).not.toMatch(/[—–]|\s-\s/);
  });

  it("says the same to the partner, without the line about someone else", () => {
    const html = renderToStaticMarkup(
      createElement(ApplicantDetailsForm, { ...base, applicantIndex: 1, onSaved: () => {} }),
    );
    expect(html).toContain("Your partner&#x27;s details for the power of attorney");
    expect(html).toContain(
      "They are printed in the deed as typed, so check them against the passport. " +
        "Accents our documents cannot print are left out.",
    );
    expect(html).not.toContain("If this order is for someone else");
    expect(html).not.toContain("exactly as typed");
  });
});
