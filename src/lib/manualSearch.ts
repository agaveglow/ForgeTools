/** Pure helpers for searching page text of a manual. No storage or PDF code here, so they are easy to test. */

export interface PageText { page: number; text: string }
export interface PageHit { page: number; score: number; snippet: string }

const words = (q: string): string[] => q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 || /\d/.test(w));

export function snippetAround(text: string, terms: string[], width = 70): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const low = flat.toLowerCase();
  let at = -1;
  for (const t of terms) { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return flat.slice(0, width * 2);
  const from = Math.max(0, at - width), to = Math.min(flat.length, at + width);
  return (from > 0 ? '…' : '') + flat.slice(from, to) + (to < flat.length ? '…' : '');
}

/** Pages containing every word of the query, best first. Exact phrase and repeated hits score higher. */
export function searchPages(pages: PageText[], query: string, limit = 40): PageHit[] {
  const terms = words(query);
  if (!terms.length) return [];
  const phrase = query.trim().toLowerCase();
  const hits: PageHit[] = [];
  for (const p of pages) {
    const low = p.text.toLowerCase();
    let score = 0, ok = true;
    for (const t of terms) { const n = low.split(t).length - 1; if (!n) { ok = false; break; } score += Math.min(n, 5); }
    if (!ok) continue;
    if (terms.length > 1 && low.includes(phrase)) score += 10;
    hits.push({ page: p.page, score, snippet: snippetAround(p.text, terms) });
  }
  hits.sort((a, b) => b.score - a.score || a.page - b.page);
  return hits.slice(0, limit);
}

export const formatBytes = (n: number): string => (n >= 1048576 ? `${(n / 1048576).toFixed(n >= 10485760 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const BRANDS = ['Ricoh', 'Develop', 'UTAX', 'Sharp', 'Epson', 'Apprenticeship', 'Other'] as const;
export const guessBrand = (name: string): string => {
  const n = name.toLowerCase();
  if (/epson|wf-?\d|workforce/.test(n)) return 'Epson';
  if (/ricoh/.test(n)) return 'Ricoh';
  if (/ineo|develop|bizhub/.test(n)) return 'Develop';
  if (/utax|triumph|ih_|\d{4}ci/.test(n)) return 'UTAX';
  if (/sharp|mx-/.test(n)) return 'Sharp';
  if (/off.?the.?job|aptem|harvard|referenc|apprentic|activity.?log/.test(n)) return 'Apprenticeship';
  return 'Other';
};
