import { COMMANDS } from '../content/commands';
import { WORKFLOWS } from '../content/workflows';
import type { KbEntry, WorkLog } from '../data/types';

export interface SearchHit {
  kind: 'work log' | 'troubleshooting' | 'command' | 'knowledge';
  id: string;
  title: string;
  sub: string;
  route: string;
  score: number;
}

function score(q: string[], title: string, body: string): number {
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let s = 0;
  for (const w of q) {
    if (t.includes(w)) s += t.startsWith(w) ? 6 : 4;
    else if (b.includes(w)) s += 1;
    else return 0; // every word must match somewhere
  }
  return s;
}

export function searchAll(query: string, logs: WorkLog[], kb: KbEntry[], limit = 30): SearchHit[] {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!q.length) return [];
  const hits: SearchHit[] = [];
  for (const l of logs) {
    const s = score(q, `${l.ref} ${l.device} ${l.problem}`, [l.client, l.investigation, l.actions, l.result, l.ticket, l.category].join(' '));
    if (s) hits.push({ kind: 'work log', id: l.id, title: l.problem.slice(0, 90) || l.ref, sub: `${l.ref} · ${l.category}`, route: `/logs/${l.id}`, score: s });
  }
  for (const w of WORKFLOWS) {
    const s = score(q, w.title, [w.summary, w.symptoms.join(' '), w.category].join(' '));
    if (s) hits.push({ kind: 'troubleshooting', id: w.id, title: w.title, sub: w.category, route: `/troubleshoot/${w.id}`, score: s });
  }
  for (const c of COMMANDS) {
    const s = score(q, c.name, [c.purpose, c.syntax, c.group].join(' '));
    if (s) hits.push({ kind: 'command', id: c.id, title: c.name, sub: c.purpose, route: `/commands/${c.id}`, score: s });
  }
  for (const k of kb) {
    const s = score(q, k.title, [k.body, k.tags.join(' '), k.category].join(' '));
    if (s) hits.push({ kind: 'knowledge', id: k.id, title: k.title, sub: k.category, route: `/kb/${k.id}`, score: s + (k.pinned ? 1 : 0) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
