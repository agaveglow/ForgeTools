import { COLLECTIONS, SCHEMA_VERSION } from './types';
import type { BaseRecord, CollectionMap, CollectionName, Meta, Settings, UsageKind } from './types';
import { LocalStorageAdapter } from './storage';
import type { StorageAdapter } from './storage';
import { nowIso, uid } from '../lib/util';

export const DEFAULT_SETTINGS: Settings = { theme: 'system', logMode: 'auto' };

export interface ExportFile {
  app: 'forgetools';
  schemaVersion: number;
  exportedAt: string;
  data: {
    collections: { [K in CollectionName]: CollectionMap[K][] };
    settings: Settings;
    meta: Meta;
  };
}

type Cols = { [K in CollectionName]: CollectionMap[K][] };

const USAGE_CAP = 300;

/**
 * In-memory, subscribable data store backed by a StorageAdapter.
 * Every mutation replaces the affected collection array (immutable updates), so React
 * hooks can rely on array identity.
 */
export class Store {
  private cols!: Cols;
  private settings!: Settings;
  private meta!: Meta;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(
    private adapter: StorageAdapter,
    _opts: { seed?: boolean } = {},
  ) {
    this.load();
    this.purgeDemo();
  }

  /** Re-read everything from the adapter (after unlock/lock). */
  reload(): void {
    this.load();
    this.purgeDemo();
    this.emit();
  }

  // ----- subscription -----
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getVersion = (): number => this.version;
  private emit(): void {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  get persistent(): boolean {
    return (this.adapter as { persistent?: boolean }).persistent ?? true;
  }

  // ----- loading -----
  private load(): void {
    const cols = {} as Cols;
    for (const name of COLLECTIONS) {
      const raw = this.adapter.read(name);
      (cols as Record<string, unknown>)[name] = Array.isArray(raw) ? raw : [];
    }
    this.cols = cols;
    const s = this.adapter.read('settings') as Partial<Settings> | undefined;
    this.settings = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
    const m = this.adapter.read('meta') as Partial<Meta> | undefined;
    this.meta = {
      schemaVersion: m?.schemaVersion ?? SCHEMA_VERSION,
      seededAt: m?.seededAt,
      counters: { workLog: m?.counters?.workLog ?? 0 },
    };
  }

  private persist(name: CollectionName): void {
    this.adapter.write(name, this.cols[name]);
  }
  private persistMeta(): void {
    this.adapter.write('meta', this.meta);
  }

  /** Sample data is no longer shipped. Remove any left over from earlier versions. */
  private purgeDemo(): void {
    let changed = false;
    for (const name of COLLECTIONS) {
      const list = this.cols[name] as BaseRecord[];
      if (list.some((r) => r.demo)) { (this.cols as Record<string, unknown>)[name] = list.filter((r) => !r.demo); this.persist(name); changed = true; }
    }
    if (changed || !this.meta.seededAt) { this.meta.seededAt = this.meta.seededAt ?? nowIso(); this.persistMeta(); }
  }

  // ----- reads -----
  list<K extends CollectionName>(name: K): CollectionMap[K][] {
    return this.cols[name];
  }
  get<K extends CollectionName>(name: K, id: string): CollectionMap[K] | undefined {
    return (this.cols[name] as BaseRecord[]).find((r) => r.id === id) as CollectionMap[K] | undefined;
  }
  getSettings(): Settings {
    return this.settings;
  }
  getMeta(): Meta {
    return this.meta;
  }

  // ----- writes -----
  /** Insert or update. Pass a partial for new records with required fields filled by the caller. */
  upsert<K extends CollectionName>(name: K, rec: Omit<CollectionMap[K], 'id' | 'createdAt' | 'updatedAt'> & Partial<BaseRecord>): CollectionMap[K] {
    const now = nowIso();
    const list = this.cols[name] as BaseRecord[];
    const existing = rec.id ? list.find((r) => r.id === rec.id) : undefined;
    const next = {
      ...(existing ?? {}),
      ...rec,
      id: existing?.id ?? rec.id ?? uid(),
      createdAt: existing?.createdAt ?? rec.createdAt ?? now,
      updatedAt: now,
    } as unknown as CollectionMap[K];
    // Editing a demo record keeps it flagged as demo only if the caller leaves it so; user-created records are never demo.
    const nextList = existing ? list.map((r) => (r.id === existing.id ? (next as BaseRecord) : r)) : [...list, next as BaseRecord];
    (this.cols as Record<string, unknown>)[name] = nextList;
    this.persist(name);
    this.emit();
    return next;
  }

  remove(name: CollectionName, id: string): void {
    const list = this.cols[name] as BaseRecord[];
    if (!list.some((r) => r.id === id)) return;
    (this.cols as Record<string, unknown>)[name] = list.filter((r) => r.id !== id);
    this.persist(name);
    this.emit();
  }

  /** Record that a knowledge-base entry was opened, without changing its updatedAt. */
  markKbUsed(id: string): void {
    const cur = this.cols.kbEntries.find((r) => r.id === id);
    if (!cur) return;
    this.cols.kbEntries = this.cols.kbEntries.map((r) => (r.id === id ? { ...r, lastUsedAt: nowIso() } : r));
    this.persist('kbEntries');
    this.emit();
  }

  nextWorkLogRef(): string {
    this.meta.counters.workLog += 1;
    this.persistMeta();
    const year = new Date().getFullYear();
    return `WL-${year}-${String(this.meta.counters.workLog).padStart(4, '0')}`;
  }

  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.adapter.write('settings', this.settings);
    this.emit();
  }

