import { describe, expect, test } from 'bun:test';
import { buildWalkthrough, walkthroughToGuide, walkthroughBody } from '../../src/lib/walkthrough';
import { parseTranscriptText, transcribeAudio, TranscribeError, isAudioFile, isTranscriptFile } from '../../src/lib/transcribe';
import { extractReadable, searchWeb, fetchReadable, validateUrl, WebError } from '../../src/lib/web';
import { MemoryFiles, NativeFiles, EncryptingFiles, setFileCipher, slugify, uniquePath } from '../../src/data/files';

const ctx = { logs: [], kb: [] };

describe('walkthrough', () => {
  const t = 'To reset the print spooler. First open an admin command prompt. Then run net stop spooler. Next delete the files in the spool folder. Finally run net start spooler. The queue then printed again. Be careful not to delete the folder itself.';
  test('orders steps, keeps commands and cautions, invents nothing', () => {
    const w = buildWalkthrough(t);
    expect(w.steps.length).toBeGreaterThanOrEqual(4);
    expect(w.commands.join(' ')).toContain('net stop spooler');
    expect(w.cautions.join(' ')).toMatch(/careful/i);
    const all = JSON.stringify(w).toLowerCase();
    expect(all).not.toContain('reboot');
  });
  test('warns when there are no steps or result', () => {
    const w = buildWalkthrough('we talked about the printer for a bit');
    expect(w.warnings.length).toBeGreaterThan(0);
  });
  test('guide carries voice-note tag and body keeps the transcript', () => {
    const w = buildWalkthrough(t);
    const g = walkthroughToGuide(w, ctx);
    expect(g.tags).toContain('voice-note');
    expect(walkthroughBody('GUIDE', t)).toContain(t.slice(0, 30));
  });
});

describe('transcribe', () => {
  test('srt and vtt are flattened', () => {
    expect(parseTranscriptText('a.srt', '1\n00:00:01,000 --> 00:00:02,000\nHello there\n\n2\n00:00:02,000 --> 00:00:03,000\nHello there\n\n3\n00:00:03,000 --> 00:00:04,000\nNext step')).toBe('Hello there Next step');
    expect(parseTranscriptText('a.txt', ' plain ')).toBe('plain');
  });
  test('file type detection', () => {
    expect(isAudioFile({ name: 'x.m4a' })).toBe(true);
    expect(isTranscriptFile({ name: 'x.vtt' })).toBe(true);
    expect(isAudioFile({ name: 'x.txt' })).toBe(false);
  });
  const blob = new Blob(['abc'], { type: 'audio/mp4' });
  const okFetch = (body: string, status = 200) => async () => ({ ok: status < 400, status, text: async () => body });
  test('sends bearer key, returns text', async () => {
    let seen: Record<string, string> = {};
    const f = async (_u: string, init: { headers?: Record<string, string> }) => { seen = init.headers ?? {}; return { ok: true, status: 200, text: async () => '{"text":" hi "}' }; };
    expect(await transcribeAudio(blob, { url: 'https://x.test/v1', key: 'k' }, f as never)).toBe('hi');
    expect(seen.Authorization).toBe('Bearer k');
  });
  test('refuses http to the internet, empty config, errors', async () => {
    await expect(transcribeAudio(blob, { url: '' }, okFetch('') as never)).rejects.toBeInstanceOf(TranscribeError);
    await expect(transcribeAudio(blob, { url: 'http://example.com/x' }, okFetch('') as never)).rejects.toBeInstanceOf(TranscribeError);
    await expect(transcribeAudio(blob, { url: 'https://x.test' }, okFetch('boom', 500) as never)).rejects.toBeInstanceOf(TranscribeError);
    await expect(transcribeAudio(blob, { url: 'https://x.test' }, okFetch('{"text":""}') as never)).rejects.toBeInstanceOf(TranscribeError);
  });
});

