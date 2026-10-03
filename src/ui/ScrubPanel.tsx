import { useState } from 'react';
import type { ScrubResult } from '../lib/scrub';
import { scrubSummary } from '../lib/scrub';
import { Button, Field, TextInput } from './primitives';

export function mergeScrub(a: ScrubResult | null, b: ScrubResult): ScrubResult {
  const items = [...(a?.items ?? []), ...b.items];
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.label] = (counts[i.label] ?? 0) + 1;
  return { text: b.text, items, counts };
}

/** Shows what automatic scrubbing removed, and lets the person remove more words. Originals are shown on screen only. */
export function ScrubPanel({ result, onAddTerms, onRescrub }: { result: ScrubResult | null; onAddTerms: (terms: string[]) => void; onRescrub: () => void }) {
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState('');
  return (
    <div className="rounded-md border border-line bg-surface2 p-3 space-y-2" data-testid="scrub-panel">
      <p className="text-sm" role="status">{result ? scrubSummary(result) : 'Names, numbers and identifying details are removed automatically when you load a document or paste text.'}</p>
      <p className="text-xs text-muted">This is a safety net. Names written in ordinary sentences can be missed, so read the text before saving.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onRescrub}>Scrub the text again</Button>
        {result && result.items.length > 0 && <Button size="sm" onClick={() => setShow((s) => !s)} aria-expanded={show}>{show ? 'Hide' : 'Show'} what was removed</Button>}
      </div>
      {show && result && (
        <div>
          <p className="text-xs text-muted mb-1">Shown on screen only. Nothing here is saved.</p>
          <ul className="text-xs space-y-0.5 max-h-48 overflow-y-auto">{result.items.map((i, k) => <li key={k} className="wrap-any"><span className="text-muted">{i.label}:</span> <span className="line-through">{i.original}</span> → {i.replacement}</li>)}</ul>
        </div>
      )}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); const t = terms.split(',').map((x) => x.trim()).filter(Boolean); if (t.length) { onAddTerms(t); setTerms(''); } }}>
        <div className="flex-1 min-w-48"><Field label="Also remove these words" htmlFor="scrub-terms" hint="Separate with commas. Used for this text only and not stored."><TextInput id="scrub-terms" value={terms} onChange={(e: { target: { value: string } }) => setTerms(e.target.value)} /></Field></div>
        <Button size="sm" type="submit" disabled={!terms.trim()}>Remove</Button>
      </form>
    </div>
  );
}
