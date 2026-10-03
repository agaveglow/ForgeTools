/**
 * Storage adapter boundary.
 *
 * The app talks to `Store` (store.ts), and `Store` persists through a StorageAdapter.
 * Today the adapter is localStorage, scoped by an account id ("local"). To add a real
 * backend later, implement StorageAdapter against an API (or Capacitor SQLite/Preferences)
 * and pass it to `createStore`. Because the Store keeps an in-memory copy and notifies
 * subscribers, an async backend can sync in the background without changing any UI code.
 *
 *   Account
 *     ├── workLogs / skillRatings / sessions / checklistRuns / kbEntries / usage
 *     ├── settings
 *     └── meta
 */

export interface StorageAdapter {
  /** Returns undefined when nothing has been stored under the key. */
  read(key: string): unknown | undefined;
  write(key: string, value: unknown): void;
  remove(key: string): void;
  /** All keys belonging to this account (used for reset/export). */
  keys(): string[];
}

export const STORAGE_PREFIX = 'forgetools:v1';

function isStorageAvailable(): boolean {
  try {
    const k = '__forgetools_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** localStorage-backed adapter, namespaced per account. Falls back to memory if storage is blocked. */
export class LocalStorageAdapter implements StorageAdapter {
  private fallback = new Map<string, string>();
  private usable: boolean;
  readonly accountId: string;

  constructor(accountId = 'local') {
    this.accountId = accountId;
    this.usable = typeof window !== 'undefined' && isStorageAvailable();
  }

  get persistent(): boolean {
    return this.usable;
  }

  private k(key: string): string {
    return `${STORAGE_PREFIX}:${this.accountId}:${key}`;
  }

  read(key: string): unknown | undefined {
    const raw = this.usable ? window.localStorage.getItem(this.k(key)) : this.fallback.get(this.k(key));
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  write(key: string, value: unknown): void {
    const raw = JSON.stringify(value);
    if (this.usable) {
      try {
        window.localStorage.setItem(this.k(key), raw);
        return;
      } catch {
        // Quota exceeded or storage disabled mid-session: keep working in memory, surface via `persistent`.
        this.usable = false;
      }
    }
    this.fallback.set(this.k(key), raw);
  }

  remove(key: string): void {
    if (this.usable) window.localStorage.removeItem(this.k(key));
    this.fallback.delete(this.k(key));
  }

  keys(): string[] {
    const prefix = `${STORAGE_PREFIX}:${this.accountId}:`;
    const out: string[] = [];
    if (this.usable) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
      }
    }
    for (const k of this.fallback.keys()) if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
    return [...new Set(out)];
  }
}

/** In-memory adapter for tests. */
export class MemoryAdapter implements StorageAdapter {
  private m = new Map<string, string>();
  read(key: string) {
    const raw = this.m.get(key);
    return raw == null ? undefined : JSON.parse(raw);
  }
  write(key: string, value: unknown) {
    this.m.set(key, JSON.stringify(value));
  }
  remove(key: string) {
    this.m.delete(key);
  }
  keys() {
    return [...this.m.keys()];
  }
}
