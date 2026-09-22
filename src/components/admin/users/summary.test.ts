import { describe, expect, it } from "vitest";

import type { AdminUserCounts } from "@/lib/db/types";

import { NOTHING_STORED, describeDeletion, joinParts } from "./summary";

/** The line the delete dialog shows above the email field. */

const counts = (patch: Partial<AdminUserCounts> = {}): AdminUserCounts => ({
  orders: 0,
  paidOrders: 0,
  documents: 0,
  deliverables: 0,
  agreements: 0,
  answers: 0,
  files: 0,
  ...patch,
});

describe("joinParts", () => {
  it("joins with commas and one and", () => {
    expect(joinParts([])).toBe("");
    expect(joinParts(["3 orders"])).toBe("3 orders");
    expect(joinParts(["3 orders", "14 files"])).toBe("3 orders and 14 files");
    expect(joinParts(["3 orders", "14 files", "1 agreement"])).toBe("3 orders, 14 files and 1 agreement");
  });
});

describe("describeDeletion", () => {
  it("names orders, files, agreements and answers", () => {
    expect(describeDeletion(counts({ orders: 3, files: 14, agreements: 1, answers: 6 }))).toBe(
      "3 orders, 14 files, 1 agreement and 6 answers go with it.",
    );
  });

  it("says nothing about what is not there", () => {
    expect(describeDeletion(counts({ orders: 1 }))).toBe("1 order goes with it.");
    expect(describeDeletion(counts({ files: 2 }))).toBe("2 files go with it.");
  });

  it("has a line for an account with nothing on it", () => {
    expect(describeDeletion(counts())).toBe(NOTHING_STORED);
  });
});
