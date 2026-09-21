import { sendEmail } from "./send";

/**
 * The admin feedback channel: what a note is, and the email that tells the
 * team one arrived. Server only (it sends through ./send, which is).
 *
 * Patricia tests the platform from the admin area and sends notes with the
 * Feedback button in the corner of every admin page. POST /api/admin/feedback
 * saves each one in `public.admin_feedback` (supabase/migrations/0010) and
 * then calls sendFeedbackEmail(), best effort: the note is saved whether or
 * not the email goes out, and nothing here throws.
 *
 * The email goes to FEEDBACK_TO (.env.local; business@guyshore.com in
 * development, so a test note never reaches the firm). Unset, the email is
 * skipped with one log line and the note still lands on /admin/feedback.
 *
 * Self contained on purpose: its own small template in the same visual
 * language as src/lib/email/templates.ts (Georgia, navy, gold eyebrow), so
 * the client emails there stay untouched. Every value a person typed is
 * escaped before it lands in the HTML. Copy follows the house rules.
 *
 * The labels below are the admin's English and the only copy of them: the
 * client pieces (feedback-button.tsx, feedback-dialog.tsx) cannot import
 * this module at runtime, so the server components that render them
 * (AdminShell, /admin/feedback) pass the labels down as props.
 */

export const FEEDBACK_PRIORITIES = ["blocks", "should_change", "nice_to_have"] as const;
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

export const FEEDBACK_PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  blocks: "Blocks my work",
  should_change: "Should change",
  nice_to_have: "Nice to have",
};

export const FEEDBACK_STATUSES = ["open", "planned", "done", "wont_do"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Open",
  planned: "Planned",
  done: "Done",
  wont_do: "Won't do",
};

/** Limits the route enforces and the migration's checks repeat. */
export const FEEDBACK_MAX_TEXT = 2000;
export const FEEDBACK_MAX_PAGE_URL = 500;

/** A row of `public.admin_feedback`. */
export type AdminFeedbackRow = {
  id: string;
  user_id: string | null;
  page_url: string | null;
  expected: string | null;
  happened: string | null;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
};

export function isFeedbackPriority(value: unknown): value is FeedbackPriority {
  return typeof value === "string" && (FEEDBACK_PRIORITIES as readonly string[]).includes(value);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

/**
 * A screen path the admin typed is linked only when it is a path on this
 * site: it starts with one slash, not two (`//host` would leave the site).
 */
export function isSitePath(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

// ---------------------------------------------------------------------------
// The email
// ---------------------------------------------------------------------------

const NAVY = "#0E2A47";
const NAVY_SOFT = "#2D4B72";
const NAVY_MUTED = "#5B7199";
const GOLD = "#D0A12B";
const GOLD_DARK = "#A67D1E";
const PAPER = "#FAFAF7";
const WHITE = "#FFFFFF";
const LINE = "#E3DAD0";
const SERIF = "Georgia,'Times New Roman',serif";

const FEEDBACK_PAGE_PATH = "/admin/feedback";

const sentAtFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Lisbon",
});

export type FeedbackEmailInput = {
  id: string;
  pageUrl: string | null;
  expected: string | null;
  happened: string | null;
  priority: FeedbackPriority;
  /** Who sent it: the signed in admin's email. */
  senderEmail: string;
  createdAt: string;
  /** Where links point: the site URL or the request's origin. */
  origin: string;
};

