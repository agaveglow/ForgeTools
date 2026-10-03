import { describe, expect, test } from 'bun:test';
import { PRIORITIES, addBusinessMinutes, deadlines, intoHours, nextBusinessDaySameTime } from '../../src/lib/sla';

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);
// 2026-10-02 is a Friday, 2026-10-05 a Monday.
describe('business time', () => {
  test('inside hours simply adds', () => {
    expect(addBusinessMinutes(d(2026, 10, 5, 10, 0), 30)).toEqual(d(2026, 10, 5, 10, 30));
  });
  test('rolls over the evening and the weekend', () => {
    expect(addBusinessMinutes(d(2026, 10, 2, 16, 50), 30)).toEqual(d(2026, 10, 5, 9, 20));
    expect(addBusinessMinutes(d(2026, 10, 2, 16, 59), 15)).toEqual(d(2026, 10, 5, 9, 14));
  });
  test('outside hours starts at the next opening', () => {
    expect(intoHours(d(2026, 10, 3, 12))).toEqual(d(2026, 10, 5, 9));
    expect(intoHours(d(2026, 10, 5, 7))).toEqual(d(2026, 10, 5, 9));
    expect(intoHours(d(2026, 10, 5, 17, 0))).toEqual(d(2026, 10, 6, 9));
    expect(addBusinessMinutes(d(2026, 10, 3, 12), 15)).toEqual(d(2026, 10, 5, 9, 15));
  });
  test('critical: 15 / 30 minutes and a 2-hour update', () => {
    const p = PRIORITIES.find((x) => x.id === 'critical')!;
    const r = deadlines(p, d(2026, 10, 5, 10, 0));
    expect(r.respondBy).toEqual(d(2026, 10, 5, 10, 15));
    expect(r.contractualBy).toEqual(d(2026, 10, 5, 10, 30));
    expect(r.firstUpdateBy).toEqual(d(2026, 10, 5, 12, 0));
    expect(r.outsideHours).toBe(false);
  });
  test('normal: 24-hour update is the next business day', () => {
    const p = PRIORITIES.find((x) => x.id === 'normal')!;
    expect(deadlines(p, d(2026, 10, 2, 11, 0)).firstUpdateBy).toEqual(d(2026, 10, 5, 11, 0));
    expect(nextBusinessDaySameTime(d(2026, 10, 5, 11, 0))).toEqual(d(2026, 10, 6, 11, 0));
  });
  test('table matches the checklist', () => {
    expect(PRIORITIES.map((p) => [p.targetResponse, p.contractualResponse])).toEqual([[15, 30], [30, 60], [60, 120], [240, 240]]);
    expect(PRIORITIES.map((p) => p.updateEvery.minutes)).toEqual([120, 240, 1440, 1440]);
  });
  test('flags a log made outside hours', () => {
    expect(deadlines(PRIORITIES[0], d(2026, 10, 3, 12)).outsideHours).toBe(true);
  });
});
