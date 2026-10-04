/** Reads a pasted SPF or DMARC record and says what is risky. Held in memory only. */
export interface Finding { level: 'bad' | 'warn' | 'ok'; text: string }

export function checkSpf(raw: string): { kind: 'spf'; findings: Finding[] } | { error: string } {
  const t = raw.trim().replace(/^"|"$/g, '').replace(/"\s+"/g, '');
  if (!/^v=spf1(\s|$)/i.test(t)) return { error: 'An SPF record must start with v=spf1.' };
  const parts = t.split(/\s+/).slice(1);
  const f: Finding[] = [];
  const all = parts.find((p) => /^[+\-~?]?all$/i.test(p));
  if (!all) f.push({ level: 'warn', text: 'No "all" at the end, so the record does not say what to do with other senders' });
  else if (all.toLowerCase() === '-all') f.push({ level: 'ok', text: 'Ends with -all: strict' });
  else if (all.toLowerCase() === '~all') f.push({ level: 'warn', text: 'Ends with ~all: soft fail. Common, but -all is stricter once you are sure of all senders' });
  else f.push({ level: 'bad', text: `Ends with ${all}: this lets other senders through` });
  if (parts.length && parts[parts.length - 1] !== all && all) f.push({ level: 'warn', text: 'Terms appear after "all" and are ignored' });
  if (parts.some((p) => /^ptr/i.test(p))) f.push({ level: 'warn', text: 'The ptr term is discouraged' });
  const lookups = parts.filter((p) => /^[+\-~?]?(include:|a(:|\/|$)|mx(:|\/|$)|exists:|redirect=)/i.test(p)).length;
  f.push({ level: lookups > 10 ? 'bad' : lookups > 7 ? 'warn' : 'ok', text: `${lookups} lookup term${lookups === 1 ? '' : 's'} counted directly (the limit is 10 including nested includes)` });
  if (/ip4:0\.0\.0\.0\/0|ip6:::\/0/i.test(t)) f.push({ level: 'bad', text: 'Allows every address' });
  if (t.length > 255) f.push({ level: 'warn', text: 'Longer than 255 characters: it must be split into quoted pieces in DNS' });
  return { kind: 'spf', findings: f };
}

export function checkDmarc(raw: string): { kind: 'dmarc'; findings: Finding[]; tags: Record<string, string> } | { error: string } {
  const t = raw.trim().replace(/^"|"$/g, '').replace(/"\s+"/g, '');
  if (!/^v=DMARC1\s*;/i.test(t)) return { error: 'A DMARC record must start with v=DMARC1;' };
  const tags: Record<string, string> = {};
  for (const p of t.split(';')) { const m = /^\s*([a-z]+)\s*=\s*(.*?)\s*$/i.exec(p); if (m) tags[m[1].toLowerCase()] = m[2]; }
  const f: Finding[] = [];
  const p = (tags.p ?? '').toLowerCase();
  if (!p) f.push({ level: 'bad', text: 'No p= policy, so the record is invalid' });
  else if (p === 'reject') f.push({ level: 'ok', text: 'p=reject: failing mail is refused' });
  else if (p === 'quarantine') f.push({ level: 'ok', text: 'p=quarantine: failing mail goes to junk' });
  else if (p === 'none') f.push({ level: 'warn', text: 'p=none: watching only. Fine to start with, but it does not stop spoofing' });
  else f.push({ level: 'bad', text: `p=${p} is not a valid policy` });
  if (tags.pct && Number(tags.pct) < 100) f.push({ level: 'warn', text: `pct=${tags.pct}: the policy only applies to part of the mail` });
  if (!tags.rua) f.push({ level: 'warn', text: 'No rua= address, so you will not receive summary reports' });
  if (tags.sp && tags.p && tags.sp.toLowerCase() === 'none' && p !== 'none') f.push({ level: 'warn', text: 'Subdomains are set to none while the main domain is stricter' });
  return { kind: 'dmarc', findings: f, tags };
}
