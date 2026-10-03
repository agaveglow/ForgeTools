/**
 * Starter checklists for recurring checks. Generic IT-service routines only: no client names or details.
 * Nothing here is added until the person chooses to add it.
 */
import type { TaskKind } from '../data/types';

export interface StarterList { id: string; title: string; kind: TaskKind; note?: string; items: string[] }

import { CHECK_GUIDES } from './checkGuides';
import type { CheckGuide } from './checkGuides';

const tasksFor = (f: CheckGuide['frequency'], optional = false): string[] => CHECK_GUIDES.filter((g) => g.frequency === f && g.id.startsWith('o-') === optional).map((g) => g.task ?? g.title);

export const STARTER_LISTS: StarterList[] = [
  { id: 'daily-core', title: 'Daily checks', kind: 'daily', note: 'Usually automated where possible, but reviewed every day. From your Tasks checklist. The end of the patch deployment line was cut off in the screenshot, so check its wording.', items: tasksFor('daily') },
  { id: 'weekly-core', title: 'Weekly checks', kind: 'weekly', note: 'Deeper review or small maintenance.', items: tasksFor('weekly') },
  { id: 'monthly-core', title: 'Monthly checks', kind: 'monthly', note: 'Deeper, proactive maintenance.', items: tasksFor('monthly') },
  { id: 'quarterly-core', title: 'Quarterly checks', kind: 'quarterly', note: 'Strategic, capacity and risk-focused.', items: tasksFor('quarterly') },
  { id: 'optional', title: 'Optional but recommended', kind: 'quarterly', note: 'Added as quarterly reminders: change how often they repeat if you prefer.', items: tasksFor('quarterly', true) },
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
