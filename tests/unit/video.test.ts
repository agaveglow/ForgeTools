import { describe, expect, test } from 'bun:test';
import { fetchVideoInfo, minutesToHours, parseVideoId, suggestRequirements, watchUrl, whatIDidFor } from '../../src/lib/video';

describe('YouTube links', () => {
  test('recognises the usual link shapes and rejects the rest', () => {
    const id = 'dQw4w9WgXcQ';
    for (const u of [`https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}?t=42`, `https://m.youtube.com/watch?v=${id}&list=x`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`, `  https://youtube.com/watch?v=${id}  `]) expect(parseVideoId(u)).toBe(id);
    for (const u of ['https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'not a url', 'https://www.youtube.com/watch?v=short', 'https://www.youtube.com/watch', 'ftp://youtube.com/watch?v=dQw4w9WgXcQ']) expect(parseVideoId(u)).toBeNull();
    expect(watchUrl(id)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
  const ok = (body: unknown, status = 200) => async () => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => JSON.stringify(body) });
  test('reads title and channel from oEmbed', async () => {
    const v = await fetchVideoInfo('https://youtu.be/dQw4w9WgXcQ', ok({ title: 'Subnetting made simple', author_name: 'Net Channel' }) as never);
    expect(v).toEqual({ id: 'dQw4w9WgXcQ', title: 'Subnetting made simple', channel: 'Net Channel', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  });
  test('clear errors for bad links, private videos and blocked requests', async () => {
    await expect(fetchVideoInfo('https://example.com', ok({}) as never)).rejects.toThrow('YouTube video link');
    await expect(fetchVideoInfo('https://youtu.be/dQw4w9WgXcQ', ok({}, 404) as never)).rejects.toThrow('private');
    await expect(fetchVideoInfo('https://youtu.be/dQw4w9WgXcQ', (async () => { throw new TypeError('cors'); }) as never)).rejects.toThrow('Type it in yourself');
    await expect(fetchVideoInfo('https://youtu.be/dQw4w9WgXcQ', ok({ title: '  ' }) as never)).rejects.toThrow('No title');
  });
});

describe('entry from a video', () => {
  test('minutes become quarter hours, never zero', () => {
    expect(minutesToHours(20)).toBe(0.25);
    expect(minutesToHours(25)).toBe(0.5);
    expect(minutesToHours(1)).toBe(0.25);
    expect(minutesToHours(45)).toBe(0.75);
    expect(minutesToHours(0)).toBe(0);
    expect(minutesToHours(NaN)).toBe(0);
  });
  test('the generated line states only what is known', () => {
    expect(whatIDidFor({ title: 'Subnetting', channel: 'Net Channel' }, 30)).toBe('Watched the video “Subnetting” by Net Channel (30 min).');
    expect(whatIDidFor({ title: 'Subnetting' })).toBe('Watched the video “Subnetting”.');
  });
  test('requirement suggestions use shared words only', () => {
    const reqs = [{ id: 'a', title: 'Understand networking and subnetting', group: 'Knowledge', notes: '' }, { id: 'b', title: 'Printer maintenance', group: 'Print', notes: '' }] as never[];
    expect(suggestRequirements('Subnetting made simple', reqs).map((r: { id: string }) => r.id)).toEqual(['a']);
    expect(suggestRequirements('cooking pasta', reqs)).toEqual([]);
  });
});
