/**
 * The Aptem "Activity details" form, mirrored so a log entry here matches it field for field.
 * ForgeTools cannot see, sign in to or submit to Aptem: the person copies the fields across and ticks the entry off.
 */
import type { ApprenticeEntry } from '../data/types';

export type AptemType = NonNullable<ApprenticeEntry['aptemType']>;
export type AptemWhen = NonNullable<ApprenticeEntry['when']>;

export const AP_TYPES: Array<{ id: AptemType; label: string }> = [
  { id: 'otj', label: 'Off-the-Job training' },
  { id: 'engmaths', label: 'English or maths' },
  { id: 'other', label: 'Other' },
];
export const AP_WHEN: Array<{ id: AptemWhen; label: string }> = [
  { id: 'paid', label: 'This activity was completed during my paid working hours' },
  { id: 'own-paid', label: 'This activity was completed in my own time and I am being paid' },
  { id: 'own-toil', label: 'This activity was completed in my own time and I am receiving time off in lieu' },
];
export const typeLabel = (t: AptemType | undefined): string => AP_TYPES.find((x) => x.id === t)?.label ?? 'Off-the-Job training';
export const whenLabel = (w: AptemWhen | undefined): string => AP_WHEN.find((x) => x.id === w)?.label ?? AP_WHEN[0].label;

/** Aptem allows 1000 characters in "Describe the activity". */
export const DESCRIPTION_MAX = 1000;

/** The components shown in the person's Aptem list at the time of setup. They can edit this list in the app. */
export const DEFAULT_COMPONENTS: string[] = [
  'Module 1 Self-Paced Learning', 'Module 1 Practical Application', 'Module 1 Work-based Project', 'Module 1 Assignment',
  'Module 2 Self-Paced Learning', 'Module 2 Practical Application', 'Module 2 Work-based Project', 'Module 2 Assignment',
  'Module 3 Self-Paced Learning', 'Module 3 Secure Design Practical Application', 'Module 3 Cyber Defence Practical Application', 'Module 3 Work-based Project', 'Module 3 Assignment',
  'Module 4 Self-Paced Learning', 'Module 4 Practical Application', 'Module 4 Assignment',
  'Module 5 Self-Paced Learning', 'Module 5 Practical Application', 'Module 5 Assignment',
  'Module 6 Work-based Project', 'Module 6 Assignment',
  'Workplace Write Up',
];

/** One name per line. Trims, drops blanks and repeats, and keeps the list a sensible size. */
export function parseComponentList(text: string): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.replace(/\s+/g, ' ').trim().slice(0, 120);
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k); out.push(t);
    if (out.length >= 200) break;
  }
  return out;
}

/** Search as you type: every word typed must appear, in any order. */
export function filterComponents(list: string[], q: string): string[] {
  const ws = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!ws.length) return list;
  return list.filter((c) => { const l = c.toLowerCase(); return ws.every((w) => l.includes(w)); });
}

/** Aptem allows at most 12 hours in a single entry. */
export const MAX_MINUTES = 12 * 60;
/** Total minutes from the two boxes. Returns the raw total, so the caller can tell the person it is over the limit. */
export const toMinutes = (hours: number, minutes: number): number => {
  const h = Math.max(0, Math.floor(Number(hours) || 0)); const m = Math.max(0, Math.floor(Number(minutes) || 0));
  return h * 60 + m;
};
export const splitMinutes = (total: number): { hours: number; minutes: number } => {
  const t = Math.max(0, Math.round(Number(total) || 0));
  return { hours: Math.floor(t / 60), minutes: t % 60 };
};
/** Hours as a number for the totals, to two places. */
export const hoursFromMinutes = (total: number): number => Math.round((Math.max(0, total) / 60) * 100) / 100;
/** Minutes for any entry, old or new. Entries from before this form only have hours. */
export const minutesOf = (e: Pick<ApprenticeEntry, 'hours' | 'minutes'>): number => (typeof e.minutes === 'number' ? e.minutes : Math.round((Number(e.hours) || 0) * 60));

