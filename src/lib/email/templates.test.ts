import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dashboardUrl,
  documentRejected,
  documentsReady,
  newPaidOrder,
  orderCompleted,
  paymentMismatch,
  paymentReceived,
  serviceAgreement,
  type EmailContent,
} from "./templates";

/**
 * The email templates: what each one says, where its button goes, and the
 * house rules every one of them keeps (no dashes as punctuation, none of the
 * banned words). Pure functions, no network.
 */

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_URL = `http://localhost:3000/en/dashboard/orders/${ORDER_ID}`;
const ADMIN_URL = `http://localhost:3000/admin/orders?order=${ORDER_ID}`;

afterEach(() => {
  vi.unstubAllEnvs();
});

function all(): [string, EmailContent][] {
  return [
    ["documentRejected", documentRejected({ docLabel: "Passport", reason: "The scan is cut off.", dashboardUrl: CLIENT_URL })],
    ["orderCompleted", orderCompleted({ serviceName: "NIF only", dashboardUrl: CLIENT_URL })],
    ["serviceAgreement", serviceAgreement({ serviceName: "NIF only", dashboardUrl: CLIENT_URL })],
    ["paymentReceived with agreement", paymentReceived({ serviceName: "NIF only", hasAgreement: true, dashboardUrl: CLIENT_URL })],
    ["paymentReceived without", paymentReceived({ serviceName: "Couple package", hasAgreement: false, dashboardUrl: CLIENT_URL })],
    [
      "newPaidOrder with agreement",
      newPaidOrder({
        serviceName: "NIF + Bank Account",
        amount: "€497",
        clientEmail: "client@example.com",
        hasAgreement: true,
        orderId: ORDER_ID,
        adminUrl: ADMIN_URL,
      }),
    ],
    [
      "newPaidOrder without",
      newPaidOrder({
        serviceName: "Couple package",
        amount: "€597",
        clientEmail: "client@example.com",
        hasAgreement: false,
        orderId: ORDER_ID,
        adminUrl: ADMIN_URL,
      }),
    ],
    [
      "documentsReady",
      documentsReady({
        serviceName: "Couple package",
        clientEmail: "client@example.com",
        filesToReview: 5,
        applicants: 2,
        orderId: ORDER_ID,
        adminUrl: ADMIN_URL,
      }),
    ],
    ["paymentMismatch", paymentMismatch(MISMATCH)],
  ];
}

const MISMATCH = {
  serviceName: "NIF only",
  clientEmail: "client@example.com",
  paid: "€497",
  expected: "€149",
  sessionId: "cs_live_a1B2c3",
  orderId: ORDER_ID,
  adminUrl: ADMIN_URL,
};

describe("paymentReceived", () => {
  it("thanks the client, names the service and sends them to the order", () => {
    const email = paymentReceived({ serviceName: "NIF only", hasAgreement: true, dashboardUrl: CLIENT_URL });

    expect(email.subject).toBe("Payment received for your NIF only order");
    expect(email.text).toContain("Payment received");
    expect(email.text).toContain("We received your payment for your NIF only order.");
    expect(email.text).toContain(`Open your order: ${CLIENT_URL}`);
    expect(email.html).toContain(`href="${CLIENT_URL}"`);
    expect(email.text).toContain("Reply to this email if you have a question.");
  });

  it("asks for the agreement details first when the service has an agreement", () => {
    const email = paymentReceived({ serviceName: "NIF only", hasAgreement: true, dashboardUrl: CLIENT_URL });

    expect(email.text).toContain("Next, confirm your details for the service agreement, then upload your documents.");
  });

  it("goes straight to the documents when the service has no agreement", () => {
    const email = paymentReceived({ serviceName: "Couple package", hasAgreement: false, dashboardUrl: CLIENT_URL });

    expect(email.text).toContain("Next, upload your documents.");
    expect(email.text).not.toContain("service agreement");
  });
});

