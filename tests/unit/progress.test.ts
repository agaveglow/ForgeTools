import { describe, expect, test } from 'bun:test';
import { ymd, weekStart, weekDays, taskDone, toggleTask, taskState, taskSummary, streak, hoursIn, weekHours, requirementProgress, nextRequirements, clampHours } from '../../src/lib/progress';
import type { Task, ApprenticeEntry, Requirement } from '../../src/data/types';

const base = { id: 'x', createdAt: '', updatedAt: '' };
const t = (o: Partial<Task>): Task => ({ ...base, title: 't', kind: 'daily', doneOn: [], ...o });
const NOW = new Date(2026, 9, 3, 12); // Sat 3 Oct 2026

describe('dates', () => {
  test('week runs Monday to Sunday', () => {
    expect(ymd(weekStart(NOW))).toBe('2026-09-28');
    expect(weekDays(NOW)[6]).toBe('2026-10-04');
    expect(ymd(weekStart(new Date(2026, 9, 4)))).toBe('2026-09-28'); // Sunday
  });
});

describe('tasks', () => {
  test('daily resets each day, weekly each week', () => {
    expect(taskDone(t({ doneOn: ['2026-10-02'] }), NOW)).toBe(false);
    expect(taskDone(t({ doneOn: ['2026-10-03'] }), NOW)).toBe(true);
    expect(taskDone(t({ kind: 'weekly', doneOn: ['2026-09-29'] }), NOW)).toBe(true);
    expect(taskDone(t({ kind: 'weekly', doneOn: ['2026-09-27'] }), NOW)).toBe(false);
  });
  test('toggle', () => {
    expect(toggleTask(t({}), NOW)).toEqual(['2026-10-03']);
    expect(toggleTask(t({ doneOn: ['2026-10-03', '2026-10-02'] }), NOW)).toEqual(['2026-10-02']);
    expect(toggleTask(t({ kind: 'weekly', doneOn: ['2026-09-30'] }), NOW)).toEqual([]);
    expect(toggleTask(t({ kind: 'once' }), NOW)).toEqual(['2026-10-03']);
  });
  test('one-off states and summary', () => {
    expect(taskState(t({ kind: 'once', due: '2026-10-01' }), NOW)).toBe('overdue');
    expect(taskState(t({ kind: 'once', due: '2026-10-03' }), NOW)).toBe('due');
    expect(taskState(t({ kind: 'once', due: '2026-10-09' }), NOW)).toBe('upcoming');
    const s = taskSummary([t({ doneOn: ['2026-10-03'] }), t({}), t({ kind: 'weekly' }), t({ kind: 'once', due: '2026-10-01' }), t({ archived: true })], NOW);
    expect(s).toMatchObject({ dailyDone: 1, dailyTotal: 2, weeklyTotal: 1, overdue: 1 });
  });
});

describe('streak and hours', () => {
  test('streak counts back and survives an empty today', () => {
    expect(streak(new Set(['2026-10-03', '2026-10-02', '2026-10-01', '2026-09-29']), NOW)).toBe(3);
    expect(streak(new Set(['2026-10-02', '2026-10-01']), NOW)).toBe(2);
    expect(streak(new Set(['2026-09-20']), NOW)).toBe(0);
  });
  const e = (date: string, hours: number, offTheJob = true): ApprenticeEntry => ({ ...base, date, hours, offTheJob, activity: 'Study', title: '', whatIDid: '', learned: '', reflection: '', requirementIds: [] });
  test('hours totals respect off-the-job flag and week', () => {
    const list = [e('2026-09-29', 2), e('2026-10-02', 1.5), e('2026-10-02', 3, false), e('2026-09-20', 4)];
    expect(weekHours(list, NOW)).toBe(3.5);
    expect(weekHours(list, NOW, false)).toBe(6.5);
    expect(hoursIn(list, '0000-01-01', '9999-12-31')).toBe(7.5);
    expect(clampHours(30)).toBe(24); expect(clampHours(1.1)).toBe(1); expect(clampHours(-3)).toBe(0);
  });
});

describe('requirements', () => {
  const r = (status: Requirement['status'], target?: string, title = 'r'): Requirement => ({ ...base, title, kind: 'job', group: '', status, target, notes: '' });
  test('progress and next-up ordering', () => {
    const list = [r('signed-off'), r('evidenced'), r('in-progress', '2026-11-01', 'b'), r('not-started', undefined, 'c'), r('not-started', '2026-10-10', 'a')];
    expect(requirementProgress(list)).toMatchObject({ total: 5, done: 2, signedOff: 1, pct: 40 });
    expect(nextRequirements(list).map((x) => x.title)).toEqual(['a', 'b', 'c']);
    expect(requirementProgress([]).pct).toBe(0);
  });
});

import { periodKey, boardStatus, moveTask, daysLeftInPeriod } from '../../src/lib/progress';
import { parseTaskLines, STARTER_LISTS } from '../../src/content/routines';

describe('monthly, quarterly and board', () => {
  const mk = (kind: Task['kind'], doneOn: string[] = [], extra: Partial<Task> = {}) => ({ id: 'x', createdAt: '', updatedAt: '', title: 't', kind, doneOn, ...extra }) as Task;
  test('period keys', () => {
    expect(periodKey('monthly', new Date(2026, 9, 3))).toBe('2026-10');
    expect(periodKey('quarterly', new Date(2026, 9, 3))).toBe('2026-Q4');
    expect(periodKey('quarterly', new Date(2026, 11, 31))).toBe('2026-Q4');
  });
  test('done lasts for the period then resets', () => {
    const t = mk('quarterly', ['2026-10-02']);
    expect(taskDone(t, new Date(2026, 11, 30))).toBe(true);
    expect(taskDone(t, new Date(2027, 0, 1))).toBe(false);
    const m = mk('monthly', ['2026-09-30']);
    expect(taskDone(m, new Date(2026, 9, 1))).toBe(false);
  });
  test('toggle only affects this period', () => {
    const t = mk('monthly', ['2026-09-10', '2026-10-02']);
    expect(toggleTask(t, new Date(2026, 9, 5))).toEqual(['2026-09-10']);
    expect(toggleTask(mk('monthly', ['2026-09-10']), new Date(2026, 9, 5))).toEqual(['2026-09-10', '2026-10-05']);
  });
  test('days left', () => {
    expect(daysLeftInPeriod('monthly', new Date(2026, 9, 30))).toBe(1);
    expect(daysLeftInPeriod('quarterly', new Date(2026, 9, 3))).toBe(89);
    expect(daysLeftInPeriod('daily', new Date())).toBeUndefined();
  });
  test('board moves', () => {
    const now = new Date(2026, 9, 3);
    const t = mk('once');
    expect(boardStatus(t)).toBe('todo');
    const d = moveTask(t, 'done', now);
    expect(d.doneOn).toEqual(['2026-10-03']);
    expect(boardStatus(d)).toBe('done');
    const back = moveTask(d, 'doing', now);
    expect(back.doneOn).toEqual([]);
    expect(boardStatus(back)).toBe('doing');
    expect(boardStatus(mk('once', [], { status: 'done' }))).toBe('todo');
  });
  test('parse pasted lists', () => {
    const l = parseTaskLines('📆 Quarterly tasks\n- Review backups\n2. Check licences\n[ ] Review backups\n\nx');
    expect(l).toEqual(['Review backups', 'Check licences']);
    expect(STARTER_LISTS.find((x) => x.kind === 'quarterly')?.items.length).toBe(9);
  });
});
