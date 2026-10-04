import { describe, expect, test } from 'bun:test';
import { guessBrand, searchPages, snippetAround, formatBytes } from '../../src/lib/manualSearch';

const pages = [
  { page: 1, text: 'Contents. Introduction to the machine.' },
  { page: 7, text: 'Clearing a paper jam in the duplex unit. Open the left cover and remove the jammed paper.' },
  { page: 9, text: 'Paper jam in the bypass tray. Paper jam code C6000 appears.' },
];
describe('manual search', () => {
  test('needs every word and ranks by relevance', () => {
    const h = searchPages(pages, 'paper jam');
    expect(h.map((x) => x.page).sort()).toEqual([7, 9]);
    expect(searchPages(pages, 'jammed')[0].page).toBe(7);
  });
  test('phrase match outranks scattered words', () => {
    const h = searchPages([{ page: 1, text: 'jam of paper rolls' }, { page: 2, text: 'a paper jam' }], 'paper jam');
    expect(h[0].page).toBe(2);
  });
  test('fault codes and short numbers work', () => {
    expect(searchPages(pages, 'C6000')[0].page).toBe(9);
    expect(searchPages(pages, 'zzz')).toEqual([]);
    expect(searchPages(pages, '  ')).toEqual([]);
  });
  test('snippet is centred on the match and trimmed', () => {
    const s = snippetAround('x '.repeat(100) + 'toner empty here ' + 'y '.repeat(100), ['toner']);
    expect(s).toContain('toner empty');
    expect(s.startsWith('…') && s.endsWith('…')).toBe(true);
    expect(s.length).toBeLessThan(200);
  });
  test('brand guess and sizes', () => {
    expect(guessBrand('EpsonWF579r_UserGuide.pdf')).toBe('Epson');
    expect(guessBrand('Service_Manual_-_ineo_227.pdf')).toBe('Develop');
    expect(guessBrand('SM_2506ci_3206ci.pdf')).toBe('UTAX');
    expect(guessBrand('misc.pdf')).toBe('Other');
    expect(formatBytes(46385500)).toBe('44 MB');
    expect(formatBytes(2048)).toBe('2 KB');
  });
});

import { WORKFLOW_LISTS, WORKFLOW_LOOP, WORKFLOW_MONITOR, WORKFLOW_PRIORITIES, WORKFLOW_QUICK } from '../../src/content/workflow';
describe('daily workflow content', () => {
  test('matches the walkthrough: 38 checklist items in 5 lists', () => {
    expect(WORKFLOW_LISTS.map((l) => l.items.length)).toEqual([7, 8, 8, 7, 8]);
    expect(new Set(WORKFLOW_LISTS.map((l) => l.id)).size).toBe(5);
    expect([WORKFLOW_PRIORITIES.length, WORKFLOW_LOOP.length, WORKFLOW_MONITOR.length, WORKFLOW_QUICK.length]).toEqual([4, 5, 9, 6]);
  });
});

import { analyseTopic } from '../../src/lib/agent';
import { COMMANDS } from '../../src/content/commands';
import { WORKFLOWS } from '../../src/content/workflows';
describe('local administrator how-to', () => {
  const ask = (q: string) => analyseTopic(q, { logs: [], kb: [] } as never);
  test('asking how to add a local admin gets the create procedure, not the audit', () => {
    for (const q of ['how to add a local admin account on a users device', 'create a local administrator account', 'add admin account to customer pc']) {
      expect(ask(q).matches[0].workflow.id).toBe('win-create-local-admin');
    }
    expect(ask('local admin review least privilege').matches[0].workflow.id).toBe('sec-local-admin-review');
  });
  test('the nine steps follow the supplied procedure, in order', () => {
    const w = WORKFLOWS.find((x) => x.id === 'win-create-local-admin')!;
    expect(w.steps.map((s) => s.commandIds?.[0])).toEqual(['whoami', 'hostname', 'net-user', 'net-localgroup-administrators', 'dsregcmd-status', 'net-user-add', 'net-localgroup-add', 'net-user', 'net-localgroup-administrators']);
    expect(COMMANDS.find((c) => c.id === 'net-user-add')!.example).toBe('net user ITSupport * /add');
    expect(COMMANDS.find((c) => c.id === 'net-localgroup-add')!.example).toBe('net localgroup Administrators ITSupport /add');
    expect(w.documentation.join(' ')).toContain('Do not record the password');
  });
});

