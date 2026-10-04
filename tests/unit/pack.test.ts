import { describe, expect, test } from 'bun:test';
import { PackError, parsePack, planPack } from '../../src/lib/pack';

const mk = (o: Record<string, unknown>) => JSON.stringify({ forgetoolsPack: 1, name: 'Test pack', ...o });

describe('pack reading', () => {
  test('reads guides and requirements, tidying them', () => {
    const { pack, dropped } = parsePack(mk({ kb: [{ title: '  Reset a thing ', category: 'Procedures', tags: ['A', 'a', ' b '], body: 'STEPS\n1. Do it' }], requirements: [{ title: 'Learn X', kind: 'job', group: 'Week 1', notes: 'n' }] }));
    expect(dropped).toEqual([]);
    expect(pack.kb[0].title).toBe('Reset a thing');
    expect(pack.kb[0].tags).toEqual(['a', 'b']);
    expect(pack.requirements[0].kind).toBe('job');
  });
  test('an unknown category falls back to References and an unknown kind to apprenticeship', () => {
    const { pack } = parsePack(mk({ kb: [{ title: 't', category: 'Nope', body: 'b' }], requirements: [{ title: 'r', kind: 'x' }] }));
    expect(pack.kb[0].category).toBe('References');
    expect(pack.requirements[0].kind).toBe('apprenticeship');
  });
  test('things that are not packs are refused with a clear error', () => {
    expect(() => parsePack('not json')).toThrow(PackError);
    expect(() => parsePack('{"kb":[]}')).toThrow(PackError);
    expect(() => parsePack(mk({}))).toThrow(PackError);
    expect(() => parsePack('x'.repeat(4 * 1024 * 1024))).toThrow(PackError);
  });
  test('unusable items are dropped and reported, not guessed', () => {
    const { pack, dropped } = parsePack(mk({ kb: [{ title: '', body: 'b' }, { title: 'ok', body: 'b' }], requirements: [{ kind: 'job' }] }));
    expect(pack.kb.length).toBe(1);
    expect(dropped.length).toBe(2);
  });
});

describe('pack plan', () => {
  const pack = parsePack(mk({
    kb: [{ title: 'Guide A', body: 'A body' }, { title: 'guide  a', body: 'repeat in the same pack' }, { title: 'Guide B', body: 'B body' }, { title: 'Has secret', body: 'password is Hunter2!x' }],
    requirements: [{ title: 'Req 1', group: 'W1' }, { title: 'Req 1', group: 'W2' }, { title: 'Req 1', group: 'W1' }],
  })).pack;
  test('skips what is already here and repeats inside the pack, so importing twice is safe', () => {
    const p = planPack(pack, ['guide b'], [{ title: 'req 1', group: 'w1' }]);
    expect(p.kbNew.map((k) => k.title)).toEqual(['Guide A']);
    expect(p.kbHere).toBe(2); // Guide B already here, "guide  a" repeats Guide A
    expect(p.reqNew.map((r) => r.group)).toEqual(['W2']);
    expect(p.reqHere).toBe(2);
  });
  test('a guide containing a secret is refused, never added', () => {
    const p = planPack(pack, [], []);
    expect(p.refused.some((r) => r.title === 'Has secret')).toBe(true);
    expect(p.kbNew.some((k) => k.title === 'Has secret')).toBe(false);
  });
  test('personal-looking details are flagged for checking but not silently dropped', () => {
    const w = parsePack(mk({ kb: [{ title: 'Has email', body: 'Ask jane.doe@acme-widgets.co.uk' }] })).pack;
    const p = planPack(w, [], []);
    expect(p.warnings.length).toBe(1);
    expect(p.kbNew.length).toBe(1);
  });
});
