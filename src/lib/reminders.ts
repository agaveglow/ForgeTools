/** Pure scheduling logic for reminders: due reminders and the next time a repeating one fires. No native code here. */
import type { Reminder, ReminderRepeat } from '../data/types';

export const REPEAT_LABELS: Record<ReminderRepeat, string> = { none: 'Once', daily: 'Every day', weekdays: 'Weekdays (Mon–Fri)', weekly: 'Every week' };

const DAY_MS = 86_400_000;
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);

/** The next time at or after `from` that a reminder set for `at` with this repeat should fire. Null once a one-off has passed. */
export function nextOccurrence(at: string, repeat: ReminderRepeat, from: Date): Date | null {
  const base = new Date(at);
  if (Number.isNaN(base.getTime())) return null;
  if (repeat === 'none') return base.getTime() >= from.getTime() ? base : null;
  const step = repeat === 'weekly' ? 7 : 1;
  let d = base;
  if (d.getTime() < from.getTime()) {
    const steps = Math.ceil((from.getTime() - d.getTime()) / (step * DAY_MS));
    d = addDays(d, steps * step);
  }
  if (repeat === 'weekdays') while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return d;
}

/** Reminders whose next occurrence fell in the last minute up to `now`. For the browser's while-open checker only. */
export function dueReminders(list: Reminder[], now: Date): Reminder[] {
  const from = new Date(now.getTime() - 60_000);
  return list.filter((r) => {
    if (!r.enabled) return false;
    const next = nextOccurrence(r.at, r.repeat, from);
    return next !== null && next.getTime() <= now.getTime();
  });
}

/** Sorted soonest-first, for display. Disabled and past one-offs go last, most recent first among those. */
export function sortReminders(list: Reminder[], now: Date): Reminder[] {
  const withNext = list.map((r) => ({ r, next: r.enabled ? nextOccurrence(r.at, r.repeat, now) : null }));
  return withNext
    .sort((a, b) => {
      if (!!a.next !== !!b.next) return a.next ? -1 : 1;
      if (a.next && b.next) return a.next.getTime() - b.next.getTime();
      return new Date(b.r.at).getTime() - new Date(a.r.at).getTime();
    })
    .map((x) => x.r);
}

export const blankReminder = (): Pick<Reminder, 'title' | 'text' | 'at' | 'repeat' | 'enabled'> => ({ title: '', text: '', at: '', repeat: 'none', enabled: true });
