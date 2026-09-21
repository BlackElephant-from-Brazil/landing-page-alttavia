import { afterEach, describe, expect, it, vi } from "vitest";

import { getStripeSecretKey, isLiveMode, stripeMode } from "./client";

/**
 * The mode follows the prefix of STRIPE_SECRET_KEY. Keys here are made up:
 * a prefix and a filler, never a real value.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isLiveMode", () => {
  it("is live for a full live secret key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_placeholder");
    expect(isLiveMode()).toBe(true);
    expect(stripeMode()).toBe("live");
  });

  it("is live for a restricted live key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_placeholder");
    expect(isLiveMode()).toBe(true);
    expect(stripeMode()).toBe("live");
  });

  it("is test for test keys, full or restricted", () => {
    for (const key of ["sk_test_placeholder", "rk_test_placeholder"]) {
      vi.stubEnv("STRIPE_SECRET_KEY", key);
      expect(isLiveMode()).toBe(false);
      expect(stripeMode()).toBe("test");
    }
  });

  it("does not read live from anywhere but the start of the key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_sk_live_placeholder");
    expect(isLiveMode()).toBe(false);
    vi.stubEnv("STRIPE_SECRET_KEY", "pk_live_placeholder");
    expect(isLiveMode()).toBe(false);
  });

  it("throws a clear error when the key is missing", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(() => getStripeSecretKey()).toThrow("STRIPE_SECRET_KEY must be set");
    expect(() => isLiveMode()).toThrow("STRIPE_SECRET_KEY must be set");
  });
});
