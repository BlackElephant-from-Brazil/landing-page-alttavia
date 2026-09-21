import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * sendEmail with a spied fetch: which recipients reach Resend at all. No
 * network; the key and sender are fake values stubbed per test.
 */

vi.mock("server-only", () => ({}));

import { isReservedAddress, sendEmail } from "./send";

const message = { subject: "Your order is complete", html: "<p>Done</p>", text: "Done" };

let fetchSpy: ReturnType<typeof vi.fn>;
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("EMAIL_API_KEY", "re_test_fake");
  vi.stubEnv("EMAIL_FROM", "Alttavia Relocation <hello@send.example.com>");
  fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchSpy);
  info = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  info.mockRestore();
});

describe("isReservedAddress", () => {
  it("is true on the .invalid top level domain, in any case", () => {
    expect(isReservedAddress("ana@demo.alttavia.invalid")).toBe(true);
    expect(isReservedAddress("BEN@Demo.Alttavia.INVALID")).toBe(true);
    expect(isReservedAddress("someone@invalid")).toBe(true);
    expect(isReservedAddress(" carla@demo.alttavia.invalid ")).toBe(true);
  });

  it("is false for any other address", () => {
    expect(isReservedAddress("business@guyshore.com")).toBe(false);
    expect(isReservedAddress("client@invalid.com")).toBe(false);
    expect(isReservedAddress("client@notinvalid")).toBe(false);
    expect(isReservedAddress("no-at-sign.invalid")).toBe(false);
  });
});

describe("sendEmail", () => {
  it("never calls Resend for a demo address and answers ok, so the admin UI reads as usual", async () => {
    const result = await sendEmail({ to: "ana@demo.alttavia.invalid", ...message });

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0][0])).toContain("reserved .invalid address skipped");
  });

  it("skips a demo address even when the email variables are missing", async () => {
    vi.stubEnv("EMAIL_API_KEY", "");

    expect(await sendEmail({ to: "dora@demo.alttavia.invalid", ...message })).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends to a real address", async () => {
    const result = await sendEmail({ to: "business@guyshore.com", ...message });

    expect(result).toEqual({ ok: true, id: "email_1" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1].body));
    expect(body.to).toEqual(["business@guyshore.com"]);
  });
});
