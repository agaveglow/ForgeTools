import { describe, expect, test } from 'bun:test';
import { acceptedHours, AP_STATUS, isFutureDate, MAX_MINUTES, possibleDuplicate, statusLabel, aptemFields, aptemText, DEFAULT_COMPONENTS, descriptionFor, dmy, filterComponents, hoursFromMinutes, minutesOf, parseComponentList, splitMinutes, timeText, toMinutes } from '../../src/lib/aptem';

describe('Aptem form helpers', () => {
  test('hours and minutes combine and split exactly', () => {
    expect(toMinutes(1, 35)).toBe(95);
    expect(splitMinutes(95)).toEqual({ hours: 1, minutes: 35 });
    expect(toMinutes(0, 0)).toBe(0);
    expect(toMinutes(13, 0)).toBe(780); // over the limit is reported, not hidden
    expect(MAX_MINUTES).toBe(720);
    expect(toMinutes(-2, -5)).toBe(0);
    expect(hoursFromMinutes(95)).toBe(1.58);
    expect(timeText(95)).toBe('1 h 35 min'); expect(timeText(120)).toBe('2 h'); expect(timeText(35)).toBe('35 min');
  });
  test('older entries with only hours still give minutes', () => {
    expect(minutesOf({ hours: 2.5 })).toBe(150);
    expect(minutesOf({ hours: 2.5, minutes: 140 })).toBe(140);
  });
  test('date is dd/mm/yyyy like Aptem', () => { expect(dmy('2026-10-04')).toBe('04/10/2026'); });
  test('the link is added on its own line, and nothing is added without one', () => {
    expect(descriptionFor('Watched X.', 'https://youtu.be/a')).toBe('Watched X.\nLink: https://youtu.be/a');
    expect(descriptionFor('  Watched X.  ')).toBe('Watched X.');
  });
  test('component search needs every word, any order, any case', () => {
    expect(filterComponents(DEFAULT_COMPONENTS, 'module 3 cyber')).toEqual(['Module 3 Cyber Defence Practical Application']);
    expect(filterComponents(DEFAULT_COMPONENTS, 'ASSIGNMENT 5')).toEqual(['Module 5 Assignment']);
    expect(filterComponents(DEFAULT_COMPONENTS, '')).toEqual(DEFAULT_COMPONENTS);
    expect(filterComponents(DEFAULT_COMPONENTS, 'zzz')).toEqual([]);
  });
  test('component list text: trims, drops blanks and repeats', () => {
    expect(parseComponentList('  A  b \n\nA B\nC\r\n')).toEqual(['A b', 'C']);
    expect(parseComponentList('x\n'.repeat(5)).length).toBe(1);
    expect(parseComponentList(Array.from({ length: 300 }, (_, i) => `c${i}`).join('\n')).length).toBe(200);
  });
  test('fields come out in Aptem order with Aptem labels, and empty ones are left out', () => {
    const f = aptemFields({ date: '2026-10-04', hours: 1.58, minutes: 95, aptemType: 'otj', when: 'paid', offTheJob: true, whatIDid: 'Watched X.', learned: '', reflection: '', link: 'https://youtu.be/a', component: 'Module 1 Self-Paced Learning' });
    expect(f.map((x) => x.label)).toEqual(['Type of activity', 'When did this activity take place?', 'Describe the activity', 'Date of activity', 'Time spent: Hours', 'Time spent: Minutes', 'Which component does this activity apply to?']);
    expect(f[0].value).toBe('Off-the-Job training');
    expect(f[2].value).toBe('Watched X.\nLink: https://youtu.be/a');
    expect(f[3].value).toBe('04/10/2026');
    expect(f[4].value).toBe('1'); expect(f[5].value).toBe('35');
    expect(aptemText(f).split('\n')[0]).toBe('Type of activity: Off-the-Job training');
    const none = aptemFields({ date: '2026-10-04', hours: 1, offTheJob: false, whatIDid: 'x', learned: '', reflection: '' });
    expect(none.some((x) => x.label.startsWith('Which component'))).toBe(false);
    expect(none[0].value).toBe('Other');
  });
  test('an older entry that had learned and reflection text keeps it in the description', () => {
    const f = aptemFields({ date: '2026-10-04', hours: 1, offTheJob: true, whatIDid: 'Did.', learned: 'Learned.', reflection: 'Refl.' });
    expect(f.find((x) => x.label === 'Describe the activity')?.value).toBe('Did.\n\nLearned.\n\nRefl.');
  });
  test('the starting component list has no repeats', () => { expect(new Set(DEFAULT_COMPONENTS.map((c) => c.toLowerCase())).size).toBe(DEFAULT_COMPONENTS.length); });
  test('only accepted off-the-job entries count as verified', () => {
    const e = (id: string, minutes: number, status: never, otj = true) => ({ id, minutes, hours: minutes / 60, offTheJob: otj, aptemStatus: status }) as never;
    expect(acceptedHours([e('a', 90, 'accepted' as never), e('b', 60, 'submitted' as never), e('c', 30, 'accepted' as never, false), e('d', 60, undefined as never)])).toBe(1.5);
    expect(AP_STATUS.filter((s) => s.counts).map((s) => s.id)).toEqual(['accepted']);
    expect(statusLabel('rejected')).toContain('Rejected'); expect(statusLabel(undefined)).toBe('');
  });
  test('future dates are refused', () => { expect(isFutureDate('2026-10-05', '2026-10-04')).toBe(true); expect(isFutureDate('2026-10-04', '2026-10-04')).toBe(false); });
  test('same date, component and time is flagged as a possible duplicate', () => {
    const list = [{ id: 'x', date: '2026-10-04', component: 'Module 1 Assignment', minutes: 60, hours: 1 }] as never[];
    expect(possibleDuplicate(list, { date: '2026-10-04', component: 'Module 1 Assignment', minutes: 60 })?.id).toBe('x');
    expect(possibleDuplicate(list, { date: '2026-10-04', component: 'Module 1 Assignment', minutes: 45 })).toBeUndefined();
    expect(possibleDuplicate(list, { date: '2026-10-04', component: 'Module 1 Assignment', minutes: 60 }, 'x')).toBeUndefined();
    expect(possibleDuplicate(list, { date: '2026-10-04', component: '', minutes: 60 })).toBeUndefined();
  });
});
