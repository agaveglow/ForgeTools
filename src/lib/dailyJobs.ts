import type { DailyJob } from '../data/types';

export const DEFAULT_DAILY_JOBS: DailyJob[] = [
  { id: 'clock-in', text: 'Clock in on BrightHR', kind: 'job', stamp: true },
  { id: 'watch-outlook', text: 'Check Outlook emails', kind: 'watch', everyMin: 30 },
  { id: 'watch-itarian', text: 'Check ITarian tickets', kind: 'watch', everyMin: 30 },
  { id: 'clock-out', text: 'Clock out on BrightHR', kind: 'job', stamp: true },
];

export const WATCH_INTERVALS = [15, 30, 45, 60, 120] as const;

/** What the page remembers about today. It belongs to one day and clears itself the next day. */
export interface DayState { day: string; done: Record<string, string>; checked: Record<string, string>; counts: Record<string, number> }

export const dayKeyOf = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const emptyDay = (now: Date): DayState => ({ day: dayKeyOf(now), done: {}, checked: {}, counts: {} });

const isIsoMap = (v: unknown): v is Record<string, string> => !!v && typeof v === 'object' && Object.values(v as object).every((x) => typeof x === 'string');

export function parseDay(raw: string | null, now: Date): DayState {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (v && v.day === dayKeyOf(now) && isIsoMap(v.done) && isIsoMap(v.checked)) {
      const counts: Record<string, number> = {};
      if (v.counts && typeof v.counts === 'object') for (const [k, n] of Object.entries(v.counts)) if (typeof n === 'number' && n >= 0) counts[k] = Math.min(n, 999);
      return { day: v.day, done: v.done, checked: v.checked, counts };
    }
  } catch { /* fall through */ }
  return emptyDay(now);
}

export const minutesSince = (iso: string | undefined, now: Date): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / 60000)) : null;
};

export type WatchState = 'never' | 'ok' | 'due';
/** 'never' = not checked yet today. 'due' = the gap since the last check is longer than the interval. */
export function watchState(job: DailyJob, lastIso: string | undefined, now: Date): WatchState {
  const m = minutesSince(lastIso, now);
  if (m === null) return 'never';
  return m >= (job.everyMin ?? 30) ? 'due' : 'ok';
}

export const agoText = (m: number | null): string => (m === null ? 'not checked yet' : m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`);

export const timeText = (iso: string): string => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function dayProgress(jobs: DailyJob[], st: DayState): { done: number; total: number } {
  const js = jobs.filter((j) => j.kind === 'job');
  return { done: js.filter((j) => st.done[j.id]).length, total: js.length };
}
