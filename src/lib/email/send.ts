import "server-only";

/**
 * Sends one transactional email through Resend's REST API. Contract
 * (docs/admin-contract.md) section 4.
 *
 * Best effort by design: the three emails this sends (document rejected,
 * pendency posted, order complete) must never block the admin action that
 * triggers them. So this never throws. A missing key, a network error or a
 * non 2xx answer is logged with the subject and the recipient and answered
 * with `{ ok: false }`; the caller carries on.
 *
 * Configuration, all in .env.local (see .env.example):
 *
 *   EMAIL_API_KEY    Resend API key
 *   EMAIL_FROM       "Alttavia Relocation <hello@send.alttavia-relocation.com>"
 *   EMAIL_REPLY_TO   where a client's reply lands (optional)
 *
 * Content comes from src/lib/email/templates.ts. No SDK: one fetch.
 */

const RESEND_URL = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = {
  ok: boolean;
  /** Resend's id for the message, when it accepted it. */
  id?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO;

  if (!apiKey || !from) {
    console.error(`sendEmail: EMAIL_API_KEY or EMAIL_FROM not set; "${input.subject}" to ${input.to} not sent`);
    return { ok: false };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      console.error(
        `sendEmail: Resend answered ${res.status} for "${input.subject}" to ${input.to}: ${body?.message ?? "no message"}`,
      );
      return { ok: false };
    }
    return { ok: true, id: body?.id };
  } catch (err) {
    console.error(`sendEmail: request failed for "${input.subject}" to ${input.to}:`, err);
    return { ok: false };
  }
}
