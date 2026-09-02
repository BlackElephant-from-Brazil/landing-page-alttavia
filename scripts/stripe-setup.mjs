#!/usr/bin/env node
/**
 * Sets up everything the checkout needs on the Stripe side: the four products,
 * their prices, and a hosted payment link each, every link pointing back at
 * our success page when the buyer finishes. Then it prints the env block to
 * paste into .env.local (local) or the Netlify dashboard (production).
 *
 * Run it once with a test key and once with a live key. Test and live are
 * separate worlds in Stripe: separate products, prices, links and keys.
 *
 *   npm run stripe:setup            reads STRIPE_SECRET_KEY from .env.local
 *   npm run stripe:setup -- --live  same, for the live key
 *
 * Reading the key from .env.local rather than the command line keeps it out of
 * your shell history, and works the same in cmd, PowerShell and bash, none of
 * which agree on how to set a variable for one command.
 *
 * Safe to run again, and worth running again: it reuses anything already
 * tagged with the same `alttavia_product` metadata, and it repairs the
 * redirect on links that are missing it. Nothing is duplicated.
 *
 * Amounts are read from PRICE_CENTS in src/content/bank-nif.ts so Stripe can
 * never charge an amount the page does not show. Change the price there first.
 *
 * No SDK needed: this talks to the Stripe REST API with fetch.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.stripe.com/v1";

/**
 * The catalogue. `id` matches ProductId in src/lib/apply/types.ts, and the
 * names and descriptions match the pricing cards, because both show up on the
 * Stripe Checkout page and on the receipt the customer keeps.
 *
 * Not in this list, on purpose:
 *   - Two NIFs (€298) is this same nifOnly price with quantity 2, not a product.
 *   - A joint account is the bundle or bankOnly price with different fulfilment,
 *     carried in the session metadata, not a separate price.
 *   - Tax representation renewal (€99 a year) is a subscription for later.
 */
const CATALOGUE = [
  {
    id: "nif-only",
    priceKey: "nifOnly",
    env: "STRIPE_PRICE_NIF_ONLY",
    linkEnv: "NEXT_PUBLIC_CHECKOUT_NIF_ONLY",
    name: "NIF only",
    description: "Portuguese tax number, filed with Finanças, with 12 months of tax representation included.",
  },
  {
    id: "bundle",
    priceKey: "bundle",
    env: "STRIPE_PRICE_BUNDLE",
    linkEnv: "NEXT_PUBLIC_CHECKOUT_BUNDLE",
    name: "NIF + Bank Account",
    description: "Portuguese tax number and a Portuguese bank account, sequenced correctly, with 12 months of tax representation included.",
  },
  {
    id: "bank-only",
    priceKey: "bankOnly",
    env: "STRIPE_PRICE_BANK_ONLY",
    linkEnv: "NEXT_PUBLIC_CHECKOUT_BANK_ONLY",
    name: "Bank Account only",
    description: "Portuguese bank account with Novo Banco for someone who already holds a NIF.",
  },
  {
    id: "couple",
    priceKey: "couple",
    env: "STRIPE_PRICE_COUPLE",
    linkEnv: "NEXT_PUBLIC_CHECKOUT_COUPLE",
    name: "Couple package",
    description: "Two Portuguese tax numbers and one joint bank account, from one checkout.",
  },
];

/** Reads PRICE_CENTS out of the content module so there is one source of truth. */
function readPriceCents() {
  const file = join(ROOT, "src", "content", "bank-nif.ts");
  const source = readFileSync(file, "utf8");
  const block = source.match(/export const PRICE_CENTS = \{([\s\S]*?)\} as const;/);
  if (!block) {
    throw new Error(`Could not find PRICE_CENTS in ${file}. Did the file move?`);
  }
  const cents = {};
  for (const [, key, value] of block[1].matchAll(/(\w+):\s*(\d+)/g)) {
    cents[key] = Number(value);
  }
  return cents;
}

