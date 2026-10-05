import { describe, expect, test } from 'bun:test';
import { dueReminders, nextOccurrence, sortReminders } from '../../src/lib/reminders';
import type { Reminder } from '../../src/data/types';

const R = (p: Partial<Reminder>): Reminder => ({ id: 'r', createdAt: '', updatedAt: '', title: 'T', at: '2026-10-05T09:00:00', repeat: 'none', enabled: true, ...p });

describe('nextOccurrence', () => {
  test('one-off: itself if still ahead, null once past', () => {
    expect(nextOccurrence('2026-10-05T09:00:00', 'none', new Date('2026-10-05T08:00:00'))?.toISOString()).toBe(new Date('2026-10-05T09:00:00').toISOString());
    expect(nextOccurrence('2026-10-05T09:00:00', 'none', new Date('2026-10-05T10:00:00'))).toBeNull();
  });
  test('daily: rolls forward to the next day at the same time', () => {
    const n = nextOccurrence('2026-10-01T09:00:00', 'daily', new Date('2026-10-05T10:00:00'))!;
    expect(n.toISOString()).toBe(new Date('2026-10-06T09:00:00').toISOString());
  });
  test('weekly: rolls forward in 7-day steps', () => {
    const n = nextOccurrence('2026-10-01T09:00:00', 'weekly', new Date('2026-10-05T10:00:00'))!;
    expect(n.toISOString()).toBe(new Date('2026-10-08T09:00:00').toISOString());
  });
  test('weekdays: skips Saturday and Sunday', () => {
    // 2026-10-02 is a Friday; daily step lands on Sat 10-03, which must skip to Mon 10-05
    const n = nextOccurrence('2026-10-02T09:00:00', 'weekdays', new Date('2026-10-03T00:00:00'))!;
    expect(n.getDay()).not.toBe(0); expect(n.getDay()).not.toBe(6);
    expect(n.toISOString()).toBe(new Date('2026-10-05T09:00:00').toISOString());
  });
  test('bad date is null', () => { expect(nextOccurrence('not-a-date', 'daily', new Date())).toBeNull(); });
});

describe('dueReminders', () => {
  test('fires once in the minute it becomes due, not before or long after', () => {
    const r = R({ at: '2026-10-05T09:00:00' });
    expect(dueReminders([r], new Date('2026-10-05T08:59:00')).length).toBe(0);
    expect(dueReminders([r], new Date('2026-10-05T09:00:30')).length).toBe(1);
    expect(dueReminders([r], new Date('2026-10-05T09:05:00')).length).toBe(0);
  });
  test('disabled never fires', () => {
    expect(dueReminders([R({ enabled: false })], new Date('2026-10-05T09:00:10')).length).toBe(0);
  });
});

describe('sortReminders', () => {
  test('soonest first, disabled and past ones last', () => {
    const now = new Date('2026-10-05T00:00:00');
    const a = R({ id: 'a', at: '2026-10-10T09:00:00' });
    const b = R({ id: 'b', at: '2026-10-07T09:00:00' });
    const c = R({ id: 'c', at: '2026-10-01T09:00:00', enabled: false });
    const out = sortReminders([a, b, c], now);
    expect(out.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });
});
