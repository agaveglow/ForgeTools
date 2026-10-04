/**
 * Turning a YouTube link into the start of an apprenticeship activity entry.
 *
 * Only the public title and channel name are read (YouTube's oEmbed). The app cannot watch or summarise
 * the video, so "what I learned" always comes from the person. Nothing is written for them.
 */
import type { Requirement } from '../data/types';
import type { FetchFn } from './web';
import { WebError } from './web';

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const ID = /^[A-Za-z0-9_-]{11}$/;

export function parseVideoId(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  let id: string | null = null;
  if (host.endsWith('youtu.be')) id = u.pathname.split('/')[1] ?? null;
  else if (u.pathname === '/watch') id = u.searchParams.get('v');
  else { const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/); id = m ? m[1] : null; }
  return id && ID.test(id) ? id : null;
}

export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

export interface VideoInfo { id: string; title: string; channel: string; url: string }

export async function fetchVideoInfo(raw: string, f: FetchFn = (globalThis.fetch as unknown as FetchFn)): Promise<VideoInfo> {
  const id = parseVideoId(raw);
  if (!id) throw new WebError('That does not look like a YouTube video link.', 'invalid');
  const url = watchUrl(id);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new WebError('You are offline. Type the title yourself, or try again when connected.', 'offline');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await f(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal: ctl.signal });
    if (!res.ok) throw new WebError(res.status === 401 || res.status === 403 || res.status === 404 ? 'That video is private, removed or not shareable, so its title could not be read.' : `YouTube answered with an error (${res.status}).`, 'http');
    const j = JSON.parse(await res.text()) as { title?: unknown; author_name?: unknown };
    const title = typeof j.title === 'string' ? j.title.trim().slice(0, 150) : '';
    if (!title) throw new WebError('No title came back for that video.', 'empty');
    return { id, title, channel: typeof j.author_name === 'string' ? j.author_name.trim().slice(0, 80) : '', url };
  } catch (e) {
    if (e instanceof WebError) throw e;
    throw new WebError('The title could not be looked up from here. Type it in yourself and carry on.', 'blocked');
  } finally { clearTimeout(t); }
}

/** Minutes to hours in quarter-hour steps, never less than a quarter hour. */
export function minutesToHours(min: number): number {
  if (!Number.isFinite(min) || min <= 0) return 0;
  return Math.max(0.25, Math.round(min / 15) / 4);
}

/** A factual one-liner. It says only what is known: what was watched, where, for how long. */
export function whatIDidFor(v: { title: string; channel?: string }, minutes?: number): string {
  const by = v.channel ? ` by ${v.channel}` : '';
  const len = minutes && minutes > 0 ? ` (${minutes} min)` : '';
  return `Watched the video “${v.title}”${by}${len}.`;
}

/** Prompts to help the person write their own words. */
export const LEARNING_PROMPTS = [
  'What was the main idea or technique?',
  'What is one thing you now understand that you did not before?',
  'Where would you use this in your job (managed print, IT services, telecoms)?',
  'What will you do next to practise or check it?',
];

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
/** Suggests which of your own requirements this might relate to, by shared words. You confirm. */
export function suggestRequirements(text: string, reqs: Requirement[], max = 3): Requirement[] {
  const q = new Set(words(text));
  return reqs
    .map((r) => ({ r, s: words(r.title + ' ' + r.group + ' ' + r.notes).filter((w) => q.has(w)).length }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, max).map((x) => x.r);
}
