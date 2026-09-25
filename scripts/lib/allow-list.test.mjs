/** scripts/lib/allow-list.mjs. Run with `npm run test:scripts`. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allowListEntries, mergeAllowList } from "./allow-list.mjs";

const SITE = "https://bank-nif-portugal.alttavia-relocation.com/**";

describe("allowListEntries", () => {
  it("reads the comma separated string Supabase stores", () => {
    assert.deepEqual(allowListEntries("http://localhost:3000/**, https://staging.example/** ,"), [
      "http://localhost:3000/**",
      "https://staging.example/**",
    ]);
    assert.deepEqual(allowListEntries(""), []);
    assert.deepEqual(allowListEntries(null), []);
    assert.deepEqual(allowListEntries(undefined), []);
    assert.deepEqual(allowListEntries([" a ", "", "b"]), ["a", "b"]);
  });
});

describe("mergeAllowList", () => {
  it("keeps every entry in its order and appends the new one", () => {
    const current = "http://localhost:3000/**,http://192.168.1.10:3000/**,https://staging--x.netlify.app/**";
    assert.equal(mergeAllowList(current, SITE), `${current},${SITE}`);
  });

  it("answers the stored value itself when the entry is already there", () => {
    const current = `http://localhost:3000/**, ${SITE}`;
    assert.equal(mergeAllowList(current, SITE), current);
    const array = ["http://localhost:3000/**", SITE];
    assert.equal(mergeAllowList(array, SITE), array);
  });

  it("starts a list when there is none, and keeps an array an array", () => {
    assert.equal(mergeAllowList("", SITE), SITE);
    assert.equal(mergeAllowList(null, SITE), SITE);
    assert.deepEqual(mergeAllowList(["http://localhost:3000/**"], SITE), ["http://localhost:3000/**", SITE]);
  });

  it("drops only the empty pieces a trailing comma leaves", () => {
    assert.equal(mergeAllowList("http://localhost:3000/**,", SITE), `http://localhost:3000/**,${SITE}`);
  });
});
