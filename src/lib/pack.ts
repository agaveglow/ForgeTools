/**
 * Packs: a plain JSON file of guides and requirements that you load onto this device.
 *
 * Why this exists: guides and training plans that come from your employer or training provider belong on your
 * own device, not in this project's public code. A pack is made outside the repository, imported here, and
 * stays in this browser or app. Nothing is uploaded. Every item is scanned for secrets and personal details
 * before it is added, and anything already here (same title) is skipped, so importing twice is safe.
 */
import { KB_CATEGORIES } from '../data/types';
import type { KbCategory, RequirementKind } from '../data/types';
import { hasBlockers, scanText } from './sensitive';

export const PACK_MAX_BYTES = 3 * 1024 * 1024;
const MAX_KB = 200, MAX_REQ = 500;

export interface PackKb { title: string; category: KbCategory; tags: string[]; body: string }
export interface PackReq { title: string; kind: RequirementKind; group: string; notes: string }
export interface Pack { name: string; kb: PackKb[]; requirements: PackReq[] }
export class PackError extends Error {}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '');
const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Reads and checks a pack. Items that are not usable are left out and listed in `dropped`. */
export function parsePack(text: string): { pack: Pack; dropped: string[] } {
  if (text.length > PACK_MAX_BYTES) throw new PackError('That file is too large to be a pack.');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new PackError('That is not a ForgeTools pack. It could not be read as a pack file.'); }
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || o.forgetoolsPack !== 1) throw new PackError('That is not a ForgeTools pack (wrong or missing pack marker).');
  const dropped: string[] = [];
  const name = str(o.name, 80) || 'Pack';
  const kb: PackKb[] = []; const requirements: PackReq[] = [];
  const kbIn = Array.isArray(o.kb) ? o.kb : []; const rqIn = Array.isArray(o.requirements) ? o.requirements : [];
  if (kbIn.length > MAX_KB) dropped.push(`Only the first ${MAX_KB} guides were read.`);
  if (rqIn.length > MAX_REQ) dropped.push(`Only the first ${MAX_REQ} requirements were read.`);
  kbIn.slice(0, MAX_KB).forEach((k, i) => {
    const r = k as Record<string, unknown>;
    const title = str(r?.title, 150); const body = str(r?.body, 30000);
    if (!title || !body) { dropped.push(`Guide ${i + 1} has no title or content.`); return; }
    const category = (KB_CATEGORIES as readonly string[]).includes(r.category as string) ? (r.category as KbCategory) : 'References';
    const tags = (Array.isArray(r.tags) ? r.tags : []).map((t) => str(t, 40).toLowerCase()).filter(Boolean).slice(0, 10);
    kb.push({ title, category, tags: [...new Set(tags)], body });
  });
  rqIn.slice(0, MAX_REQ).forEach((q, i) => {
    const r = q as Record<string, unknown>;
    const title = str(r?.title, 200);
    if (!title) { dropped.push(`Requirement ${i + 1} has no title.`); return; }
    requirements.push({ title, kind: r.kind === 'job' ? 'job' : 'apprenticeship', group: str(r.group, 60), notes: str(r.notes, 500) });
  });
  if (!kb.length && !requirements.length) throw new PackError('That pack has nothing in it that can be added.');
  return { pack: { name, kb, requirements }, dropped };
}

export interface PackRefusal { type: 'guide' | 'requirement'; title: string; why: string }
export interface PackWarning { type: 'guide' | 'requirement'; title: string; what: string }
export interface PackPlan {
  kbNew: PackKb[]; kbHere: number; reqNew: PackReq[]; reqHere: number;
  /** Items with a secret in them. These are never added. */
  refused: PackRefusal[];
  /** Items with personal-looking details. They can be added, once the person has checked them. */
  warnings: PackWarning[];
}

const reqKey = (r: { title: string; group: string }) => `${norm(r.group)}|${norm(r.title)}`;

/** Works out what importing would do, without changing anything. */
export function planPack(pack: Pack, haveKbTitles: string[], haveReqs: Array<{ title: string; group: string }>): PackPlan {
  const plan: PackPlan = { kbNew: [], kbHere: 0, reqNew: [], reqHere: 0, refused: [], warnings: [] };
  const kbHave = new Set(haveKbTitles.map(norm)); const rqHave = new Set(haveReqs.map(reqKey));
  const seenKb = new Set<string>(); const seenRq = new Set<string>();
  const check = (type: 'guide' | 'requirement', title: string, text: string): 'ok' | 'refuse' => {
    const f = scanText(text);
    if (hasBlockers(f)) { plan.refused.push({ type, title, why: [...new Set(f.filter((x) => x.severity === 'block').map((x) => x.label))].join(', ') }); return 'refuse'; }
    const w = [...new Set(f.map((x) => x.label))];
    if (w.length) plan.warnings.push({ type, title, what: w.join(', ') });
    return 'ok';
  };
  for (const k of pack.kb) {
    const key = norm(k.title);
    if (kbHave.has(key) || seenKb.has(key)) { plan.kbHere++; continue; }
    seenKb.add(key);
    if (check('guide', k.title, `${k.title}\n${k.tags.join(' ')}\n${k.body}`) === 'ok') plan.kbNew.push(k);
  }
  for (const r of pack.requirements) {
    const key = reqKey(r);
    if (rqHave.has(key) || seenRq.has(key)) { plan.reqHere++; continue; }
    seenRq.add(key);
    if (check('requirement', r.title, `${r.title}\n${r.group}\n${r.notes}`) === 'ok') plan.reqNew.push(r);
  }
  return plan;
}
