/** File hash checking with the browser's own crypto. Nothing leaves the device. */
export type HashAlg = 'SHA-256' | 'SHA-1' | 'SHA-384' | 'SHA-512';
export const HASH_ALGS: HashAlg[] = ['SHA-256', 'SHA-1', 'SHA-384', 'SHA-512'];
export const HASH_MAX_BYTES = 500 * 1024 * 1024;

export const toHex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Strips spaces, colons, a leading algorithm label and case, so a pasted hash can be compared. */
export function normalizeHash(s: string): string {
  return s.trim().replace(/^(?:sha-?1|sha-?256|sha-?384|sha-?512|md5)\s*[:=]?\s*/i, '').replace(/[\s:-]/g, '').toLowerCase();
}

/** Guesses the algorithm from the length of a pasted hash. */
export function algFromLength(hash: string): HashAlg | 'MD5' | null {
  const h = normalizeHash(hash);
  if (!/^[0-9a-f]+$/.test(h)) return null;
  return ({ 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' } as Record<number, HashAlg | 'MD5'>)[h.length] ?? null;
}

export type Compare = 'match' | 'mismatch' | 'invalid' | 'empty';
export function compareHashes(computed: string, expected: string): Compare {
  const e = normalizeHash(expected);
  if (!e) return 'empty';
  if (!/^[0-9a-f]+$/.test(e)) return 'invalid';
  return e === computed.toLowerCase() ? 'match' : 'mismatch';
}

export async function hashBuffer(buf: ArrayBuffer, alg: HashAlg): Promise<string> {
  return toHex(await crypto.subtle.digest(alg, buf));
}
