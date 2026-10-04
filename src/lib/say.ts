import { PHRASES } from '../content/say';
import type { Phrase } from '../content/say';

export type Tone = 'friendly' | 'brief';
export interface SayVars { name: string; me: string; issue: string; mins: string; app: string }
export const EMPTY_VARS: SayVars = { name: '', me: '', issue: '', mins: '', app: '' };
const FALLBACK: Record<string, string> = { name: 'there', me: '', issue: 'the problem', time: 'a few minutes', app: 'the application' };

/** Minutes as typed become "about 10 minutes". Anything that is not a sensible number falls back. */
export function timePhrase(mins: string): string {
  const n = Number(String(mins).trim());
  if (!Number.isFinite(n) || n <= 0 || n > 600) return '';
  const r = Math.round(n);
  if (r === 1) return 'about a minute';
  if (r >= 60 && r % 60 === 0) return `about ${r / 60} hour${r === 60 ? '' : 's'}`;
  return `about ${r} minutes`;
}

/** Fill {placeholders}. A [[segment]] is kept only if every placeholder inside it has a value. */
export function fill(template: string, v: SayVars): string {
  const val: Record<string, string> = { name: v.name.trim(), me: v.me.trim(), issue: v.issue.trim(), time: timePhrase(v.mins), app: v.app.trim() };
  const out = template
    .replace(/\[\[(.*?)\]\]/g, (_m, seg: string) => ((seg.match(/\{(\w+)\}/g) ?? []).every((k) => val[k.slice(1, -1)]) ? seg : ''))
    .replace(/\{(\w+)\}/g, (_m, k: string) => val[k] || FALLBACK[k] || '');
  return out.replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim();
}

export const phraseText = (p: Phrase, tone: Tone, v: SayVars): string => fill(tone === 'brief' ? p.brief : p.friendly, v);
export const phraseById = (id: string): Phrase | undefined => PHRASES.find((p) => p.id === id);

/** Break a message into lines no longer than `width`. Existing line breaks are kept. */
export function wrapText(text: string, width: number): string {
  if (!width || width < 20) return text;
  return text.split('\n').map((line) => {
    const out: string[] = []; let cur = '';
    for (const w of line.split(' ')) {
      if (cur && (cur + ' ' + w).length > width) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    }
    out.push(cur);
    return out.join('\n');
  }).join('\n');
}

export interface Compose {
  tone: Tone; vars: SayVars;
  opening: boolean; askTime: boolean; privacy: boolean;
  action: string; needs: string[]; closing: string; thanks: boolean;
  wrap: number;
}
export const EMPTY_COMPOSE: Compose = { tone: 'friendly', vars: EMPTY_VARS, opening: true, askTime: false, privacy: false, action: '', needs: [], closing: '', thanks: false, wrap: 0 };

const NEED_ORDER = ['hands-off', 'save-work', 'restart', 'type-password', 'test-it', 'print-test', 'confirm-fixed'];

/** Assemble one message from the choices. Nothing is added that was not chosen or typed. */
export function compose(c: Compose): string {
  const parts: string[] = [];
  const use = (id: string) => { const p = phraseById(id); if (p) parts.push(phraseText(p, c.tone, c.vars)); };
  if (c.opening) use('open-intro');
  if (c.askTime) use('ask-time');
  if (c.privacy) use('privacy');
  const action = c.action.trim().replace(/[.\s]+$/, '');
  if (action) parts.push(c.tone === 'brief' ? `Doing: ${action}.` : `Right now I'm ${action}.`);
  const t = timePhrase(c.vars.mins);
  if (t && !c.needs.includes('hands-off')) parts.push(c.tone === 'brief' ? `Time: ${t}.` : `This should take ${t}.`);
  for (const id of NEED_ORDER) if (c.needs.includes(id)) use(id);
  if (c.closing) use(c.closing);
  if (c.thanks) use('thanks');
  return wrapText(parts.join('\n\n'), c.wrap);
}
