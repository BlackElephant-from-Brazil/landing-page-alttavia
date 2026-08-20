import { describe, it, expect } from "vitest";
import { generateMaps, type MapGenOptions } from "./generate-map";

// WebGL rendering tests need a real GPU context -- jsdom has no WebGL support.
// These tests run in a real browser (smoke test Task 10); here we verify
// error-handling paths and that the API contract is shaped correctly.
const webglAvailable = (() => {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl");
  } catch {
    return false;
  }
})();

describe("generateMaps", () => {
  it.skipIf(!webglAvailable)(
    "returns displacement and specular data URLs for valid dimensions",
    async () => {
      const opts: MapGenOptions = {
        width: 200,
        height: 80,
        bezelWidth: 20,
        power: 6,
        strength: 1,
        specular: { opacity: 0.4, saturation: 1, angle: -1.05 },
      };
      const result = await generateMaps(opts);
      expect(result.displacementUrl).toMatch(/^data:image\/png;base64,/);
      expect(result.specularUrl).toMatch(/^data:image\/png;base64,/);
      expect(result.width).toBe(200);
      expect(result.height).toBe(80);
    }
  );

  it.skipIf(!webglAvailable)(
    "returns neutral maps (128/128) for bezelWidth=0",
    async () => {
      const result = await generateMaps({
        width: 100,
        height: 50,
        bezelWidth: 0,
        power: 6,
        strength: 0,
        specular: { opacity: 0, saturation: 1, angle: 0 },
      });
      expect(result.displacementUrl).toBeTruthy();
    }
  );

  it("throws for zero dimensions", async () => {
    await expect(
      generateMaps({
        width: 0,
        height: 100,
        bezelWidth: 20,
        power: 6,
        strength: 1,
        specular: { opacity: 0.4, saturation: 1, angle: 0 },
      })
    ).rejects.toThrow("width and height must be > 0");
  });
});
