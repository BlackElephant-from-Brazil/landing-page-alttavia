/**
 * The emails the platform sends about an order, as `{ subject, html, text }`
 * for src/lib/email/send.ts.
 *
 * To the client: two from the admin area (docs/admin-contract.md section 4),
 * the service agreement sent after payment (docs/agreement-contract.md
 * section 5) and, since 2026-09-21, "Payment received".
 *
 * To the team inbox (EMAIL_TEAM_INBOX, see src/lib/orders/notify.ts): "New
 * paid order", "Documents ready to review" and "Paid amount does not match
 * the order". Same layout with a small
 * table of facts and a footer that does not invite a reply.
 *
 * Same visual language as the Supabase code email: Georgia, navy text, a
 * gold eyebrow, one button. Table based and inline styled because that is
 * what email clients render. Every value that comes from a person (a
 * rejection reason, a note, an email address) is escaped before it lands in
 * the HTML.
 *
 * Copy follows the house rules in the header of src/content/bank-nif.ts:
 * short, no dashes as punctuation, one thing to do, one link to do it.
 *
 * `dashboardUrl(origin, path)` builds the link, to any path on the site
 * (the admin's `/admin/orders?order=` too): NEXT_PUBLIC_SITE_URL when set,
 * else the production site when NODE_ENV is production, else the origin the
 * route handler saw.
 */

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

const BRAND = "Alttavia Relocation";
const PRODUCTION_ORIGIN = "https://bank-nif-portugal.alttavia-relocation.com";
const DASHBOARD_PATH = "/en/dashboard";

const NAVY = "#0E2A47";
const NAVY_SOFT = "#2D4B72";
const NAVY_MUTED = "#5B7199";
const GOLD = "#D0A12B";
const GOLD_DARK = "#A67D1E";
const PAPER = "#FAFAF7";
const WHITE = "#FFFFFF";

