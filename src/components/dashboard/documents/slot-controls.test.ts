import { describe, expect, it } from "vitest";

import { DOCUMENTS_STAGE } from "@/lib/documents/stage";

import { UPLOAD_LABELS, slotControls } from "./slot-controls";

/**
 * What a document slot shows. The first block pins the behaviour the slot
 * had before the signed agreement slot existed, so moving the rule out of
 * the component changed nothing; the second is the agreement slot (0013).
 */

const LATER_STAGE = "financas_access_ready";

function controls(overrides: Partial<Parameters<typeof slotControls>[0]> = {}) {
  return slotControls({
    template: null,
    contractReady: false,
    orderStage: DOCUMENTS_STAGE,
    status: undefined,
    finished: false,
    ...overrides,
  });
}

describe("slotControls, ordinary and deed slots", () => {
  it("takes a first file on the documents stage", () => {
    expect(controls()).toEqual({
      paper: "none",
      changeable: false,
      showInput: true,
      awaitingAgreement: false,
      uploadLabel: UPLOAD_LABELS.choose,
    });
  });

  it("offers Replace for a file waiting for review, and nothing once it is approved", () => {
    expect(controls({ status: "uploaded" })).toMatchObject({ changeable: true, showInput: true, uploadLabel: UPLOAD_LABELS.replace });
    expect(controls({ status: "approved" })).toMatchObject({ changeable: false, showInput: false });
  });

  it("closes every slot once the order leaves the documents stage, rejected ones included", () => {
    for (const status of [undefined, "rejected", "uploaded"] as const) {
      expect(controls({ orderStage: LATER_STAGE, status })).toMatchObject({ changeable: false, showInput: false });
    }
  });

  it("hides the input once an upload finished, until the page refreshes", () => {
    expect(controls({ finished: true }).showInput).toBe(false);
  });

  it("asks a deed slot for the signed copy, rejected or not, and never waits for an agreement", () => {
    expect(controls({ template: "poa_nif" })).toMatchObject({ paper: "deed", uploadLabel: UPLOAD_LABELS.signed, awaitingAgreement: false });
    expect(controls({ template: "poa_bank", status: "rejected" })).toMatchObject({ showInput: true, uploadLabel: UPLOAD_LABELS.signed });
  });
});

describe("slotControls, signed agreement slot", () => {
  it("takes no file and says where to start while there is no agreement yet", () => {
    expect(controls({ template: "agreement" })).toEqual({
      paper: "agreement",
      changeable: false,
      showInput: false,
      awaitingAgreement: true,
      uploadLabel: UPLOAD_LABELS.signed,
    });
  });

  it("takes the signed copy once the agreement exists", () => {
    expect(controls({ template: "agreement", contractReady: true })).toMatchObject({
      showInput: true,
      awaitingAgreement: false,
      uploadLabel: UPLOAD_LABELS.signed,
    });
  });

  it("says nothing about the agreement on a closed or approved slot", () => {
    expect(controls({ template: "agreement", orderStage: LATER_STAGE })).toMatchObject({ showInput: false, awaitingAgreement: false });
    expect(controls({ template: "agreement", status: "approved" })).toMatchObject({ showInput: false, awaitingAgreement: false });
  });

  it("offers Replace for a signed copy waiting for review", () => {
    expect(controls({ template: "agreement", contractReady: true, status: "uploaded" })).toMatchObject({
      changeable: true,
      uploadLabel: UPLOAD_LABELS.replace,
    });
  });
});
