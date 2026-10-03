/**
 * Ask about one step of a guide. Local and rules-based: answers come only from the step's own text,
 * the command reference, the closest troubleshooting-library step, and the user's saved notes.
 * When none of those say anything useful the answer says so rather than guessing.
 */
import { WORKFLOWS } from '../content/workflows';
import type { CommandEntry, WorkflowStep } from '../content/types';
import type { KbEntry } from '../data/types';
import { findCommand, tokens } from './agent';
import type { VisualModel } from './visual';

export type StepIntent = 'why' | 'risk' | 'simple' | 'command' | 'check' | 'abnormal' | 'general';

export interface StepAnswer {
  intent: StepIntent;
  blocks: Array<{ heading?: string; lines: string[] }>;
  sources: Array<{ label: string; route: string }>;
  /** False when only the step's own words were available. */
  grounded: boolean;
}

export const STEP_QUESTIONS: Array<{ label: string; q: string }> = [
  { label: 'Why this step?', q: 'Why do I do this step?' },
  { label: 'What could go wrong?', q: 'What could go wrong with this step?' },
  { label: 'Explain simply', q: 'Explain this step simply' },
  { label: 'What does the command do?', q: 'What does the command do?' },
  { label: 'What should I see?', q: 'What should I check or see after this step?' },
  { label: 'If it looks wrong', q: 'What if the result looks wrong?' },
];

export function stepIntent(q: string): StepIntent {
  const s = q.toLowerCase();
  if (/(go wrong|risk|danger|safe|break|lose|data loss|careful|warning)/.test(s)) return 'risk';
  if (/(if .*(wrong|fail|abnormal|different|not)|doesn'?t work|didn'?t work|still|error|abnormal|looks wrong)/.test(s)) return 'abnormal';
  if (/(command|syntax|flag|switch|parameter|run |type )/.test(s)) return 'command';
  if (/(check|see|expect|output|result|look for|confirm|verify|after)/.test(s)) return 'check';
  if (/(simply|simple|plain|eli5|mean|understand|confus)/.test(s)) return 'simple';
  if (/(why|reason|purpose|what for|need to)/.test(s)) return 'why';
  return 'general';
}

function bestWorkflowStep(text: string): { step: WorkflowStep; wf: string; wfId: string } | undefined {
  const q = new Set(tokens(text));
  if (q.size < 2) return undefined;
  let best: { step: WorkflowStep; wf: string; wfId: string; score: number } | undefined;
  for (const w of WORKFLOWS) {
    for (const st of w.steps) {
      const t = tokens(st.title + ' ' + st.detail);
      const hit = new Set(t.filter((x) => q.has(x)));
      const score = hit.size / Math.sqrt(q.size * Math.max(1, new Set(t).size));
      if (hit.size >= 2 && (!best || score > best.score)) best = { step: st, wf: w.title, wfId: w.id, score };
    }
  }
  return best && best.score >= 0.25 ? best : undefined;
}

function commandsFor(commands: string[], text: string): CommandEntry[] {
  const out: CommandEntry[] = [];
  for (const c of [...commands, text]) {
    const f = findCommand(c);
    if (f && !out.includes(f)) out.push(f);
  }
  return out.slice(0, 3);
}

function notesFor(text: string, kb: KbEntry[]): KbEntry[] {
  const q = new Set(tokens(text));
  return kb
    .map((k) => ({ k, s: new Set(tokens(k.title + ' ' + k.body).filter((x) => q.has(x))).size }))
    .filter((x) => x.s >= 3)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .map((x) => x.k);
}

