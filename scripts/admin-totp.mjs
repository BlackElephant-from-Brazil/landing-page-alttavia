#!/usr/bin/env node
/**
 * The support admin's second factor, for scripts and test runs.
 *
 *   node scripts/admin-totp.mjs                          enrol the support admin
 *   node scripts/admin-totp.mjs --unenrol                remove the support admin's factor
 *   node scripts/admin-totp.mjs --unenrol --email <a>    list another admin's factors (lost phone)
 *   node scripts/admin-totp.mjs --unenrol --email <a> --apply    and remove them
 *
 * Why: the admin area asks for a code from an authenticator app once an
 * account has a second factor, and every admin once ADMIN_REQUIRE_MFA=1
 * (src/lib/supabase/admin-user.ts). The support admin
 * (business+admin@guyshore.com, see `npm run admin:create -- --support`)
 * has no phone, so this script holds its factor's secret in .env.local as
 * ADMIN_SUPPORT_TOTP_SECRET and scripts/lib/totp.mjs computes the codes;
 * scripts/authz-matrix.mjs then signs in at aal2 like a person would.
 *
 * Enrol, in order:
 *
 *   1. Signs in as ADMIN_SUPPORT_EMAIL with ADMIN_SUPPORT_PASSWORD
 *      (publishable key, nothing persisted) and checks, with the secret
 *      key, that the account is an admin. Nothing else is ever touched.
 *   2. A verified TOTP factor already there: says so and exits 0. When
 *      ADMIN_SUPPORT_TOTP_SECRET is set it also proves the secret still
 *      matches (a challenge answered with a computed code); when it does
 *      not, it says to run --unenrol and then this again.
 *   3. Removes TOTP factors left unverified by an earlier run, enrols a new
 *      one (issuer "Alttavia Admin"), writes its secret into .env.local
 *      BEFORE verifying it, so a verified factor never exists without its
 *      secret on disk, then verifies it with a computed code. A failed
 *      verification removes the factor and the line again.
 *
 * Verifying a factor signs the account's other sessions out (Supabase
 * does that on purpose), so run this before the authz matrix, not during.
 *
 * --unenrol removes factors through the admin API with the secret key, so
 * it needs no code: for the support admin at once (and the .env.local line
 * goes too); for another admin account (--email, the firm's own when a
 * phone is lost) it lists the factors and removes them only with --apply.
 * Supabase signs that account out everywhere when a verified factor goes;
 * the person then signs in with the password and sets up the new phone at
 * /admin/settings. A client account is refused.
 *
 * Never prints a secret, a code, a password or a token. Reads .env.local
 * (the readEnvFile pattern of scripts/stripe-setup.mjs): NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY,
 * ADMIN_SUPPORT_EMAIL, ADMIN_SUPPORT_PASSWORD, ADMIN_SUPPORT_TOTP_SECRET.
 * An explicit environment variable wins over the file.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { secondsLeft, totp } from "./lib/totp.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = ".env.local";
const SECRET_VAR = "ADMIN_SUPPORT_TOTP_SECRET";
const ISSUER = "Alttavia Admin";
const FRIENDLY_NAME = "Support admin script";

/**
 * Minimal .env reader, the same one scripts/stripe-setup.mjs uses. CRLF
 * safe, ignores comments and blank lines, strips one pair of quotes.
 */
function readEnvFile(name) {
  const values = {};
  let source;
  try {
    source = readFileSync(join(ROOT, name), "utf8");
  } catch {
    return values;
  }
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value) values[match[1]] = value;
  }
  return values;
}

/**
 * Sets or removes names in .env.local: a line that assigns one of them is
 * replaced in place (value) or dropped (null); a name not found is
 * appended (value only). Every other line, the file's line endings and its
 * final newline stay as they were. The same shape as writeEnvValues in
 * scripts/create-admin.mjs, plus removal.
 */