describe("newPaidOrder", () => {
  it("gives the team the service, the amount, the client and a link to the admin order", () => {
    const email = newPaidOrder({
      serviceName: "NIF + Bank Account",
      amount: "€497",
      clientEmail: "client@example.com",
      hasAgreement: true,
      orderId: ORDER_ID,
      adminUrl: ADMIN_URL,
    });

    expect(email.subject).toBe("New paid order: NIF + Bank Account, €497");
    expect(email.text).toContain("Service: NIF + Bank Account");
    expect(email.text).toContain("Amount: €497");
    expect(email.text).toContain("Client: client@example.com");
    expect(email.text).toContain(`Order: ${ORDER_ID}`);
    expect(email.text).toContain(`Open the order: ${ADMIN_URL}`);
    expect(email.html).toContain(`href="${ADMIN_URL}"`);
    expect(email.text).toContain("service agreement");
  });

  it("signs as the platform and does not invite a reply", () => {
    const email = newPaidOrder({
      serviceName: "NIF only",
      amount: "€149",
      clientEmail: "client@example.com",
      hasAgreement: false,
      orderId: ORDER_ID,
      adminUrl: ADMIN_URL,
    });

    expect(email.text).not.toContain("Reply to this email");
    expect(email.text).toContain("Sent to the team inbox only.");
    expect(email.text).not.toContain("service agreement");
  });

  it("escapes what a person typed", () => {
    const email = newPaidOrder({
      serviceName: "NIF <b>only</b> & more",
      amount: "€149",
      clientEmail: "o'hara@example.com",
      hasAgreement: false,
      orderId: ORDER_ID,
      adminUrl: ADMIN_URL,
    });

    expect(email.html).not.toContain("<b>only</b>");
    expect(email.html).toContain("NIF &lt;b&gt;only&lt;/b&gt; &amp; more");
    expect(email.html).toContain("o&#39;hara@example.com");
  });
});

describe("documentsReady", () => {
  it("tells the team the set is complete and links to the admin order", () => {
    const email = documentsReady({
      serviceName: "NIF only",
      clientEmail: "client@example.com",
      filesToReview: 1,
      applicants: 1,
      orderId: ORDER_ID,
      adminUrl: ADMIN_URL,
    });

    expect(email.subject).toBe("Documents ready to review: NIF only, client@example.com");
    expect(email.text).toContain("Every required document for this NIF only order is in.");
    expect(email.text).toContain("To review: 1 file");
    expect(email.text).not.toContain("Applicants:");
    expect(email.text).toContain(`Review the documents: ${ADMIN_URL}`);
  });

  it("counts files in the plural and says when there are two applicants", () => {
    const email = documentsReady({
      serviceName: "Couple package",
      clientEmail: "client@example.com",
      filesToReview: 5,
      applicants: 2,
      orderId: ORDER_ID,
      adminUrl: ADMIN_URL,
    });

    expect(email.text).toContain("To review: 5 files");
    expect(email.text).toContain("Applicants: 2");
  });
});

describe("paymentMismatch", () => {
  it("tells the team what was paid against what the order expects, and links to the order", () => {
    const email = paymentMismatch(MISMATCH);

    expect(email.subject).toBe("Paid amount does not match the order: NIF only, client@example.com");
    expect(email.text).toContain("Paid: €497");
    expect(email.text).toContain("Order total: €149");
    expect(email.text).toContain("Stripe session: cs_live_a1B2c3");
    expect(email.text).toContain(`Open the order: ${ADMIN_URL}`);
    expect(email.text).toContain("Sent to the team inbox only.");
  });
});

describe("dashboardUrl", () => {
  it("builds the admin link on the origin the request saw", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(dashboardUrl("http://localhost:3000/", `/admin/orders?order=${ORDER_ID}`)).toBe(ADMIN_URL);
  });

  it("prefers the site URL when it is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");

    expect(dashboardUrl("http://localhost:3000", "/en/dashboard")).toBe("https://example.com/en/dashboard");
  });
});

describe("house rules", () => {
  const BANNED = /\b(problem|trap|free|refund|money back|video call|run by lawyers)\b/i;

  it.each(all())("%s uses no dash as punctuation and none of the banned words", (_name, email) => {
    for (const copy of [email.subject, email.text]) {
      expect(copy).not.toMatch(/[–—]/);
      expect(copy).not.toMatch(/\s-\s/);
      expect(copy).not.toMatch(BANNED);
    }
  });
});