  trackUsage(kind: UsageKind, refId: string, label: string, route: string): void {
    const list = this.cols.usage;
    const last = list[list.length - 1];
    // Collapse immediate repeats (e.g. React re-mounts).
    if (last && last.refId === refId && last.kind === kind && Date.now() - new Date(last.createdAt).getTime() < 60_000) return;
    const now = nowIso();
    const ev = { id: uid(), createdAt: now, updatedAt: now, kind, refId, label, route };
    this.cols.usage = [...list, ev].slice(-USAGE_CAP);
    this.persist('usage');
    this.emit();
  }

  // ----- data management -----
  /** Erase everything. */
  resetAll(): void {
    for (const name of COLLECTIONS) {
      (this.cols as Record<string, unknown>)[name] = [];
      this.persist(name);
    }
    this.meta = { schemaVersion: SCHEMA_VERSION, counters: { workLog: 0 } };
    this.meta.seededAt = nowIso();
    this.persistMeta();
    this.emit();
  }

  exportAll(): ExportFile {
    const collections = {} as Cols;
    for (const name of COLLECTIONS) {
      const list = this.cols[name] as BaseRecord[];
      (collections as Record<string, unknown>)[name] = list.filter((r) => !r.demo);
    }
    return {
      app: 'forgetools',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      data: { collections, settings: this.settings, meta: this.meta },
    };
  }

  /** Validate and import an export. Merge keeps both sides and lets the newer record win by id. */
  importAll(raw: unknown, mode: 'merge' | 'replace'): { ok: true; added: number } | { ok: false; error: string } {
    const f = raw as Partial<ExportFile> | null;
    if (!f || typeof f !== 'object' || f.app !== 'forgetools') return { ok: false, error: 'This file is not a ForgeTools export.' };
    if (typeof f.schemaVersion !== 'number' || f.schemaVersion > SCHEMA_VERSION)
      return { ok: false, error: 'This export was made by a newer version of ForgeTools.' };
    const cols = f.data?.collections as Partial<Cols> | undefined;
    if (!cols) return { ok: false, error: 'Export file has no data.' };
    for (const name of COLLECTIONS) {
      const v = (cols as Record<string, unknown>)[name];
      if (v !== undefined && !Array.isArray(v)) return { ok: false, error: `Invalid data for "${name}".` };
      if (Array.isArray(v) && v.some((r) => !r || typeof r !== 'object' || typeof (r as BaseRecord).id !== 'string'))
        return { ok: false, error: `Invalid record in "${name}".` };
    }
    let added = 0;
    for (const name of COLLECTIONS) {
      const incoming = ((cols as Record<string, unknown>)[name] as BaseRecord[] | undefined) ?? [];
      const current = mode === 'replace' ? [] : (this.cols[name] as BaseRecord[]);
      const byId = new Map(current.map((r) => [r.id, r]));
      for (const r of incoming.filter((x) => !x.demo)) {
        const ex = byId.get(r.id);
        if (!ex) added++;
        if (!ex || (r.updatedAt ?? '') > (ex.updatedAt ?? '')) byId.set(r.id, r);
      }
      (this.cols as Record<string, unknown>)[name] = [...byId.values()];
      this.persist(name);
    }
    const importedCounter = f.data?.meta?.counters?.workLog ?? 0;
    this.meta.counters.workLog = Math.max(this.meta.counters.workLog, importedCounter);
    if (mode === 'replace') this.meta.seededAt = this.meta.seededAt ?? nowIso();
    this.persistMeta();
    this.emit();
    return { ok: true, added };
  }
}

export function createStore(adapter?: StorageAdapter, opts?: { seed?: boolean }): Store {
  return new Store(adapter ?? new LocalStorageAdapter('local'), opts);
}