import { GLANCE_APPS, GLANCE_ICONS, honeycombRows, ringDash, ringFraction } from '../../src/lib/glance';
describe('glance home', () => {
  test('bubbles stagger 3,4 and every app has an icon and a unique route', () => {
    expect(honeycombRows(GLANCE_APPS).map((r) => r.length)).toEqual([3, 4]);
    expect(GLANCE_APPS.every((a) => GLANCE_ICONS[a.icon]?.length > 0)).toBe(true);
    expect(new Set(GLANCE_APPS.map((a) => a.to)).size).toBe(GLANCE_APPS.length);
    expect(honeycombRows([1, 2, 3, 4, 5], [2])).toEqual([[1, 2], [3, 4], [5]]);
  });
  test('ring maths clamps and never divides by zero', () => {
    expect(ringFraction(3, 4)).toBe(0.75);
    expect(ringFraction(9, 4)).toBe(1);
    expect(ringFraction(1, 0)).toBe(0);
    expect(ringFraction(-2, 4)).toBe(0);
    const c = 2 * Math.PI * 50;
    expect(ringDash(50, 0.5)).toBe(`${(c / 2).toFixed(2)} ${c.toFixed(2)}`);
  });
});

import { AREAS, areaOfPath, parentPath } from '../../src/lib/areas';
describe('areas and navigation', () => {
  test('every page is in exactly one area, with an icon', () => {
    const all = AREAS.flatMap((a) => a.pages.map((p) => p.to));
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(22);
    for (const a of AREAS) for (const p of a.pages) expect(GLANCE_ICONS[p.icon]?.length).toBeGreaterThan(0);
  });
  test('paths belong to the right area', () => {
    expect(areaOfPath('/tasks')?.id).toBe('today');
    expect(areaOfPath('/checks/qbr')?.id).toBe('today');
    expect(areaOfPath('/session/abc')?.id).toBe('fix');
    expect(areaOfPath('/kb/xyz/edit')?.id).toBe('fix');
    expect(areaOfPath('/guides')?.id).toBe('fix'); expect(areaOfPath('/procedures/abc')?.id).toBe('fix'); expect(areaOfPath('/library/abc')?.id).toBe('fix');
    expect(areaOfPath('/logs/new')?.id).toBe('notes');
    expect(areaOfPath('/nowhere')).toBeUndefined();
  });
  test('back goes up one level, then to the area, then home', () => {
    expect(parentPath('/')).toBeNull();
    expect(parentPath('/a/today')).toBe('/');
    expect(parentPath('/apps')).toBe('/');
    expect(parentPath('/settings')).toBe('/');
    expect(parentPath('/tasks')).toBe('/a/today');
    expect(parentPath('/checks/qbr')).toBe('/checks');
    expect(parentPath('/logs/abc/edit')).toBe('/logs/abc');
    expect(parentPath('/session/abc')).toBe('/troubleshoot');
    expect(parentPath('/unknown')).toBe('/');
    expect(parentPath('/kb')).toBe('/guides'); expect(parentPath('/kb/abc')).toBe('/kb'); expect(parentPath('/guides')).toBe('/a/fix');
  });
});

import { cleanEdit } from '../../src/lib/manuals';
describe('editing a manual', () => {
  test('trims and tidies the name', () => {
    expect(cleanEdit({ title: '  My   guide  ', brand: 'Epson', note: ' x ' }, 'Old').title).toBe('My guide');
    expect(cleanEdit({ title: '  My   guide  ', brand: 'Epson', note: ' x ' }, 'Old').note).toBe('x');
  });
  test('a blank name keeps the old one, so a manual is never unnamed', () => {
    expect(cleanEdit({ title: '   ', brand: 'Ricoh', note: '' }, 'Old name').title).toBe('Old name');
  });
  test('an unknown brand becomes Other', () => {
    expect(cleanEdit({ title: 'a', brand: 'Nashuatec', note: '' }, 'o').brand).toBe('Other');
    expect(cleanEdit({ title: 'a', brand: 'Sharp', note: '' }, 'o').brand).toBe('Sharp');
  });
  test('name and note are length-limited', () => {
    const c = cleanEdit({ title: 'a'.repeat(500), brand: 'Epson', note: 'b'.repeat(900) }, 'o');
    expect(c.title.length).toBe(120);
    expect(c.note.length).toBe(300);
  });
});