export type EmailContent = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function base(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function sentAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${sentAtFormat.format(date)} Lisbon time`;
}

/** A person's words as escaped HTML paragraphs, line breaks kept. */
function paragraphs(value: string): string {
  return value
    .split(/\n\s*\n/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 10px;font-family:${SERIF};font-size:15px;line-height:1.6;color:${NAVY};">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function block(label: string, body: string | null): string {
  const content = body
    ? paragraphs(body)
    : `<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${NAVY_MUTED};">Left empty.</p>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border-left:3px solid ${GOLD};background:${PAPER};">
        <tr><td style="padding:14px 18px;">
          <p style="margin:0 0 6px;font-family:${SERIF};font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${GOLD_DARK};">${escapeHtml(label)}</p>
          ${content}
        </td></tr>
      </table>`;
}

function detailRow(label: string, valueHtml: string): string {
  return `<tr>
          <td style="padding:4px 16px 4px 0;font-family:${SERIF};font-size:13px;color:${NAVY_MUTED};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:4px 0;font-family:${SERIF};font-size:15px;color:${NAVY};vertical-align:top;">${valueHtml}</td>
        </tr>`;
}

/** Subject, HTML and plain text for one note. Pure. */
export function feedbackEmail(input: FeedbackEmailInput): EmailContent {
  const priority = FEEDBACK_PRIORITY_LABELS[input.priority];
  const screen = input.pageUrl ?? "Not given";
  const screenUrl = isSitePath(input.pageUrl) ? `${base(input.origin)}${input.pageUrl}` : null;
  const listUrl = `${base(input.origin)}${FEEDBACK_PAGE_PATH}`;
  const when = sentAt(input.createdAt);
  const subject = `Admin feedback: ${priority}${input.pageUrl ? ` on ${input.pageUrl.slice(0, 80)}` : ""}`;

  const screenHtml = screenUrl
    ? `<a href="${escapeHtml(screenUrl)}" style="color:${NAVY};">${escapeHtml(screen)}</a>`
    : escapeHtml(screen);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${WHITE};border:1px solid ${LINE};">
      <tr><td style="padding:36px 40px 32px;">
        <p style="margin:0 0 18px;font-family:${SERIF};font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:${GOLD_DARK};">Admin feedback</p>
        <h1 style="margin:0 0 20px;font-family:${SERIF};font-size:26px;font-weight:normal;line-height:1.2;color:${NAVY};">A new note: ${escapeHtml(priority)}</h1>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
        ${detailRow("Screen", screenHtml)}
        ${detailRow("Priority", escapeHtml(priority))}
        ${detailRow("Sent by", escapeHtml(input.senderEmail))}
        ${detailRow("Sent on", escapeHtml(when))}
        </table>
        ${block("What was expected", input.expected)}
        ${block("What happened", input.happened)}
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 0;">
          <tr><td style="background:${NAVY};border-radius:999px;">
            <a href="${escapeHtml(listUrl)}" style="display:inline-block;padding:14px 28px;font-family:${SERIF};font-size:16px;color:${WHITE};text-decoration:none;">See every note</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 40px 24px;border-top:1px solid ${LINE};">
        <p style="margin:0;font-family:${SERIF};font-size:13px;line-height:1.6;color:${NAVY_SOFT};">Sent from the Feedback button in the Alttavia admin. Note ${escapeHtml(input.id)}.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `A new note: ${priority}`,
    "",
    `Screen: ${screenUrl ?? screen}`,
    `Priority: ${priority}`,
    `Sent by: ${input.senderEmail}`,
    `Sent on: ${when}`,
    "",
    "What was expected:",
    input.expected ?? "Left empty.",
    "",
    "What happened:",
    input.happened ?? "Left empty.",
    "",
    `See every note: ${listUrl}`,
    "",
    `Sent from the Feedback button in the Alttavia admin. Note ${input.id}.`,
  ].join("\n");

  return { subject, html, text };
}

/**
 * Emails the note to FEEDBACK_TO. Never throws: an unset address is one log
 * line, a failed send is logged by sendEmail(). Answers whether it went out.
 */
export async function sendFeedbackEmail(input: FeedbackEmailInput): Promise<boolean> {
  const to = process.env.FEEDBACK_TO?.trim();
  if (!to) {
    console.info(`feedback: FEEDBACK_TO not set; note ${input.id} saved, not emailed`);
    return false;
  }
  try {
    const result = await sendEmail({ to, ...feedbackEmail(input) });
    return result.ok;
  } catch (error) {
    console.error(`feedback: email for note ${input.id} failed:`, error);
    return false;
  }
}
