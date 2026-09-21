import { describe, expect, it, vi } from "vitest";

import { retryAgreementEmail } from "./email-retry";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

/** A request that stays out until the test lets it answer. */
function pendingPost() {
  let answer: (value: { ok: boolean }) => void = () => {};
  const post = vi.fn(() => new Promise<{ ok: boolean }>((resolve) => (answer = resolve)));
  return { post, answer: (ok: boolean) => answer({ ok }) };
}

describe("retryAgreementEmail", () => {
  it("POSTs the order's contract route with an empty JSON body and reports an ok answer", async () => {
    const post = vi.fn(async () => ({ ok: true }));

    expect(await retryAgreementEmail(ORDER_ID, post)).toBe(true);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(`/api/orders/${ORDER_ID}/contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  });

  it("never has two requests out for one order: StrictMode's second effect sends nothing", async () => {
    const { post, answer } = pendingPost();

    const first = retryAgreementEmail(ORDER_ID, post);
    const second = retryAgreementEmail(ORDER_ID, post);

    expect(await second).toBe(false);
    expect(post).toHaveBeenCalledTimes(1);

    answer(true);
    expect(await first).toBe(true);
  });

  it("lets another order through meanwhile, and the same order again once the first answered", async () => {
    const { post, answer } = pendingPost();
    const first = retryAgreementEmail(ORDER_ID, post);

    const other = vi.fn(async () => ({ ok: true }));
    expect(await retryAgreementEmail(OTHER_ID, other)).toBe(true);

    answer(false);
    expect(await first).toBe(false);

    const again = vi.fn(async () => ({ ok: true }));
    expect(await retryAgreementEmail(ORDER_ID, again)).toBe(true);
    expect(again).toHaveBeenCalledTimes(1);
  });

  it("stays silent when the route refuses or the network fails, and frees the order either way", async () => {
    expect(await retryAgreementEmail(ORDER_ID, async () => ({ ok: false }))).toBe(false);
    expect(
      await retryAgreementEmail(ORDER_ID, async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).toBe(false);
    expect(await retryAgreementEmail(ORDER_ID, async () => ({ ok: true }))).toBe(true);
  });
});
