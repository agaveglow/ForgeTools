/**
 * Printer guides library storage. Manuals are the user's own PDFs. They live in this browser's
 * IndexedDB only: never uploaded, never put in the repo. Page text is extracted once so search is instant.
 */
import { uid, nowIso } from './util';
import { openPdf, pageText } from './pdfjs';
import type { PdfDoc } from './pdfjs';
import { searchPages } from './manualSearch';
import type { PageHit } from './manualSearch';

export interface ManualMeta { id: string; title: string; fileName: string; size: number; pages: number; brand: string; added: string; indexed: number }
export interface ManualMark { id: string; manualId: string; page: number; label: string; added: string }

const DB = 'forgetools-manuals';
let dbp: Promise<IDBDatabase> | null = null;
const db = (): Promise<IDBDatabase> => (dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => {
    const d = r.result;
    d.createObjectStore('meta', { keyPath: 'id' });
    d.createObjectStore('blobs');
    d.createObjectStore('text');
    d.createObjectStore('marks', { keyPath: 'id' });
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => { dbp = null; rej(r.error); };
}));

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then((d) => new Promise<T | undefined>((res, rej) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req ? (req.result as T) : undefined);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  }));
}

const textKey = (id: string, page: number) => `${id}:${String(page).padStart(5, '0')}`;

export async function listManuals(): Promise<ManualMeta[]> {
  const all = ((await run<ManualMeta[]>('meta', 'readonly', (s) => s.getAll())) ?? []) as ManualMeta[];
  return all.sort((a, b) => a.title.localeCompare(b.title));
}
export const getManual = async (id: string): Promise<ManualMeta | undefined> => (await run<ManualMeta>('meta', 'readonly', (s) => s.get(id))) as ManualMeta | undefined;
export const putMeta = async (m: ManualMeta): Promise<void> => { await run('meta', 'readwrite', (s) => s.put(m)); };
export const getBlob = async (id: string): Promise<Blob | undefined> => (await run<Blob>('blobs', 'readonly', (s) => s.get(id))) as Blob | undefined;

export class ManualError extends Error {}
export const MAX_MANUAL_BYTES = 600 * 1024 * 1024;

const titleFromName = (n: string) => n.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Manual';

export async function addManual(file: File, brand: string): Promise<ManualMeta> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw new ManualError('That is not a PDF file.');
  if (file.size > MAX_MANUAL_BYTES) throw new ManualError('That file is over 600 MB, which is too big to keep on a device.');
  let doc: PdfDoc;
  try { doc = await openPdf(file); } catch { throw new ManualError('That PDF could not be opened. It may be damaged or password protected.'); }
  const meta: ManualMeta = { id: uid(), title: titleFromName(file.name), fileName: file.name, size: file.size, pages: doc.numPages, brand, added: nowIso(), indexed: 0 };
  await doc.destroy();
  try {
    await run('blobs', 'readwrite', (s) => s.put(file, meta.id));
  } catch {
    throw new ManualError('There is not enough space on this device to keep that manual.');
  }
  await putMeta(meta);
  return meta;
}

export async function removeManual(id: string): Promise<void> {
  await run('meta', 'readwrite', (s) => s.delete(id));
  await run('blobs', 'readwrite', (s) => s.delete(id));
  await run('text', 'readwrite', (s) => s.delete(IDBKeyRange.bound(`${id}:`, `${id}:￿`)));
  const marks = await listMarks(id);
  for (const m of marks) await removeMark(m.id);
}

/** Reads page text in the background so search works. Resumes where it stopped. */
export async function indexManual(id: string, onProgress: (done: number, total: number) => void, signal: { stop: boolean }): Promise<void> {
  const meta = await getManual(id);
  const blob = await getBlob(id);
  if (!meta || !blob || meta.indexed >= meta.pages) return;
  const doc = await openPdf(blob);
  try {
    let batch: Array<[string, { page: number; text: string }]> = [];
    const flush = async (upTo: number) => {
      if (batch.length) { const b = batch; batch = []; await run('text', 'readwrite', (s) => { for (const [k, v] of b) s.put(v, k); }); }
      meta.indexed = upTo; await putMeta(meta);
    };
    for (let p = meta.indexed + 1; p <= meta.pages; p++) {
      if (signal.stop) { await flush(p - 1); return; }
      let text = '';
      try { const pg = await doc.getPage(p); text = await pageText(pg); pg.cleanup(); } catch { /* unreadable page: leave blank */ }
      batch.push([textKey(id, p), { page: p, text }]);
      if (p % 20 === 0 || p === meta.pages) { await flush(p); onProgress(p, meta.pages); await new Promise((r) => setTimeout(r, 0)); }
    }
  } finally { await doc.destroy(); }
}

async function pagesOf(id: string): Promise<Array<{ page: number; text: string }>> {
  return ((await run<Array<{ page: number; text: string }>>('text', 'readonly', (s) => s.getAll(IDBKeyRange.bound(`${id}:`, `${id}:￿`)))) ?? []) as Array<{ page: number; text: string }>;
}
export async function searchManual(id: string, query: string): Promise<PageHit[]> { return searchPages(await pagesOf(id), query); }
export async function getPageText(id: string, page: number): Promise<string> {
  const v = (await run<{ text: string }>('text', 'readonly', (s) => s.get(textKey(id, page)))) as { text: string } | undefined;
  return v?.text ?? '';
}
export async function searchAll(query: string): Promise<Array<PageHit & { manual: ManualMeta }>> {
  const out: Array<PageHit & { manual: ManualMeta }> = [];
  for (const m of await listManuals()) for (const h of searchPages(await pagesOf(m.id), query, 6)) out.push({ ...h, manual: m });
  return out.sort((a, b) => b.score - a.score).slice(0, 40);
}

export const listMarks = async (manualId?: string): Promise<ManualMark[]> => {
  const all = ((await run<ManualMark[]>('marks', 'readonly', (s) => s.getAll())) ?? []) as ManualMark[];
  return all.filter((m) => !manualId || m.manualId === manualId).sort((a, b) => a.page - b.page);
};
export const addMark = async (manualId: string, page: number, label: string): Promise<void> => { await run('marks', 'readwrite', (s) => s.put({ id: uid(), manualId, page, label: label.trim().slice(0, 100), added: nowIso() } satisfies ManualMark)); };
export const removeMark = async (id: string): Promise<void> => { await run('marks', 'readwrite', (s) => s.delete(id)); };

export async function askPersistent(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
