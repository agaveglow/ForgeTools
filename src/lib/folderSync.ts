/**
 * Optional encrypted copy of your data in a folder you choose on the phone (phone app only).
 * What is written is exactly what is already stored on the device: ciphertext plus the lock's salt and check value.
 * It is never written while encryption is off, and the passphrase is never written anywhere.
 * To restore, a fresh app reads the file back and then asks for the same passphrase.
 */
import type { VaultAdapter } from '../data/vault';

export const MIRROR_FILE = 'forgetools-data.json';
export const MIRROR_PREV = 'forgetools-data-prev.json';
const MAX_ENTRIES = 600;
const MAX_CHARS = 30_000_000;

export interface FolderPlugin {
  pickFolder(): Promise<{ name: string }>;
  folderName(): Promise<{ name: string | null }>;
  writeFile(o: { name: string; data: string }): Promise<void>;
  readFile(o: { name: string }): Promise<{ data: string | null }>;
  forget(): Promise<void>;
}
interface CapGlobal { isNativePlatform?: () => boolean; registerPlugin?: (name: string) => unknown; Plugins?: Record<string, unknown> }

let cached: FolderPlugin | undefined;
/** The native folder plugin, or undefined when this is not the phone app. */
export function folderPlugin(): FolderPlugin | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { Capacitor?: CapGlobal; __ftFolder?: FolderPlugin };
  // A stand-in used only by the automated tests, and only on localhost.
  if (w.__ftFolder && window.location.hostname === 'localhost') return w.__ftFolder;
  const cap = w.Capacitor;
  if (!cap?.isNativePlatform?.()) return undefined;
  if (!cached) cached = (cap.registerPlugin ? cap.registerPlugin('FolderSync') : cap.Plugins?.FolderSync) as FolderPlugin | undefined;
  return cached;
}

export interface Mirror { app: 'forgetools-mirror'; v: 1; savedAt: string; entries: Record<string, unknown> }

export function buildMirror(entries: Record<string, unknown>, now = new Date()): string {
  return JSON.stringify({ app: 'forgetools-mirror', v: 1, savedAt: now.toISOString(), entries } satisfies Mirror);
}

const KEY_OK = /^(?:vault|enc\.[A-Za-z0-9_.:-]{1,80})$/;
/** Reads and checks a copy from the folder before anything is restored from it. */
export function parseMirror(text: string): { ok: true; savedAt: string; entries: Record<string, unknown> } | { ok: false; error: string } {
  if (text.length > MAX_CHARS) return { ok: false, error: 'That file is too large to be a ForgeTools copy.' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'That file could not be read as a ForgeTools copy.' }; }
  const m = raw as Partial<Mirror> | null;
  if (!m || m.app !== 'forgetools-mirror' || m.v !== 1 || typeof m.savedAt !== 'string' || !m.entries || typeof m.entries !== 'object' || Array.isArray(m.entries)) return { ok: false, error: 'That is not a ForgeTools copy.' };
  const keys = Object.keys(m.entries);
  if (keys.length > MAX_ENTRIES) return { ok: false, error: 'That copy has too many items.' };
  const entries: Record<string, unknown> = {};
  for (const k of keys) {
    if (!KEY_OK.test(k)) return { ok: false, error: 'That copy contains something unexpected, so it was not used.' };
    const v = (m.entries as Record<string, unknown>)[k];
    if (k === 'vault') {
      const meta = v as { v?: unknown; salt?: unknown; iterations?: unknown; check?: unknown } | null;
      if (!meta || meta.v !== 1 || typeof meta.salt !== 'string' || typeof meta.check !== 'string' || !Number.isInteger(meta.iterations) || (meta.iterations as number) < 1000 || (meta.iterations as number) > 5_000_000) return { ok: false, error: 'The lock details in that copy are not valid.' };
    } else if (typeof v !== 'string' || !v.startsWith('ft1.')) return { ok: false, error: 'That copy holds data that is not encrypted, so it was not used.' };
    entries[k] = v;
  }
  if (!('vault' in entries)) return { ok: false, error: 'That copy has no lock details, so it cannot be opened.' };
  return { ok: true, savedAt: m.savedAt, entries };
}

// ---------- saving ----------
export interface SyncStatus { ok: boolean; at: string; error?: string }
let status: SyncStatus | undefined;
const listeners = new Set<() => void>();
const LAST_KEY = 'forgetools:folderStatus';
const DAY_KEY = 'forgetools:folderDay';
export const syncStatus = (): SyncStatus | undefined => {
  if (status) return status;
  try { const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as SyncStatus | null; if (v && typeof v.at === 'string') status = v; } catch { /* none */ }
  return status;
};
export const onSyncStatus = (cb: () => void): (() => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
function setStatus(s: SyncStatus) { status = s; try { localStorage.setItem(LAST_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } listeners.forEach((l) => l()); }

let running: Promise<void> | undefined;
/** Writes the encrypted copy now. Once a day the previous copy is kept as a second file. */
export function syncNow(vault: VaultAdapter, plugin: FolderPlugin): Promise<void> {
  running = (running ?? Promise.resolve()).then(async () => {
    try {
      if (vault.state !== 'unlocked') return;
      await vault.flush();
      const snap = vault.snapshot();
      if (!snap) return;
      const today = new Date().toISOString().slice(0, 10);
      let lastDay: string | null = null;
      try { lastDay = localStorage.getItem(DAY_KEY); } catch { /* none */ }
      if (lastDay !== today) {
        const old = await plugin.readFile({ name: MIRROR_FILE });
        if (old.data) await plugin.writeFile({ name: MIRROR_PREV, data: old.data });
      }
      await plugin.writeFile({ name: MIRROR_FILE, data: buildMirror(snap) });
      try { localStorage.setItem(DAY_KEY, today); } catch { /* none */ }
      setStatus({ ok: true, at: new Date().toISOString() });
    } catch (e) {
      const m = (e as { message?: string })?.message;
      setStatus({ ok: false, at: new Date().toISOString(), error: m === 'no-folder' ? 'The folder is no longer available. Choose it again.' : 'Could not save to the folder. Check it still exists and has space.' });
    }
  });
  return running;
}
