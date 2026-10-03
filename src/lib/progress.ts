/** Pure helpers behind the dashboard: dates, task status, streaks, hours, requirement progress. */
import type { ApprenticeEntry, Requirement, Task, WorkLog } from '../data/types';

export const ymd = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseYmd = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); };
export const addDays = (d: Date, n: number): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
/** Monday of the week containing d (local time). */
export const weekStart = (d: Date): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; };
export const weekDays = (d: Date): string[] => { const s = weekStart(d); return Array.from({ length: 7 }, (_, i) => ymd(addDays(s, i))); };

export type TaskState = 'done' | 'due' | 'overdue' | 'upcoming';

export function taskDone(t: Task, now: Date): boolean {
  if (t.kind === 'once') return t.doneOn.length > 0;
  if (t.kind === 'daily') return t.doneOn.includes(ymd(now));
  const week = new Set(weekDays(now));
  return t.doneOn.some((d) => week.has(d));
}

export function taskState(t: Task, now: Date): TaskState {
  if (taskDone(t, now)) return 'done';
  if (t.kind === 'once' && t.due) { const today = ymd(now); return t.due < today ? 'overdue' : t.due === today ? 'due' : 'upcoming'; }
  return 'due';
}

/** Toggle today's completion. One-off tasks keep the date they were completed. */
export function toggleTask(t: Task, now: Date): string[] {
  const today = ymd(now);
  if (t.kind === 'once') return t.doneOn.length ? [] : [today];
  if (taskDone(t, now)) {
    const week = new Set(t.kind === 'daily' ? [today] : weekDays(now));
    return t.doneOn.filter((d) => !week.has(d));
  }
  return [...t.doneOn, today].slice(-400);
}

export const activeTasks = (tasks: Task[]): Task[] => tasks.filter((t) => !t.archived);

export function taskSummary(tasks: Task[], now: Date) {
  const act = activeTasks(tasks);
  const daily = act.filter((t) => t.kind === 'daily');
  const weekly = act.filter((t) => t.kind === 'weekly');
  const once = act.filter((t) => t.kind === 'once' && !taskDone(t, now));
  const overdue = once.filter((t) => taskState(t, now) === 'overdue');
  return {
    dailyDone: daily.filter((t) => taskDone(t, now)).length, dailyTotal: daily.length,
    weeklyDone: weekly.filter((t) => taskDone(t, now)).length, weeklyTotal: weekly.length,
    onceOpen: once.length, overdue: overdue.length,
  };
}

/** Days (YYYY-MM-DD) on which the person recorded any work, learning or completed a task. */
export function activityDays(logs: WorkLog[], entries: ApprenticeEntry[], tasks: Task[]): Set<string> {
  const s = new Set<string>();
  for (const l of logs) s.add(ymd(new Date(l.occurredAt)));
  for (const e of entries) s.add(e.date);
  for (const t of tasks) for (const d of t.doneOn) s.add(d);
  return s;
}

/** Consecutive days with activity, counting back from today (or yesterday if nothing yet today). */
export function streak(days: Set<string>, now: Date): number {
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(ymd(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}

export const hoursIn = (entries: ApprenticeEntry[], from: string, to: string, otjOnly = true): number =>
  Math.round(entries.filter((e) => e.date >= from && e.date <= to && (!otjOnly || e.offTheJob)).reduce((n, e) => n + (Number(e.hours) || 0), 0) * 100) / 100;

export const weekHours = (entries: ApprenticeEntry[], now: Date, otjOnly = true): number => { const w = weekDays(now); return hoursIn(entries, w[0], w[6], otjOnly); };
export const totalHours = (entries: ApprenticeEntry[], otjOnly = true): number => hoursIn(entries, '0000-01-01', '9999-12-31', otjOnly);

export function requirementProgress(reqs: Requirement[]) {
  const by = { 'not-started': 0, 'in-progress': 0, evidenced: 0, 'signed-off': 0 } as Record<Requirement['status'], number>;
  for (const r of reqs) by[r.status]++;
  const done = by.evidenced + by['signed-off'];
  return { total: reqs.length, done, signedOff: by['signed-off'], by, pct: reqs.length ? Math.round((done / reqs.length) * 100) : 0 };
}

/** Requirements still open, soonest target first (no target last). */
export function nextRequirements(reqs: Requirement[], limit = 5): Requirement[] {
  return reqs.filter((r) => r.status !== 'signed-off' && r.status !== 'evidenced')
    .sort((a, b) => (a.target ?? '9999').localeCompare(b.target ?? '9999') || a.title.localeCompare(b.title)).slice(0, limit);
}

export const clampHours = (v: number): number => Math.max(0, Math.min(24, Math.round((Number(v) || 0) * 4) / 4));
