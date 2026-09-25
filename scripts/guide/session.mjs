/**
 * Sessions for the guide's screenshots, built server side and handed to the
 * browser as the cookies @supabase/ssr reads, so no sign in form is ever
 * filled and no email is ever sent.
 *
 *   adminSession()        the support admin (ADMIN_SUPPORT_EMAIL and
 *                         ADMIN_SUPPORT_PASSWORD in .env.local, written by
 *                         `npm run admin:create -- --support`), signed in
 *                         with the password. When ADMIN_SUPPORT_TOTP_SECRET
 *                         is in .env.local too (the base32 secret of the
 *                         account's authenticator), the second factor
 *                         challenge is completed with a code computed here
 *                         (RFC 6238: HMAC-SHA1, 30 s, 6 digits), so the
 *                         session is aal2.
 *   clientSession(email)  a client, the way an emailed code signs one in:
 *                         auth.admin.generateLink (magiclink, which sends
 *                         nothing) then verifyOtp with its token hash. Only
 *                         for the demo accounts on demo.alttavia.invalid.
 *
 * Both answer { cookies, userId, end }. `cookies` is a list of { name, value }
 * for the dev server's origin: sb-<ref>-auth-token, value "base64-" plus the
 * base64url JSON of the session, split into .0, .1, ... past 3180 characters,
 * the pattern of scripts/authz-matrix.mjs. `end()` signs that one session out
 * on the server (scope local: the account's other sessions stay).
 *
 * Reads .env.local with the readEnvFile pattern of scripts/stripe-setup.mjs.
 * Never prints a token, a password or a secret.
 *
 *   node scripts/guide/session.mjs --selftest   checks the TOTP code against
 *                                               the RFC 6238 test vectors
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DEMO_DOMAIN = "demo.alttavia.invalid";
const CHUNK_SIZE = 3180;

/**
 * Minimal .env reader, the same one scripts/stripe-setup.mjs uses. CRLF
 * safe, ignores comments and blank lines, strips one pair of quotes.
 */
