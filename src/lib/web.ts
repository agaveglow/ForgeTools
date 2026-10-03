/**
 * Internet lookup: search for documentation and pull the readable text of a page into a guide.
 *
 * Needs a connection. In the phone app, Capacitor's HTTP layer makes requests natively, so websites that
 * block browser cross-origin requests still work. In a plain browser many sites will be blocked by CORS
 * and the lookup will fail with a clear message. Content from the web is always labelled with its
 * source and retrieval date and is never presented as checked.
 */
import type { GuideSection } from './agent';

export interface WebResult {
  title: string;
  url: string;
  description: string;
}

export interface WebBlock {
  kind: 'h' | 'p' | 'li' | 'code';
  text: string;
}
export interface WebPage {
  title: string;
  url: string;
  host: string;
  blocks: WebBlock[];
  retrievedAt: string;
}

export type FetchFn = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; headers: { get(n: string): string | null }; text(): Promise<string>; json(): Promise<unknown> }>;

export class WebError extends Error {
  constructor(message: string, public kind: 'offline' | 'blocked' | 'http' | 'invalid' | 'empty' | 'timeout') { super(message); }
}

/** Public documentation search used for lookups. Replaceable. */
export const SEARCH_ENDPOINT = 'https://learn.microsoft.com/api/search';

const PRIVATE_HOST = /^(?:localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.0\.0\.0)/i;

export function validateUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new WebError('That is not a valid web address.', 'invalid'); }
  if (u.protocol !== 'https:') throw new WebError('Only secure (https) addresses can be fetched.', 'invalid');
  if (PRIVATE_HOST.test(u.hostname)) throw new WebError('Addresses on your own network are not fetched.', 'invalid');
  return u;
}

async function request(f: FetchFn, url: string, headers?: Record<string, string>) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new WebError('You are offline. Connect to the internet and try again.', 'offline');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await f(url, { signal: ctl.signal, headers });
    if (!res.ok) throw new WebError(`The site answered with an error (${res.status}).`, 'http');
    return res;
  } catch (e) {
    if (e instanceof WebError) throw e;
    if ((e as { name?: string }).name === 'AbortError') throw new WebError('The request took too long.', 'timeout');
    throw new WebError('Could not reach the site. In a browser this is often a cross-origin block; the phone app does not have that limit.', 'blocked');
  } finally { clearTimeout(timer); }
}

export async function searchWeb(query: string, f: FetchFn = (globalThis.fetch as unknown as FetchFn)): Promise<WebResult[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const url = `${SEARCH_ENDPOINT}?search=${encodeURIComponent(q)}&locale=en-us&$top=6`;
  const res = await request(f, url, { Accept: 'application/json' });
  const data = (await res.json()) as { results?: Array<Record<string, unknown>>; value?: Array<Record<string, unknown>> };
  const rows = data.results ?? data.value ?? [];
  const out: WebResult[] = [];
  for (const r of rows) {
    const title = String(r.title ?? '').trim();
    const link = String(r.url ?? r.link ?? '').trim();
    if (!title || !link) continue;
    let abs = link;
    try { abs = new URL(link, 'https://learn.microsoft.com').toString(); } catch { continue; }
    out.push({ title, url: abs, description: String(r.description ?? r.summary ?? '').trim().slice(0, 240) });
  }
  return out;
}

// ---------- readable text ----------

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"' };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
const strip = (s: string) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export function extractReadable(html: string, url: string, now = new Date()): WebPage {
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')) || new URL(url).hostname;
  // Prefer the main content area when there is one.
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? html;
  const cleaned = main
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|button|iframe|template)\b[\s\S]*?<\/\1>/gi, ' ');
  const blocks: WebBlock[] = [];
  const re = /<(h[1-4]|p|li|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const tag = m[1].toLowerCase();
    if (tag === 'pre') {
      const code = decode(m[2].replace(/<[^>]+>/g, '')).replace(/\r/g, '').trim();
      if (code) blocks.push({ kind: 'code', text: code.slice(0, 1200) });
      continue;
    }
    const text = strip(m[2]);
    if (text.length < 3) continue;
    blocks.push({ kind: tag.startsWith('h') ? 'h' : tag === 'li' ? 'li' : 'p', text: text.slice(0, 600) });
    if (blocks.length >= 120) break;
  }
  if (!blocks.length) throw new WebError('No readable text was found on that page.', 'empty');
  return { title: title.replace(/\s*[|–—-]\s*Microsoft Learn$/i, ''), url, host: new URL(url).hostname, blocks, retrievedAt: now.toISOString() };
}

export async function fetchReadable(rawUrl: string, f: FetchFn = (globalThis.fetch as unknown as FetchFn)): Promise<WebPage> {
  const u = validateUrl(rawUrl);
  const res = await request(f, u.toString(), { Accept: 'text/html,application/xhtml+xml' });
  const type = res.headers.get('content-type') ?? '';
  if (type && !/html|text/i.test(type)) throw new WebError('That address is not a web page.', 'invalid');
  return extractReadable(await res.text(), u.toString());
}

/** A guide section holding the useful part of a web page, clearly labelled as external. */
export function webSection(p: WebPage, maxItems = 12): GuideSection {
  const items: string[] = [];
  let heading = '';
  for (const b of p.blocks) {
    if (b.kind === 'h') { heading = b.text; continue; }
    if (b.kind === 'code') continue;
    if (b.text.length < 25) continue;
    items.push(heading ? `${heading}: ${b.text}` : b.text);
    heading = '';
    if (items.length >= maxItems) break;
  }
  return {
    title: `From the web: ${p.host}`,
    note: `${p.title}. Source ${p.url}, retrieved ${p.retrievedAt.slice(0, 10)}. External content, not checked. Verify before relying on it.`,
    items,
    code: p.blocks.filter((b) => b.kind === 'code').slice(0, 3).map((b) => b.text),
  };
}
