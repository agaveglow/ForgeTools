import { describe, expect, test } from 'bun:test';
import { agoText, dayKeyOf, DEFAULT_DAILY_JOBS, dayProgress, emptyDay, minutesSince, parseDay, watchState } from '../../src/lib/dailyJobs';

const at = (h: number, m: number) => new Date(2026, 9, 4, h, m, 0);
describe('daily jobs', () => {
  test('defaults are the four general jobs', () => {
    expect(DEFAULT_DAILY_JOBS.map((j) => j.text)).toEqual(['Clock in on BrightHR', 'Check Outlook emails', 'Check ITarian tickets', 'Clock out on BrightHR']);
    expect(DEFAULT_DAILY_JOBS.filter((j) => j.kind === 'watch').every((j) => (j.everyMin ?? 0) > 0)).toBe(true);
  });
  test('watch state: never, ok, then due after the interval', () => {
    const w = DEFAULT_DAILY_JOBS[1];
    const last = at(9, 0).toISOString();
    expect(watchState(w, undefined, at(9, 5))).toBe('never');
    expect(watchState(w, last, at(9, 29))).toBe('ok');
    expect(watchState(w, last, at(9, 30))).toBe('due');
    expect(watchState({ ...w, everyMin: 60 }, last, at(9, 45))).toBe('ok');
  });
  test('minutes and wording', () => {
    expect(minutesSince(at(9, 0).toISOString(), at(10, 5))).toBe(65);
    expect(minutesSince('nonsense', at(10, 5))).toBeNull();
    expect(agoText(null)).toBe('not checked yet');
    expect(agoText(0)).toBe('just now');
    expect(agoText(12)).toBe('12 min ago');
    expect(agoText(65)).toBe('1 h 5 min ago');
  });
  test('state belongs to one day and survives only that day', () => {
    const st = { ...emptyDay(at(9, 0)), done: { 'clock-in': at(8, 55).toISOString() } };
    expect(parseDay(JSON.stringify(st), at(15, 0)).done['clock-in']).toBeTruthy();
    expect(parseDay(JSON.stringify(st), new Date(2026, 9, 5, 9, 0)).done).toEqual({});
    expect(parseDay('{bad json', at(9, 0)).day).toBe(dayKeyOf(at(9, 0)));
    expect(parseDay(JSON.stringify({ day: dayKeyOf(at(9, 0)), done: { a: 5 }, checked: {} }), at(9, 0)).done).toEqual({});
  });
  test('progress counts only once-a-day jobs', () => {
    const st = { ...emptyDay(at(9, 0)), done: { 'clock-in': 'x' } };
    expect(dayProgress(DEFAULT_DAILY_JOBS, st)).toEqual({ done: 1, total: 2 });
  });
});
