import {
  VERTEX_SHADER,
  DISPLACEMENT_FRAGMENT_SHADER,
  SPECULAR_FRAGMENT_SHADER,
} from "./shaders";
import { createProgram, setupQuad } from "./webgl-utils";

export type SpecularOptions = {
  opacity: number;
  saturation: number;
  angle: number; // radians
};

export type MapGenOptions = {
  width: number;
  height: number;
  bezelWidth: number;
  power?: number;    // squircle exponent, default 6
  strength?: number; // displacement strength, default 1
  specular?: SpecularOptions;
};

export type MapGenResult = {
  displacementUrl: string;
  specularUrl: string;
  width: number;
  height: number;
  /** Maximum displacement in pixels -- use as feDisplacementMap scale */
  maxDisplacement: number;
};

/**
 * Render a displacement map and a specular highlight map using WebGL.
 * Works in browser (HTMLCanvasElement) and in Workers (OffscreenCanvas).
 * Returns two PNG data URLs ready for use in <feImage> SVG filter primitives.
 */
export async function generateMaps(opts: MapGenOptions): Promise<MapGenResult> {
  const {
    width,
    height,
    bezelWidth,
    power = 6,
    strength = 1,
    specular = { opacity: 0.4, saturation: 1, angle: -Math.PI / 3 },
  } = opts;

  if (width <= 0 || height <= 0) {
    throw new Error("width and height must be > 0");
  }

  const [dispUrl] = await renderPass(
    width,
    height,
    DISPLACEMENT_FRAGMENT_SHADER,
    (gl, program) => {
      setUniforms(gl, program, {
        u_resolution: [width, height],
        u_bezelWidth: bezelWidth,
        u_power: power,
        u_strength: strength,
      });
    }
  );

  const [specUrl] = await renderPass(
    width,
    height,
    SPECULAR_FRAGMENT_SHADER,
    (gl, program) => {
      setUniforms(gl, program, {
        u_resolution: [width, height],
        u_bezelWidth: bezelWidth,
        u_power: power,
        u_lightAngle: specular.angle,
        u_opacity: specular.opacity,
        u_saturation: specular.saturation,
      });
    }
  );

  // maxDisplacement in pixels: strength * bezelWidth (upper bound of the warp)
  const maxDisplacement = strength * bezelWidth;

  return {
    displacementUrl: dispUrl,
    specularUrl: specUrl,
    width,
    height,
    maxDisplacement,
  };
}

// -- Internal helpers --

type Uniforms = Record<string, number | number[]>;

function setUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  uniforms: Uniforms
): void {
  for (const [name, value] of Object.entries(uniforms)) {
    const loc = gl.getUniformLocation(program, name);
    if (loc === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 2) gl.uniform2fv(loc, value);
      else if (value.length === 3) gl.uniform3fv(loc, value);
    } else {
      gl.uniform1f(loc, value);
    }
  }
}

async function renderPass(
  width: number,
  height: number,
  fragmentSource: string,
  bindUniforms: (gl: WebGLRenderingContext, program: WebGLProgram) => void
): Promise<[dataUrl: string, maxValue: number]> {
  // Use OffscreenCanvas when available (works in Workers too)
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : (() => {
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          return c;
        })();

  const gl = ((canvas as HTMLCanvasElement).getContext?.("webgl") ??
    (canvas as OffscreenCanvas).getContext?.("webgl")) as WebGLRenderingContext | null;

  if (!gl) throw new Error("WebGL not available");

  const program = createProgram(gl, VERTEX_SHADER, fragmentSource);
  gl.useProgram(program);
  setupQuad(gl, program);
  bindUniforms(gl, program);

  gl.viewport(0, 0, width, height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Read pixels to compute max displacement (for feDisplacementMap scale)
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let maxVal = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const dx = Math.abs(pixels[i] - 128) / 127;
    const dy = Math.abs(pixels[i + 1] - 128) / 127;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > maxVal) maxVal = mag;
  }

  const dataUrl = await canvasToDataUrl(canvas);

  // Explicitly release the WebGL context so it doesn't count toward the browser's
  // per-page limit. Without this, zombie contexts accumulate (GC timing is non-
  // deterministic) and can evict other WebGL canvases (e.g. the cobe globe).
  const loseExt = gl.getExtension("WEBGL_lose_context");
  if (loseExt) loseExt.loseContext();

  return [dataUrl, maxVal];
}

async function canvasToDataUrl(
  canvas: HTMLCanvasElement | OffscreenCanvas
): Promise<string> {
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return blobToDataUrl(blob);
  }
  return (canvas as HTMLCanvasElement).toDataURL("image/png");
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
