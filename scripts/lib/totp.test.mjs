/**
 * scripts/lib/totp.mjs against the published test vectors. Run with
 * `npm run test:scripts` (node --test scripts/lib); vitest only looks at
 * src/, so these stay out of `npm test`.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { base32Decode, base32Encode, hotp, secondsLeft, totp } from "./totp.mjs";

/** The RFC 4226 and RFC 6238 SHA-1 key, "12345678901234567890" in ASCII. */
const RFC_KEY = Buffer.from("12345678901234567890", "ascii");
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("base32", () => {
  it("decodes the RFC key and encodes it back", () => {
    assert.deepEqual(base32Decode(RFC_SECRET), RFC_KEY);
    assert.equal(base32Encode(RFC_KEY), RFC_SECRET);
  });

  it("matches the RFC 4648 vectors", () => {
    const vectors = [
      ["f", "MY"],
      ["fo", "MZXQ"],
      ["foo", "MZXW6"],
      ["foob", "MZXW6YQ"],
      ["fooba", "MZXW6YTB"],
      ["foobar", "MZXW6YTBOI"],
    ];
    for (const [plain, encoded] of vectors) {
      assert.equal(base32Encode(Buffer.from(plain)), encoded);
      assert.equal(base32Decode(encoded).toString(), plain);
    }
  });

  it("forgives case, groups and padding the way apps show a secret", () => {
    assert.deepEqual(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq"), RFC_KEY);
    assert.deepEqual(base32Decode("GEZD-GNBV-GY3T-QOJQ-GEZD-GNBV-GY3T-QOJQ"), RFC_KEY);
    assert.equal(base32Decode("MZXW6YQ=").toString(), "foob");
  });

  it("refuses what is not base32", () => {
    assert.throws(() => base32Decode("GEZDGNB1"), /not base32/);
    assert.throws(() => base32Decode("GEZDGNB8"), /not base32/);
    assert.throws(() => base32Decode(""), /empty/);
    assert.throws(() => base32Decode("   "), /empty/);
    assert.throws(() => base32Decode(undefined), TypeError);
  });
});

describe("hotp", () => {
  it("matches the RFC 4226 appendix D values", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, counter) => assert.equal(hotp(RFC_KEY, counter), code));
  });

  it("refuses a counter or a length it cannot use", () => {
    assert.throws(() => hotp(RFC_KEY, -1), RangeError);
    assert.throws(() => hotp(RFC_KEY, 1.5), RangeError);
    assert.throws(() => hotp(RFC_KEY, 0, 4), RangeError);
  });
});

describe("totp", () => {
  // RFC 6238 appendix B, SHA-1 column, 8 digit codes; the 6 digit code is
  // the same number modulo 10^6, which is the last six digits.
  const vectors = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];

  it("matches the RFC 6238 SHA-1 values with 8 digits", () => {
    for (const [seconds, code] of vectors) {
      assert.equal(totp(RFC_SECRET, { time: seconds * 1000, digits: 8 }), code);
    }
  });

  it("gives the last six of those digits by default, as Supabase and the apps do", () => {
    for (const [seconds, code] of vectors) {
      assert.equal(totp(RFC_SECRET, { time: seconds * 1000 }), code.slice(-6));
    }
  });

  it("keeps one code for the whole 30 second step and changes at its edge", () => {
    assert.equal(totp(RFC_SECRET, { time: 30_000 }), totp(RFC_SECRET, { time: 59_999 }));
    assert.notEqual(totp(RFC_SECRET, { time: 59_999 }), totp(RFC_SECRET, { time: 60_000 }));
  });

  it("always answers six digits, leading zeros kept", () => {
    for (let step = 0; step < 200; step += 1) {
      assert.match(totp(RFC_SECRET, { time: step * 30_000 }), /^\d{6}$/);
    }
  });

  it("refuses a time or a step it cannot use", () => {
    assert.throws(() => totp(RFC_SECRET, { time: -1 }), RangeError);
    assert.throws(() => totp(RFC_SECRET, { time: Number.NaN }), RangeError);
    assert.throws(() => totp(RFC_SECRET, { step: 0 }), RangeError);
  });
});

describe("secondsLeft", () => {
  it("counts down within the step", () => {
    assert.equal(secondsLeft({ time: 0 }), 30);
    assert.equal(secondsLeft({ time: 29_000 }), 1);
    assert.equal(secondsLeft({ time: 29_999 }), 1);
    assert.equal(secondsLeft({ time: 30_000 }), 30);
  });
});
