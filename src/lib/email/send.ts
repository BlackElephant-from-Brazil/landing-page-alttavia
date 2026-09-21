import "server-only";

/**
 * Sends one transactional email through Resend's REST API. Contract
 * (docs/admin-contract.md) section 4.
 *
 * Best effort by design: the emails this sends (document rejected, order
 * complete, service agreement) must never block the action that triggers
 * them. So this never throws. A missing key, a network error or a
 * non 2xx answer is logged with the subject and the recipient and answered
 * with `{ ok: false }`; the caller carries on.
 *
 * `attachments` ride along as base64, which is how Resend's REST API takes a
 * file (docs/agreement-contract.md section 5). Resend caps a message at
 * 40 MB after encoding; the one attachment sent today is a PDF of a few
 * dozen kilobytes.
 *
 * Configuration, all in .env.local (see .env.example):
 *
 *   EMAIL_API_KEY    Resend API key
 *   EMAIL_FROM       "Alttavia Relocation <hello@send.alttavia-relocation.com>"
 *   EMAIL_REPLY_TO   where a client's reply lands (optional)
 *
 * Content comes from src/lib/email/templates.ts. No SDK: one fetch.
 *
 * Reserved addresses are never sent to. A recipient on `.invalid` (RFC 2606;
 * the demo accounts of scripts/seed-demo.mjs live on demo.alttavia.invalid)
 * can never receive mail, and a message to one would hard bounce on the
 * sending domain and hurt its reputation. Such a send is skipped with one
 * info line and answered `{ ok: true }`, so the admin UI reads as it would
 * for a real client (training runs on the demo data). No real client can
 * have such an address.
 */

const RESEND_URL = "https://api.resend.com/emails";

export type EmailAttachment = {
  filename: string;
  content: Uint8Array;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult = {
  ok: boolean;
  /** Resend's id for the message, when it accepted it. */
  id?: string;
};

/** True for an address on the reserved `.invalid` top level domain, which never receives mail. */
export function isReservedAddress(to: string): boolean {
  const at = to.lastIndexOf("@");
  if (at < 0) return false;
  const domain = to.slice(at + 1).trim().replace(/>$/, "").replace(/\.$/, "").toLowerCase();
  return domain === "invalid" || domain.endsWith(".invalid");
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (isReservedAddress(input.to)) {
    console.info(`sendEmail: "${input.subject}" to a reserved .invalid address skipped`);
    return { ok: true };
  }

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
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((file) => ({
                filename: file.filename,
                content: Buffer.from(file.content).toString("base64"),
              })),
            }
          : {}),
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