describe('web', () => {
  const resp = (body: unknown, type = 'application/json', status = 200) => async () => ({ ok: status < 400, status, headers: { get: () => type }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), json: async () => body });
  test('url validation blocks non-https and private hosts', () => {
    expect(() => validateUrl('http://learn.microsoft.com')).toThrow(WebError);
    expect(() => validateUrl('https://192.168.1.1/x')).toThrow(WebError);
    expect(() => validateUrl('https://localhost/x')).toThrow(WebError);
    expect(() => validateUrl('not a url')).toThrow(WebError);
    expect(validateUrl('https://learn.microsoft.com/x').hostname).toBe('learn.microsoft.com');
  });
  test('search parses results and tolerates junk', async () => {
    const r = await searchWeb('print queue', resp({ results: [{ title: 'A', url: '/en-us/a', description: 'd' }, { title: '', url: 'x' }] }) as never);
    expect(r).toHaveLength(1);
    expect(r[0].url).toBe('https://learn.microsoft.com/en-us/a');
  });
  test('extractReadable drops scripts and keeps steps', () => {
    const p = extractReadable('<html><head><title>T | Microsoft Learn</title></head><body><nav>menu</nav><main><h1>H</h1><script>evil()</script><p>Stop the spooler service first.</p><ol><li>Delete spool files now.</li></ol></main></body></html>', 'https://learn.microsoft.com/x');
    expect(p.title).toBe('T');
    expect(JSON.stringify(p.blocks)).not.toContain('evil');
    expect(p.blocks.some((b) => b.kind === 'li')).toBe(true);
  });
  test('fetchReadable rejects non-html and surfaces http errors', async () => {
    await expect(fetchReadable('https://x.test/a.pdf', resp('x', 'application/pdf') as never)).rejects.toBeInstanceOf(WebError);
    await expect(fetchReadable('https://x.test/a', resp('x', 'text/html', 404) as never)).rejects.toBeInstanceOf(WebError);
  });
});

describe('files', () => {
  test('slug and unique path', async () => {
    expect(slugify('Hello, World! & more')).toBe('hello-world-more');
    const fs = new MemoryFiles();
    const d = new Date('2026-01-02T00:00:00Z');
    const a = await uniquePath(fs, 'guides', 'Fix it', 'md', d); await fs.write(a, 'x');
    expect(a).toBe('guides/2026-01-02-fix-it.md');
    expect(await uniquePath(fs, 'guides', 'Fix it', 'md', d)).toBe('guides/2026-01-02-fix-it-2.md');
  });
  test('native storage uses app-private DATA directory', async () => {
    const calls: Array<Record<string, unknown>> = []; const store = new Map<string, string>();
    const fake = {
      writeFile: async (o: Record<string, unknown>) => { calls.push(o); store.set(String(o.path), String(o.data)); },
      readFile: async (o: Record<string, unknown>) => { if (!store.has(String(o.path))) throw new Error('nf'); return { data: store.get(String(o.path))! }; },
      readdir: async (o: Record<string, unknown>) => ({ files: [...store.keys()].filter((k) => k.startsWith(String(o.path) + '/')).map((k) => ({ name: k.split('/').pop()!, size: 1, mtime: 1 })) }),
      deleteFile: async (o: Record<string, unknown>) => { store.delete(String(o.path)); },
    };
    const n = new NativeFiles(fake as never);
    await n.write('guides/a.md', 'hi');
    expect(calls[0].directory).toBe('DATA');
    expect(await n.read('guides/a.md')).toBe('hi');
    expect((await n.list()).map((f) => f.path)).toEqual(['guides/a.md']);
    await n.remove('guides/a.md');
    expect(await n.read('guides/a.md')).toBeNull();
  });
  test('encrypting wrapper: ciphertext at rest, locked blocks reads and writes', async () => {
    let state: 'off' | 'locked' | 'unlocked' = 'unlocked';
    setFileCipher({ state: () => state, encrypt: async (t) => 'ft1.' + btoa(t), decrypt: async (t) => atob(t.slice(4)) });
    const base = new MemoryFiles(); const f = new EncryptingFiles(base);
    await f.write('guides/a.md', 'plain words');
    expect(await base.read('guides/a.md')).not.toContain('plain words');
    expect(await f.read('guides/a.md')).toBe('plain words');
    state = 'locked';
    expect(await f.read('guides/a.md')).toBeNull();
    await expect(f.write('guides/b.md', 'x')).rejects.toThrow();
    state = 'unlocked'; await f.migrate('decrypt');
    expect(await base.read('guides/a.md')).toBe('plain words');
    setFileCipher(null);
  });
});
