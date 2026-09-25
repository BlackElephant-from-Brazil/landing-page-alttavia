/**
 * Zip archives, CRC-32 and a deflate encoder, in plain node and nothing to
 * install, for the two scripts that handle the firm's Word models: a .docx
 * is a zip.
 *
 *   scripts/generate-contracts.mjs    reads the models (readZipEntry)
 *   scripts/edit-contract-models.mjs  rewrites them (readZip, writeZip)
 *
 * Why an encoder of our own when node has zlib: the edited models are
 * committed, and "same input, same bytes" must hold on any machine. zlib's
 * output is not promised to be stable across versions (node 22 moved to a
 * zlib fork with other match finding), so a model rewritten on another
 * machine could differ by a few bytes with no word changed. This encoder is
 * a plain LZ77 with fixed Huffman codes (RFC 1951, block type 1): integer
 * arithmetic only, so its output depends on the input alone. It compresses
 * less than zlib, which a Word model and a small logo can afford. Every
 * stream it writes is inflated again with node's zlib and compared before
 * it is returned, so a bug here stops the script instead of shipping a
 * broken file.
 *
 * Reading still inflates with zlib: inflating has exactly one right answer.
 */

import { inflateRawSync } from "node:zlib";

// ---------------------------------------------------------------------------
// CRC-32 and Adler-32
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 as zip and PNG use it. `seed` continues a running value. */
export function crc32(bytes, seed = 0) {
  let c = (seed ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Adler-32, the checksum at the end of a zlib stream. */
export function adler32(bytes) {
  let a = 1;
  let b = 0;
  // 5552 is the most bytes that can be summed before b could overflow 32 bits.
  for (let start = 0; start < bytes.length; start += 5552) {
    const end = Math.min(start + 5552, bytes.length);
    for (let i = start; i < end; i++) {
      a += bytes[i];
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

// ---------------------------------------------------------------------------
// Deflate: LZ77 with fixed Huffman codes, one final block
// ---------------------------------------------------------------------------

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

const WINDOW = 32768;
const MIN_MATCH = 3;
const MAX_MATCH = 258;
/** How many earlier places with the same three bytes are tried. More compresses better and runs slower. */
const MAX_CHAIN = 128;
const HASH_BITS = 15;
const HASH_MASK = (1 << HASH_BITS) - 1;

/** Huffman codes go out most significant bit first, into a stream filled from the least significant bit. */
function reverseBits(code, length) {
  let out = 0;
  for (let i = 0; i < length; i++) {
    out = (out << 1) | (code & 1);
    code >>>= 1;
  }
  return out;
}

/** The fixed literal/length code of RFC 1951 section 3.2.6, reversed and ready to write. */
const LITERAL = (() => {
  const codes = new Uint16Array(288);
  const lengths = new Uint8Array(288);
  for (let symbol = 0; symbol < 288; symbol++) {
    let code;
    let length;
    if (symbol < 144) [code, length] = [0x30 + symbol, 8];
    else if (symbol < 256) [code, length] = [0x190 + symbol - 144, 9];
    else if (symbol < 280) [code, length] = [symbol - 256, 7];
    else [code, length] = [0xc0 + symbol - 280, 8];
    codes[symbol] = reverseBits(code, length);
    lengths[symbol] = length;
  }
  return { codes, lengths };
})();

/** Match length (3 to 258) to its index in LENGTH_BASE. 258 has a code of its own. */
const LENGTH_INDEX = (() => {
  const table = new Uint8Array(MAX_MATCH + 1);
  for (let i = 0; i < LENGTH_BASE.length; i++) {
    const last = Math.min(MAX_MATCH, LENGTH_BASE[i] + (1 << LENGTH_EXTRA[i]) - 1);
    for (let length = LENGTH_BASE[i]; length <= last; length++) table[length] = i;
  }
  return table;
})();

function distanceIndex(distance) {
  let low = 0;
  let high = DIST_BASE.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (DIST_BASE[middle] <= distance) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** Writes bits least significant first, as deflate wants them. */
class BitWriter {
  constructor(capacity) {
    this.buffer = new Uint8Array(Math.max(1024, capacity));
    this.length = 0;
    this.acc = 0;
    this.count = 0;
  }

  push(byte) {
    if (this.length === this.buffer.length) {
      const grown = new Uint8Array(this.buffer.length * 2);
      grown.set(this.buffer);
      this.buffer = grown;
    }
    this.buffer[this.length++] = byte;
  }

  bits(value, count) {
    this.acc |= value << this.count;
    this.count += count;
    while (this.count >= 8) {
      this.push(this.acc & 0xff);
      this.acc >>>= 8;
      this.count -= 8;
    }
  }

  finish() {
    if (this.count > 0) this.push(this.acc & 0xff);
    this.acc = 0;
    this.count = 0;
    return this.buffer.slice(0, this.length);
  }
}

function deflateUnchecked(data) {
  const out = new BitWriter(data.length / 2);
  // BFINAL = 1, BTYPE = 01 (fixed Huffman codes).
  out.bits(1, 1);
  out.bits(1, 2);

  const literal = (symbol) => out.bits(LITERAL.codes[symbol], LITERAL.lengths[symbol]);
  const head = new Int32Array(1 << HASH_BITS).fill(-1);
  const previous = new Int32Array(WINDOW).fill(-1);
  const hashAt = (i) => ((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2]) & HASH_MASK;
  const insert = (i) => {
    if (i + MIN_MATCH > data.length) return;
    const hash = hashAt(i);
    previous[i & (WINDOW - 1)] = head[hash];
    head[hash] = i;
  };

  let i = 0;
  while (i < data.length) {
    let best = 0;
    let bestDistance = 0;
    const limit = Math.min(MAX_MATCH, data.length - i);

    if (limit >= MIN_MATCH) {
      let candidate = head[hashAt(i)];
      let chain = MAX_CHAIN;
      while (candidate >= 0 && i - candidate <= WINDOW && chain-- > 0) {
        if (data[candidate + best] === data[i + best]) {
          let length = 0;
          while (length < limit && data[candidate + length] === data[i + length]) length++;
          if (length > best) {
            best = length;
            bestDistance = i - candidate;
            if (length === limit) break;
          }
        }
        const next = previous[candidate & (WINDOW - 1)];
        // A slot reused by a newer position ends the chain: chains only go back in time.
        if (next >= candidate) break;
        candidate = next;
      }
    }

    if (best >= MIN_MATCH) {
      const lengthIndex = LENGTH_INDEX[best];
      literal(257 + lengthIndex);
      if (LENGTH_EXTRA[lengthIndex] > 0) out.bits(best - LENGTH_BASE[lengthIndex], LENGTH_EXTRA[lengthIndex]);
      const distIndex = distanceIndex(bestDistance);
      out.bits(reverseBits(distIndex, 5), 5);
      if (DIST_EXTRA[distIndex] > 0) out.bits(bestDistance - DIST_BASE[distIndex], DIST_EXTRA[distIndex]);
      for (let k = 0; k < best; k++) insert(i + k);
      i += best;
    } else {
      literal(data[i]);
      insert(i);
      i += 1;
    }
  }
  literal(256);
  return out.finish();
}

/**
 * Raw deflate of `bytes` (no zlib or gzip wrapper), deterministic: the same
 * input gives the same output on every machine. Checked by inflating it
 * back with node's zlib before it is returned.
 */
export function deflateRaw(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const compressed = deflateUnchecked(data);
  const back = inflateRawSync(compressed);
  if (back.length !== data.length || Buffer.compare(back, Buffer.from(data.buffer, data.byteOffset, data.byteLength)) !== 0) {
    throw new Error("scripts/lib/zip.mjs: the deflate encoder produced a stream that does not inflate to its input.");
  }
  return Buffer.from(compressed);
}

/** A zlib stream (RFC 1950) around deflateRaw(): what a PNG's IDAT holds. */
export function zlibDeflate(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const trailer = Buffer.alloc(4);
  trailer.writeUInt32BE(adler32(data));
  // 0x78 0x01: deflate, 32 KiB window, no dictionary; (0x78 * 256 + 0x01) % 31 === 0.
  return Buffer.concat([Buffer.from([0x78, 0x01]), deflateRaw(data), trailer]);
}

// ---------------------------------------------------------------------------
// Reading a zip
// ---------------------------------------------------------------------------

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/**
 * Every entry of a zip archive, in the order of its central directory, with
 * its data still compressed: `{ name, method, flags, time, date, crc, size,
 * versionMadeBy, internalAttributes, externalAttributes, raw }`. Entries are
 * found through the central directory, whose sizes are the ones to trust
 * (a local header may defer them to a data descriptor).
 */
export function readZip(buffer, file) {
  let eocd = -1;
  const floor = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= floor; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${file}: not a zip archive (no end of central directory).`);

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];

  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`${file}: broken central directory at entry ${n}.`);
    }
    const versionMadeBy = buffer.readUInt16LE(offset + 4);
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const time = buffer.readUInt16LE(offset + 12);
    const date = buffer.readUInt16LE(offset + 14);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const internalAttributes = buffer.readUInt16LE(offset + 36);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
      throw new Error(`${file}: broken local header for ${name}.`);
    }
    // The local header repeats the name and carries its own extra field,
    // whose length may differ from the central one.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);

    entries.push({ name, method, flags, time, date, crc, size, versionMadeBy, internalAttributes, externalAttributes, raw });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** The uncompressed bytes of one entry read by readZip(). */
export function entryBytes(entry, file) {
  if (entry.method === 0) return Buffer.from(entry.raw);
  if (entry.method === 8) return inflateRawSync(entry.raw);
  throw new Error(`${file}: ${entry.name} uses zip method ${entry.method}, only stored and deflate are read.`);
}

/** Returns one entry of a zip archive, inflated. */
export function readZipEntry(buffer, name, file) {
  const entry = readZip(buffer, file).find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`${file}: no ${name} inside.`);
  return entryBytes(entry, file);
}

// ---------------------------------------------------------------------------
// Writing a zip
// ---------------------------------------------------------------------------

/** Bit 3: sizes in a data descriptor after the data. Never written here, sizes go in the local header. */
const FLAG_DATA_DESCRIPTOR = 0x0008;

/**
 * An entry for writeZip() whose content changed: deflated here, its CRC and
 * sizes recomputed, everything else (name, date, attributes) kept from the
 * entry it replaces, so the archive differs only where the content does.
 */
export function replaceEntry(entry, content) {
  const bytes = Buffer.from(content);
  return { ...entry, method: 8, crc: crc32(bytes), size: bytes.length, raw: deflateRaw(bytes) };
}

/**
 * A zip archive of `entries` (as readZip() returns them, or replaceEntry()),
 * in the order given. An entry that did not change is copied compressed as
 * it came, byte for byte. No extra fields and no comments; no zip64, which
 * a Word model never needs.
 */
export function writeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const flags = entry.flags & ~FLAG_DATA_DESCRIPTOR;
    const versionNeeded = entry.method === 8 ? 20 : 10;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIGNATURE, 0);
    local.writeUInt16LE(versionNeeded, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(entry.method, 8);
    local.writeUInt16LE(entry.time, 10);
    local.writeUInt16LE(entry.date, 12);
    local.writeUInt32LE(entry.crc, 14);
    local.writeUInt32LE(entry.raw.length, 18);
    local.writeUInt32LE(entry.size, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIGNATURE, 0);
    central.writeUInt16LE(entry.versionMadeBy, 4);
    central.writeUInt16LE(versionNeeded, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt16LE(entry.time, 12);
    central.writeUInt16LE(entry.date, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(entry.raw.length, 20);
    central.writeUInt32LE(entry.size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(entry.internalAttributes, 36);
    central.writeUInt32LE(entry.externalAttributes, 38);
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, Buffer.from(entry.raw));
    centrals.push(central, name);
    offset += local.length + name.length + entry.raw.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, directory, end]);
}
