import { describe, expect, it } from "vitest";

import { arcPath, compact, countTicks, donutSlices, gapDegrees, niceMax, percentsTo100, polar, ticks } from "./geometry";

describe("axis helpers", () => {
  it("rounds the top of an axis to a clean number", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(4)).toBe(5);
    expect(niceMax(2)).toBe(2);
    expect(niceMax(37)).toBe(50);
    expect(niceMax(20)).toBe(20);
    expect(niceMax(2600)).toBe(5000);
  });

  it("keeps count ticks whole", () => {
    expect(countTicks(5)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(countTicks(1)).toEqual([0, 1]);
    expect(countTicks(20)).toEqual([0, 4, 8, 12, 16, 20]);
    expect(countTicks(50)).toEqual([0, 10, 20, 30, 40, 50]);
    expect(countTicks(25)).toEqual([0, 5, 10, 15, 20, 25]);
    for (const max of [10, 20, 25, 50, 100, 200, 250, 500]) {
      expect(countTicks(max).every(Number.isInteger)).toBe(true);
    }
  });

  it("spaces ticks evenly and shortens big values", () => {
    expect(ticks(40, 4)).toEqual([0, 10, 20, 30, 40]);
    expect(compact(12)).toBe("12");
    expect(compact(1200)).toBe("1.2k");
    expect(compact(2_500_000)).toBe("2.5M");
  });
});

describe("arcPath", () => {
  it("starts at the top and sweeps clockwise", () => {
    const top = polar(50, 50, 40, 0);
    expect(top.x).toBeCloseTo(50);
    expect(top.y).toBeCloseTo(10);
    const right = polar(50, 50, 40, 90);
    expect(right.x).toBeCloseTo(90);
    expect(right.y).toBeCloseTo(50);
  });

  it("draws a quarter as one small arc", () => {
    expect(arcPath(50, 50, 40, 0, 90)).toBe("M50,10 A40,40 0 0 1 90,50");
  });

  it("flags a sweep past a half turn as a large arc", () => {
    expect(arcPath(50, 50, 40, 0, 270)).toBe("M50,10 A40,40 0 1 1 10,50");
  });

  it("draws a full turn as two half arcs and nothing for an empty sweep", () => {
    expect(arcPath(50, 50, 40, 0, 360)).toBe("M50,10 A40,40 0 1 1 50,90 A40,40 0 1 1 50,10");
    expect(arcPath(50, 50, 40, 90, 90)).toBe("");
  });
});

describe("donutSlices", () => {
  it("lays positive values out in order, skipping zeros, with a gap between neighbours", () => {
    const slices = donutSlices([2, 0, 1, 1], 4);
    expect(slices.map((s) => s.index)).toEqual([0, 2, 3]);
    expect(slices[0]).toMatchObject({ value: 2, start: 2, end: 178 });
    expect(slices[1]).toMatchObject({ value: 1, start: 182, end: 268 });
    expect(slices[2]).toMatchObject({ value: 1, start: 272, end: 358 });
  });

  it("gives a lone slice the whole ring with no gap", () => {
    expect(donutSlices([0, 5], 4)).toEqual([{ index: 1, value: 5, start: 0, end: 360 }]);
  });

  it("is empty for no data", () => {
    expect(donutSlices([0, 0], 4)).toEqual([]);
    expect(donutSlices([], 4)).toEqual([]);
  });

  it("turns a pixel gap into degrees on the ring", () => {
    expect(gapDegrees(Math.PI, 180)).toBeCloseTo(1);
    expect(gapDegrees(2, 0)).toBe(0);
  });
});

describe("percentsTo100", () => {
  it("rounds so the whole legend sums to 100", () => {
    const percents = percentsTo100([1, 1, 1]);
    expect(percents.reduce((a, b) => a + b, 0)).toBe(100);
    expect(percents).toEqual([34, 33, 33]);
  });

  it("gives the extra points to the largest remainders", () => {
    expect(percentsTo100([5, 4, 1])).toEqual([50, 40, 10]);
    const seven = percentsTo100([2, 1, 1, 1, 1, 1]);
    expect(seven.reduce((a, b) => a + b, 0)).toBe(100);
    expect(seven).toEqual([29, 15, 14, 14, 14, 14]);
  });

  it("keeps zeros at zero and handles an empty total", () => {
    expect(percentsTo100([3, 0, 1])).toEqual([75, 0, 25]);
    expect(percentsTo100([0, 0])).toEqual([0, 0]);
    expect(percentsTo100([])).toEqual([]);
  });
});
