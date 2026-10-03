/**
 * File storage for things the app creates: guides, transcripts, backups, saved web pages.
 *
 * On a phone running the Capacitor app these are real files in the app's private storage
 * (Filesystem plugin, Directory.Data): they survive clearing the web cache, stay out of the photo
 * gallery and other apps, and can be shared out. In a browser they are kept in IndexedDB.
 * The plugin is reached through window.Capacitor, so the web build needs no extra dependency.
 */

export interface StoredFile {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
}

export interface FileStorage {
  kind: 'native' | 'browser' | 'memory';
  write(path: string, content: string): Promise<void>;
  read(path: string): Promise<string | null>;
  list(): Promise<StoredFile[]>;
  remove(path: string): Promise<void>;
}

export const FILE_DIRS = ['guides', 'transcripts', 'backups', 'web'] as const;
export type FileDir = (typeof FILE_DIRS)[number];

// ---------- memory (tests, and last-resort fallback) ----------

export class MemoryFiles implements FileStorage {
  kind = 'memory' as const;
  private m = new Map<string, { content: string; modifiedAt: string }>();
  async write(path: string, content: string) { this.m.set(path, { content, modifiedAt: new Date().toISOString() }); }
  async read(path: string) { return this.m.get(path)?.content ?? null; }
  async list() { return [...this.m.entries()].map(([path, v]) => ({ path, name: path.split('/').pop() ?? path, size: v.content.length, modifiedAt: v.modifiedAt })); }
  async remove(path: string) { this.m.delete(path); }
}

// ---------- IndexedDB ----------

