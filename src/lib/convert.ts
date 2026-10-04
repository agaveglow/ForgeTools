/** Text and time converters that run in the page. */
export function toBase64(s: string): string { const b = new TextEncoder().encode(s); let bin = ''; b.forEach((x) => { bin += String.fromCharCode(x); }); return btoa(bin); }
export function fromBase64(s: string): string | null {
  try { const clean = s.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, ''); const bin = atob(clean + '='.repeat((4 - (clean.length % 4)) % 4)); const u = Uint8Array.from(bin, (c) => c.charCodeAt(0)); return new TextDecoder('utf-8', { fatal: true }).decode(u); } catch { return null; }
}
export function toHexText(s: string): string { return [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join(' '); }
export function fromHexText(s: string): string | null {
  const h = s.replace(/0x/gi, '').replace(/[\s,:-]/g, ''); if (!h || h.length % 2 || !/^[0-9a-fA-F]+$/.test(h)) return null;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)))); } catch { return null; }
}
export function urlEncode(s: string): string { return encodeURIComponent(s); }
export function urlDecode(s: string): string | null { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return null; } }

export interface TimeView { iso: string; unixSeconds: number; unixMillis: number; filetime: string; local: string }
const FILETIME_EPOCH_MS = 11644473600000;
export function viewTime(ms: number, tz?: string): TimeView | null {
  if (!Number.isFinite(ms)) return null; const d = new Date(ms); if (Number.isNaN(d.getTime())) return null;
  return { iso: d.toISOString(), unixSeconds: Math.floor(ms / 1000), unixMillis: Math.floor(ms), filetime: ((BigInt(Math.floor(ms)) + BigInt(FILETIME_EPOCH_MS)) * 10000n).toString(), local: d.toLocaleString('en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' }) };
}
/** Accepts unix seconds, unix milliseconds, a Windows FILETIME or an ISO date. */
export function parseTime(input: string): number | null {
  const t = input.trim(); if (!t) return null;
  if (/^-?\d+$/.test(t)) {
    if (t.length >= 17) return Number(BigInt(t) / 10000n - BigInt(FILETIME_EPOCH_MS));
    if (t.length >= 12) return Number(t);
    return Number(t) * 1000;
  }
  const ms = Date.parse(t); return Number.isNaN(ms) ? null : ms;
}
export function macFormats(s: string): string[] | null {
  const h = s.replace(/[^0-9a-fA-F]/g, '').toLowerCase(); if (h.length !== 12 || /[^0-9a-f]/.test(s.replace(/[0-9a-fA-F:.\-\s]/g, ''))) return null;
  const pairs = h.match(/../g)!;
  return [pairs.join(':'), pairs.join('-').toUpperCase(), h.match(/..../g)!.join('.'), h.toUpperCase()];
}
