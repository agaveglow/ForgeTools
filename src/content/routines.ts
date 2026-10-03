/**
 * Starter checklists for recurring checks. Generic IT-service routines only: no client names or details.
 * Nothing here is added until the person chooses to add it.
 */
import type { TaskKind } from '../data/types';

export interface StarterList { id: string; title: string; kind: TaskKind; note?: string; items: string[] }

export const STARTER_LISTS: StarterList[] = [
  {
    id: 'monthly-core',
    title: 'Monthly checks',
    kind: 'monthly',
    note: 'The three monthly items you sent. Add the rest of your monthly list with “Paste a list”.',
    items: [
      'Review conditional access rules',
      'Test DR plan: run a tabletop exercise or partial failover test',
      'Review vendor portals: warranty status, firmware updates for switches, firewalls, etc.',
    ],
  },
  {
    id: 'quarterly-core',
    title: 'Quarterly checks',
    kind: 'quarterly',
    note: 'Strategic, capacity and risk-focused.',
    items: [
      'Full disaster recovery test: restore key systems from backup or fail over to DR',
      'Vulnerability assessment / penetration test (internal or external)',
      'Review and apply firmware updates: servers, switches, firewalls, wireless APs',
      'Capacity planning and performance review: recommend upgrades if needed',
      'Security policy review: password policy, conditional access, device management',
      'Review external exposure: public DNS, SSL certificate expirations, open ports',
      'User permissions audit: validate access based on least privilege',
      'Review and clean up inactive devices and accounts',
      'Quarterly business review (QBR) with client: report on health, risks, recommendations',
    ],
  },
];

/** Turn pasted lines into task titles: strips bullets, numbers and emoji-only headings, drops blanks and repeats. */
export function parseTaskLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.replace(/^\s*(?:[-*•·▪◦]|\d+[.)]|\[[ xX]?\])\s*/, '').replace(/\s+/g, ' ').trim();
    if (t.length < 3 || t.length > 200) continue;
    if (/^(?:[\p{Extended_Pictographic}\s]+)?(?:daily|weekly|monthly|quarterly|annual)\s+tasks?\b.*$/iu.test(t) && t.length < 40) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}
