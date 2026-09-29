export interface JwtJsonPart {
  text: string;
  data: Record<string, unknown> | null;
  error: string;
}

export interface JwtInfo {
  error: string;
  empty: boolean;
  header: JwtJsonPart;
  payload: JwtJsonPart;
  signature: string;
  alg: string;
  algName: string;
  typ: string;
  kid: string;
  hasSignature: boolean;
}

export const ALG_NAMES: Record<string, string> = {
  HS256: 'HMAC using SHA-256',
  HS384: 'HMAC using SHA-384',
  HS512: 'HMAC using SHA-512',
  RS256: 'RSASSA-PKCS1-v1_5 using SHA-256',
  RS384: 'RSASSA-PKCS1-v1_5 using SHA-384',
  RS512: 'RSASSA-PKCS1-v1_5 using SHA-512',
  ES256: 'ECDSA using P-256 and SHA-256',
  ES384: 'ECDSA using P-384 and SHA-384',
  ES512: 'ECDSA using P-521 and SHA-512',
  PS256: 'RSASSA-PSS using SHA-256',
  PS384: 'RSASSA-PSS using SHA-384',
  PS512: 'RSASSA-PSS using SHA-512',
  EdDSA: 'Edwards-curve Digital Signature Algorithm',
  none: 'No digital signature or MAC content',
};

const HMAC_HASHES: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
};

function b64urlToBytes(seg: string): Uint8Array {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Decode a base64url segment to a UTF-8 string. Throws on invalid base64. */
export function b64urlDecode(seg: string): string {
  return new TextDecoder().decode(b64urlToBytes(seg));
}

function decodeJsonPart(seg: string): JwtJsonPart {
  let raw: string;
  try {
    raw = b64urlDecode(seg);
  } catch {
    return { text: '', data: null, error: 'segment is not valid base64url.' };
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { text: raw, data: null, error: 'segment is not valid JSON.' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { text: raw, data: null, error: 'segment is not a JSON object.' };
  }
  return { text: JSON.stringify(data, null, 2), data: data as Record<string, unknown>, error: '' };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Decode a JWT (2 parts = unsecured JWS, 3 parts = signed). Never verifies the signature. */
export function decodeJwt(token: string): JwtInfo {
  const blank: JwtInfo = {
    error: '',
    empty: true,
    header: { text: '', data: null, error: '' },
    payload: { text: '', data: null, error: '' },
    signature: '',
    alg: '',
    algName: '',
    typ: '',
    kid: '',
    hasSignature: false,
  };

  const trimmed = token.trim().replace(/^Bearer\s+/i, '');
  if (!trimmed) return blank;

  const parts = trimmed.split('.');
  if (parts.length !== 2 && parts.length !== 3) {
    return {
      ...blank,
      empty: false,
      error: `A JWT has 2 or 3 dot-separated parts — got ${parts.length}.`,
    };
  }

  const header = decodeJsonPart(parts[0]);
  const payload = decodeJsonPart(parts[1]);
  const hasSignature = parts.length === 3 && parts[2].length > 0;
  const alg = str(header.data?.alg);

  if (header.error) {
    return { ...blank, empty: false, header, payload, error: `Header: ${header.error}`, hasSignature };
  }

  return {
    error: '',
    empty: false,
    header,
    payload,
    signature: hasSignature ? parts[2] : '',
    alg,
    algName: alg ? (ALG_NAMES[alg] ?? `Unknown algorithm "${alg}"`) : '',
    typ: str(header.data?.typ),
    kid: str(header.data?.kid),
    hasSignature,
  };
}

export interface ClaimRow {
  claim: string;
  value: string;
  human: string;
}

const CLAIM_LABELS: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expires at',
  nbf: 'Not valid before',
  iat: 'Issued at',
  jti: 'JWT ID',
};

/** NumericDate claims accept seconds or milliseconds — normalize to ms. */
function numDateToMs(v: number): number {
  return v > 1e12 ? v : v * 1000;
}

export function claimRows(payload: Record<string, unknown> | null): ClaimRow[] {
  if (!payload) return [];
  const rows: ClaimRow[] = [];
  for (const claim of Object.keys(CLAIM_LABELS)) {
    if (!(claim in payload)) continue;
    const v = payload[claim];
    if (claim === 'exp' || claim === 'nbf' || claim === 'iat') {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const d = new Date(numDateToMs(v));
      rows.push({ claim, value: String(v), human: `${d.toUTCString()} · ${d.toLocaleString()}` });
    } else if (claim === 'aud') {
      const text = Array.isArray(v) ? v.map(String).join(', ') : String(v);
      rows.push({ claim, value: text, human: CLAIM_LABELS[claim] });
    } else {
      rows.push({ claim, value: String(v), human: CLAIM_LABELS[claim] });
    }
  }
  return rows;
}

export interface TokenTimeStatus {
  expired: boolean;
  notYet: boolean;
  expDate: Date | null;
  nbfDate: Date | null;
}

/** Time validity from exp / nbf claims. Signature is NOT checked here. */
export function tokenTimeStatus(payload: Record<string, unknown> | null, now = Date.now()): TokenTimeStatus {
  const status: TokenTimeStatus = { expired: false, notYet: false, expDate: null, nbfDate: null };
  if (!payload) return status;
  const exp = payload.exp;
  const nbf = payload.nbf;
  if (typeof exp === 'number' && Number.isFinite(exp)) {
    status.expDate = new Date(numDateToMs(exp));
    status.expired = numDateToMs(exp) < now;
  }
  if (typeof nbf === 'number' && Number.isFinite(nbf)) {
    status.nbfDate = new Date(numDateToMs(nbf));
    status.notYet = numDateToMs(nbf) > now;
  }
  return status;
}

export interface VerifyResult {
  ok: boolean;
  error: string;
}

/**
 * Verify an HMAC-signed JWT (HS256/384/512) against a shared secret, locally.
 * RSA/EC/EdDSA tokens need the issuer's public key and cannot be verified here.
 */
export async function verifyHmac(token: string, secret: string): Promise<VerifyResult> {
  const trimmed = token.trim().replace(/^Bearer\s+/i, '');
  const parts = trimmed.split('.');
  if (parts.length < 3 || !parts[2]) {
    return { ok: false, error: 'This token has no signature part.' };
  }
  const header = decodeJsonPart(parts[0]);
  const alg = str(header.data?.alg);
  const hash = HMAC_HASHES[alg];
  if (!hash) {
    return {
      ok: false,
      error: alg
        ? `Algorithm "${alg}" is not HMAC — verifying it requires the issuer's public key, which this tool does not have.`
        : 'Token header has no "alg".',
    };
  }
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return { ok: false, error: 'Web Crypto is unavailable — it requires HTTPS or localhost.' };
  }
  let expected: Uint8Array;
  try {
    expected = b64urlToBytes(parts[2]);
  } catch {
    return { ok: false, error: 'Signature segment is not valid base64url.' };
  }
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash },
      false,
      ['sign'],
    );
    const sig = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts[0]}.${parts[1]}`)),
    );
    if (sig.length !== expected.length) return { ok: false, error: '' };
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig[i] ^ expected[i];
    return { ok: diff === 0, error: '' };
  } catch {
    return { ok: false, error: 'Verification failed — Web Crypto rejected the key.' };
  }
}