/** The absolute dashboard URL for a link inside an email. */
export function dashboardUrl(origin?: string | null, path: string = DASHBOARD_PATH): string {
  const production = process.env.NODE_ENV === "production";
  const base = (process.env.NEXT_PUBLIC_SITE_URL || (production ? PRODUCTION_ORIGIN : origin) || PRODUCTION_ORIGIN).replace(
    /\/+$/,
    "",
  );
  return `${base}${path}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A person's text as HTML paragraphs: escaped, blank lines split it. */
function quoted(value: string): string {
  return value
    .trim()
    .split(/\n\s*\n/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:${NAVY};">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

type Fact = { label: string; value: string };

type Layout = {
  eyebrow: string;
  heading: string;
  /** Plain paragraphs, escaped here. */
  paragraphs: string[];
  /** Label and value rows for the team's emails, escaped here. */
  facts?: Fact[];
  /** A block of the person's own words, rendered in a quiet box. */
  quote?: { label: string; body: string };
  cta: { label: string; url: string };
  /** A last line under the button. */
  footnote?: string;
  /** Who reads it: the client (the default) may reply; the team gets a plain signature. */
  audience?: "client" | "team";
};

const CLIENT_SIGNATURE = `${BRAND}. Reply to this email if you have a question.`;
const TEAM_SIGNATURE = `${BRAND} client platform. Sent to the team inbox only.`;

function signature(layout: Layout): string {
  return layout.audience === "team" ? TEAM_SIGNATURE : CLIENT_SIGNATURE;
}

function html(layout: Layout): string {
  const paragraphs = layout.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:${NAVY_SOFT};">${escapeHtml(text)}</p>`,
    )
    .join("");

  const facts = layout.facts?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-top:1px solid #E3DAD0;">
        ${layout.facts
          .map(
            (fact) =>
              `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid #E3DAD0;width:34%;vertical-align:top;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD_DARK};">${escapeHtml(fact.label)}</td><td style="padding:10px 0;border-bottom:1px solid #E3DAD0;vertical-align:top;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.5;color:${NAVY};word-break:break-word;">${escapeHtml(fact.value)}</td></tr>`,
          )
          .join("")}
      </table>`
    : "";

  const quote = layout.quote
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-left:3px solid ${GOLD};background:${PAPER};">
        <tr><td style="padding:14px 18px;">
          <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${GOLD_DARK};">${escapeHtml(layout.quote.label)}</p>
          ${quoted(layout.quote.body)}
        </td></tr>
      </table>`
    : "";

  const footnote = layout.footnote
    ? `<p style="margin:20px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:${NAVY_MUTED};">${escapeHtml(layout.footnote)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(layout.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${WHITE};border:1px solid #E3DAD0;">
      <tr><td style="padding:36px 40px 32px;">
        <p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:${GOLD_DARK};">${escapeHtml(layout.eyebrow)}</p>
        <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:normal;line-height:1.2;color:${NAVY};">${escapeHtml(layout.heading)}</h1>
        ${paragraphs}
        ${facts}
        ${quote}
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 0;">
          <tr><td style="background:${NAVY};border-radius:999px;">
            <a href="${escapeHtml(layout.cta.url)}" style="display:inline-block;padding:14px 28px;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:${WHITE};text-decoration:none;">${escapeHtml(layout.cta.label)}</a>
          </td></tr>
        </table>
        ${footnote}
      </td></tr>
      <tr><td style="padding:18px 40px 24px;border-top:1px solid #E3DAD0;">
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.6;color:${NAVY_MUTED};">${escapeHtml(signature(layout))}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function text(layout: Layout): string {
  const lines = [layout.heading, "", ...layout.paragraphs.flatMap((p) => [p, ""])];
  if (layout.facts?.length) lines.push(...layout.facts.map((fact) => `${fact.label}: ${fact.value}`), "");
  if (layout.quote) lines.push(`${layout.quote.label}:`, layout.quote.body.trim(), "");
  lines.push(`${layout.cta.label}: ${layout.cta.url}`);
  if (layout.footnote) lines.push("", layout.footnote);
  lines.push("", signature(layout));
  return lines.join("\n");
}

function build(subject: string, layout: Layout): EmailContent {
  return { subject, html: html(layout), text: text(layout) };
}

/** A document was rejected: which one, why, and where to upload a new file. */
export function documentRejected(input: { docLabel: string; reason: string; dashboardUrl: string }): EmailContent {
  return build(`A new file is needed: ${input.docLabel}`, {
    eyebrow: "Your order",
    heading: `We need a new ${input.docLabel}`,
    paragraphs: [
      `We reviewed your ${input.docLabel} and could not accept it.`,
      "Upload a new file from your dashboard and we carry on from there.",
    ],
    quote: { label: "Reason", body: input.reason },
    cta: { label: "Upload a new file", url: input.dashboardUrl },
  });
}

/** The order is complete: the deliverables and the report are ready. */
export function orderCompleted(input: { serviceName: string; dashboardUrl: string }): EmailContent {
  return build(`Your ${input.serviceName} order is complete`, {
    eyebrow: "Your order",
    heading: "All done",
    paragraphs: [
      `Your ${input.serviceName} order is complete.`,
      "Your documents and the final report are ready on your dashboard. Keep a copy of each one.",
    ],
    cta: { label: "See your documents", url: input.dashboardUrl },
  });
}

/**
 * The service agreement is ready. The PDF itself rides along as an attachment
 * (the caller adds it); the button opens the order, where it stays available.
 */
export function serviceAgreement(input: { serviceName: string; dashboardUrl: string }): EmailContent {
  return build("Your service agreement", {
    eyebrow: "Your order",
    heading: "Your service agreement",
    paragraphs: [
      `Your service agreement for ${input.serviceName} is attached to this email as a PDF. You can also open it from your order at any time.`,
    ],
    cta: { label: "See your order", url: input.dashboardUrl },
  });
}

/**
 * To the client, once, when the order is paid for the first time. One line
 * on what comes next: the details for the service agreement when the
 * service has one, then the documents.
 */
export function paymentReceived(input: {
  serviceName: string;
  /** The service has a contract template, so the client confirms their details first. */
  hasAgreement: boolean;
  dashboardUrl: string;
}): EmailContent {
  return build(`Payment received for your ${input.serviceName} order`, {
    eyebrow: "Your order",
    heading: "Payment received",
    paragraphs: [
      `Thank you. We received your payment for your ${input.serviceName} order.`,
      input.hasAgreement
        ? "Next, confirm your details for the service agreement, then upload your documents."
        : "Next, upload your documents.",
    ],
    cta: { label: "Open your order", url: input.dashboardUrl },
  });
}

/** To the team inbox, once per order, when the payment is recorded. */
export function newPaidOrder(input: {
  serviceName: string;
  /** Already formatted, "€497". */
  amount: string;
  clientEmail: string;
  hasAgreement: boolean;
  orderId: string;
  adminUrl: string;
}): EmailContent {
  return build(`New paid order: ${input.serviceName}, ${input.amount}`, {
    eyebrow: "New order",
    heading: "New paid order",
    audience: "team",
    paragraphs: [
      `A client paid for ${input.serviceName}.`,
      input.hasAgreement
        ? "Next they confirm their details for the service agreement and upload their documents. You get an email when every required document is in."
        : "Next they upload their documents. You get an email when every required document is in.",
    ],
    facts: [
      { label: "Service", value: input.serviceName },
      { label: "Amount", value: input.amount },
      { label: "Client", value: input.clientEmail },
      { label: "Order", value: input.orderId },
    ],
    cta: { label: "Open the order", url: input.adminUrl },
  });
}

/**
 * To the team inbox when Stripe reports a paid session whose amount or
 * currency differs from the order it names. The money was taken, the order
 * stays unpaid and the client still sees Pay, so a person has to look.
 */
export function paymentMismatch(input: {
  serviceName: string;
  clientEmail: string;
  /** Already formatted, "€497", or "Not stated". */
  paid: string;
  /** Already formatted, what the order expects. */
  expected: string;
  sessionId: string;
  orderId: string;
  adminUrl: string;
}): EmailContent {
  return build(`Paid amount does not match the order: ${input.serviceName}, ${input.clientEmail}`, {
    eyebrow: "Payment",
    heading: "Paid amount does not match the order",
    audience: "team",
    paragraphs: [
      "Stripe took a payment for this order, but the amount or the currency is not the one on the order.",
      "The order stays unpaid and the client still sees the Pay button. Check the payment in Stripe before the client pays again.",
    ],
    facts: [
      { label: "Service", value: input.serviceName },
      { label: "Client", value: input.clientEmail },
      { label: "Paid", value: input.paid },
      { label: "Order total", value: input.expected },
      { label: "Stripe session", value: input.sessionId },
      { label: "Order", value: input.orderId },
    ],
    cta: { label: "Open the order", url: input.adminUrl },
  });
}

/**
 * To the team inbox when the last required document of an order arrives.
 * It may come again after a rejected file is replaced, which is intended:
 * the set is complete again and waits for a review.
 */
export function documentsReady(input: {
  serviceName: string;
  clientEmail: string;
  /** Files whose newest upload waits for a review. */
  filesToReview: number;
  applicants: number;
  orderId: string;
  adminUrl: string;
}): EmailContent {
  const files = input.filesToReview === 1 ? "1 file" : `${input.filesToReview} files`;
  return build(`Documents ready to review: ${input.serviceName}, ${input.clientEmail}`, {
    eyebrow: "Documents",
    heading: "Documents ready to review",
    audience: "team",
    paragraphs: [
      `Every required document for this ${input.serviceName} order is in.`,
      "Open the order to approve each file or reject it with a reason.",
    ],
    facts: [
      { label: "Service", value: input.serviceName },
      { label: "Client", value: input.clientEmail },
      ...(input.applicants === 2 ? [{ label: "Applicants", value: "2" }] : []),
      { label: "To review", value: files },
      { label: "Order", value: input.orderId },
    ],
    cta: { label: "Review the documents", url: input.adminUrl },
  });
}
