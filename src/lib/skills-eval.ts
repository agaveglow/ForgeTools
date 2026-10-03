import type { SkillLevel } from '../content/skills';
import { SKILLS } from '../content/skills';
import type { SkillRating, WorkLog } from '../data/types';

export interface SkillEvidence {
  skillId: string;
  /** Real (non-demo) logs claiming this skill. */
  logs: WorkLog[];
  /** Distinct calendar days with such logs. */
  days: number;
  withEvidence: number;
  suggested: SkillLevel | null;
  /** The level the user chose, if any. */
  chosen: SkillLevel | null;
  warning?: string;
}

const dayKey = (iso: string) => iso.slice(0, 10);

export function suggestLevel(days: number): SkillLevel | null {
  if (days >= 8) return 'Confident';
  if (days >= 4) return 'Practised';
  if (days >= 2) return 'Developing';
  if (days >= 1) return 'Exposure';
  return null;
}

const ORDER: SkillLevel[] = ['Exposure', 'Developing', 'Practised', 'Confident', 'Demonstrated'];

export function evaluateSkills(logs: WorkLog[], ratings: SkillRating[]): SkillEvidence[] {
  const real = logs.filter((l) => !l.demo);
  return SKILLS.map((s) => {
    const mine = real.filter((l) => l.skills.includes(s.id));
    const days = new Set(mine.map((l) => dayKey(l.occurredAt))).size;
    const withEvidence = mine.filter((l) => (l.evidence ?? '').trim() || (l.ticket ?? '').trim()).length;
    const chosen = ratings.find((r) => r.skillId === s.id)?.level ?? null;
    let warning: string | undefined;
    if (chosen === 'Demonstrated' && withEvidence < 3) warning = 'Demonstrated normally needs at least 3 logs with evidence. You have ' + withEvidence + '.';
    else if (chosen && ORDER.indexOf(chosen) > ORDER.indexOf(suggestLevel(days) ?? 'Exposure') + 1 && chosen !== 'Demonstrated')
      warning = 'This is higher than your logged evidence suggests (' + days + ' day' + (days === 1 ? '' : 's') + ' of work).';
    else if (chosen && days === 0) warning = 'No real work logs back this level yet.';
    return { skillId: s.id, logs: mine, days, withEvidence, suggested: suggestLevel(days), chosen, warning };
  });
}
