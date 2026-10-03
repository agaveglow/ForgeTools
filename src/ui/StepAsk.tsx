import { useState } from 'react';
import { useCollection } from '../data/hooks';
import { answerAboutStep, STEP_QUESTIONS } from '../lib/stepHelp';
import type { StepAnswer } from '../lib/stepHelp';
import { scanText } from '../lib/sensitive';
import type { VisualModel } from '../lib/visual';
import { Button, Chip, TextInput } from './primitives';
import { Sources } from './GuideView';

/** Ask about one step. Questions are answered on this device and are never saved. */
export function StepAsk({ model, index, onIndex }: { model: VisualModel; index: number; onIndex?: (i: number) => void }) {
  const kb = useCollection('kbEntries');
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState<{ q: string; step: number } | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const step = model.steps[index];
  if (!step) return null;
  const findings = scanText(q);
  const blocked = findings.length > 0;
  const ask = (text: string) => {
    if (!text.trim() || scanText(text).length) return;
    setAsked({ q: text.trim(), step: index });
  };
  const ans: StepAnswer | undefined = asked && asked.step === index ? answerAboutStep(model, index, asked.q, kb) : undefined;
  return (
    <section aria-label="Ask about this step" data-testid="step-ask" className="rounded-md border border-line bg-surface p-3 space-y-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full min-h-11 flex items-center justify-between text-left font-medium text-sm">
        <span>Ask about step {step.n}</span><span aria-hidden className="text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="space-y-3">
          {onIndex && (
            <label className="text-sm block">Step
              <select className="ml-2 min-h-11 rounded-sm border border-line bg-surface px-2" value={index} onChange={(e: { target: { value: string } }) => onIndex(Number(e.target.value))} aria-label="Which step">
                {model.steps.map((s, i) => <option key={s.n} value={i}>{s.n}. {s.text.slice(0, 50)}</option>)}
              </select>
            </label>
          )}
          <div role="group" aria-label="Quick questions" className="flex flex-wrap gap-1.5">
            {STEP_QUESTIONS.map((x) => <Chip key={x.label} active={asked?.q === x.q && asked.step === index} onClick={() => { setQ(''); ask(x.q); }}>{x.label}</Chip>)}
          </div>
          <form className="flex gap-2" onSubmit={(e: { preventDefault: () => void }) => { e.preventDefault(); ask(q); }}>
            <TextInput aria-label={`Your question about step ${step.n}`} placeholder="Ask your own question…" value={q} onChange={(e: { target: { value: string } }) => setQ(e.target.value)} />
            <Button type="submit" variant="primary" disabled={!q.trim() || blocked}>Ask</Button>
          </form>
          {blocked && <p role="alert" className="text-sm text-warn">That looks like it has a name, number or secret in it. Ask without it, for example “the device” instead of a name.</p>}
          {ans && (
            <div aria-live="polite" data-testid="step-answer" className="rounded-sm border border-line bg-surface2 p-3 space-y-2 text-sm">
              <p className="text-xs text-muted">Step {step.n}: {asked?.q}</p>
              {ans.blocks.map((b, i) => (
                <div key={i}>
                  {b.heading && <p className="font-medium">{b.heading}</p>}
                  {b.lines.map((l, j) => <p key={j} className="wrap-any">{l}</p>)}
                </div>
              ))}
              <Sources items={ans.sources} />
              <p className="text-xs text-muted">{ans.grounded ? 'From the built-in library and your notes.' : 'No library match, so this only repeats the step.'} Answered on this device, not saved.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
