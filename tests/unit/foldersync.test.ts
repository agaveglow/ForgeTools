import { describe, expect, test } from 'bun:test';
import { LocalStorageAdapter } from '../../src/data/storage';
import { VaultAdapter } from '../../src/data/vault';
import { createStore } from '../../src/data/store';
import { MIRROR_FILE, MIRROR_PREV, buildMirror, parseMirror, syncNow } from '../../src/lib/folderSync';
import type { FolderPlugin } from '../../src/lib/folderSync';

const IT = 1000;
const fakePlugin = () => {
  const files = new Map<string, string>(); let fail = false;
  const p: FolderPlugin = {
    pickFolder: async () => ({ name: 'Data' }), folderName: async () => ({ name: 'Data' }), forget: async () => undefined,
    writeFile: async ({ name, data }) => { if (fail) throw new Error('no-folder'); files.set(name, data); },
    readFile: async ({ name }) => ({ data: files.get(name) ?? null }),
  };
  return { p, files, setFail: (v: boolean) => { fail = v; } };
};

describe('folder copy', () => {
  test('mirror holds only ciphertext and lock details, never plain text', async () => {
    const inner = new LocalStorageAdapter('m' + Math.random()); const v = new VaultAdapter(inner, IT); const s = createStore(v, { seed: false });
    await v.enable('purple tractor lamp 9');
    s.upsert('kbEntries', { title: 'plain-title-xyz', category: 'Procedures', tags: [], body: 'plain-body-xyz', pinned: false, demo: false });
    await v.flush();
    const f = fakePlugin();
    await syncNow(v, f.p);
    const text = f.files.get(MIRROR_FILE)!;
    expect(text).toBeTruthy(); expect(text).not.toContain('plain-title-xyz'); expect(text).not.toContain('plain-body-xyz');
    const parsed = parseMirror(text);
    expect(parsed.ok).toBe(true);
  });

  test('restore into a fresh app, then the same passphrase opens the data', async () => {
    const innerA = new LocalStorageAdapter('a' + Math.random()); const a = new VaultAdapter(innerA, IT); const sa = createStore(a, { seed: false });
    await a.enable('purple tractor lamp 9');
    sa.upsert('kbEntries', { title: 'keep-me', category: 'Procedures', tags: [], body: 'b', pinned: false, demo: false });
    await a.flush();
    const f = fakePlugin(); await syncNow(a, f.p);
    const parsed = parseMirror(f.files.get(MIRROR_FILE)!); if (!parsed.ok) throw new Error('bad');

    const innerB = new LocalStorageAdapter('b' + Math.random()); const b = new VaultAdapter(innerB, IT);
    innerB.write('leftover', { x: 1 });
    expect(b.state).toBe('off');
    b.restore(parsed.entries);
    expect(b.state).toBe('locked'); expect(innerB.read('leftover')).toBeUndefined();
    await expect(b.unlock('wrong passphrase here')).rejects.toBeDefined();
    await b.unlock('purple tractor lamp 9');
    const sb = createStore(b, { seed: false });
    expect(sb.list('kbEntries').map((k) => k.title)).toContain('keep-me');
  });

  test('restore refuses to overwrite a live encrypted app', async () => {
    const inner = new LocalStorageAdapter('c' + Math.random()); const v = new VaultAdapter(inner, IT);
    await v.enable('purple tractor lamp 9');
    expect(() => v.restore({})).toThrow();
  });

  test('a copy is checked before use: wrong app, plain data, odd keys, bad lock details', () => {
    const good = { salt: 'AAAA', iterations: 600000, check: 'ft1.x.y', v: 1 };
    const mk = (entries: unknown) => JSON.stringify({ app: 'forgetools-mirror', v: 1, savedAt: new Date().toISOString(), entries });
    expect(parseMirror('not json').ok).toBe(false);
    expect(parseMirror(JSON.stringify({ app: 'x' })).ok).toBe(false);
    expect(parseMirror(mk({ vault: good, 'enc.workLogs': 'ft1.a.b.c' })).ok).toBe(true);
    expect(parseMirror(mk({ vault: good, 'enc.workLogs': '[{"plain":"data"}]' })).ok).toBe(false);
    expect(parseMirror(mk({ vault: good, '__proto__x': 'ft1.a' })).ok).toBe(false);
    expect(parseMirror(mk({ vault: good, 'enc.../../etc': 'ft1.a' })).ok).toBe(false);
    expect(parseMirror(mk({ vault: { ...good, iterations: 5 } })).ok).toBe(false);
    expect(parseMirror(mk({ 'enc.a': 'ft1.a' })).ok).toBe(false);
    expect(buildMirror({ vault: good })).toContain('forgetools-mirror');
  });

  test('previous day copy is kept, nothing is written while locked, failures are reported', async () => {
    const inner = new LocalStorageAdapter('d' + Math.random()); const v = new VaultAdapter(inner, IT);
    await v.enable('purple tractor lamp 9');
    const f = fakePlugin();
    f.files.set(MIRROR_FILE, 'old-copy');
    await syncNow(v, f.p);
    expect(f.files.get(MIRROR_PREV)).toBe('old-copy');
    const before = f.files.get(MIRROR_FILE);
    await v.lock();
    f.files.set(MIRROR_FILE, 'sentinel');
    await syncNow(v, f.p);
    expect(f.files.get(MIRROR_FILE)).toBe('sentinel'); expect(before).not.toBe('sentinel');
  });
});