export function answerAboutStep(model: VisualModel, stepIndex: number, question: string, kb: KbEntry[] = []): StepAnswer {
  const step = model.steps[stepIndex];
  const intent = stepIntent(question);
  if (!step) return { intent, blocks: [{ lines: ['That step is not in this guide.'] }], sources: [], grounded: false };

  const cmds = commandsFor(step.commands, step.text);
  const wfm = bestWorkflowStep(step.text);
  const notes = notesFor(step.text, kb);
  const blocks: StepAnswer['blocks'] = [];
  const sources: StepAnswer['sources'] = [];
  const add = (heading: string | undefined, lines: Array<string | undefined>) => {
    const l = lines.filter((x): x is string => !!x);
    if (l.length) blocks.push({ heading, lines: l });
  };
  let grounded = false;

  const cmdBlock = (c: CommandEntry, parts: Array<'purpose' | 'explanation' | 'syntax' | 'expected' | 'risks' | 'when'>) => {
    grounded = true;
    add(c.name, [
      parts.includes('purpose') ? c.purpose : undefined,
      parts.includes('explanation') ? c.explanation : undefined,
      parts.includes('when') ? 'Use it when: ' + c.whenToUse : undefined,
      parts.includes('syntax') ? 'Syntax: ' + c.syntax : undefined,
      parts.includes('expected') ? 'Expect: ' + c.expectedOutput : undefined,
      parts.includes('risks') ? 'Risk: ' + c.risks + (c.needsAdmin ? ' Needs an Administrator prompt.' : '') : undefined,
    ]);
    sources.push({ label: c.name, route: `/commands/${c.id}` });
  };

  switch (intent) {
    case 'risk':
      if (step.caution) add('This step is marked as a caution', [step.text]);
      cmds.forEach((c) => cmdBlock(c, ['risks']));
      if (model.cautions.length) add('Cautions in this guide', model.cautions.slice(0, 4));
      if (wfm?.step.ifAbnormal) { grounded = true; add('If it goes wrong', [wfm.step.ifAbnormal]); }
      break;
    case 'abnormal':
      if (wfm?.step.ifAbnormal) { grounded = true; add('If the result is abnormal', [wfm.step.ifAbnormal]); }
      if (wfm?.step.meaning) { grounded = true; add('What it may mean', [wfm.step.meaning]); }
      cmds.forEach((c) => cmdBlock(c, ['expected']));
      break;
    case 'command':
      cmds.forEach((c) => cmdBlock(c, ['purpose', 'explanation', 'syntax', 'expected', 'risks']));
      break;
    case 'check':
      if (wfm?.step.lookFor) { grounded = true; add('Look for', [wfm.step.lookFor]); }
      if (wfm?.step.meaning) add('What it may mean', [wfm.step.meaning]);
      cmds.forEach((c) => cmdBlock(c, ['expected']));
      break;
    case 'simple':
      add('In plain words', [step.text]);
      cmds.forEach((c) => cmdBlock(c, ['purpose']));
      if (wfm?.step.detail) { grounded = true; add('Another way the library puts it', [wfm.step.detail]); }
      break;
    case 'why':
      cmds.forEach((c) => cmdBlock(c, ['purpose', 'when']));
      if (wfm) { grounded = true; add('Where this fits', [`The library uses a similar step in “${wfm.wf}”: ${wfm.step.title}.`, wfm.step.meaning]); }
      break;
    default:
      cmds.forEach((c) => cmdBlock(c, ['purpose', 'explanation']));
      if (wfm) { grounded = true; add('From the library', [wfm.step.detail, wfm.step.lookFor ? 'Look for: ' + wfm.step.lookFor : undefined]); }
  }
  if (wfm) sources.push({ label: wfm.wf, route: `/troubleshoot/${wfm.wfId}` });
  if (notes.length) {
    grounded = true;
    add('Your notes that mention this', notes.map((n) => n.title));
    notes.forEach((n) => sources.push({ label: n.title, route: `/kb/${n.id}` }));
  }

  if (!blocks.length) {
    blocks.push({ lines: [`Nothing in the library or your notes says more about step ${step.n}, so I won’t guess.`, 'The step itself says: ' + step.text, 'Try naming the command or device, or check the vendor’s own documentation.'] });
  }
  return { intent, blocks, sources: dedupe(sources), grounded };
}

function dedupe(s: StepAnswer['sources']): StepAnswer['sources'] {
  const seen = new Set<string>();
  return s.filter((x) => (seen.has(x.route + x.label) ? false : (seen.add(x.route + x.label), true)));
}
