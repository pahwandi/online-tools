export interface ExifEntry {
  name: string;
  value: string;
  gps?: boolean;
}

export interface ImageMeta {
  kind: 'jpeg' | 'png' | 'other';
  hasExifBlock: boolean;
  hasXmp: boolean;
  hasIcc: boolean;
  entries: ExifEntry[];
  gps: { lat: number; lon: number; alt: number | null } | null;
}

export interface StripResult {
  bytes: Uint8Array;
  removed: number;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ORIENTATIONS: Record<number, string> = {
  1: 'Normal',
  2: 'Mirrored horizontally',
  3: 'Rotated 180°',
  4: 'Mirrored vertically',
  5: 'Mirrored horizontally, rotated 270°',
  6: 'Rotated 90° CW',
  7: 'Mirrored horizontally, rotated 90°',
  8: 'Rotated 270° CW',
};

/** Tags worth showing from IFD0. */
const MAIN_TAGS: Record<number, string> = {
  0x010e: 'Image description',
  0x010f: 'Camera make',
  0x0110: 'Camera model',
  0x0112: 'Orientation',
  0x0131: 'Software',
  0x0132: 'Date modified',
  0x013b: 'Artist',
  0x8298: 'Copyright',
};

/** Tags worth showing from the Exif sub-IFD. */
const EXIF_TAGS: Record<number, string> = {
  0x829a: 'Exposure time',
  0x829d: 'F-number',
  0x8827: 'ISO speed',
  0x9003: 'Date taken',
  0x9004: 'Date digitized',
  0x9209: 'Flash',
  0x920a: 'Focal length',
  0xa002: 'Pixel width',
  0xa003: 'Pixel height',
  0xa405: 'Focal length (35mm equiv.)',
  0xa420: 'Image unique ID',
  0xa433: 'Lens make',
  0xa434: 'Lens model',
  0xa435: 'Lens serial number',
};

const trimNum = (v: number): string => String(Number(v.toFixed(3)));

function typeSize(type: number): number {
  return [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] ?? 0;
}

type RawValue = number[] | string;

function readRaw(
  dv: DataView,
  base: number,
  le: boolean,
  type: number,
  count: number,
  entryPos: number,
): RawValue | null {
  const size = typeSize(type) * count;
  if (size === 0 || size > 1 << 20) return null;
  const dataPos = size <= 4 ? entryPos + 8 : base + dv.getUint32(entryPos + 8, le);
  if (dataPos < base || dataPos >= dv.byteLength) return null;

  if (type === 2) {
    const chars: string[] = [];
    for (let i = 0; i < count && dataPos + i < dv.byteLength; i++) {
      const c = dv.getUint8(dataPos + i);
      if (c === 0) break;
      chars.push(String.fromCharCode(c));
    }
    return chars.join('').trim();
  }

  const nums: number[] = [];
  const n = Math.min(count, 64);
  for (let i = 0; i < n; i++) {
    const p = dataPos + i * typeSize(type);
    if (p + typeSize(type) > dv.byteLength) break;
    switch (type) {
      case 1:
      case 7:
        nums.push(dv.getUint8(p));
        break;
      case 3:
        nums.push(dv.getUint16(p, le));
        break;
      case 4:
        nums.push(dv.getUint32(p, le));
        break;
      case 5: {
        const a = dv.getUint32(p, le);
        const b = dv.getUint32(p + 4, le);
        nums.push(b === 0 ? 0 : a / b);
        break;
      }
      case 6:
        nums.push(dv.getInt8(p));
        break;
      case 8:
        nums.push(dv.getInt16(p, le));
        break;
      case 9:
        nums.push(dv.getInt32(p, le));
        break;
      case 10: {
        const a = dv.getInt32(p, le);
        const b = dv.getInt32(p + 4, le);
        nums.push(b === 0 ? 0 : a / b);
        break;
      }
      case 11:
        nums.push(dv.getFloat32(p, le));
        break;
      case 12:
        nums.push(dv.getFloat64(p, le));
        break;
    }
  }
  return nums.length ? nums : null;
}

function formatTag(tag: number, raw: RawValue): string {
  if (typeof raw === 'string') return raw;
  if (raw.length === 0) return '';
  switch (tag) {
    case 0x0112:
      return ORIENTATIONS[raw[0]] ?? `Unknown (${raw[0]})`;
    case 0x829a: {
      const v = raw[0];
      if (!v) return '0 s';
      return v >= 1 ? `${trimNum(v)} s` : `1/${Math.round(1 / v)} s`;
    }
    case 0x829d:
      return `f/${trimNum(raw[0])}`;
    case 0x920a:
      return `${trimNum(raw[0])} mm`;
    case 0xa405:
      return `${raw[0]} mm`;
    case 0x9209:
      return raw[0] & 1 ? 'Fired' : 'Did not fire';
    default:
      return raw.length === 1 ? trimNum(raw[0]) : raw.map(trimNum).join(', ');
  }
}

interface TiffResult {
  entries: ExifEntry[];
  gps: { lat: number; lon: number; alt: number | null } | null;
}

function walkIfd(
  dv: DataView,
  base: number,
  le: boolean,
  ifdPos: number,
  dict: Record<number, string>,
  out: ExifEntry[],
): Record<number, RawValue> {
  const raw: Record<number, RawValue> = {};
  if (ifdPos + 2 > dv.byteLength || ifdPos < base) return raw;
  const count = dv.getUint16(ifdPos, le);
  for (let i = 0; i < count && i < 512; i++) {
    const p = ifdPos + 2 + i * 12;
    if (p + 12 > dv.byteLength) break;
    const tag = dv.getUint16(p, le);
    const type = dv.getUint16(p + 2, le);
    const cnt = dv.getUint32(p + 4, le);
    if (cnt === 0 || cnt > 0xffff) continue;
    const value = readRaw(dv, base, le, type, cnt, p);
    if (value === null) continue;
    raw[tag] = value;
    const name = dict[tag];
    if (name) {
      const text = formatTag(tag, value);
      if (text) out.push({ name, value: text });
    }
  }
  return raw;
}

function toDegrees(v: RawValue | undefined): number | null {
  if (!v || typeof v === 'string' || v.length < 3) return null;
  return v[0] + v[1] / 60 + v[2] / 3600;
}

/** Parse a TIFF header (Exif block) at `base` inside `dv`. */
export function parseTiff(dv: DataView, base: number): TiffResult | null {
  if (base + 8 > dv.byteLength) return null;
  const bo = dv.getUint16(base);
  let le: boolean;
  if (bo === 0x4949) le = true;
  else if (bo === 0x4d4d) le = false;
  else return null;
  if (dv.getUint16(base + 2, le) !== 42) return null;

  const ifd0Pos = base + dv.getUint32(base + 4, le);
  const entries: ExifEntry[] = [];
  const main = walkIfd(dv, base, le, ifd0Pos, MAIN_TAGS, entries);

  if (typeof main[0x8769] !== 'undefined' && typeof main[0x8769] !== 'string') {
    const pos = base + (main[0x8769] as number[])[0];
    walkIfd(dv, base, le, pos, EXIF_TAGS, entries);
  }

  let gps: TiffResult['gps'] = null;
  if (typeof main[0x8825] !== 'undefined' && typeof main[0x8825] !== 'string') {
    const pos = base + (main[0x8825] as number[])[0];
    const g: Record<number, RawValue> = {};
    if (pos + 2 <= dv.byteLength && pos >= base) {
      const count = dv.getUint16(pos, le);
      for (let i = 0; i < count && i < 512; i++) {
        const p = pos + 2 + i * 12;
        if (p + 12 > dv.byteLength) break;
        const tag = dv.getUint16(p, le);
        const type = dv.getUint16(p + 2, le);
        const cnt = dv.getUint32(p + 4, le);
        if (cnt === 0 || cnt > 0xffff) continue;
        const value = readRaw(dv, base, le, type, cnt, p);
        if (value !== null) g[tag] = value;
      }
    }
    const lat = toDegrees(g[2]);
    const lon = toDegrees(g[4]);
    if (lat !== null && lon !== null) {
      const latRef = typeof g[1] === 'string' ? (g[1] as string).toUpperCase() : 'N';
      const lonRef = typeof g[3] === 'string' ? (g[3] as string).toUpperCase() : 'E';
      const sLat = latRef === 'S' ? -1 : 1;
      const sLon = lonRef === 'W' ? -1 : 1;
      gps = { lat: sLat * lat, lon: sLon * lon, alt: null };
      entries.push({
        name: 'GPS location',
        value: `${(sLat * lat).toFixed(6)}, ${(sLon * lon).toFixed(6)}`,
        gps: true,
      });
      const alt = g[6];
      if (alt && typeof alt !== 'string') {
        const below = typeof g[5] !== 'string' && (g[5] as number[])[0] === 1;
        const a = alt[0];
        gps.alt = below ? -a : a;
        entries.push({
          name: 'GPS altitude',
          value: `${trimNum(a)} m ${below ? 'below' : 'above'} sea level`,
          gps: true,
        });
      }
      if (typeof g[29] === 'string') {
        entries.push({ name: 'GPS date stamp', value: g[29] as string, gps: true });
      }
    }
  }

  return { entries, gps };
}

interface JpegSegment {
  marker: number;
  start: number;
  end: number;
  bodyStart: number;
  bodyEnd: number;
}

function walkJpeg(u8: Uint8Array): { segments: JpegSegment[]; sosStart: number } | null {
  if (u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) return null;
  const segments: JpegSegment[] = [];
  let i = 2;
  let sosStart = -1;
  while (i + 1 < u8.length) {
    if (u8[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = u8[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    // standalone markers (no length field)
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8) {
      i += 2;
      continue;
    }
    if (i + 4 > u8.length) break;
    const len = (u8[i + 2] << 8) | u8[i + 3];
    if (len < 2 || i + 2 + len > u8.length) break;
    const seg: JpegSegment = {
      marker,
      start: i,
      end: i + 2 + len,
      bodyStart: i + 4,
      bodyEnd: i + 2 + len,
    };
    segments.push(seg);
    if (marker === 0xda) {
      sosStart = i;
      break;
    }
    i += 2 + len;
  }
  return { segments, sosStart };
}

function startsWith(u8: Uint8Array, pos: number, prefix: number[] | string): boolean {
  const bytes = typeof prefix === 'string' ? [...prefix].map((c) => c.charCodeAt(0)) : prefix;
  if (pos + bytes.length > u8.length) return false;
  return bytes.every((b, idx) => u8[pos + idx] === b);
}

/** Read displayable metadata (EXIF / XMP / ICC / text chunks) from JPEG or PNG bytes. */
export function readImageMeta(buf: ArrayBuffer): ImageMeta {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  const other: ImageMeta = {
    kind: 'other',
    hasExifBlock: false,
    hasXmp: false,
    hasIcc: false,
    entries: [],
    gps: null,
  };

  if (u8[0] === 0xff && u8[1] === 0xd8) {
    const walked = walkJpeg(u8);
    if (!walked) return other;
    const meta: ImageMeta = { ...other, kind: 'jpeg' };
    for (const seg of walked.segments) {
      if (seg.marker === 0xe1) {
        if (startsWith(u8, seg.bodyStart, 'Exif\0\0')) {
          meta.hasExifBlock = true;
          const tiff = parseTiff(dv, seg.bodyStart + 6);
          if (tiff) {
            meta.entries.push(...tiff.entries);
            if (tiff.gps) meta.gps = tiff.gps;
          }
        } else if (startsWith(u8, seg.bodyStart, 'http://ns.adobe.com/xap/1.0/')) {
          meta.hasXmp = true;
        }
      } else if (seg.marker === 0xe2 && startsWith(u8, seg.bodyStart, 'ICC_PROFILE')) {
        meta.hasIcc = true;
      } else if (seg.marker === 0xfe) {
        const len = Math.min(seg.bodyEnd - seg.bodyStart, 120);
        let text = '';
        for (let i = 0; i < len; i++) {
          const c = u8[seg.bodyStart + i];
          if (c < 0x20 || c > 0x7e) continue;
          text += String.fromCharCode(c);
        }
        if (text.trim()) meta.entries.push({ name: 'Comment', value: text.trim() });
      }
    }
    if (meta.hasXmp) meta.entries.push({ name: 'XMP packet', value: 'Adobe XMP metadata present' });
    if (meta.hasIcc) meta.entries.push({ name: 'ICC profile', value: 'Color profile present (kept)' });
    return meta;
  }

  if (PNG_SIG.every((b, i) => u8[i] === b)) {
    const meta: ImageMeta = { ...other, kind: 'png' };
    let pos = 8;
    while (pos + 12 <= u8.length) {
      const size = dv.getUint32(pos);
      if (size > u8.length - pos - 12) break;
      const type = String.fromCharCode(u8[pos + 4], u8[pos + 5], u8[pos + 6], u8[pos + 7]);
      const dataPos = pos + 8;
      if (type === 'eXIf' && size >= 8) {
        meta.hasExifBlock = true;
        const tiff = parseTiff(dv, dataPos);
        if (tiff) {
          meta.entries.push(...tiff.entries);
          if (tiff.gps) meta.gps = tiff.gps;
        }
      } else if (type === 'tEXt') {
        let nul = dataPos;
        while (nul < dataPos + size && u8[nul] !== 0) nul++;
        const key = new TextDecoder().decode(u8.slice(dataPos, nul));
        const val = new TextDecoder()
          .decode(u8.slice(nul + 1, Math.min(dataPos + size, nul + 1 + 80)))
          .replace(/[^\x20-\x7e]/g, '');
        if (key !== 'XML:com.adobe.xmp') {
          meta.entries.push({ name: `PNG text: ${key}`, value: val || '(empty)' });
        } else {
          meta.hasXmp = true;
        }
      } else if (type === 'iTXt' || type === 'zTXt') {
        let nul = dataPos;
        while (nul < dataPos + size && u8[nul] !== 0) nul++;
        const key = new TextDecoder().decode(u8.slice(dataPos, nul));
        if (key === 'XML:com.adobe.xmp') meta.hasXmp = true;
        else meta.entries.push({ name: `PNG text: ${key}`, value: '(compressed)' });
      } else if (type === 'tIME') {
        meta.entries.push({ name: 'PNG last-modified time', value: 'tIME chunk present' });
      } else if (type === 'iCCP') {
        meta.hasIcc = true;
        meta.entries.push({ name: 'ICC profile', value: 'Color profile present (kept)' });
      }
      if (type === 'IEND') break;
      pos = dataPos + size + 4;
    }
    if (meta.hasXmp) meta.entries.push({ name: 'XMP packet', value: 'Adobe XMP metadata present' });
    return meta;
  }

  return other;
}

/**
 * Losslessly remove metadata segments (EXIF/XMP APP1, APP12, comments) from a
 * JPEG. Pixel data, JFIF, ICC and Adobe APP segments are preserved byte-for-byte.
 */
export function stripJpegMetadata(buf: ArrayBuffer): StripResult | null {
  const u8 = new Uint8Array(buf);
  const walked = walkJpeg(u8);
  if (!walked) return null;

  const drop = (seg: JpegSegment): boolean =>
    seg.marker === 0xe1 || seg.marker === 0xec || seg.marker === 0xfe;

  const pieces: Uint8Array[] = [u8.slice(0, 2)];
  let removed = 0;
  let cursor = 2;
  for (const seg of walked.segments) {
    if (seg.marker === 0xda) break;
    pieces.push(u8.slice(cursor, seg.start));
    if (drop(seg)) {
      removed++;
    } else {
      pieces.push(u8.slice(seg.start, seg.end));
    }
    cursor = seg.end;
  }
  if (walked.sosStart >= 0) {
    pieces.push(u8.slice(cursor, walked.sosStart));
    pieces.push(u8.slice(walked.sosStart));
  } else {
    pieces.push(u8.slice(cursor));
  }

  const total = pieces.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of pieces) {
    out.set(p, off);
    off += p.length;
  }
  return { bytes: out, removed };
}

const PNG_DROP_CHUNKS = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

/** Losslessly remove metadata chunks from a PNG. Critical chunks and ICC are kept. */
export function stripPngMetadata(buf: ArrayBuffer): StripResult | null {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  if (!PNG_SIG.every((b, i) => u8[i] === b)) return null;

  const pieces: Uint8Array[] = [u8.slice(0, 8)];
  let pos = 8;
  let removed = 0;
  while (pos + 12 <= u8.length) {
    const size = dv.getUint32(pos);
    if (size > u8.length - pos - 12) break;
    const type = String.fromCharCode(u8[pos + 4], u8[pos + 5], u8[pos + 6], u8[pos + 7]);
    const chunkEnd = pos + 12 + size;
    if (PNG_DROP_CHUNKS.has(type)) removed++;
    else pieces.push(u8.slice(pos, chunkEnd));
    if (type === 'IEND') break;
    pos = chunkEnd;
  }
  if (pos < u8.length) pieces.push(u8.slice(pos)); // trailing bytes, keep verbatim

  const total = pieces.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of pieces) {
    out.set(p, off);
    off += p.length;
  }
  return { bytes: out, removed };
}