function writeEnvValues(name, values) {
  const path = join(ROOT, name);
  let source = "";
  try {
    source = readFileSync(path, "utf8");
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const wanted = new Map(Object.entries(values));
  const found = new Set();

  const lines = source.length > 0 ? source.split(/\r?\n/) : [];
  const endsWithNewline = /\r?\n$/.test(source);
  if (endsWithNewline) lines.pop();

  const out = [];
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=/);
    if (!match || !wanted.has(match[1])) {
      out.push(line);
      continue;
    }
    found.add(match[1]);
    const value = wanted.get(match[1]);
    if (value !== null) out.push(`${match[1]}=${value}`);
  }
  const appended = [...wanted].filter(([key, value]) => !found.has(key) && value !== null);
  for (const [key, value] of appended) out.push(`${key}=${value}`);

  const body = out.join(eol);
  writeFileSync(path, endsWithNewline || appended.length > 0 ? body + eol : body, "utf8");
}

const fileEnv = readEnvFile(ENV_FILE);
const env = (key) => process.env[key] || fileEnv[key];

const args = process.argv.slice(2);
const unenrol = args.includes("--unenrol") || args.includes("--unenroll");
const apply = args.includes("--apply");
function argValue(name) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const inline = args.find((a) => a.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

function authClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** The account's id and role, by email, with the secret key. */
async function profile(secretClient, email) {
  const { data, error } = await secretClient.from("users").select("id, role").eq("email", email).maybeSingle();
  if (error) throw new Error(`users: ${error.message}`);
  return data;
}

function describeFactor(factor) {
  const when = typeof factor.created_at === "string" ? factor.created_at.slice(0, 16).replace("T", " ") : "unknown date";
  return `${factor.factor_type} ${factor.status}, "${factor.friendly_name ?? "no name"}", added ${when} UTC`;
}

/**
 * Removes the account's TOTP factors through the admin API. Answers how
 * many went. Needs no code and no session of the account.
 */
async function removeFactors(secretClient, userId, { dryRun }) {
  const { data, error } = await secretClient.auth.admin.mfa.listFactors({ userId });
  if (error) throw new Error(`listFactors: ${error.message}`);
  const factors = (data?.factors ?? []).filter((factor) => factor.factor_type === "totp");
  if (factors.length === 0) {
    console.log("No authenticator app factor on this account.");
    return 0;
  }
  for (const factor of factors) {
    console.log(`  ${dryRun ? "would remove" : "removing"}: ${describeFactor(factor)}`);
    if (dryRun) continue;
    const { error: deleteError } = await secretClient.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (deleteError) throw new Error(`deleteFactor: ${deleteError.message}`);
  }
  return factors.length;
}

/**
 * Challenges and verifies `factorId` with a code computed from `secret`.
 * Waits for a fresh step when the current one is about to end, so the
 * code does not expire on the way; tries the next step once more on a
 * refusal (clock skew).
 */
async function verifyWithSecret(client, factorId, secret) {
  if (secondsLeft() < 3) await new Promise((resolve) => setTimeout(resolve, secondsLeft() * 1000 + 250));
  let result = await client.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) });
  if (result.error && result.error.code !== "over_request_rate_limit") {
    await new Promise((resolve) => setTimeout(resolve, secondsLeft() * 1000 + 250));
    result = await client.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) });
  }
  return result.error ?? null;
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const publishable = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY");
  const supportEmail = env("ADMIN_SUPPORT_EMAIL");
  const supportPassword = env("ADMIN_SUPPORT_PASSWORD");
  const missing = Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
    SUPABASE_SECRET_KEY: secretKey,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    console.error(`Missing in ${ENV_FILE}: ${missing.join(", ")}`);
    process.exit(1);
  }
  const secretClient = authClient(url, secretKey);

  // --- Unenrol ----------------------------------------------------------------
  if (unenrol) {
    const other = argValue("--email")?.trim().toLowerCase() ?? null;
    const email = other ?? supportEmail?.trim().toLowerCase();
    if (!email) {
      console.error(`Missing in ${ENV_FILE}: ADMIN_SUPPORT_EMAIL (or pass --email).`);
      process.exit(1);
    }
    const account = await profile(secretClient, email);
    if (!account) {
      console.error(`No account for ${email}.`);
      process.exit(1);
    }
    if (account.role !== "admin") {
      console.error(`${email} is not an admin account. Refusing.`);
      process.exit(1);
    }
    const isSupport = email === supportEmail?.trim().toLowerCase();
    const dryRun = !isSupport && !apply;
    console.log(`\nSecond factor of ${email}${dryRun ? " (dry run)" : ""}\n`);
    const count = await removeFactors(secretClient, account.id, { dryRun });
    if (isSupport && fileEnv[SECRET_VAR] !== undefined) {
      writeEnvValues(ENV_FILE, { [SECRET_VAR]: null });
      console.log(`${SECRET_VAR} removed from ${ENV_FILE}.`);
    }
    if (dryRun && count > 0) {
      console.log("\nNothing removed. Run again with --apply to remove them; that account is then signed out everywhere.\n");
    } else if (count > 0) {
      console.log(`\nDone. ${isSupport ? "Run this script again to enrol a new factor." : "Ask them to sign in with the password and set up the new phone at /admin/settings."}\n`);
    }
    return;
  }

  // --- Enrol the support admin ------------------------------------------------
  if (!supportEmail || !supportPassword) {
    console.error(`Missing in ${ENV_FILE}: ADMIN_SUPPORT_EMAIL, ADMIN_SUPPORT_PASSWORD. Run npm run admin:create -- --support first.`);
    process.exit(1);
  }
  const client = authClient(url, publishable);
  const signIn = await client.auth.signInWithPassword({ email: supportEmail, password: supportPassword });
  if (signIn.error || !signIn.data.session) {
    console.error(`Password sign in failed (${signIn.error?.code ?? signIn.error?.message ?? "no session"}).`);
    process.exit(1);
  }
  const userId = signIn.data.user.id;
  const account = await profile(secretClient, supportEmail.trim().toLowerCase());
  if (account?.role !== "admin" || account.id !== userId) {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    console.error("ADMIN_SUPPORT_EMAIL is not an admin account. Refusing.");
    process.exit(1);
  }

  try {
    const listed = await client.auth.mfa.listFactors();
    if (listed.error) throw new Error(`listFactors: ${listed.error.message}`);
    const verified = listed.data.totp;
    const stored = env(SECRET_VAR);

    if (verified.length > 0) {
      console.log(`\n${supportEmail} already has an authenticator app factor (${describeFactor(verified[0])}).`);
      if (!stored) {
        console.log(`${SECRET_VAR} is not in ${ENV_FILE}, so scripts cannot answer its codes.`);
        console.log("Run with --unenrol, then run this again.\n");
        return;
      }
      const failed = await verifyWithSecret(client, verified[0].id, stored);
      if (failed) {
        console.log(`${SECRET_VAR} in ${ENV_FILE} does not match it (${failed.code ?? "refused"}).`);
        console.log("Run with --unenrol, then run this again.\n");
      } else {
        console.log(`${SECRET_VAR} in ${ENV_FILE} matches it. Nothing to do.\n`);
      }
      return;
    }

    for (const factor of listed.data.all) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        await client.auth.mfa.unenroll({ factorId: factor.id }).catch(() => undefined);
      }
    }

    const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: FRIENDLY_NAME, issuer: ISSUER });
    if (enrolled.error || !enrolled.data) {
      throw new Error(`enroll: ${enrolled.error?.code ?? enrolled.error?.message ?? "no data"}`);
    }
    const factorId = enrolled.data.id;
    const secret = enrolled.data.totp.secret;

    // On disk first: a verified factor must never exist without its secret.
    try {
      writeEnvValues(ENV_FILE, { [SECRET_VAR]: secret });
    } catch (err) {
      await client.auth.mfa.unenroll({ factorId }).catch(() => undefined);
      throw new Error(`${ENV_FILE} could not be written (${err?.code ?? err?.message}); the factor was removed.`);
    }

    const failed = await verifyWithSecret(client, factorId, secret);
    if (failed) {
      await client.auth.mfa.unenroll({ factorId }).catch(() => undefined);
      writeEnvValues(ENV_FILE, { [SECRET_VAR]: null });
      throw new Error(`The first code was refused (${failed.code ?? "refused"}); the factor and the ${ENV_FILE} line were removed. Check the computer's clock.`);
    }

    console.log(`\n${supportEmail} now has an authenticator app factor.`);
    console.log(`Its secret (not shown) is in ${ENV_FILE} as ${SECRET_VAR}; scripts/authz-matrix.mjs uses it.`);
    console.log("Supabase signed the account's other sessions out.\n");
  } finally {
    // The session this script opened is not needed any more.
    await secretClient.auth.admin
      .signOut((await client.auth.getSession()).data.session?.access_token ?? "", "local")
      .catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
