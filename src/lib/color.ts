export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
  white: '#ffffff',
  maroon: '#800000',
  red: '#ff0000',
  purple: '#800080',
  fuchsia: '#ff00ff',
  green: '#008000',
  lime: '#00ff00',
  olive: '#808000',
  yellow: '#ffff00',
  navy: '#000080',
  blue: '#0000ff',
  teal: '#008080',
  aqua: '#00ffff',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  orange: '#ffa500',
  pink: '#ffc0cb',
  gold: '#ffd700',
  coral: '#ff7f50',
  crimson: '#dc143c',
  salmon: '#fa8072',
  tomato: '#ff6347',
  indigo: '#4b0082',
  violet: '#ee82ee',
  plum: '#dda0dd',
  orchid: '#da70d6',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  beige: '#f5f5dc',
  ivory: '#fffff0',
  linen: '#faf0e6',
  wheat: '#f5deb3',
  tan: '#d2b48c',
  chocolate: '#d2691e',
  brown: '#a52a2a',
  firebrick: '#b22222',
  sienna: '#a0522d',
  peru: '#cd853f',
  turquoise: '#40e0d0',
  skyblue: '#87ceeb',
  steelblue: '#4682b4',
  royalblue: '#4169e1',
  slategray: '#708090',
  seagreen: '#2e8b57',
  forestgreen: '#228b22',
  darkgreen: '#006400',
  limegreen: '#32cd32',
  springgreen: '#00ff7f',
  darkblue: '#00008b',
  midnightblue: '#191970',
  darkgray: '#a9a9a9',
  dimgray: '#696969',
  lightgray: '#d3d3d3',
  whitesmoke: '#f5f5f5',
  snow: '#fffafa',
  honeydew: '#f0fff0',
  mintcream: '#f5fffa',
  azure: '#f0ffff',
  ghostwhite: '#f8f8ff',
};

const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

const round2 = (v: number): number => Math.round(v * 100) / 100;

export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = ln - c / 2;
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

function parseRgbChannel(v: string): number | null {
  if (v.endsWith('%')) {
    const n = Number(v.slice(0, -1));
    return Number.isFinite(n) ? clamp((n / 100) * 255, 0, 255) : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, 0, 255) : null;
}

function parseAlpha(v: string | undefined): number | null {
  if (v === undefined) return 1;
  if (v.endsWith('%')) {
    const n = Number(v.slice(0, -1));
    return Number.isFinite(n) ? clamp(n / 100, 0, 1) : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, 0, 1) : null;
}

/** Parse hex (#rgb/#rgba/#rrggbb/#rrggbbaa), rgb()/rgba(), hsl()/hsla(), or a named color. */
export function parseColor(input: string): Rgba | null {
  let src = input.trim();
  if (!src) return null;

  const named = NAMED_COLORS[src.toLowerCase()];
  if (named) src = named;

  if (src.startsWith('#')) {
    const hex = src.slice(1).toLowerCase();
    if (!/^([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(hex)) {
      return null;
    }
    if (hex.length <= 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a: round2(a) };
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a: round2(a) };
  }

  const lower = src.toLowerCase();

  const rgbMatch = lower.match(
    /^rgba?\(\s*([^)\s,/]+)[\s,]+([^)\s,/]+)[\s,]+([^)\s,/]+)(?:\s*[,/]\s*([^)\s]+))?\s*\)$/,
  );
  if (rgbMatch) {
    const r = parseRgbChannel(rgbMatch[1]);
    const g = parseRgbChannel(rgbMatch[2]);
    const b = parseRgbChannel(rgbMatch[3]);
    const a = parseAlpha(rgbMatch[4]);
    if (r === null || g === null || b === null || a === null) return null;
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a: round2(a) };
  }

  const hslMatch = lower.match(
    /^hsla?\(\s*([^)\s,/]+)[\s,]+([^)\s,/]+)[\s,]+([^)\s,/]+)(?:\s*[,/]\s*([^)\s]+))?\s*\)$/,
  );
  if (hslMatch) {
    const hRaw = hslMatch[1].replace(/deg$/, '');
    const h = Number(hRaw);
    const s = Number(hslMatch[2].replace(/%$/, ''));
    const l = Number(hslMatch[3].replace(/%$/, ''));
    const a = parseAlpha(hslMatch[4]);
    if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l) || a === null) {
      return null;
    }
    const { r, g, b } = hslToRgb(h, s, l);
    return { r, g, b, a: round2(a) };
  }

  return null;
}

/** HEX without alpha, lowercase — safe for <input type="color">. */
export function toHex6(c: Rgba): string {
  const h = (n: number) =>
    Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export function toHex(c: Rgba): string {
  if (c.a >= 1) return toHex6(c);
  const ha = Math.round(clamp(c.a, 0, 1) * 255).toString(16).padStart(2, '0');
  return `${toHex6(c)}${ha}`;
}

export function toRgbString(c: Rgba): string {
  if (c.a >= 1) return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a})`;
}

export function toHslString(c: Rgba): string {
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  if (c.a >= 1) return `hsl(${h}, ${s}%, ${l}%)`;
  return `hsla(${h}, ${s}%, ${l}%, ${c.a})`;
}

/** WCAG relative luminance (assumes opaque color). */
export function luminance(c: Rgba): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

/** Composite a (possibly transparent) color over an opaque background. */
export function compositeOver(fg: Rgba, bg: Rgba): Rgba {
  const a = clamp(fg.a, 0, 1);
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/** WCAG contrast ratio between two opaque colors (1–21). */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick black or white text for maximum readability on a background color. */
export function readableText(bg: Rgba): string {
  const white = { r: 255, g: 255, b: 255, a: 1 };
  const black = { r: 0, g: 0, b: 0, a: 1 };
  return contrastRatio(bg, white) >= contrastRatio(bg, black) ? '#ffffff' : '#111111';
}

export const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
