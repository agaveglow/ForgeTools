/**
 * Passphrase encryption using the browser's Web Crypto API (no third-party code).
 *  - Key: PBKDF2-SHA-256 from the passphrase and a random salt, then AES-256-GCM.
 *  - Every encryption uses a fresh random 12-byte IV. GCM authenticates, so tampering is detected.
 * The passphrase is never stored. Lose it and the data cannot be recovered.
 */

import { estimateBits } from './passgen';

export const DEFAULT_ITERATIONS = 600_000;
export const MIN_PASSPHRASE = 12;
const PREFIX = 'ft1.';

export class CryptoError extends Error {
  constructor(message: string, public kind: 'unsupported' | 'wrong-passphrase' | 'corrupt') { super(message); }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new CryptoError('Encryption needs a secure context (https or localhost) and is not available here.', 'unsupported');
  return s;
};

export const cryptoAvailable = (): boolean => !!globalThis.crypto?.subtle;
export const randomBytes = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations = DEFAULT_ITERATIONS, extractable = false): Promise<CryptoKey> {
  const s = subtle();
  const base = await s.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return s.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
}

export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(text)));
  return `${PREFIX}${b64(iv)}.${b64(ct)}`;
}

export const isCiphertext = (s: unknown): s is string => typeof s === 'string' && s.startsWith(PREFIX);

export async function decryptText(key: CryptoKey, payload: string): Promise<string> {
  if (!isCiphertext(payload)) throw new CryptoError('Not encrypted data.', 'corrupt');
  const [ivs, cts] = payload.slice(PREFIX.length).split('.');
  if (!ivs || !cts) throw new CryptoError('Encrypted data is damaged.', 'corrupt');
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(ivs) as BufferSource }, key, unb64(cts) as BufferSource);
    return dec.decode(pt);
  } catch {
    throw new CryptoError('Wrong passphrase, or the data is damaged.', 'wrong-passphrase');
  }
}

// ---------- passphrase-protected envelope (for backups) ----------

export interface Envelope { app: 'forgetools-encrypted'; v: 1; kdf: 'PBKDF2-SHA256'; iterations: number; salt: string; data: string }

export const isEnvelope = (x: unknown): x is Envelope =>
  !!x && typeof x === 'object' && (x as Envelope).app === 'forgetools-encrypted' && typeof (x as Envelope).data === 'string' && typeof (x as Envelope).salt === 'string';

export async function sealWithPassphrase(passphrase: string, text: string, iterations = DEFAULT_ITERATIONS): Promise<Envelope> {
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt, iterations);
  return { app: 'forgetools-encrypted', v: 1, kdf: 'PBKDF2-SHA256', iterations, salt: b64(salt), data: await encryptText(key, text) };
}

export async function openWithPassphrase(passphrase: string, env: Envelope): Promise<string> {
  const iterations = Number(env.iterations);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 5_000_000) throw new CryptoError('This backup has unusual settings and was not opened.', 'corrupt');
  return decryptText(await deriveKey(passphrase, unb64(env.salt), iterations), env.data);
}

/** Basic strength gate: length plus not trivially repetitive. Real strength is the user's job; we say so in the UI. */
export function passphraseProblem(p: string): string | null {
  if (p.length < MIN_PASSPHRASE) return `Use at least ${MIN_PASSPHRASE} characters. Four random words is better.`;
  if (/^(.)\1+$/.test(p)) return 'That passphrase is too repetitive.';
  if (/^(?:password|12345678|qwertyui|letmein)/i.test(p)) return 'That passphrase is too easy to guess.';
  if (estimateBits(p).bits < 50) return 'That passphrase is too easy to guess. Try four or more random words, or a longer mix of letters, numbers and symbols.';
  return null;
}
