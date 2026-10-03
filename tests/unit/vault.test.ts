import { describe, expect, test } from 'bun:test';
import { CryptoError, decryptText, deriveKey, encryptText, isCiphertext, isEnvelope, openWithPassphrase, passphraseProblem, sealWithPassphrase, randomBytes } from '../../src/lib/crypto';
import { LocalStorageAdapter } from '../../src/data/storage';
import { VaultAdapter } from '../../src/data/vault';
import { createStore } from '../../src/data/store';

const IT = 1000; // fast for tests; the app uses 600k

describe('crypto', () => {
  test('round trip, fresh IV each time', async () => {
    const k = await deriveKey('correct horse', randomBytes(16), IT);
    const a = await encryptText(k, 'hello'); const b = await encryptText(k, 'hello');
    expect(isCiphertext(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(await decryptText(k, a)).toBe('hello');
  });
  test('wrong key and tampering are rejected', async () => {
    const salt = randomBytes(16);
    const k1 = await deriveKey('one-pass-word', salt, IT); const k2 = await deriveKey('two-pass-word', salt, IT);
    const c = await encryptText(k1, 'secret');
    await expect(decryptText(k2, c)).rejects.toBeInstanceOf(CryptoError);
    const parts = c.split('.'); parts[2] = parts[2].slice(0, -4) + 'AAAA';
    await expect(decryptText(k1, parts.join('.'))).rejects.toBeInstanceOf(CryptoError);
  });
  test('envelope seal/open and bad iteration counts', async () => {
    const env = await sealWithPassphrase('a long passphrase', '{"x":1}', IT);
    expect(isEnvelope(env)).toBe(true);
    expect(await openWithPassphrase('a long passphrase', env)).toBe('{"x":1}');
    await expect(openWithPassphrase('nope nope nope', env)).rejects.toBeInstanceOf(CryptoError);
    await expect(openWithPassphrase('a long passphrase', { ...env, iterations: 1 })).rejects.toBeInstanceOf(CryptoError);
  });
  test('passphrase rules', () => {
    expect(passphraseProblem('short')).not.toBeNull();
    expect(passphraseProblem('aaaaaaaaaa')).not.toBeNull();
    expect(passphraseProblem('password123')).not.toBeNull();
    expect(passphraseProblem('purple-tractor-lamp-9')).toBeNull();
  });
});

describe('vault', () => {
  const make = () => { const inner = new LocalStorageAdapter('t' + Math.random()); return { inner, v: new VaultAdapter(inner, IT) }; };

  test('enable encrypts existing data, lock hides it, unlock restores it', async () => {
    const { inner, v } = make();
    const s = createStore(v, { seed: false });
    s.upsert('kbEntries', { title: 'Top secret title', category: 'Procedures', tags: [], body: 'body text', pinned: false, demo: false });
    await v.enable('purple tractor lamp');
    await v.flush();
    const raw = JSON.stringify(inner.keys().map((k) => inner.read(k)));
    expect(raw).not.toContain('Top secret title');
    expect(inner.keys().some((k) => k === 'kbEntries')).toBe(false);
    s.reload();
    expect(s.list('kbEntries').length).toBe(1);
    await v.lock();
    s.reload();
    expect(s.list('kbEntries').length).toBe(0);
    await expect(v.unlock('wrong wrong wrong')).rejects.toBeInstanceOf(CryptoError);
    await v.unlock('purple tractor lamp');
    s.reload();
    expect(s.list('kbEntries')[0].title).toBe('Top secret title');
  });

  test('new writes while unlocked are stored encrypted and survive a restart', async () => {
    const { inner, v } = make();
    const s = createStore(v, { seed: false });
    await v.enable('purple tractor lamp');
    s.upsert('workLogs', { ref: 'WL-1', occurredAt: new Date().toISOString(), client: '', device: 'Laptop XYZ', category: 'Other', problem: 'unique-problem-text', investigation: '', actions: '', result: '', followUp: '', status: 'info', skills: [], learned: '', evidence: '', ticket: '', demo: false });
    await v.flush();
    expect(JSON.stringify(inner.keys().map((k) => inner.read(k)))).not.toContain('unique-problem-text');
    const v2 = new VaultAdapter(inner, IT); // simulates reopening the app
    expect(v2.state).toBe('locked');
    await v2.unlock('purple tractor lamp');
    expect(createStore(v2, { seed: false }).list('workLogs')[0].problem).toBe('unique-problem-text');
  });

  test('locked adapter ignores writes and returns nothing', async () => {
    const { inner, v } = make();
    await v.enable('purple tractor lamp'); await v.lock();
    v.write('x', { a: 1 });
    expect(v.read('x')).toBeUndefined();
    expect(v.keys()).toEqual([]);
    expect(inner.read('enc.x')).toBeUndefined();
  });

  test('disable restores plain data; destroy wipes', async () => {
    const { inner, v } = make();
    v.write('settings', { theme: 'dark' });
    await v.enable('purple tractor lamp');
    await v.disable();
    expect(v.state).toBe('off');
    expect((inner.read('settings') as { theme: string }).theme).toBe('dark');
    expect(inner.read('vault')).toBeUndefined();
    await v.enable('purple tractor lamp'); await v.lock();
    v.destroy();
    expect(inner.keys().length).toBe(0);
    expect(v.state).toBe('off');
  });
});
