import { describe, expect, it } from "vitest";

import { lockBodyScroll } from "./scroll-lock";

/** As much of a document as the lock touches. */
function fakeDocument(overflow = "") {
  return { body: { style: { overflow } } };
}

describe("lockBodyScroll", () => {
  it("hides the overflow while held and puts back what was there", () => {
    const doc = fakeDocument("auto");
    const release = lockBodyScroll(doc);
    expect(doc.body.style.overflow).toBe("hidden");
    release();
    expect(doc.body.style.overflow).toBe("auto");
  });

  it("restores the page when a dialog and the dialog inside it close in the same commit, parent first", () => {
    // What used to go wrong: the inner dialog had saved "hidden" and restored it last.
    const doc = fakeDocument("");
    const modal = lockBodyScroll(doc);
    const details = lockBodyScroll(doc);
    expect(doc.body.style.overflow).toBe("hidden");

    modal();
    expect(doc.body.style.overflow).toBe("hidden");
    details();
    expect(doc.body.style.overflow).toBe("");
  });

  it("restores the page whatever the order of the releases", () => {
    const doc = fakeDocument("scroll");
    const [a, b, c] = [lockBodyScroll(doc), lockBodyScroll(doc), lockBodyScroll(doc)];
    b();
    c();
    expect(doc.body.style.overflow).toBe("hidden");
    a();
    expect(doc.body.style.overflow).toBe("scroll");
  });

  it("counts a release once, however often it is called", () => {
    // StrictMode runs a cleanup twice; a second call must not unlock somebody else's lock.
    const doc = fakeDocument("");
    const first = lockBodyScroll(doc);
    const second = lockBodyScroll(doc);
    first();
    first();
    first();
    expect(doc.body.style.overflow).toBe("hidden");
    second();
    expect(doc.body.style.overflow).toBe("");
  });

  it("reads the value to restore again each time the page goes from unlocked to locked", () => {
    const doc = fakeDocument("");
    lockBodyScroll(doc)();
    doc.body.style.overflow = "clip";
    const release = lockBodyScroll(doc);
    expect(doc.body.style.overflow).toBe("hidden");
    release();
    expect(doc.body.style.overflow).toBe("clip");
  });

  it("keeps documents apart", () => {
    const one = fakeDocument("");
    const two = fakeDocument("auto");
    const releaseOne = lockBodyScroll(one);
    const releaseTwo = lockBodyScroll(two);
    releaseOne();
    expect(one.body.style.overflow).toBe("");
    expect(two.body.style.overflow).toBe("hidden");
    releaseTwo();
    expect(two.body.style.overflow).toBe("auto");
  });
});