export class IndexedDbFiles implements FileStorage {
  kind = 'browser' as const;
  private dbp: Promise<IDBDatabase> | null = null;
  private db(): Promise<IDBDatabase> {
    if (!this.dbp) {
      this.dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open('forgetools-files', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files', { keyPath: 'path' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbp;
  }
  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const req = fn(db.transaction('files', mode).objectStore('files'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async write(path: string, content: string) { await this.tx('readwrite', (s) => s.put({ path, content, modifiedAt: new Date().toISOString() })); }
  async read(path: string) { const r = await this.tx<{ content: string } | undefined>('readonly', (s) => s.get(path)); return r?.content ?? null; }
  async list() {
    const all = await this.tx<Array<{ path: string; content: string; modifiedAt: string }>>('readonly', (s) => s.getAll());
    return all.map((r) => ({ path: r.path, name: r.path.split('/').pop() ?? r.path, size: r.content.length, modifiedAt: r.modifiedAt }));
  }
  async remove(path: string) { await this.tx('readwrite', (s) => s.delete(path)); }
}

// ---------- Capacitor Filesystem ----------

interface FsPlugin {
  writeFile(o: { path: string; data: string; directory: string; encoding: string; recursive: boolean }): Promise<unknown>;
  readFile(o: { path: string; directory: string; encoding: string }): Promise<{ data: string | Blob }>;
  readdir(o: { path: string; directory: string }): Promise<{ files: Array<string | { name: string; type?: string; size?: number; mtime?: number }> }>;
  deleteFile(o: { path: string; directory: string }): Promise<unknown>;
  stat?(o: { path: string; directory: string }): Promise<{ size: number; mtime: number }>;
}

export class NativeFiles implements FileStorage {
  kind = 'native' as const;
  /** Capacitor's Directory.Data: app-private storage. */
  static DIR = 'DATA';
  constructor(private fs: FsPlugin) {}
  async write(path: string, content: string) {
    await this.fs.writeFile({ path, data: content, directory: NativeFiles.DIR, encoding: 'utf8', recursive: true });
  }
  async read(path: string) {
    try {
      const r = await this.fs.readFile({ path, directory: NativeFiles.DIR, encoding: 'utf8' });
      return typeof r.data === 'string' ? r.data : await (r.data as Blob).text();
    } catch { return null; }
  }
  async list() {
    const out: StoredFile[] = [];
    for (const dir of FILE_DIRS) {
      let res: Awaited<ReturnType<FsPlugin['readdir']>>;
      try { res = await this.fs.readdir({ path: dir, directory: NativeFiles.DIR }); } catch { continue; }
      for (const f of res.files) {
        const name = typeof f === 'string' ? f : f.name;
        const info = typeof f === 'string' ? undefined : f;
        let size = info?.size ?? 0;
        let mtime = info?.mtime ?? 0;
        if (!mtime && this.fs.stat) { try { const s = await this.fs.stat({ path: `${dir}/${name}`, directory: NativeFiles.DIR }); size = s.size; mtime = s.mtime; } catch { /* keep zero */ } }
        out.push({ path: `${dir}/${name}`, name, size, modifiedAt: mtime ? new Date(mtime).toISOString() : '' });
      }
    }
    return out;
  }
  async remove(path: string) { await this.fs.deleteFile({ path, directory: NativeFiles.DIR }); }
}

// ---------- selection ----------

interface CapacitorGlobal { isNativePlatform?: () => boolean; Plugins?: { Filesystem?: FsPlugin; Share?: { share(o: Record<string, unknown>): Promise<unknown> } } }
const cap = (): CapacitorGlobal | undefined => (typeof window !== 'undefined' ? (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor : undefined);

export const isNativeApp = (): boolean => !!cap()?.isNativePlatform?.();

// ---------- optional encryption of file contents ----------
// File names (which include the guide title) stay readable; only the contents are encrypted.

export interface FileCipher {
  state(): 'off' | 'locked' | 'unlocked';
  encrypt(text: string): Promise<string>;
  decrypt(payload: string): Promise<string>;
}
let cipher: FileCipher | null = null;
export const setFileCipher = (c: FileCipher | null) => { cipher = c; };
const isEnc = (s: string) => s.startsWith('ft1.');

export class EncryptingFiles implements FileStorage {
  constructor(private base: FileStorage) {}
  get kind() { return this.base.kind; }
  async write(path: string, content: string) {
    const st = cipher?.state() ?? 'off';
    if (st === 'locked') throw new Error('The app is locked.');
    await this.base.write(path, st === 'unlocked' && cipher ? await cipher.encrypt(content) : content);
  }
  async read(path: string) {
    const raw = await this.base.read(path);
    if (raw === null || !isEnc(raw)) return raw;
    if (cipher?.state() !== 'unlocked') return null;
    try { return await cipher.decrypt(raw); } catch { return null; }
  }
  list() { return this.base.list(); }
  remove(path: string) { return this.base.remove(path); }
  /** Re-write every file encrypted or plain, to match turning encryption on or off. Run while unlocked. */
  async migrate(mode: 'encrypt' | 'decrypt'): Promise<void> {
    if (!cipher) return;
    for (const f of await this.base.list()) {
      const raw = await this.base.read(f.path);
      if (raw === null) continue;
      if (mode === 'encrypt' && !isEnc(raw)) await this.base.write(f.path, await cipher.encrypt(raw));
      if (mode === 'decrypt' && isEnc(raw)) await this.base.write(f.path, await cipher.decrypt(raw));
    }
  }
  async removeAll(): Promise<void> { for (const f of await this.base.list()) await this.base.remove(f.path); }
}

export function createFileStorage(): FileStorage {
  const c = cap();
  if (c?.isNativePlatform?.() && c.Plugins?.Filesystem) return new EncryptingFiles(new NativeFiles(c.Plugins.Filesystem));
  if (typeof indexedDB !== 'undefined') return new EncryptingFiles(new IndexedDbFiles());
  return new EncryptingFiles(new MemoryFiles());
}

export async function wipeFiles(): Promise<void> {
  const f = files();
  if (f instanceof EncryptingFiles) await f.removeAll(); else for (const x of await f.list()) await f.remove(x.path);
  notifyFilesChanged();
}
export async function migrateFiles(mode: 'encrypt' | 'decrypt'): Promise<void> {
  const f = files();
  if (f instanceof EncryptingFiles) await f.migrate(mode);
}

/** Share a stored file with another app on the phone (native only). Returns false if it can't. */
export async function shareStoredFile(path: string, title: string): Promise<boolean> {
  const c = cap();
  const share = c?.Plugins?.Share;
  const fs = c?.Plugins?.Filesystem as (FsPlugin & { getUri?: (o: { path: string; directory: string }) => Promise<{ uri: string }> }) | undefined;
  if (!c?.isNativePlatform?.() || !share || !fs?.getUri) return false;
  try {
    const { uri } = await fs.getUri({ path, directory: NativeFiles.DIR });
    await share.share({ title, url: uri });
    return true;
  } catch { return false; }
}

// ---------- naming ----------

export function slugify(s: string, max = 60): string {
  const t = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
  return t || 'untitled';
}

export async function uniquePath(fs: FileStorage, dir: FileDir, title: string, ext: string, now = new Date()): Promise<string> {
  const base = `${dir}/${now.toISOString().slice(0, 10)}-${slugify(title)}`;
  const existing = new Set((await fs.list()).map((f) => f.path));
  let p = `${base}.${ext}`;
  for (let i = 2; existing.has(p); i++) p = `${base}-${i}.${ext}`;
  return p;
}

// ---------- app-wide instance ----------

let instance: FileStorage | null = null;
const listeners = new Set<() => void>();
export const files = (): FileStorage => (instance ??= createFileStorage());
export const setFileStorage = (f: FileStorage) => { instance = f; listeners.forEach((l) => l()); };
export const subscribeFiles = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const notifyFilesChanged = () => listeners.forEach((l) => l());

/** Save a created document as a file and return its path. */
export async function saveCreatedFile(dir: FileDir, title: string, ext: string, content: string): Promise<string> {
  const fs = files();
  const path = await uniquePath(fs, dir, title, ext);
  await fs.write(path, content);
  notifyFilesChanged();
  return path;
}
