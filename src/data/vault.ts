/**
 * Optional encryption at rest.
 *
 * VaultAdapter wraps the normal localStorage adapter. In 'off' mode it is a pass-through.
 * Once enabled, records are kept decrypted only in memory while the app is unlocked, and are written
 * to localStorage as AES-GCM ciphertext (keys named "enc.<name>"). While locked the app holds no records.
 * The passphrase is never stored; only a random salt and a check value that proves it is correct.
 */
import type { LocalStorageAdapter, StorageAdapter } from './storage';
import { DEFAULT_ITERATIONS, CryptoError, b64, decryptText, deriveKey, encryptText, randomBytes, unb64 } from '../lib/crypto';

export type VaultState = 'off' | 'locked' | 'unlocked';
/** Fingerprint unlock: the data key, encrypted with a key that only the phone's secure hardware can produce after a fingerprint. */
export interface BioMeta { cred: string; salt: string; wrapped: string }
interface VaultMeta { v: 1; salt: string; iterations: number; check: string; bio?: BioMeta }
const CHECK_TEXT = 'forgetools-vault-ok';
const ENC = 'enc.';

export class VaultAdapter implements StorageAdapter {
  private mem = new Map<string, unknown>();
  private key: CryptoKey | null = null;
  private chain: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private persistListeners = new Set<() => void>();
  private version = 0;
  state: VaultState;
  failedPersist = false;

  constructor(private inner: LocalStorageAdapter, private iterations = DEFAULT_ITERATIONS) {
    this.state = inner.read('vault') ? 'locked' : 'off';
  }

  get persistent(): boolean { return this.inner.persistent; }
  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  getVersion = () => this.version;
  private setState(s: VaultState) { this.state = s; this.version++; this.listeners.forEach((l) => l()); }

  // ----- StorageAdapter -----
  read(key: string): unknown | undefined {
    if (this.state === 'off') return this.inner.read(key);
    return this.state === 'unlocked' ? this.mem.get(key) : undefined;
  }
  write(key: string, value: unknown): void {
    if (this.state === 'off') { this.inner.write(key, value); return; }
    if (this.state !== 'unlocked' || !this.key) return;
    const snap = JSON.parse(JSON.stringify(value)) as unknown;
    this.mem.set(key, snap);
    this.queue(key, snap, this.key);
  }
  remove(key: string): void {
    if (this.state === 'off') { this.inner.remove(key); return; }
    if (this.state !== 'unlocked' || !this.key) return;
    this.mem.delete(key);
    this.queue(key, undefined, this.key);
  }
  keys(): string[] {
    if (this.state === 'off') return this.inner.keys();
    return this.state === 'unlocked' ? [...this.mem.keys()] : [];
  }

  private queue(key: string, value: unknown, k: CryptoKey) {
    this.chain = this.chain.then(async () => {
      try {
        if (value === undefined) this.inner.remove(ENC + key);
        else this.inner.write(ENC + key, await encryptText(k, JSON.stringify(value)));
        this.persistListeners.forEach((l) => l());
      } catch { this.failedPersist = true; this.version++; this.listeners.forEach((l) => l()); }
    });
  }
  /** Called after each encrypted write reaches storage. Used to keep the optional folder copy up to date. */
  onPersisted(cb: () => void): () => void { this.persistListeners.add(cb); return () => { this.persistListeners.delete(cb); }; }

  /** The encrypted form of everything stored (ciphertext and the lock's salt and check value). Never plain data. Null when encryption is off. */
  snapshot(): Record<string, unknown> | null {
    if (this.state === 'off') return null;
    const out: Record<string, unknown> = {};
    for (const k of this.inner.keys()) if (k === 'vault' || k.startsWith(ENC)) out[k] = this.inner.read(k);
    return out;
  }

  /** Put a snapshot back into a fresh app. Replaces whatever is stored now. The app then asks for the passphrase. */
  restore(entries: Record<string, unknown>): void {
    if (this.state !== 'off') throw new Error('Restore only works in an app with encryption off.');
    for (const k of this.inner.keys()) this.inner.remove(k);
    for (const [k, v] of Object.entries(entries)) {
      if (k === 'vault') { const { bio: _bio, ...rest } = v as VaultMeta; void _bio; this.inner.write(k, rest); } else this.inner.write(k, v);
    }
    this.mem = new Map(); this.key = null;
    this.setState('locked');
  }

  /** Resolves once every queued write has reached storage. */
  flush(): Promise<void> { return this.chain; }

