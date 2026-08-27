#!/usr/bin/env node
/**
 * Creates the four Bank + NIF products in Stripe and prints the env block to
 * paste into .env.local (local) or the Netlify dashboard (production).
 *
 * Run it once with a test key and once with a live key. Test and live are
 * separate worlds in Stripe: separate products, separate prices, separate ids.
 *
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs --live
 *
 * Safe to run again: it looks for products already tagged with the same
 * `alttavia_product` metadata and reuses them instead of creating duplicates.
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
    name: "NIF only",
    description: "Portuguese tax number, filed with Finanças, with 12 months of tax representation included.",
  },
  {
    id: "bundle",
    priceKey: "bundle",
    env: "STRIPE_PRICE_BUNDLE",
    name: "NIF + Bank Account",
    description: "Portuguese tax number and a Portuguese bank account, sequenced correctly, with 12 months of tax representation included.",
  },
  {
    id: "bank-only",
    priceKey: "bankOnly",
    env: "STRIPE_PRICE_BANK_ONLY",
    name: "Bank Account only",
    description: "Portuguese bank account with Novo Banco for someone who already holds a NIF.",
  },
  {
    id: "couple",
    priceKey: "couple",
    env: "STRIPE_PRICE_COUPLE",
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

const KEY = process.env.STRIPE_SECRET_KEY;
const live = process.argv.includes("--live");

async function main() {
  if (!KEY) {
    console.error("Set STRIPE_SECRET_KEY first.\n");
    console.error("  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs");
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

    envLines.push(`${item.env}=${price.id}`);
    console.log("");
  }

  console.log("Paste this into .env.local (test) or the Netlify environment (live):\n");
  console.log(envLines.join("\n"));
  console.log("");
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
