#!/usr/bin/env node
/**
 * Takes the user guide's screenshots against the running dev server and
 * writes them to docs/guia/prints/<id>.png, marked in red where the guide
 * says to look.
 *
 *   node scripts/guide/capture.mjs                       every scene
 *   node scripts/guide/capture.mjs --only landing,admin-login
 *   node scripts/guide/capture.mjs --list                the scenes, nothing taken
 *   node scripts/guide/capture.mjs --base http://localhost:3000
 *   node scripts/guide/capture.mjs --skip-pending        do not even look for screens still being built
 *   node scripts/guide/capture.mjs --headful             watch Chrome do it
 *   node scripts/guide/capture.mjs --no-marks            the same prints without the red marks
 *   node scripts/guide/capture.mjs --out-dir <folder>    the PNGs go there instead of docs/guia/prints
 *
 * Email scenes (the `email` field) need no server: the templates of
 * src/lib/email/templates.ts are rendered with sample values (emails.mjs).
 *
 * Needs: the dev server up (it is never started here), Chrome installed,
 * and for the signed in scenes the demo data (`npm run demo:history --
 * --apply`) and the support admin (ADMIN_SUPPORT_EMAIL and
 * ADMIN_SUPPORT_PASSWORD in .env.local). No npm package is added: Chrome is
 * driven over the DevTools protocol by scripts/guide/browser.mjs.
 *
 * Read only by construction: every request to the dev server that is not
 * GET, HEAD or OPTIONS is blocked in the browser (and listed in the table),
 * so a click in a scene can open a dialog or a question but never approve,
 * move, send or delete anything. Sessions are made server side
 * (session.mjs), no email goes out, and each one is signed out at the end.
 *
 * The second factor needs two runs, because its scenes want the support
 * admin in opposite states. First, with no factor on that account:
 *   node scripts/guide/capture.mjs --only admin-settings-second-factor
 * Then enrol it (node scripts/admin-totp.mjs, which writes
 * ADMIN_SUPPORT_TOTP_SECRET into .env.local) and run everything else, which
 * takes admin-login-code and admin-settings-second-factor-on too. A full run
 * after the enrolment skips admin-settings-second-factor, since Set up is gone.
 *
 * A scene marked `pending` (a screen being built) is looked for briefly: when
 * it is there, it is taken and the table says the flag can go; when it is
 * not, it is skipped with its note. Exit code 1 when any scene failed.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { VIEWPORTS, guardReadOnly, openBrowser } from "./browser.mjs";
import {
  annotate,
  clickTarget,
  describeTarget,
  dragTo,
  ensureGuide,
  mask,
  maskEmails,
  rectOf,
  scrollIntoView,
  setValue,
  tidyPage,
  waitForHydration,
  waitForTarget,
} from "./annotate.mjs";
import { emailSceneUrl } from "./emails.mjs";
import { KEEP_DOMAINS, PEOPLE, loadFixtures, needsFixtures, scenes as ALL_SCENES } from "./scenes.mjs";
import { ROOT, adminClient, adminSession, clientSession } from "./session.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
function argValue(name, fallback) {
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}
const has = (flag) => argv.includes(flag);

const BASE = argValue("--base", "http://localhost:3000").replace(/\/+$/, "");
const ORIGIN = new URL(BASE).origin;
const only = argValue("--only", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const skipPending = has("--skip-pending");
const headful = has("--headful");
const marks = !has("--no-marks");
const guard = !has("--no-guard");
const outDir = argValue("--out-dir", "");

if (has("--help") || has("-h")) {
  console.log(
    "\n  node scripts/guide/capture.mjs [--only id,id] [--list] [--base URL] [--skip-pending] [--headful] [--no-marks] [--out-dir folder]\n",
  );
  process.exit(0);
}

let selected = ALL_SCENES;
if (only.length) {
  const known = new Set(ALL_SCENES.map((s) => s.id));
  const unknown = only.filter((id) => !known.has(id));
  if (unknown.length) {
    console.error(`Unknown scene id: ${unknown.join(", ")}. See --list.`);
    process.exit(2);
  }
  selected = ALL_SCENES.filter((s) => only.includes(s.id));
}

if (has("--list")) {
  const rows = selected.map((s) => [
    s.id,
    s.role,
    s.email ? "(email)" : s.session,
    typeof s.viewport === "object" ? `${s.viewport.width}x${s.viewport.height}` : s.viewport,
    s.pending ? "pending" : "",
  ]);
  printTable(["scene", "role", "session", "viewport", ""], rows);
  console.log(`\n${selected.length} scenes. Prints go to docs/guia/prints/.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printTable(header, rows) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)));
  const line = (cells) => cells.map((c, i) => String(c ?? "").padEnd(widths[i])).join("  ").trimEnd();
  console.log(line(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(line(row));
}

async function serverAnswers() {
  try {
    const res = await fetch(`${BASE}/en`, { redirect: "manual", signal: AbortSignal.timeout(120_000) });
    return { ok: res.status < 500, status: res.status };
  } catch (error) {
    return { ok: false, status: 0, reason: error.cause?.code ?? error.message };
  }
}

/** Sets the wizard's answers (or anything else) in storage before the page's own scripts run. */
function storageScript(storage) {
  const session = JSON.stringify(storage?.session ?? {});
  const local = JSON.stringify(storage?.local ?? {});
  return `(() => {
    try {
      if (location.origin !== ${JSON.stringify(ORIGIN)}) return;
      const put = (store, values) => { for (const key of Object.keys(values)) { const v = values[key]; store.setItem(key, typeof v === "string" ? v : JSON.stringify(v)); } };
      put(sessionStorage, ${session});
      put(localStorage, ${local});
    } catch (error) {}
  })();`;
}

