/**
 * The three emails a client gets from the admin area, as `{ subject, html,
 * text }` for src/lib/email/send.ts. Contract (docs/admin-contract.md)
 * section 4.
 *
 * Same visual language as the Supabase code email: Georgia, navy text, a
 * gold eyebrow, one button. Table based and inline styled because that is
 * what email clients render. Every value that comes from a person (a
 * rejection reason, a note) is escaped before it lands in the HTML.
 *
 * Copy follows the house rules in src/content/bank-nif.ts: short, British
 * English, no dashes as punctuation, one thing to do, one link to do it.
 *
 * `dashboardUrl(origin)` builds the link: NEXT_PUBLIC_SITE_URL when set,
 * else the origin the route handler saw, else the production site.
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
  const base = (process.env.NEXT_PUBLIC_SITE_URL || origin || PRODUCTION_ORIGIN).replace(/\/+$/, "");
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

type Layout = {
  eyebrow: string;
  heading: string;
  /** Plain paragraphs, escaped here. */
  paragraphs: string[];
  /** A block of the person's own words, rendered in a quiet box. */
  quote?: { label: string; body: string };
  cta: { label: string; url: string };
  /** A last line under the button. */
  footnote?: string;
};

function html(layout: Layout): string {
  const paragraphs = layout.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:${NAVY_SOFT};">${escapeHtml(text)}</p>`,
    )
    .join("");

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
        ${quote}
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 0;">
          <tr><td style="background:${NAVY};border-radius:999px;">
            <a href="${escapeHtml(layout.cta.url)}" style="display:inline-block;padding:14px 28px;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:${WHITE};text-decoration:none;">${escapeHtml(layout.cta.label)}</a>
          </td></tr>
        </table>
        ${footnote}
      </td></tr>
      <tr><td style="padding:18px 40px 24px;border-top:1px solid #E3DAD0;">
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.6;color:${NAVY_MUTED};">${escapeHtml(BRAND)}. Reply to this email if you have a question.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function text(layout: Layout): string {
  const lines = [layout.heading, "", ...layout.paragraphs.flatMap((p) => [p, ""])];
  if (layout.quote) lines.push(`${layout.quote.label}:`, layout.quote.body.trim(), "");
  lines.push(`${layout.cta.label}: ${layout.cta.url}`);
  if (layout.footnote) lines.push("", layout.footnote);
  lines.push("", `${BRAND}. Reply to this email if you have a question.`);
  return lines.join("\n");
}

function build(subject: string, layout: Layout): EmailContent {
  return { subject, html: html(layout), text: text(layout) };
}

/** A document was rejected: which one, why, and where to upload a new file. */
export function documentRejected(input: { docLabel: string; reason: string; dashboardUrl: string }): EmailContent {
  return build(`A new upload is needed: ${input.docLabel}`, {
    eyebrow: "Your order",
    heading: `We need a new ${input.docLabel}`,
    paragraphs: [
      `We reviewed the ${input.docLabel} you sent and could not accept it.`,
      "Upload a new file from your dashboard and we carry on from there.",
    ],
    quote: { label: "Reason", body: input.reason },
    cta: { label: "Upload a new file", url: input.dashboardUrl },
  });
}

/** A pendency was posted: the note itself and where to act on it. */
export function pendencyPosted(input: { body: string; dashboardUrl: string }): EmailContent {
  return build("We need something from you", {
    eyebrow: "Your order",
    heading: "Pending from you",
    paragraphs: ["Your order is waiting on one thing from your side."],
    quote: { label: "From our team", body: input.body },
    cta: { label: "Open your dashboard", url: input.dashboardUrl },
    footnote: "Once it is done we mark it resolved on your dashboard.",
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
