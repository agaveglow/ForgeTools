/**
 * Visual model of a guide: the ordered steps, the commands that belong to each, and cautions.
 * Built from a Guide object (fresh from the agent) or from saved guide text (Knowledge base entry).
 * It only rearranges what the guide already says. Nothing is added, and nothing is simulated beyond
 * showing the commands the guide lists.
 */
import type { Guide } from './agent';

export interface VStep { n: number; text: string; commands: string[]; caution: boolean }
export interface VisualModel { title: string; steps: VStep[]; cautions: string[] }

const CAUTION_TITLE = /caution|risk|warning|watch out|careful|before you (?:start|begin)|safety/i;
const CAUTION_TEXT = /\b(?:caution|careful|warning|do not|don't|never|backup|back up|data loss|hot)\b/i;
export const isCautionText = (s: string) => CAUTION_TEXT.test(s);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function attachCommands(steps: VStep[], commands: string[]) {
  if (!steps.length) return;
  for (const c of commands) {
    const cmd = clean(c);
    if (!cmd) continue;
    const key = cmd.toLowerCase();
    const first = key.split(/\s+/).slice(0, 2).join(' ');
    const hit = steps.find((s) => s.text.toLowerCase().includes(key)) ?? steps.find((s) => s.text.toLowerCase().includes(first));
    (hit ?? steps[steps.length - 1]).commands.push(cmd);
  }
}

export function modelFromGuide(g: Guide): VisualModel {
  const stepTexts: string[] = [];
  const cautions: string[] = [];
  const commands: string[] = [];
  const ordered = g.sections.filter((s) => s.ordered);
  for (const s of g.sections) {
    if (CAUTION_TITLE.test(s.title)) { cautions.push(...s.items.map(clean)); continue; }
    if (ordered.length ? s.ordered : s.items.length > 0 && !/overview|summary|what you need|sources/i.test(s.title)) stepTexts.push(...s.items.map(clean));
    for (const c of s.code ?? []) commands.push(c);
  }
  const steps: VStep[] = stepTexts.filter(Boolean).slice(0, 40).map((text, i) => ({ n: i + 1, text, commands: [], caution: isCautionText(text) }));
  attachCommands(steps, commands.flatMap((c) => c.split('\n')));
  return { title: g.title, steps, cautions };
}

/** Rebuild the model from saved guide text (the format produced by guideToText). */
export function modelFromText(title: string, body: string): VisualModel {
  const lines = body.replace(/\r/g, '').split('\n');
  const steps: VStep[] = [];
  const cautions: string[] = [];
  const pendingCode: string[] = [];
  let section = '';
  let inCode = false;
  let code: string[] = [];
  for (const line of lines) {
    if (/^TRANSCRIPT\s*$/.test(line) && !inCode) break;
    if (line.trim().startsWith('```')) {
      if (inCode) { pendingCode.push(code.join('\n')); code = []; }
      inCode = !inCode;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    if (/^[A-Z][A-Z0-9 ,&/'’-]{2,}$/.test(line.trim())) { section = line.trim(); continue; }
    const m = line.match(/^\s*(\d+)\.\s+(.*\S)\s*$/);
    if (m && !CAUTION_TITLE.test(section)) { steps.push({ n: steps.length + 1, text: clean(m[2]), commands: [], caution: isCautionText(m[2]) }); continue; }
    const b = line.match(/^\s*[-•]\s+(.*\S)\s*$/);
    if (b && CAUTION_TITLE.test(section)) cautions.push(clean(b[1]));
  }
  attachCommands(steps, pendingCode.flatMap((c) => c.split('\n')));
  return { title, steps: steps.slice(0, 40), cautions };
}

export const hasVisuals = (m: VisualModel) => m.steps.length >= 2;

// ---------- diagram layout ----------

export type StepIcon = 'terminal' | 'warning' | 'settings' | 'printer' | 'network' | 'user' | 'power' | 'search' | 'file' | 'shield' | 'update' | 'check' | 'step';

const ICON_RULES: Array<[StepIcon, RegExp]> = [
  ['warning', /\b(?:caution|warning|careful|do not|don't|never|back ?up|data loss|hot)\b/i],
  ['printer', /\b(?:print\w*|toner|drum|tray|jam\w*|paper|scan\w*|copier|mfp|spool\w*|queue)\b/i],
  ['network', /\b(?:network|wi-?fi|ethernet|dns|dhcp|ip address|router|switch|firewall|vpn|port|ping|connect\w*|cable|link)\b/i],
  ['shield', /\b(?:security|phish\w*|malware|virus|password|mfa|conditional access|permission\w*|access|encrypt\w*|certificate)\b/i],
  ['update', /\b(?:update\w*|firmware|patch\w*|upgrade|install\w*|driver\w*|version)\b/i],
  ['power', /\b(?:restart|reboot|power|shut ?down|turn off|turn on|switch off|switch on|reset)\b/i],
  ['settings', /\b(?:settings?|configur\w*|option\w*|enable|disable|policy|register|setup|set up|menu|panel)\b/i],
  ['user', /\b(?:user|account|profile|sign[- ]?in|log ?in|mailbox|customer|contact)\b/i],
  ['file', /\b(?:file|folder|log|document|export|import|save|report|backup)\b/i],
  ['search', /\b(?:check|look|find|review|verify|confirm|inspect|test|compare|identify|note)\b/i],
];

/** Picks an icon for a step from its wording. Purely cosmetic: it never changes what the step says. */
export function iconFor(s: { text: string; commands: string[] }): StepIcon {
  if (s.commands.length && !/\b(?:caution|warning|do not|never)\b/i.test(s.text)) return 'terminal';
  for (const [icon, re] of ICON_RULES) if (re.test(s.text)) return icon;
  return 'step';
}

export interface DiagramNode { id: string; kind: 'start' | 'step' | 'end'; y: number; h: number; lines: string[]; cmd?: string; n?: number; caution?: boolean; icon?: StepIcon; photo?: boolean }

export const PHOTO_H = 76;

export function wrapText(text: string, max: number): string[] {
  const out: string[] = []; let cur = '';
  for (const w of text.split(' ')) {
    if (w.length > max) { if (cur) { out.push(cur); cur = ''; } for (let i = 0; i < w.length; i += max) out.push(w.slice(i, i + max)); continue; }
    if ((cur + ' ' + w).trim().length > max) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

export function layoutDiagram(m: VisualModel, perLine = 29, maxLines = 4, photoSteps: ReadonlySet<number> = new Set()): { nodes: DiagramNode[]; height: number } {
  const nodes: DiagramNode[] = [];
  let y = 8;
  const push = (n: Omit<DiagramNode, 'y'>) => { nodes.push({ ...n, y }); y += n.h + 22; };
  push({ id: 'start', kind: 'start', h: 28, lines: ['Start'] });
  for (const s of m.steps) {
    let lines = wrapText(s.text, perLine);
    if (lines.length > maxLines) lines = [...lines.slice(0, maxLines - 1), lines[maxLines - 1].replace(/\s*\S{0,3}$/, '') + '…'];
    const cmd = s.commands[0] ? (s.commands[0].length > 36 ? s.commands[0].slice(0, 35) + '…' : s.commands[0]) : undefined;
    const photo = photoSteps.has(s.n);
    push({ id: `s${s.n}`, kind: 'step', n: s.n, caution: s.caution, lines, cmd, icon: iconFor(s), photo, h: 14 + lines.length * 17 + (cmd ? 24 : 0) + (photo ? PHOTO_H + 8 : 0) });
  }
  push({ id: 'end', kind: 'end', h: 28, lines: ['Done: check the result'] });
  return { nodes, height: y - 22 + 8 };
}

/** Typing/reading time for one step in the player, in ms (before speed scaling). */
export function stepDuration(s: VStep): number {
  const words = s.text.split(/\s+/).length;
  const typing = s.commands.reduce((n, c) => n + c.length * 35, 0);
  return Math.min(20000, 2500 + words * 280 + typing);
}
