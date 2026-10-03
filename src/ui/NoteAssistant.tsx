import { useState } from 'react';
import { structureNotes, joinClauses } from '../lib/notes';
import type { StructuredNote } from '../lib/notes';
import { LOG_CATEGORIES } from '../data/types';
import type { LogCategory } from '../data/types';
import { SKILL_BY_ID } from '../content/skills';
import { Badge, Button, Checkbox, Field, Select, TextArea } from './primitives';

export interface AssistantResult {
  problem: string;
  investigation: string;
  actions: string;
  result: string;
  followUp: string;
  category: LogCategory;
  skills: string[];
  device?: string;
}

interface Sug {
  problem: string;
  investigation: string;
  actions: string;
  result: string;
  followUp: string;
  other: string;
  category: LogCategory;
  skills: string[];
  skillPick: Record<string, boolean>;
  areaPick: Record<string, boolean>;
  note: StructuredNote;
}

const LABELS: Array<[keyof Pick<Sug, 'problem' | 'investigation' | 'actions' | 'result' | 'followUp'>, string]> = [
  ['problem', 'Problem'],
  ['investigation', 'Investigation'],
  ['actions', 'Actions taken'],
  ['result', 'Result'],
  ['followUp', 'Follow-up'],
];

/**
 * Turns rough notes into an EDITABLE structured suggestion. It only re-organises the user's own words.
 * Skills and "possible areas" are untick-by-default: tick only what you actually did.
 */
export function NoteAssistant({ onApply, onCancel }: { onApply: (r: AssistantResult) => void; onCancel?: () => void }) {
  const [raw, setRaw] = useState('');
  const [sug, setSug] = useState<Sug | null>(null);

  const run = () => {
    const n = structureNotes(raw);
    setSug({
      problem: joinClauses(n.problem),
      investigation: joinClauses(n.investigation),
      actions: joinClauses(n.actions),
      result: joinClauses(n.result),
      followUp: joinClauses(n.followUp),
      other: joinClauses(n.other),
      category: n.category,
      skills: n.skills,
      skillPick: {},
      areaPick: {},
      note: n,
    });
  };
  const set = <K extends keyof Sug>(k: K, v: Sug[K]) => setSug((s) => (s ? { ...s, [k]: v } : s));

  const apply = () => {
    if (!sug) return;
    const ticked = sug.note.possibleAreas.filter((a) => sug.areaPick[a.label]).map((a) => a.label);
    const inv = [sug.investigation, ticked.length ? `Also checked: ${ticked.join('; ')}.` : ''].filter(Boolean).join(' ');
    onApply({
      problem: sug.problem,
      investigation: inv,
      actions: sug.actions,
      result: sug.result,
      followUp: sug.followUp,
      category: sug.category,
      skills: sug.skills.filter((s) => sug.skillPick[s]),
      device: sug.note.deviceGuess,
    });
  };

  return (
    <div className="space-y-3">
      <Field label="Rough notes" htmlFor="rough" hint="Type or paste in your own words. Nothing is added that you did not write.">
        <TextArea id="rough" rows={5} value={raw} onChange={(e: { target: { value: string } }) => setRaw(e.target.value)} placeholder="e.g. user couldn't open shared mailbox, checked permissions, recreated profile, works now" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!raw.trim()} onClick={run}>Structure my notes</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Close</Button>}
      </div>

      {sug && (
        <div className="space-y-3 border-t border-line pt-3" data-testid="assistant-suggestion">
          <p className="text-sm text-muted">
            Suggestion. Everything below is editable and nothing is saved until you apply it and save the log.
          </p>
          {sug.note.missing.length > 0 && (
            <div role="status" className="text-sm rounded-sm border border-warn/50 bg-warn/5 p-2">
              Not covered in your notes: <strong>{sug.note.missing.map((m) => ({ problem: 'the problem', actions: 'what you did', result: 'the result' }[m])).join(', ')}</strong>. Add it if you know it. Leaving it blank is fine.
            </div>
          )}
          {LABELS.map(([k, label]) => (
            <Field key={k} label={label} htmlFor={'sug-' + k}>
              <TextArea id={'sug-' + k} rows={2} value={sug[k]} onChange={(e: { target: { value: string } }) => set(k, e.target.value)} placeholder={`(nothing in your notes about this)`} />
            </Field>
          ))}
          {sug.other && (
            <Field label="Could not place" htmlFor="sug-other" hint="Your words that did not clearly fit a section.">
              <TextArea id="sug-other" rows={2} value={sug.other} onChange={(e: { target: { value: string } }) => set('other', e.target.value)} />
              <Button size="sm" className="mt-1" onClick={() => setSug((s) => (s ? { ...s, investigation: [s.investigation, s.other].filter(Boolean).join(' '), other: '' } : s))}>Add to Investigation</Button>
            </Field>
          )}
          <Field label="Category">
            <Select value={sug.category} onChange={(e: { target: { value: string } }) => set('category', e.target.value as LogCategory)} aria-label="Category">
              {LOG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          {sug.skills.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium">Skills this may relate to</legend>
              <p className="text-xs text-muted mb-1">Tick only skills you genuinely used in this work.</p>
              {sug.skills.map((s) => (
                <Checkbox key={s} checked={!!sug.skillPick[s]} onChange={(v) => set('skillPick', { ...sug.skillPick, [s]: v })} label={SKILL_BY_ID[s]?.name ?? s} />
              ))}
            </fieldset>
          )}
          {sug.note.possibleAreas.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium">Areas you may also want to mention <Badge>only if you did them</Badge></legend>
              <p className="text-xs text-muted mb-1">These are prompts, not claims. They are added to Investigation only if ticked.</p>
              {sug.note.possibleAreas.map((a) => (
                <Checkbox key={a.label} checked={!!sug.areaPick[a.label]} onChange={(v) => set('areaPick', { ...sug.areaPick, [a.label]: v })} label={a.label} />
              ))}
            </fieldset>
          )}
          <Button variant="primary" onClick={apply}>Apply to work log</Button>
        </div>
      )}
    </div>
  );
}
