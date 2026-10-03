/**
 * Call priorities and response times, from the priority table in the user's Tasks checklist.
 * Times are counted on business days between 09:00 and 17:00. Public holidays are NOT taken into account.
 * This is a helper for planning replies and updates, not the contract: check wording and times against the current agreement.
 */
export type Priority = 'critical' | 'high' | 'normal' | 'low';

export interface PriorityDef {
  id: Priority;
  label: string;
  /** Minutes. */
  targetResponse: number;
  contractualResponse: number;
  updateEvery: { minutes: number; label: string };
  description: string[];
  example: string;
}

export const PRIORITIES: PriorityDef[] = [
  { id: 'critical', label: 'Critical', targetResponse: 15, contractualResponse: 30, updateEvery: { minutes: 120, label: 'Every 2 hours' }, description: ['All users unable to work.', 'Business critical services unavailable.'], example: 'Server totally down, no users can log on, email not working for all users.' },
  { id: 'high', label: 'High', targetResponse: 30, contractualResponse: 60, updateEvery: { minutes: 240, label: 'Every 4 hours' }, description: ['Single user cannot log on to server or business critical service.'], example: 'Problem with a single user accessing a time critical application (e.g. payroll).' },
  { id: 'normal', label: 'Normal', targetResponse: 60, contractualResponse: 120, updateEvery: { minutes: 1440, label: 'Every 24 hours' }, description: ['User unable to perform routine function.'], example: 'User or users unable to print to a specific printer when other printers are available.' },
  { id: 'low', label: 'Low', targetResponse: 240, contractualResponse: 240, updateEvery: { minutes: 1440, label: 'Every 24 hours' }, description: ['Routine question, new feature request.'], example: 'User requires new software installing, new user creating etc.' },
];

export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 17;

const isBusinessDay = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;
const at = (d: Date, h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0, 0);
const nextDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);

/** The earliest moment inside business hours at or after d. */
export function intoHours(d: Date): Date {
  let t = new Date(d);
  for (let i = 0; i < 10; i++) {
    if (!isBusinessDay(t)) { t = at(nextDay(t), OPEN_HOUR); continue; }
    if (t < at(t, OPEN_HOUR)) return at(t, OPEN_HOUR);
    if (t >= at(t, CLOSE_HOUR)) { t = at(nextDay(t), OPEN_HOUR); continue; }
    return t;
  }
  return t;
}

/** Add working minutes, skipping evenings and weekends. */
export function addBusinessMinutes(start: Date, minutes: number): Date {
  let t = intoHours(start);
  let left = minutes;
  for (let guard = 0; guard < 400; guard++) {
    const close = at(t, CLOSE_HOUR);
    const room = Math.round((close.getTime() - t.getTime()) / 60000);
    if (left <= room) return new Date(t.getTime() + left * 60000);
    left -= room;
    t = intoHours(close);
  }
  return t;
}

/** Same time on the next business day (for the 24-hour update rule), kept inside business hours. */
export function nextBusinessDaySameTime(start: Date): Date {
  const s = intoHours(start);
  let n = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1, s.getHours(), s.getMinutes(), 0, 0);
  while (!isBusinessDay(n)) n = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, n.getHours(), n.getMinutes(), 0, 0);
  return n;
}

export interface Deadlines { respondBy: Date; contractualBy: Date; firstUpdateBy: Date; outsideHours: boolean }

export function deadlines(p: PriorityDef, loggedAt: Date): Deadlines {
  const outsideHours = intoHours(loggedAt).getTime() !== loggedAt.getTime();
  const respondBy = addBusinessMinutes(loggedAt, p.targetResponse);
  const contractualBy = addBusinessMinutes(loggedAt, p.contractualResponse);
  const firstUpdateBy = p.updateEvery.minutes >= 1440 ? nextBusinessDaySameTime(loggedAt) : addBusinessMinutes(loggedAt, p.updateEvery.minutes);
  return { respondBy, contractualBy, firstUpdateBy, outsideHours };
}