function firstTarget(highlight) {
  const first = highlight?.[0];
  return first ? (first.target ?? first) : null;
}

class Skip extends Error {}

async function runStep(page, step) {
  if (step.wait) return sleep(step.wait);
  if (step.waitFor) return waitForTarget(page, step.waitFor, { timeoutMs: step.timeoutMs ?? 20_000 });
  if (step.scroll) return scrollIntoView(page, step.scroll, { block: step.block });
  if (step.set !== undefined) {
    await waitForTarget(page, step.set, { timeoutMs: step.timeoutMs ?? 20_000 });
    await waitForHydration(page, step.set, { timeoutMs: 15_000 });
    if (!(await setValue(page, step.set, step.value))) throw new Error(`cannot type into ${describeTarget(step.set)}`);
    return undefined;
  }
  if (step.click) {
    await waitForTarget(page, step.click, { timeoutMs: step.timeoutMs ?? 20_000 });
    await waitForHydration(page, step.click, { timeoutMs: 20_000 });
    const attempts = step.retries ?? 3;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (!(await clickTarget(page, step.click))) throw new Error(`nothing to click: ${describeTarget(step.click)}`);
      if (!step.expect) {
        await sleep(400);
        return undefined;
      }
      try {
        await waitForTarget(page, step.expect, { timeoutMs: 4000 * attempt });
        return undefined;
      } catch {
        // Not yet: the page may have been hydrating. Click again.
      }
    }
    throw new Error(`clicked ${describeTarget(step.click)} but ${describeTarget(step.expect)} did not show`);
  }
  if (step.drag) {
    await waitForTarget(page, step.drag, { timeoutMs: step.timeoutMs ?? 20_000 });
    await waitForTarget(page, step.to, { timeoutMs: step.timeoutMs ?? 20_000 });
    await waitForHydration(page, step.drag, { timeoutMs: 20_000 });
    if (!(await dragTo(page, step.drag, step.to))) throw new Error(`cannot drag ${describeTarget(step.drag)} to ${describeTarget(step.to)}`);
    if (step.expect) await waitForTarget(page, step.expect, { timeoutMs: 8000 });
    return undefined;
  }
  if (step.eval) return page.evaluate(step.eval);
  throw new Error(`unknown step ${JSON.stringify(step)}`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const server = selected.every((s) => s.email) ? { ok: true } : await serverAnswers();
if (!server.ok) {
  console.error(
    `The dev server does not answer at ${BASE} (${server.status || server.reason}). Start it first; this script never does.`,
  );
  process.exit(2);
}

let fixtures = null;
let admin = null;
const wantFixtures = selected.some((s) => needsFixtures(s) || s.session !== "none");
if (wantFixtures) {
  admin = adminClient();
  if (selected.some(needsFixtures)) fixtures = await loadFixtures(admin);
}

const browser = await openBrowser({ headless: !headful });
const contexts = new Map();
const sessionsOpened = [];

/** One browser context per signed in person, made on first use. */
async function contextFor(sessionKey) {
  if (contexts.has(sessionKey)) {
    const known = contexts.get(sessionKey);
    if (known.error) throw known.error;
    return known.id;
  }
  const entry = { id: null, error: null };
  contexts.set(sessionKey, entry);
  try {
    entry.id = await browser.newContext();
    if (sessionKey !== "none") {
      let session;
      if (sessionKey === "admin") session = await adminSession(admin);
      else if (sessionKey === "admin-password-only") session = await adminSession(admin, { secondFactor: false });
      else if (PEOPLE[sessionKey]) session = await clientSession(PEOPLE[sessionKey].email, admin);
      else throw new Error(`unknown session "${sessionKey}"`);
      sessionsOpened.push(session);
      await browser.setCookies(
        entry.id,
        session.cookies.map((c) => ({
          name: c.name,
          value: c.value,
          url: BASE,
          path: "/",
          httpOnly: false,
          secure: BASE.startsWith("https:"),
          sameSite: "Lax",
        })),
      );
    }
    return entry.id;
  } catch (error) {
    entry.error = error;
    throw error;
  }
}

async function runScene(scene) {
  const context = await contextFor(scene.session);
  const viewport = typeof scene.viewport === "object" ? scene.viewport : (VIEWPORTS[scene.viewport] ?? VIEWPORTS.desktop);
  const page = await browser.newPage({ context, viewport });
  const notes = [];
  try {
    await page.send("Emulation.setTimezoneOverride", { timezoneId: "Europe/Lisbon" }).catch(() => undefined);
    await page.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-motion", value: "reduce" },
        { name: "prefers-color-scheme", value: "light" },
      ],
    });
    if (scene.storage) await page.addInitScript(storageScript(scene.storage));
    const blocked = guard ? await guardReadOnly(page, ORIGIN) : [];
    let documentStatus = 0;
    page.on("Network.responseReceived", (params) => {
      if (params.type === "Document") documentStatus = params.response.status;
    });

    // Fields may be (fx) => value when they need ids from the demo data.
    const value = (field) => (typeof field === "function" ? field(fixtures) : field);
    const path = scene.email ? null : value(scene.path);
    const highlight = value(scene.highlight) ?? [];
    const before = value(scene.before) ?? [];
    let url = `${BASE}${path}`;
    if (scene.email) {
      url = await emailSceneUrl(scene);
      if (!url) {
        if (scene.pending) throw new Skip(`pending: ${scene.pending}`);
        throw new Error(`src/lib/email/templates.ts has no ${scene.email.template}`);
      }
    }
    await page.goto(url);
    await ensureGuide(page);
    await tidyPage(page);

    if (documentStatus >= 500) throw new Error(`the server answered ${documentStatus}`);
    const where = await page.evaluate(() => ({ path: location.pathname, text: document.body.innerText.slice(0, 4000) }));
    const wantedPath = new URL(url).pathname;
    if (where.path.endsWith("/login") && !wantedPath.endsWith("/login")) {
      throw new Error(`sent to ${where.path}: the ${scene.session} session was refused`);
    }
    if (scene.role === "admin" && scene.session === "admin" && /Set up your second factor/.test(where.text) && !scene.pending) {
      throw new Error("the admin area asks the support admin to set up a second factor (add ADMIN_SUPPORT_TOTP_SECRET to .env.local)");
    }

    const ready = value(scene.ready) ?? firstTarget(highlight);
    if (ready) {
      try {
        await waitForTarget(page, ready, { timeoutMs: scene.pending ? 8000 : 45_000 });
      } catch (error) {
        if (scene.pending) throw new Skip(`pending: ${scene.pending}`);
        throw new Error(`not on screen: ${describeTarget(ready)}`);
      }
    }

    for (const step of before) {
      try {
        await runStep(page, step);
      } catch (error) {
        if (scene.pending) throw new Skip(`pending: ${scene.pending}`);
        throw error;
      }
    }
    await tidyPage(page);
    await page.settle(500);

    // Every highlight must be there: a print with a missing mark is worse than none.
    const missing = [];
    for (const item of highlight) {
      const target = item.target ?? item;
      try {
        await waitForTarget(page, target, { timeoutMs: scene.pending ? 3000 : 8000 });
      } catch {
        missing.push(describeTarget(target));
      }
    }
    if (missing.length) {
      if (scene.pending) throw new Skip(`pending: ${scene.pending}`);
      throw new Error(`not found: ${missing.join("; ")}`);
    }

    const scroll = scene.scroll === undefined ? firstTarget(highlight) : value(scene.scroll);
    if (scroll) {
      const target = scroll.target ?? scroll;
      await scrollIntoView(page, target, { block: scroll.block ?? "center" });
      await page.settle(250);
    }

    // No focus ring or caret on the print unless the scene asks for it.
    if (!scene.keepFocus) await page.evaluate(() => document.activeElement?.blur?.()).catch(() => undefined);
    const blurred = await maskEmails(page, KEEP_DOMAINS);
    if (scene.mask?.length) await mask(page, scene.mask);
    if (blurred) notes.push(`${blurred} email${blurred === 1 ? "" : "s"} blurred`);

    const fullPage = scene.shot === "full";
    if (marks && highlight.length) {
      const result = await annotate(page, highlight, { mode: fullPage ? "document" : "viewport" });
      if (result.missing.length) throw new Error(`could not mark: ${result.missing.join("; ")}`);
    }
    await page.settle(150);

    let png;
    if (fullPage) {
      png = await page.screenshot({ fullPage: true });
    } else if (scene.shot && typeof scene.shot === "object" && scene.shot.clip) {
      const clip = await rectOf(page, scene.shot.clip, scene.shot.pad ?? 24);
      if (!clip) throw new Error(`nothing to clip to: ${describeTarget(scene.shot.clip)}`);
      png = await page.screenshot({ clip });
    } else {
      png = await page.screenshot();
    }

    const file = outDir ? resolve(outDir, `${scene.id}.png`) : join(ROOT, scene.out);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, png);

    if (blocked.length) notes.push(`blocked ${blocked.length} write${blocked.length === 1 ? "" : "s"}: ${[...new Set(blocked)].join(", ")}`);
    if (scene.pending) notes.push("the screen exists now: the pending flag can go");
    const inside = relative(ROOT, file);
    const shown = inside.startsWith("..") || isAbsolute(inside) ? file : inside;
    return { status: "done", detail: [shown.replaceAll("\\", "/"), ...notes].join("; ") };
  } finally {
    await page.close();
  }
}

const results = [];
try {
  for (const scene of selected) {
    const started = Date.now();
    if (scene.pending && skipPending) {
      results.push([scene.id, "skipped", "-", `pending: ${scene.pending}`]);
      continue;
    }
    let row;
    try {
      const result = await runScene(scene);
      row = [scene.id, result.status, `${((Date.now() - started) / 1000).toFixed(1)}s`, result.detail];
    } catch (error) {
      if (error instanceof Skip) row = [scene.id, "skipped", `${((Date.now() - started) / 1000).toFixed(1)}s`, error.message];
      else row = [scene.id, "failed", `${((Date.now() - started) / 1000).toFixed(1)}s`, error.message];
    }
    results.push(row);
    console.log(`  ${row[1].padEnd(7)} ${row[0]}`);
  }
} finally {
  for (const session of sessionsOpened) await session.end().catch(() => undefined);
  await browser.close();
}

console.log("");
printTable(["scene", "status", "time", "detail"], results);
const count = (status) => results.filter((r) => r[1] === status).length;
console.log(`\n${count("done")} done, ${count("skipped")} skipped, ${count("failed")} failed.`);
process.exitCode = count("failed") > 0 ? 1 : 0;
