import { describe, expect, it } from "vitest";

import { signedAgreement, type SignedCopyDelivery } from "./templates";

/**
 * "Signed service agreement received", the team email that carries the
 * client's signed copy (src/lib/orders/notify.ts, notifySignedAgreement).
 * Kept apart from templates.test.ts, which covers the older templates; the
 * house rules checked here are the same ones.
 */

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const ADMIN_URL = `http://localhost:3000/admin/orders?order=${ORDER_ID}`;

function email(delivery: SignedCopyDelivery, fileName = "signed agreement.pdf") {
  return signedAgreement({
    serviceName: "Couple package",
    clientEmail: "client@example.com",
    orderId: ORDER_ID,
    fileName,
    delivery,
    attachmentLimit: "8 MB",
    adminUrl: ADMIN_URL,
  });
}

describe("signedAgreement", () => {
  it("names the service and the client in the subject and gives the team the four facts", () => {
    const content = email("attached");

    expect(content.subject).toBe("Signed service agreement received: Couple package, client@example.com");
    expect(content.text).toContain("Service: Couple package");
    expect(content.text).toContain("Client: client@example.com");
    expect(content.text).toContain(`Order: ${ORDER_ID}`);
    expect(content.text).toContain("File: signed agreement.pdf");
    expect(content.text).toContain(`Open the order: ${ADMIN_URL}`);
    expect(content.html).toContain(`href="${ADMIN_URL.replace(/&/g, "&amp;")}"`);
  });

  it("says where the file is, for each way it can travel", () => {
    expect(email("attached").text).toContain("The signed copy is attached to this email.");
    expect(email("too_large").text).toContain("The file is larger than 8 MB, so it is not attached. Download it from the order.");
    expect(email("unavailable").text).toContain("The file could not be attached. Download it from the order.");
    expect(email("test_payment").text).toContain(
      "This order was paid in test mode, so the file is not attached. Download it from the order.",
    );
  });

  it("signs as the platform and does not invite a reply", () => {
    const content = email("attached");

    expect(content.text).toContain("Sent to the team inbox only.");
    expect(content.text).not.toContain("Reply to this email");
  });

  it("escapes the file name the client chose", () => {
    const content = email("attached", `<img src=x onerror="alert(1)">.pdf`);

    expect(content.html).not.toContain("<img src=x");
    expect(content.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;.pdf");
  });

  it.each(["attached", "too_large", "unavailable", "test_payment"] as const)(
    "keeps the house rules when the copy is %s",
    (delivery) => {
      const content = email(delivery);
      for (const copy of [content.subject, content.text]) {
        expect(copy).not.toMatch(/[–—]/);
        expect(copy).not.toMatch(/\s-\s/);
        expect(copy).not.toMatch(/\b(problem|trap|free|refund|money back|video call|run by lawyers)\b/i);
      }
    },
  );
});
