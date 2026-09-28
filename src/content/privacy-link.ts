/**
 * Where the privacy notice lives and the short lines that link to it.
 *
 * A module of its own, with no imports, so the footer content
 * (src/content/bank-nif.ts), the sitemap and the client components can
 * link the notice without pulling in its text: src/content/privacy.ts
 * imports bank-nif.ts, so bank-nif.ts cannot import it back. privacy.ts
 * re-exports everything here, and privacy.test.ts holds these lines to the
 * house rules with the rest of the notice.
 */

export const PRIVACY_PATH = "/en/privacy";

export const PRIVACY_LINK_TEXT = "Privacy notice";

/** The line under the email form of the apply wizard, before the link. */
export const ACCOUNT_PRIVACY_NOTE = "We use your name and email to send your sign in code and run your order.";

/** The line under the email form of /en/login, before the link. */
export const LOGIN_PRIVACY_NOTE = "We use your email to send your sign in code.";

/** The line under the details form of the client area, before the link. */
export const DETAILS_PRIVACY_NOTE = "We print these details on your documents.";