export function readEnvFile(name) {
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

const fileEnv = readEnvFile(".env.local");
export const env = (key) => process.env[key] || fileEnv[key];

function required(key) {
  const value = env(key);
  if (!value) throw new Error(`${key} is not set in .env.local`);
  return value;
}

export function supabaseUrl() {
  return required("NEXT_PUBLIC_SUPABASE_URL");
}

/** The service role client: reads fixtures, makes magic links, ends sessions. */
export function adminClient() {
  return createClient(supabaseUrl(), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** A publishable key client whose session lives in memory only. */
function authClient() {
  return createClient(supabaseUrl(), required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** The cookies @supabase/ssr would read this session from, as { name, value } pairs. */
export function sessionCookies(session, url = supabaseUrl()) {
  const name = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  if (value.length <= CHUNK_SIZE) return [{ name, value }];
  const parts = [];
  for (let i = 0; i * CHUNK_SIZE < value.length; i += 1) {
    parts.push({ name: `${name}.${i}`, value: value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) });
  }
  return parts;
}

// ---------------------------------------------------------------------------
// TOTP, RFC 6238 over RFC 4226, no dependency
// ---------------------------------------------------------------------------

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("The TOTP secret is not valid base32.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** The HOTP value for a counter (RFC 4226 section 5.3). */
export function hotp(key, counter, digits = 6) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The current code for a base32 secret: HMAC-SHA1, 30 s steps, 6 digits. */
export function totp(secretBase32, { time = Date.now(), step = 30, digits = 6 } = {}) {
  return hotp(base32Decode(secretBase32), Math.floor(time / 1000 / step), digits);
}

function selftest() {
  // RFC 6238 appendix B, SHA1, secret "12345678901234567890", 8 digits.
  const key = Buffer.from("12345678901234567890", "ascii");
  const vectors = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  let ok = true;
  for (const [seconds, expected] of vectors) {
    const got = hotp(key, Math.floor(seconds / 30), 8);
    const pass = got === expected;
    ok &&= pass;
    console.log(`  T=${String(seconds).padEnd(11)} ${pass ? "ok  " : "FAIL"} ${got}`);
  }
  // The same key through base32, 6 digits: the last six of the 8 digit value.
  const b32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const six = totp(b32, { time: 59_000 });
  const pass = six === "287082";
  ok &&= pass;
  console.log(`  base32, 6 digits    ${pass ? "ok  " : "FAIL"} ${six}`);
  console.log(ok ? "\nTOTP matches RFC 6238." : "\nTOTP does NOT match RFC 6238.");
  process.exitCode = ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function ender(admin, session) {
  let done = false;
  return async () => {
    if (done) return;
    done = true;
    await admin.auth.admin.signOut(session.access_token, "local").catch(() => undefined);
  };
}

/**
 * The support admin, signed in with the password (and the second factor when
 * the secret is known and secondFactor is true). secondFactor: false stops
 * after the password, for the sign in screen that asks for the app code.
 * Throws with a plain reason when it cannot.
 */
export async function adminSession(admin = adminClient(), { secondFactor = true } = {}) {
  const email = env("ADMIN_SUPPORT_EMAIL");
  const password = env("ADMIN_SUPPORT_PASSWORD");
  if (!email || !password) {
    throw new Error("ADMIN_SUPPORT_EMAIL and ADMIN_SUPPORT_PASSWORD are not in .env.local (npm run admin:create -- --support)");
  }
  const client = authClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`support admin sign in failed (${signIn.error?.message ?? "no session"})`);
  }
  let session = signIn.data.session;
  const userId = signIn.data.user.id;

  const { data: profile } = await admin.from("users").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "admin") {
    await ender(admin, session)();
    throw new Error("ADMIN_SUPPORT_EMAIL is not an admin account");
  }

  const secret = env("ADMIN_SUPPORT_TOTP_SECRET");
  const level = await client.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => ({ data: null }));
  const wantsSecondFactor = level?.data?.nextLevel === "aal2" && level?.data?.currentLevel !== "aal2";

  if (secret && secondFactor) {
    const factors = await client.auth.mfa.listFactors();
    const factor = (factors.data?.totp ?? []).find((f) => f.status === "verified");
    if (!factor) {
      console.warn("  ! ADMIN_SUPPORT_TOTP_SECRET is set but the support admin has no verified authenticator; the session stays at one factor.");
    } else {
      const challenge = await client.auth.mfa.challenge({ factorId: factor.id });
      if (challenge.error) throw new Error(`second factor challenge failed (${challenge.error.message})`);
      const verify = await client.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.data.id,
        code: totp(secret),
      });
      if (verify.error) throw new Error(`second factor code refused (${verify.error.message}); check ADMIN_SUPPORT_TOTP_SECRET and the clock`);
      const current = await client.auth.getSession();
      session =
        current.data.session ??
        {
          ...verify.data,
          expires_at: verify.data.expires_at ?? Math.floor(Date.now() / 1000) + (verify.data.expires_in ?? 3600),
        };
    }
  } else if (wantsSecondFactor && secondFactor) {
    console.warn(
      "  ! The support admin has a second factor and ADMIN_SUPPORT_TOTP_SECRET is not in .env.local: admin pages may stop at the code prompt.",
    );
  }

  return { cookies: sessionCookies(session), userId, end: ender(admin, session) };
}

/** A demo client, signed in the way an emailed code signs one in. No email is sent. */
export async function clientSession(email, admin = adminClient()) {
  if (!String(email).toLowerCase().endsWith(`@${DEMO_DOMAIN}`)) {
    throw new Error(`clientSession only signs in demo accounts (@${DEMO_DOMAIN})`);
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink for ${email}: ${error.message}`);
  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) throw new Error(`generateLink for ${email} returned no token`);
  const client = authClient();
  let verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verified.error) verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (verified.error || !verified.data.session) {
    throw new Error(`verifyOtp for ${email}: ${verified.error?.message ?? "no session"}`);
  }
  const session = verified.data.session;
  return { cookies: sessionCookies(session), userId: session.user.id, end: ender(admin, session) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (process.argv.includes("--selftest")) selftest();
  else console.log("node scripts/guide/session.mjs --selftest   checks the TOTP code against RFC 6238");
}
