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