async function stripe(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Stripe pins behaviour to the account's API version; being explicit
      // here would mean choosing one, so let the account default apply.
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path} failed: ${json.error?.message ?? res.status}`);
  }
  return json;
}

/** Finds a product previously created by this script, if any. */
async function findProduct(id) {
  const { data } = await stripe("/products?limit=100&active=true");
  return data.find((p) => p.metadata?.alttavia_product === id);
}

/** Finds an active price on that product for the exact amount. */
async function findPrice(productId, amount) {
  const { data } = await stripe(`/prices?product=${productId}&limit=100&active=true`);
  return data.find((p) => p.unit_amount === amount && p.currency === "eur" && p.type === "one_time");
}

/** Finds an active payment link selling exactly this price. */
async function findPaymentLink(priceId) {
  const { data } = await stripe("/payment_links?limit=100&active=true");
  for (const link of data) {
    const { data: items } = await stripe(`/payment_links/${link.id}/line_items?limit=5`);
    if (items.some((i) => i.price?.id === priceId)) return link;
  }
  return undefined;
}

/** True when the link already returns the buyer to our success page. */
function redirectsTo(link, url) {
  return link.after_completion?.type === "redirect" && link.after_completion.redirect?.url === url;
}

/**
 * Where Stripe returns the buyer once payment succeeds. Always the production
 * page, in both modes: Stripe will not redirect to localhost, and the page is
 * a static explanation of what happens next, so a test buyer seeing it is
 * harmless.
 */
const SUCCESS_URL = readSiteUrl() + "/en/apply/success";

function readSiteUrl() {
  const source = readFileSync(join(ROOT, "src", "content", "bank-nif.ts"), "utf8");
  const match = source.match(/export const SITE_URL = "([^"]+)"/);
  if (!match) throw new Error("Could not find SITE_URL in bank-nif.ts");
  return match[1].replace(/\/+$/, "");
}

/**
 * Minimal .env reader. An explicit environment variable still wins, so CI can
 * override without editing a file.
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

const fileEnv = readEnvFile(".env.local");
const KEY = process.env.STRIPE_SECRET_KEY || fileEnv.STRIPE_SECRET_KEY;
const live = process.argv.includes("--live");

async function main() {
  if (!KEY) {
    console.error("No STRIPE_SECRET_KEY found.\n");
    console.error("Put it in .env.local:\n");
    console.error("  STRIPE_SECRET_KEY=sk_test_...\n");
    console.error("then run: npm run stripe:setup");
    process.exit(1);
  }
  const isLiveKey = KEY.startsWith("sk_live_");
  if (isLiveKey && !live) {
    console.error("That is a live key. Re-run with --live if you mean it:\n");
    console.error("  STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs --live");
    process.exit(1);
  }
  if (!isLiveKey && live) {
    console.error("--live was passed but the key is a test key. Nothing done.");
    process.exit(1);
  }

  const cents = readPriceCents();
  const mode = isLiveKey ? "LIVE" : "TEST";
  console.log(`\nStripe ${mode} mode\n`);

  const envLines = [];
  const linkLines = [];

  for (const item of CATALOGUE) {
    const amount = cents[item.priceKey];
    if (!Number.isInteger(amount)) {
      throw new Error(`PRICE_CENTS.${item.priceKey} is missing from bank-nif.ts`);
    }

    let product = await findProduct(item.id);
    if (product) {
      console.log(`  reused product  ${item.name.padEnd(20)} ${product.id}`);
    } else {
      product = await stripe("/products", {
        method: "POST",
        body: {
          name: item.name,
          description: item.description,
          "metadata[alttavia_product]": item.id,
        },
      });
      console.log(`  created product ${item.name.padEnd(20)} ${product.id}`);
    }

    let price = await findPrice(product.id, amount);
    if (price) {
      console.log(`  reused price    ${(amount / 100).toFixed(2).padStart(20)} ${price.id}`);
    } else {
      price = await stripe("/prices", {
        method: "POST",
        body: {
          product: product.id,
          currency: "eur",
          unit_amount: String(amount),
          "metadata[alttavia_product]": item.id,
        },
      });
      console.log(`  created price   ${(amount / 100).toFixed(2).padStart(20)} ${price.id}`);
    }

    // The payment link is what the wizard actually sends buyers to, and the
    // redirect is what makes them land on our success page instead of
    // Stripe's generic confirmation.
    let link = await findPaymentLink(price.id);
    if (!link) {
      link = await stripe("/payment_links", {
        method: "POST",
        body: {
          "line_items[0][price]": price.id,
          "line_items[0][quantity]": "1",
          "after_completion[type]": "redirect",
          "after_completion[redirect][url]": SUCCESS_URL,
          "metadata[alttavia_product]": item.id,
        },
      });
      console.log(`  created link    ${item.name.padEnd(20)} ${link.url}`);
    } else if (!redirectsTo(link, SUCCESS_URL)) {
      link = await stripe(`/payment_links/${link.id}`, {
        method: "POST",
        body: {
          "after_completion[type]": "redirect",
          "after_completion[redirect][url]": SUCCESS_URL,
        },
      });
      console.log(`  fixed redirect  ${item.name.padEnd(20)} ${link.url}`);
    } else {
      console.log(`  reused link     ${item.name.padEnd(20)} ${link.url}`);
    }

    envLines.push(`${item.env}=${price.id}`);
    linkLines.push(`${item.linkEnv}=${link.url}`);
    console.log("");
  }

  if (isLiveKey) {
    console.log("Set these in the Netlify environment:\n");
    console.log(envLines.join("\n"));
    console.log("");
    console.log("Leave the NEXT_PUBLIC_CHECKOUT_* variables UNSET in production.");
    console.log("The live links are the fallback baked into src/content/bank-nif.ts:\n");
    console.log(linkLines.map((l) => `  ${l}`).join("\n"));
  } else {
    console.log("Paste this into .env.local so localhost never takes real money:\n");
    console.log([...linkLines, ...envLines].join("\n"));
  }
  console.log("");
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
