import { describe, expect, it } from "vitest";

import { JOINT_DEED_APPLICANTS, isJointDeed, jointDeedMissing } from "./joint";

describe("isJointDeed", () => {
  it("is the couple's bank deed slot after 0016: poa_bank, shared, two applicants", () => {
    expect(isJointDeed({ template: "poa_bank", per_applicant: false }, 2)).toBe(true);
  });

  it("leaves a per applicant bank deed slot to one deed per person", () => {
    expect(isJointDeed({ template: "poa_bank", per_applicant: true }, 2)).toBe(false);
  });

  it("never joins a NIF deed: a NIF is personal", () => {
    expect(isJointDeed({ template: "poa_nif", per_applicant: false }, 2)).toBe(false);
    expect(isJointDeed({ template: "poa_nif", per_applicant: true }, 2)).toBe(false);
  });

  it("keeps a shared bank deed slot on a one person order a single deed", () => {
    expect(isJointDeed({ template: "poa_bank", per_applicant: false }, 1)).toBe(false);
  });

  it("is never true for an ordinary upload slot", () => {
    expect(isJointDeed({ template: null, per_applicant: false }, 2)).toBe(false);
  });

  it("names the two applicants in the order they sign", () => {
    expect(JOINT_DEED_APPLICANTS).toEqual([0, 1]);
  });
});

describe("jointDeedMissing", () => {
  const row = { full_name: "Jane Doe" };

  it("asks for the first person before the partner, as the route's 409 does", () => {
    expect(jointDeedMissing(null, null)).toBe(0);
    expect(jointDeedMissing(null, row)).toBe(0);
  });

  it("asks for the partner once the first person's details are there", () => {
    expect(jointDeedMissing(row, null)).toBe(1);
    expect(jointDeedMissing(row, undefined)).toBe(1);
  });

  it("is null once both are on the order, so the deed downloads", () => {
    expect(jointDeedMissing(row, row)).toBeNull();
  });
});