  // ----- lifecycle -----
  async enable(passphrase: string): Promise<void> {
    if (this.state !== 'off') throw new Error('Encryption is already on.');
    const salt = randomBytes(16);
    const key = await deriveKey(passphrase, salt, this.iterations);
    const meta: VaultMeta = { v: 1, salt: b64(salt), iterations: this.iterations, check: await encryptText(key, CHECK_TEXT) };
    const plainKeys = this.inner.keys().filter((k) => k !== 'vault' && !k.startsWith(ENC));
    const values = new Map<string, unknown>();
    for (const k of plainKeys) values.set(k, this.inner.read(k));
    // Write every encrypted copy first; only then remove plaintext, so a failure never loses data.
    for (const [k, v] of values) this.inner.write(ENC + k, await encryptText(key, JSON.stringify(v)));
    this.inner.write('vault', meta);
    for (const k of plainKeys) this.inner.remove(k);
    this.mem = values; this.key = key;
    this.setState('unlocked');
  }

  async unlock(passphrase: string): Promise<void> {
    const meta = this.inner.read('vault') as VaultMeta | undefined;
    if (!meta) throw new CryptoError('No encrypted data found.', 'corrupt');
    const key = await deriveKey(passphrase, unb64(meta.salt), meta.iterations);
    await this.load(key, meta);
  }

  // ----- fingerprint unlock -----
  get bio(): BioMeta | undefined { return (this.inner.read('vault') as VaultMeta | undefined)?.bio; }

  /** Turn on fingerprint unlock. Needs the passphrase once, to prove it is you and to get the data key to wrap. */
  async addBiometric(passphrase: string, wrapKey: CryptoKey, cred: string, salt: string): Promise<void> {
    const meta = this.inner.read('vault') as VaultMeta | undefined;
    if (!meta || this.state !== 'unlocked') throw new Error('Unlock first.');
    const exportable = await deriveKey(passphrase, unb64(meta.salt), meta.iterations, true);
    if ((await decryptText(exportable, meta.check)) !== CHECK_TEXT) throw new CryptoError('Wrong passphrase.', 'wrong-passphrase');
    const raw = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', exportable));
    const wrapped = await encryptText(wrapKey, b64(raw));
    raw.fill(0);
    this.inner.write('vault', { ...meta, bio: { cred, salt, wrapped } });
    this.version++; this.listeners.forEach((l) => l());
  }

  removeBiometric(): void {
    const meta = this.inner.read('vault') as VaultMeta | undefined;
    if (!meta?.bio) return;
    const { bio: _bio, ...rest } = meta; void _bio;
    this.inner.write('vault', rest);
    this.version++; this.listeners.forEach((l) => l());
  }

  /** Unlock with the key produced after a fingerprint. A wrong or missing key fails the same way a wrong passphrase does. */
  async unlockWithBiometric(wrapKey: CryptoKey): Promise<void> {
    const meta = this.inner.read('vault') as VaultMeta | undefined;
    if (!meta?.bio) throw new CryptoError('Fingerprint unlock is not set up.', 'corrupt');
    const raw = unb64(await decryptText(wrapKey, meta.bio.wrapped));
    const key = await globalThis.crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    raw.fill(0);
    await this.load(key, meta);
  }

  private async load(key: CryptoKey, meta: VaultMeta): Promise<void> {
    if ((await decryptText(key, meta.check)) !== CHECK_TEXT) throw new CryptoError('Wrong passphrase.', 'wrong-passphrase');
    const next = new Map<string, unknown>();
    for (const full of this.inner.keys()) {
      if (!full.startsWith(ENC)) continue;
      const raw = this.inner.read(full);
      if (typeof raw !== 'string') continue;
      next.set(full.slice(ENC.length), JSON.parse(await decryptText(key, raw)));
    }
    this.mem = next; this.key = key;
    this.setState('unlocked');
  }

  async lock(): Promise<void> {
    if (this.state !== 'unlocked') return;
    await this.flush();
    this.key = null; this.mem = new Map();
    this.setState('locked');
  }

  /** Turn encryption off and put plain data back. Must be unlocked. */
  async disable(): Promise<void> {
    if (this.state !== 'unlocked') throw new Error('Unlock first.');
    await this.flush();
    for (const [k, v] of this.mem) this.inner.write(k, v);
    for (const k of this.inner.keys()) if (k.startsWith(ENC) || k === 'vault') this.inner.remove(k);
    this.mem = new Map(); this.key = null;
    this.setState('off');
  }

  /** Wipe all stored data (used when the passphrase is lost, or on a full erase). */
  destroy(): void {
    for (const k of this.inner.keys()) this.inner.remove(k);
    this.mem = new Map(); this.key = null;
    this.setState('off');
  }

  // ----- used for file contents -----
  encryptFileText(text: string): Promise<string> {
    if (!this.key) throw new CryptoError('Locked.', 'wrong-passphrase');
    return encryptText(this.key, text);
  }
  decryptFileText(payload: string): Promise<string> {
    if (!this.key) throw new CryptoError('Locked.', 'wrong-passphrase');
    return decryptText(this.key, payload);
  }
}
