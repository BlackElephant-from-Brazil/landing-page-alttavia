/**
 * scripts/lib/png.mjs, the part scripts/firm-signature.mjs leans on to keep
 * the firm's signature no sharper than the print needs. Run with
 * `npm run test:scripts` (node --test scripts/lib); vitest only looks at src/.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decodePng, downscale, encodePng, fitFactor, fitPng, pngHeader } from "./png.mjs";

/** An opaque RGBA image of `width` x `height`, a diagonal stroke on white. */
function image(width, height) {
  const rgba = new Uint8Array(width * height * 4).fill(255);
  for (let x = 0; x < Math.min(width, height); x++) {
    const at = (x * width + x) * 4;
    rgba[at] = 20;
    rgba[at + 1] = 40;
    rgba[at + 2] = 110;
  }
  return { width, height, rgba };
}

describe("fitFactor", () => {
  it("is 1 for an image that already fits", () => {
    assert.equal(fitFactor(600, 300, 600, 300), 1);
    assert.equal(fitFactor(50, 20, 600, 300), 1);
  });

  it("is the smallest whole factor that brings both sides within the box", () => {
    assert.equal(fitFactor(601, 100, 600, 300), 2);
    assert.equal(fitFactor(2400, 800, 600, 300), 4);
    assert.equal(fitFactor(900, 1200, 600, 300), 4);
  });

  it("refuses sizes that are not whole numbers from 1", () => {
    assert.throws(() => fitFactor(0, 10, 600, 300));
    assert.throws(() => fitFactor(10.5, 10, 600, 300));
    assert.throws(() => fitFactor(10, 10, 600, -1));
  });
});

describe("shrinking a signature to fit", () => {
  it("lands within 600 x 300 for any size, and reads back as a PNG of that size", () => {
    for (const [width, height] of [
      [601, 200],
      [1799, 601],
      [2400, 800],
      [900, 1200],
    ]) {
      const factor = fitFactor(width, height, 600, 300);
      const shrunk = downscale(image(width, height), factor);
      assert.ok(shrunk.width <= 600 && shrunk.height <= 300, `${width} x ${height} -> ${shrunk.width} x ${shrunk.height}`);

      const png = encodePng(shrunk);
      assert.deepEqual(
        { width: pngHeader(png, "shrunk").width, height: pngHeader(png, "shrunk").height },
        { width: shrunk.width, height: shrunk.height },
      );
      assert.equal(decodePng(png, "shrunk").rgba.length, shrunk.width * shrunk.height * 4);
    }
  });

  it("fitPng hands back a file that fits as it is, and shrinks one that does not", () => {
    const small = encodePng(image(600, 300));
    const kept = fitPng(small, 600, 300, "small");
    assert.equal(kept.bytes, small);
    assert.deepEqual([kept.width, kept.height, kept.shrunk], [600, 300, false]);

    const large = fitPng(encodePng(image(1500, 500)), 600, 300, "large");
    assert.deepEqual([large.width, large.height, large.shrunk], [500, 167, true]);
    assert.deepEqual([pngHeader(large.bytes, "large").width, pngHeader(large.bytes, "large").height], [500, 167]);
  });
});
