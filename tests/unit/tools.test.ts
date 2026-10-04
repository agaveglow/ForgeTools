import { describe, expect, test } from 'bun:test';
import { EMPTY_NOTE, closureNote, customerUpdate, isEmptyNote } from '../../src/lib/ticketNote';
import { fitSize, pixelBlock, rectFromPoints, toImage } from '../../src/lib/redact';
import { PINOUT, ends } from '../../src/content/cabling';
import { KIT_LISTS } from '../../src/content/kit';
import { scanText } from '../../src/lib/sensitive';

describe('ticket note builder', () => {
  const f = { ...EMPTY_NOTE, reported: 'Printer will not scan to folder', scope: 'One user', checks: 'Printer online, folder reachable from another PC', cause: 'the scan account password had changed', action: 'updated the saved scan credentials', test: 'sent a scan and it arrived' };
  test('closure note', () => {
    const n = closureNote(f);
    expect(n).toContain('Reported: Printer will not scan to folder.');
    expect(n).toContain('Cause: the scan account password had changed.');
    expect(n).not.toContain('Follow-up');
  });
  test('customer update and escalation', () => {
    expect(customerUpdate(f)).toContain('The cause was the scan account password had changed.');
    const e = customerUpdate({ ...f, escalated: true, followUp: 'a senior engineer will contact you' });
    expect(e).toContain('passed it to a senior colleague');
    expect(closureNote({ ...f, escalated: true })).toContain('Escalated: yes.');
  });
  test('empty detection', () => { expect(isEmptyNote(EMPTY_NOTE)).toBe(true); expect(isEmptyNote(f)).toBe(false); });
});

describe('redactor geometry', () => {
  test('rect from drag, clamped and ignoring tiny drags', () => {
    expect(rectFromPoints(50, 40, 10, 5, 100, 100)).toEqual({ x: 10, y: 5, w: 40, h: 35 });
    expect(rectFromPoints(-20, -20, 500, 500, 100, 80)).toEqual({ x: 0, y: 0, w: 100, h: 80 });
    expect(rectFromPoints(10, 10, 11, 11, 100, 100)).toBeNull();
  });
  test('pointer to image coordinates and sizing', () => {
    expect(toImage(150, 120, { left: 50, top: 20, width: 200, height: 100 }, 400, 200)).toEqual([200, 200]);
    expect(fitSize(4000, 2000)).toEqual({ w: 2000, h: 1000 });
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 });
    expect(pixelBlock({ x: 0, y: 0, w: 300, h: 60 })).toBe(20);
  });
});

describe('cabling and kit content', () => {
  test('pinouts have eight wires and the right differences', () => {
    expect(PINOUT.T568A).toHaveLength(8); expect(PINOUT.T568B).toHaveLength(8);
    expect(PINOUT.T568B[0].name).toBe('White/Orange'); expect(PINOUT.T568A[0].name).toBe('White/Green');
    expect(PINOUT.T568A[3].name).toBe(PINOUT.T568B[3].name);
  });
  test('cable ends', () => {
    expect(ends('straight', 'T568B')).toEqual(['T568B', 'T568B']);
    expect(ends('crossover', 'T568B')).toEqual(['T568A', 'T568B']);
  });
  test('kit lists carry nothing sensitive', () => {
    for (const l of KIT_LISTS) expect(scanText(l.items.join('\n'))).toEqual([]);
    expect(new Set(KIT_LISTS.map((l) => l.id)).size).toBe(KIT_LISTS.length);
  });
});
