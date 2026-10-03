/** Pure helpers behind the dashboard: dates, task status, streaks, hours, requirement progress. */
import type { ApprenticeEntry, Requirement, Task, WorkLog } from '../data/types';

export const ymd = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseYmd = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); };
export const addDays = (d: Date, n: number): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
/** Monday of the week containing d (local time). */
export const weekStart = (d: Date): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; };
export const weekDays = (d: Date): string[] => { const s = weekStart(d); return Array.from({ length: 7 }, (_, i) => ymd(addDays(s, i))); };

export type TaskState = 'done' | 'due' | 'overdue' | 'upcoming';

/** Key of the period a date falls in for a recurring task: the day, week (Monday), month or quarter. */
export function periodKey(kind: Task['kind'], d: Date): string {
  switch (kind) {
    case 'daily': return ymd(d);
    case 'weekly': return ymd(weekStart(d));
    case 'monthly': return ymd(d).slice(0, 7);
    case 'quarterly': return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    default: return 'once';
  }
}

export function taskDone(t: Task, now: Date): boolean {
  if (t.kind === 'once') return t.doneOn.length > 0;
  const key = periodKey(t.kind, now);
  return t.doneOn.some((d) => periodKey(t.kind, parseYmd(d)) === key);
}

/** Last date the task was ticked off, if ever. */
export const lastDone = (t: Task): string | undefined => [...t.doneOn].sort().pop();

/** Days left in the current month or quarter (0 on the last day). Undefined for other kinds. */
export function daysLeftInPeriod(kind: Task['kind'], now: Date): number | undefined {
  if (kind !== 'monthly' && kind !== 'quarterly') return undefined;
  const endMonth = kind === 'monthly' ? now.getMonth() : Math.floor(now.getMonth() / 3) * 3 + 2;
  const end = new Date(now.getFullYear(), endMonth + 1, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

export function taskState(t: Task, now: Date): TaskState {
  if (taskDone(t, now)) return 'done';
  if (t.kind === 'once' && t.due) { const today = ymd(now); return t.due < today ? 'overdue' : t.due === today ? 'due' : 'upcoming'; }
  return 'due';
}

/** Toggle completion for the current period. One-off tasks keep the date they were completed. */
export function toggleTask(t: Task, now: Date): string[] {
  const today = ymd(now);
  if (t.kind === 'once') return t.doneOn.length ? [] : [today];
  if (taskDone(t, now)) {
    const key = periodKey(t.kind, now);
    return t.doneOn.filter((d) => periodKey(t.kind, parseYmd(d)) !== key);
  }
  return [...t.doneOn, today].slice(-400);
}

export const activeTasks = (tasks: Task[]): Task[] => tasks.filter((t) => !t.archived);

export function taskSummary(tasks: Task[], now: Date) {
  const act = activeTasks(tasks);
  const daily = act.filter((t) => t.kind === 'daily');
  const weekly = act.filter((t) => t.kind === 'weekly');
  const monthly = act.filter((t) => t.kind === 'monthly');
  const quarterly = act.filter((t) => t.kind === 'quarterly');
  const once = act.filter((t) => t.kind === 'once' && !taskDone(t, now));
  const overdue = once.filter((t) => taskState(t, now) === 'overdue');
  return {
    dailyDone: daily.filter((t) => taskDone(t, now)).length, dailyTotal: daily.length,
    weeklyDone: weekly.filter((t) => taskDone(t, now)).length, weeklyTotal: weekly.length,
    monthlyDone: monthly.filter((t) => taskDone(t, now)).length, monthlyTotal: monthly.length,
    quarterlyDone: quarterly.filter((t) => taskDone(t, now)).length, quarterlyTotal: quarterly.length,
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

// ---------- Task board ----------

/** Board column for a one-off task. Ticking it off anywhere puts it in Done. */
export function boardStatus(t: Task): 'todo' | 'doing' | 'blocked' | 'done' {
  if (t.doneOn.length) return 'done';
  return t.status && t.status !== 'done' ? t.status : 'todo';
}

/** The fields to change when a card moves to another column. */
export function moveTask(t: Task, to: 'todo' | 'doing' | 'blocked' | 'done', now: Date): Task {
  return { ...t, status: to, doneOn: to === 'done' ? (t.doneOn.length ? t.doneOn : [ymd(now)]) : [] };
}

// ---------- Chart data ----------

/** How many things happened on each day: work logs, learning entries and ticked tasks. */
export function activityCounts(logs: WorkLog[], entries: ApprenticeEntry[], tasks: Task[]): Map<string, number> {
  const m = new Map<string, number>();
  const bump = (d: string) => m.set(d, (m.get(d) ?? 0) + 1);
  for (const l of logs) bump(ymd(new Date(l.occurredAt)));
  for (const e of entries) bump(e.date);
  for (const t of tasks) for (const d of t.doneOn) bump(d);
  return m;
}

export interface HeatCell { date: string; count: number; future: boolean }

/** Columns of 7 days (Monday first), oldest week first, ending with the current week. */
export function heatmapWeeks(counts: Map<string, number>, now: Date, weeks = 12): HeatCell[][] {
  const start = addDays(weekStart(now), -7 * (weeks - 1));
  const today = ymd(now);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const date = ymd(addDays(start, w * 7 + d));
    return { date, count: counts.get(date) ?? 0, future: date > today };
  }));
}

/** Off-the-job hours for each of the last n weeks, oldest first. */
export function weeklyHoursSeries(entries: ApprenticeEntry[], now: Date, n = 8): Array<{ start: string; hours: number }> {
  return Array.from({ length: n }, (_, i) => {
    const s = addDays(weekStart(now), -7 * (n - 1 - i));
    const e = addDays(s, 6);
    return { start: ymd(s), hours: hoursIn(entries, ymd(s), ymd(e), true) };
  });
}
