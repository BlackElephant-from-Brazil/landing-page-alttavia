/**
 * Just enough PNG for the letterhead: read the logo out of a Word model,
 * shrink it, write it again. Plain node, no image library.
 *
 * The firm's logo sits in the models at 2639 x 1830 pixels, some 130 KB,
 * for a mark the contract prints 30 mm wide. Embedded as it is, every
 * agreement would carry and decode the full picture. scripts/
 * generate-contracts.mjs shrinks it by a whole factor (a box filter over
 * premultiplied alpha, so the soft edges against transparency stay clean)
 * and writes it with the deterministic encoder of ./zip.mjs, so the
 * generated module is the same bytes on every machine and `--check` can
 * compare it.
 *
 * Reads 8 bit RGB and RGBA, not interlaced: what the models hold. Anything
 * else stops the script with a line that says so.
 */

import { inflateSync } from "node:zlib";

import { crc32, zlibDeflate } from "./zip.mjs";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** True when `bytes` starts like a PNG file. */
export function isPng(bytes) {
  return bytes.length > SIGNATURE.length && Buffer.compare(Buffer.from(bytes.subarray(0, 8)), SIGNATURE) === 0;
}

/** The chunks of a PNG: `[{ type, data }]`, CRCs checked. */
export function pngChunks(bytes, file) {
  const buffer = Buffer.from(bytes);
  if (!isPng(buffer)) throw new Error(`${file}: not a PNG file.`);
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const crc = buffer.readUInt32BE(offset + 8 + length);
    if (crc32(buffer.subarray(offset + 4, offset + 8 + length)) !== crc) throw new Error(`${file}: the ${type} chunk is damaged.`);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

/** `{ width, height, colorType, bitDepth, interlace }` from the IHDR chunk. */
export function pngHeader(bytes, file) {
  const [header] = pngChunks(bytes, file);
  if (!header || header.type !== "IHDR") throw new Error(`${file}: the PNG has no IHDR chunk first.`);
  return {
    width: header.data.readUInt32BE(0),
    height: header.data.readUInt32BE(4),
    bitDepth: header.data[8],
    colorType: header.data[9],
    interlace: header.data[12],
  };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decodes an 8 bit RGB or RGBA PNG to `{ width, height, rgba }`, four bytes a pixel. */
export function decodePng(bytes, file) {
  const { width, height, bitDepth, colorType, interlace } = pngHeader(bytes, file);
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(
      `${file}: PNG with bit depth ${bitDepth}, colour type ${colorType}, interlace ${interlace}; ` +
        "only 8 bit RGB or RGBA, not interlaced, is read. Teach scripts/lib/png.mjs first.",
    );
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const data = inflateSync(Buffer.concat(pngChunks(bytes, file).filter((c) => c.type === "IDAT").map((c) => c.data)));
  if (data.length < height * (stride + 1)) throw new Error(`${file}: the image data is shorter than its size says.`);

  const rgba = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = data[y * (stride + 1)];
    const line = data.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`${file}: unknown PNG filter ${filter} on row ${y}.`);
      row[x] = value & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const to = (y * width + x) * 4;
      rgba[to] = row[x * channels];
      rgba[to + 1] = row[x * channels + 1];
      rgba[to + 2] = row[x * channels + 2];
      rgba[to + 3] = channels === 4 ? row[x * channels + 3] : 255;
    }
    previous = row;
  }
  return { width, height, rgba };
}

/**
 * The smallest whole factor for `downscale` that brings `width` x `height`
 * within `maxWidth` x `maxHeight`: 1 when it already fits. The result of
 * downscaling by it is at most `maxWidth` wide and `maxHeight` tall.
 */
export function fitFactor(width, height, maxWidth, maxHeight) {
  for (const value of [width, height, maxWidth, maxHeight]) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`fitFactor: ${value} is not a whole number from 1.`);
  }
  return Math.max(1, Math.ceil(width / maxWidth), Math.ceil(height / maxHeight));
}

/**
 * `bytes` shrunk by fitFactor until they fit within `maxWidth` x
 * `maxHeight` and written again as 8 bit RGBA, or the same bytes when they
 * already fit. Answers `{ bytes, width, height, shrunk }`. Throws for a PNG
 * decodePng cannot read, when it has to be shrunk.
 */
export function fitPng(bytes, maxWidth, maxHeight, file) {
  const { width, height } = pngHeader(bytes, file);
  const factor = fitFactor(width, height, maxWidth, maxHeight);
  if (factor === 1) return { bytes, width, height, shrunk: false };
  const image = downscale(decodePng(bytes, file), factor);
  return { bytes: encodePng(image), width: image.width, height: image.height, shrunk: true };
}

/**
 * Shrinks by a whole `factor`: each output pixel is the average of a
 * factor x factor block (a partial one at the right and bottom edges), in
 * premultiplied alpha. Integer arithmetic, so the result is the same on
 * every machine.
 */
export function downscale(image, factor) {
  if (!Number.isInteger(factor) || factor < 1) throw new Error(`downscale: factor ${factor} is not a whole number from 1.`);
  if (factor === 1) return image;
  const width = Math.ceil(image.width / factor);
  const height = Math.ceil(image.height / factor);
  const rgba = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let alpha = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;
      for (let sy = y * factor; sy < Math.min(image.height, (y + 1) * factor); sy++) {
        for (let sx = x * factor; sx < Math.min(image.width, (x + 1) * factor); sx++) {
          const from = (sy * image.width + sx) * 4;
          const a = image.rgba[from + 3];
          alpha += a;
          red += image.rgba[from] * a;
          green += image.rgba[from + 1] * a;
          blue += image.rgba[from + 2] * a;
          count += 1;
        }
      }
      const to = (y * width + x) * 4;
      rgba[to + 3] = Math.round(alpha / count);
      if (alpha > 0) {
        rgba[to] = Math.round(red / alpha);
        rgba[to + 1] = Math.round(green / alpha);
        rgba[to + 2] = Math.round(blue / alpha);
      }
    }
  }
  return { width, height, rgba };
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
  return Buffer.concat([head, data, crc]);
}

/**
 * Encodes `{ width, height, rgba }` as an 8 bit RGBA PNG. Each row takes
 * the filter with the smallest sum of absolute values (the usual rule), the
 * data goes through the deterministic encoder of ./zip.mjs.
 */
export function encodePng(image) {
  const { width, height, rgba } = image;
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  const zero = new Uint8Array(stride);
  const candidates = [0, 1, 2, 3, 4].map(() => new Uint8Array(stride));

  for (let y = 0; y < height; y++) {
    const row = rgba.subarray(y * stride, (y + 1) * stride);
    const previous = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : zero;
    let best = 0;
    let bestScore = Infinity;
    for (let filter = 0; filter < 5; filter++) {
      const out = candidates[filter];
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? row[x - 4] : 0;
        const b = previous[x];
        const c = x >= 4 ? previous[x - 4] : 0;
        const predicted = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const value = (row[x] - predicted) & 0xff;
        out[x] = value;
        score += value < 128 ? value : 256 - value;
      }
      if (score < bestScore) {
        bestScore = score;
        best = filter;
      }
    }
    raw[y * (stride + 1)] = best;
    raw.set(candidates[best], y * (stride + 1) + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // not interlaced
  return Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", zlibDeflate(raw)), chunk("IEND", Buffer.alloc(0))]);
}