export type AptemStatus = NonNullable<ApprenticeEntry['aptemStatus']>;
/** Set by the person. Only Accepted counts towards the verified total; the rest are what happens next. */
export const AP_STATUS: Array<{ id: AptemStatus; label: string; counts: boolean }> = [
  { id: 'to-enter', label: 'Not entered in Aptem yet', counts: false },
  { id: 'submitted', label: 'Submitted, waiting for my tutor', counts: false },
  { id: 'accepted', label: 'Accepted by my tutor', counts: true },
  { id: 'rejected', label: 'Rejected, needs changes', counts: false },
  { id: 'resubmitted', label: 'Resubmitted', counts: false },
];
export const statusLabel = (s: AptemStatus | undefined): string => AP_STATUS.find((x) => x.id === s)?.label ?? '';
/** Hours of off-the-job entries the person has marked as accepted. Entries without a status are not counted. */
export const acceptedHours = (entries: ApprenticeEntry[]): number =>
  Math.round(entries.filter((e) => e.offTheJob && e.aptemStatus === 'accepted').reduce((n, e) => n + minutesOf(e), 0) / 60 * 100) / 100;

/** True when the date is after today. Aptem does not allow future dates. Both are YYYY-MM-DD. */
export const isFutureDate = (date: string, today: string): boolean => date > today;

/** An entry with the same date, component and time already exists: logging it again could count the hours twice. */
export function possibleDuplicate(entries: ApprenticeEntry[], c: { date: string; component: string; minutes: number }, ignoreId?: string): ApprenticeEntry | undefined {
  if (!c.component || !c.minutes) return undefined;
  return entries.find((e) => e.id !== ignoreId && e.date === c.date && (e.component ?? '') === c.component && minutesOf(e) === c.minutes);
}

/** The questions to ask before saving, in our own words. */
export const BEFORE_SAVE = [
  'Is it directly relevant to my apprenticeship?',
  'Did I learn or develop something new (not just routine work)?',
  'Was it in paid working time, or paid / time off in lieu if in my own time?',
  'Have I said what I did, what I learned and how it applies to my work?',
  'Are the date and the real time right (not rounded up)?',
  'Is it the right learning plan component, and not already logged?',
];

export const timeText = (total: number): string => { const { hours, minutes } = splitMinutes(total); return hours && minutes ? `${hours} h ${minutes} min` : hours ? `${hours} h` : `${minutes} min`; };

/** Aptem asks for dd/mm/yyyy. */
export const dmy = (ymdDate: string): string => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymdDate); return m ? `${m[3]}/${m[2]}/${m[1]}` : ymdDate; };

/** What goes in "Describe the activity": the description, then the evidence link on its own line. */
export const descriptionFor = (description: string, link?: string): string => {
  const d = description.trim(); const l = (link ?? '').trim();
  return l ? `${d}${d ? '\n' : ''}Link: ${l}` : d;
};
export const descriptionOf = (e: Pick<ApprenticeEntry, 'whatIDid' | 'learned' | 'reflection' | 'link'>): string =>
  descriptionFor([e.whatIDid, e.learned, e.reflection].map((x) => (x ?? '').trim()).filter(Boolean).join('\n\n'), e.link);

export interface AptemField { label: string; value: string }
/** The entry in the order of the Aptem form, using Aptem's own labels. */
export function aptemFields(e: Pick<ApprenticeEntry, 'date' | 'hours' | 'minutes' | 'aptemType' | 'when' | 'whatIDid' | 'learned' | 'reflection' | 'link' | 'component' | 'offTheJob'>): AptemField[] {
  const { hours, minutes } = splitMinutes(minutesOf(e));
  return [
    { label: 'Type of activity', value: typeLabel(e.aptemType ?? (e.offTheJob ? 'otj' : 'other')) },
    { label: 'When did this activity take place?', value: whenLabel(e.when) },
    { label: 'Describe the activity', value: descriptionOf(e) },
    { label: 'Date of activity', value: dmy(e.date) },
    { label: 'Time spent: Hours', value: String(hours) },
    { label: 'Time spent: Minutes', value: String(minutes) },
    { label: 'Which component does this activity apply to?', value: (e.component ?? '').trim() },
  ].filter((x) => x.value.trim());
}
export const aptemText = (fields: AptemField[]): string => fields.map((x) => `${x.label}: ${x.value}`).join('\n');
