/**
 * Fingerprint / face / screen-lock unlock using WebAuthn with the PRF extension.
 *
 * The phone's secure hardware produces a secret only after the person passes the fingerprint (or face, or
 * screen-lock) check. That secret wraps the data key (see vault.ts). Nothing secret is stored by this code,
 * and without PRF support there is no secure way to do this, so it is simply not offered.
 * If this fails or the phone changes, the passphrase always works.
 */
import { b64, randomBytes, unb64 } from './crypto';

const INFO = new TextEncoder().encode('forgetools-vault-wrap-v1');

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

export type BioResult = { ok: true; cred: string; salt: string; wrapKey: CryptoKey } | { ok: false; reason: 'unsupported' | 'no-prf' | 'cancelled' | 'failed' };

export async function biometricSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.isSecureContext || !('PublicKeyCredential' in window)) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

async function wrapKeyFrom(prf: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: INFO }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const cancelled = (e: unknown) => e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError');

async function evalPrf(cred: Uint8Array, salt: Uint8Array): Promise<ArrayBuffer | undefined> {
  const got = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32) as BufferSource,
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: cred as BufferSource, transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: salt as BufferSource } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  return (got?.getClientExtensionResults() as PrfResults | undefined)?.prf?.results?.first;
}

/** Create the passkey and read its secret once. Shows the phone's fingerprint prompt (twice on some phones). */
export async function registerBiometric(): Promise<BioResult> {
  if (!(await biometricSupported())) return { ok: false, reason: 'unsupported' };
  try {
    const salt = randomBytes(32);
    const created = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32) as BufferSource,
        rp: { name: 'ForgeTools', id: location.hostname },
        user: { id: randomBytes(16) as BufferSource, name: 'forgetools-unlock', displayName: 'ForgeTools unlock' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
        extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
    if (!created) return { ok: false, reason: 'failed' };
    const enabled = (created.getClientExtensionResults() as PrfResults).prf?.enabled;
    if (enabled === false) return { ok: false, reason: 'no-prf' };
    const out = await evalPrf(new Uint8Array(created.rawId), salt);
    if (!out) return { ok: false, reason: 'no-prf' };
    return { ok: true, cred: b64(new Uint8Array(created.rawId)), salt: b64(salt), wrapKey: await wrapKeyFrom(out) };
  } catch (e) {
    return { ok: false, reason: cancelled(e) ? 'cancelled' : 'failed' };
  }
}

/** Ask for the fingerprint and return the wrapping key. */
export async function readBiometric(cred: string, salt: string): Promise<{ ok: true; wrapKey: CryptoKey } | { ok: false; reason: 'cancelled' | 'failed' }> {
  try {
    const out = await evalPrf(unb64(cred), unb64(salt));
    if (!out) return { ok: false, reason: 'failed' };
    return { ok: true, wrapKey: await wrapKeyFrom(out) };
  } catch (e) {
    return { ok: false, reason: cancelled(e) ? 'cancelled' : 'failed' };
  }
}

export const bioReasonText = (r: 'unsupported' | 'no-prf' | 'cancelled' | 'failed'): string => ({
  unsupported: 'This phone or browser has no fingerprint or screen-lock option for web apps.',
  'no-prf': 'This phone or browser can confirm your fingerprint but cannot use it to protect the encryption key, so it is not safe to offer. Keep using the passphrase.',
  cancelled: 'Cancelled. Nothing was changed.',
  failed: 'That did not work. Nothing was changed. The passphrase still works.',
})[r];
