/** Reads a pasted email header in memory. Nothing is saved or sent. */
export interface Hop { from: string; by: string; date: string }
export interface AuthResult { spf?: string; dkim?: string; dmarc?: string }
export interface HeaderReport {
  fields: Record<string, string>;
  hops: Hop[];
  auth: AuthResult;
  fromDomain?: string; returnDomain?: string; replyDomain?: string; dkimDomains: string[];
  flags: Array<{ level: 'bad' | 'warn' | 'ok'; text: string }>;
}

const unfold = (raw: string): string[] => {
  const lines = raw.replace(/\r/g, '').split('\n'); const out: string[] = [];
  for (const l of lines) { if (/^[ \t]/.test(l) && out.length) out[out.length - 1] += ' ' + l.trim(); else if (l.trim()) out.push(l); }
  return out;
};
const domainOf = (v: string | undefined): string | undefined => { const s = v ?? ''; const a = /<([^>]*)>/.exec(s)?.[1] ?? s; const m = /@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(a); return m?.[1].toLowerCase(); };
const baseDomain = (d: string): string => d.split('.').slice(-2).join('.');
const aligned = (a?: string, b?: string): boolean => !a || !b || a === b || baseDomain(a) === baseDomain(b);
const word = (s: string, key: string): string | undefined => new RegExp(`\\b${key}=(\\w+)`, 'i').exec(s)?.[1].toLowerCase();

export function parseHeader(raw: string): HeaderReport | { error: string } {
  const lines = unfold(raw);
  if (lines.length < 3 || !lines.some((l) => /^[A-Za-z-]+:/.test(l))) return { error: 'That does not look like an email header. Paste the full header, from "Received:" or "From:" down to the blank line.' };
  const fields: Record<string, string> = {}; const hops: Hop[] = []; const dkimDomains: string[] = []; let authText = '';
  for (const l of lines) {
    const m = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/.exec(l); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2];
    if (k === 'received') {
      hops.push({ from: /from\s+(\S+)/i.exec(v)?.[1] ?? '', by: /by\s+(\S+)/i.exec(v)?.[1] ?? '', date: v.split(';').slice(-1)[0].trim() });
    } else if (k === 'authentication-results') authText += ' ' + v;
    else if (k === 'received-spf') { fields['received-spf'] = v; }
    else if (k === 'dkim-signature') { const d = /\bd=([A-Za-z0-9.-]+)/.exec(v)?.[1]?.toLowerCase(); if (d) dkimDomains.push(d); }
    else if (!(k in fields)) fields[k] = v;
  }
  hops.reverse();
  const auth: AuthResult = { spf: word(authText, 'spf') ?? /^(\w+)/.exec(fields['received-spf'] ?? '')?.[1]?.toLowerCase(), dkim: word(authText, 'dkim'), dmarc: word(authText, 'dmarc') };
  const fromDomain = domainOf(fields['from']), returnDomain = domainOf(fields['return-path']), replyDomain = domainOf(fields['reply-to']);
  const flags: HeaderReport['flags'] = [];
  const res = (name: string, v: string | undefined) => {
    if (!v) flags.push({ level: 'warn', text: `${name}: no result in the header` });
    else if (v === 'pass') flags.push({ level: 'ok', text: `${name}: pass` });
    else flags.push({ level: v === 'none' || v === 'neutral' || v === 'temperror' ? 'warn' : 'bad', text: `${name}: ${v}` });
  };
  res('SPF', auth.spf); res('DKIM', auth.dkim); res('DMARC', auth.dmarc);
  if (fromDomain && returnDomain && !aligned(fromDomain, returnDomain)) flags.push({ level: 'bad', text: 'The visible From domain differs from the Return-Path domain' });
  if (fromDomain && replyDomain && !aligned(fromDomain, replyDomain)) flags.push({ level: 'bad', text: 'Replies would go to a different domain from the From address' });
  if (fromDomain && dkimDomains.length && !dkimDomains.some((d) => aligned(fromDomain, d))) flags.push({ level: 'warn', text: 'The DKIM signing domain does not match the From domain' });
  const shown = /^"?([^"<]*)"?\s*</.exec(fields['from'] ?? '')?.[1] ?? '';
  const embedded = domainOf(shown);
  if (embedded && fromDomain && !aligned(embedded, fromDomain)) flags.push({ level: 'bad', text: 'The display name contains an address that is not the real sender' });
  if (hops.length === 0) flags.push({ level: 'warn', text: 'No Received lines were found, so the route cannot be traced' });
  if (hops.length > 8) flags.push({ level: 'warn', text: `${hops.length} hops is a long route` });
  return { fields, hops, auth, fromDomain, returnDomain, replyDomain, dkimDomains, flags };
}

/** A copyable summary with no addresses, so it is safe to paste into a ticket. */
export function safeSummary(r: HeaderReport): string {
  const lines = [`SPF: ${r.auth.spf ?? 'no result'}. DKIM: ${r.auth.dkim ?? 'no result'}. DMARC: ${r.auth.dmarc ?? 'no result'}.`];
  lines.push(`From domain and Return-Path domain ${r.fromDomain && r.returnDomain ? (aligned(r.fromDomain, r.returnDomain) ? 'match' : 'do not match') : 'could not be compared'}.`);
  lines.push(`Reply-To ${r.replyDomain ? (aligned(r.fromDomain, r.replyDomain) ? 'matches the sender domain' : 'goes to a different domain') : 'not set'}.`);
  lines.push(`${r.hops.length} hop${r.hops.length === 1 ? '' : 's'} in the Received chain.`);
  const bad = r.flags.filter((f) => f.level === 'bad').length;
  lines.push(bad ? `${bad} serious flag${bad === 1 ? '' : 's'} raised.` : 'No serious flags raised.');
  return lines.join('\n');
}
