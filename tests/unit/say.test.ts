import { describe, expect, test } from 'bun:test';
import { CLOSINGS, NEEDS, PHRASES, STAGES } from '../../src/content/say';
import { EMPTY_COMPOSE, EMPTY_VARS, compose, fill, phraseText, timePhrase, wrapText } from '../../src/lib/say';
import { scanText } from '../../src/lib/sensitive';

const BANNED = /360|manchester|hull|kieran|ritarian|itarian|\beset\b|barracuda|aptem|kyocera|ricoh|skillsforall|cisco|powercert|youtube|lucidchart|datto|n-able|atera|splashtop|teamviewer|anydesk/i;
const V = { ...EMPTY_VARS, name: 'Sam', me: 'Alex', issue: 'the printer queue', mins: '10', app: 'Outlook' };

describe('remote session messages', () => {
  test('library is complete, unique and original', () => {
    expect(PHRASES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(PHRASES.map((p) => p.id)).size).toBe(PHRASES.length);
    for (const p of PHRASES) {
      expect(STAGES).toContain(p.stage);
      expect(p.friendly.length).toBeGreaterThan(15); expect(p.brief.length).toBeGreaterThan(8);
      expect(p.brief.length).toBeLessThanOrEqual(p.friendly.length);
      expect(BANNED.test(p.title + p.friendly + p.brief)).toBe(false);
      expect(scanText(p.friendly + ' ' + p.brief)).toEqual([]);
    }
    for (const n of [...NEEDS.map((x) => x.id), ...CLOSINGS.map((x) => x.id).filter(Boolean)]) expect(PHRASES.some((p) => p.id === n)).toBe(true);
  });
  test('placeholders fill, optional segments drop, fallbacks read naturally', () => {
    expect(fill("Hi {name}, [[it's {me} from IT. ]]Looking at {issue}.", V)).toBe("Hi Sam, it's Alex from IT. Looking at the printer queue.");
    expect(fill("Hi {name}, [[it's {me} from IT. ]]Looking at {issue}.", EMPTY_VARS)).toBe('Hi there, Looking at the problem.');
    expect(fill('Wait {time}.', V)).toBe('Wait about 10 minutes.');
    expect(fill('Wait {time}.', EMPTY_VARS)).toBe('Wait a few minutes.');
    expect(fill('Try {app}.', EMPTY_VARS)).toBe('Try the application.');
    for (const p of PHRASES) for (const t of ['friendly', 'brief'] as const) expect(phraseText(p, t, EMPTY_VARS)).not.toMatch(/[{}[\]]/);
  });
  test('time phrase', () => {
    expect(timePhrase('1')).toBe('about a minute');
    expect(timePhrase('5')).toBe('about 5 minutes');
    expect(timePhrase('60')).toBe('about 1 hour');
    expect(timePhrase('120')).toBe('about 2 hours');
    for (const bad of ['', 'abc', '0', '-3', '9999']) expect(timePhrase(bad)).toBe('');
  });
  test('compose adds only what was chosen, in a sensible order', () => {
    const out = compose({ ...EMPTY_COMPOSE, vars: V, askTime: true, action: 'checking the print queue.', needs: ['save-work', 'hands-off'], closing: 'closing-fixed', thanks: true });
    const order = ["Hi Sam", 'good time', "Right now I'm checking the print queue.", 'leave the mouse', 'save your work', 'sorted', 'Thanks for your help, Sam'].map((s) => out.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(out).not.toMatch(/restart|password|privacy/i);
    const NT = { ...V, mins: '' };
    expect(compose({ ...EMPTY_COMPOSE, vars: NT, opening: false })).toBe('');
    expect(compose({ ...EMPTY_COMPOSE, vars: NT, opening: false, action: 'x', tone: 'brief', needs: [] })).toBe('Doing: x.');
  });
  test('time line only appears when no hands-off line already uses it', () => {
    expect(compose({ ...EMPTY_COMPOSE, vars: V, opening: false })).toMatch(/about 10 minutes/);
    expect(compose({ ...EMPTY_COMPOSE, vars: V, opening: false, needs: ['hands-off'] }).match(/about 10 minutes/g)?.length).toBe(1);
  });
  test('wrapping keeps words whole and respects line breaks', () => {
    const w = wrapText('one two three four five six seven eight nine ten\n\nlast', 20);
    for (const l of w.split('\n')) expect(l.length).toBeLessThanOrEqual(20);
    expect(w.replace(/\s+/g, ' ')).toBe('one two three four five six seven eight nine ten last');
    expect(wrapText('a b c', 0)).toBe('a b c');
    expect(wrapText('x'.repeat(50), 20)).toBe('x'.repeat(50));
  });
  test('hostile input does not throw or break placeholders', () => {
    const evil = { ...V, name: '{issue}', issue: '[[{me}]] {{name}}', mins: '1e3', app: '$&' };
    expect(() => compose({ ...EMPTY_COMPOSE, vars: evil, askTime: true, privacy: true, needs: NEEDS.map((n) => n.id), closing: 'escalate', thanks: true, wrap: 40 })).not.toThrow();
  });
});
