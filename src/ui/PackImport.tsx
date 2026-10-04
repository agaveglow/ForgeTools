import { useMemo, useState } from 'react';
import { store, useCollection } from '../data/hooks';
import { PACK_MAX_BYTES, PackError, parsePack, planPack } from '../lib/pack';
import type { Pack } from '../lib/pack';
import { Badge, Button, Card, Checkbox, Collapsible } from './primitives';
import { Link } from './router';

/** Loads a pack file (guides and requirements) onto this device after showing exactly what it would add. */
export function PackImport() {
  const kb = useCollection('kbEntries');
  const reqs = useCollection('requirements');
  const [pack, setPack] = useState<Pack | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState('');
  const plan = useMemo(() => (pack ? planPack(pack, kb.map((k) => k.title), reqs) : null), [pack, kb, reqs]);

  const onFile = async (e: { target: { files: FileList | null; value: string } }) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setErr(''); setDone(''); setChecked(false); setPack(null); setDropped([]);
    if (f.size > PACK_MAX_BYTES) { setErr('That file is too large to be a pack.'); return; }
    try { const r = parsePack(await f.text()); setPack(r.pack); setDropped(r.dropped); }
    catch (x) { setErr(x instanceof PackError ? x.message : 'That file could not be read.'); }
  };
  const add = () => {
    if (!plan || !pack) return;
    if (plan.warnings.length && !checked) return;
    for (const k of plan.kbNew) store.upsert('kbEntries', { title: k.title, category: k.category, tags: k.tags, body: k.body, pinned: false, demo: false });
    for (const r of plan.reqNew) store.upsert('requirements', { title: r.title, kind: r.kind, group: r.group, notes: r.notes, status: 'not-started' });
    setDone(`Added ${plan.kbNew.length} guide${plan.kbNew.length === 1 ? '' : 's'} and ${plan.reqNew.length} requirement${plan.reqNew.length === 1 ? '' : 's'} to this device.`);
    setPack(null);
  };
  const nothing = !!plan && !plan.kbNew.length && !plan.reqNew.length;

  return (
    <Collapsible title="Import a pack (guides and requirements)">
      <div className="space-y-3" data-testid="pack-import">
        <p className="text-xs text-muted">A pack is a file of guides and requirements made for ForgeTools, for example from your employer’s or training provider’s own material. It is read on this device and added here only, never uploaded and never part of the project’s public code. You see exactly what it would add first, and anything already here is skipped, so adding it twice is safe.</p>
        <label className="inline-flex items-center justify-center min-h-11 px-3.5 rounded-sm border border-line bg-surface hover:bg-surface2 text-sm font-medium cursor-pointer focus-within:outline-2 focus-within:outline-accent">
          Choose a pack file
          <input type="file" accept=".json,application/json" className="sr-only" aria-label="Choose a pack file" data-testid="pack-file" onChange={onFile} />
        </label>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        {done && <p role="status" className="text-sm text-ok" data-testid="pack-done">{done} <Link to="/kb" className="underline">Open Knowledge base</Link> · <Link to="/requirements" className="underline">Open Requirements</Link></p>}
        {pack && plan && (
          <Card className="p-3 space-y-2" data-testid="pack-plan">
            <p className="font-medium text-sm wrap-any">{pack.name}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="accent">{plan.kbNew.length} new guide{plan.kbNew.length === 1 ? '' : 's'}</Badge>
              <Badge tone="accent">{plan.reqNew.length} new requirement{plan.reqNew.length === 1 ? '' : 's'}</Badge>
              {(plan.kbHere > 0 || plan.reqHere > 0) && <Badge>{plan.kbHere + plan.reqHere} already here, skipped</Badge>}
            </div>
            {plan.kbNew.length > 0 && <details className="text-sm"><summary className="cursor-pointer min-h-9 flex items-center">Guides that will be added</summary><ul className="list-disc pl-5 space-y-0.5">{plan.kbNew.map((k) => <li key={k.title} className="wrap-any">{k.title}</li>)}</ul></details>}
            {plan.reqNew.length > 0 && <details className="text-sm"><summary className="cursor-pointer min-h-9 flex items-center">Requirements that will be added</summary><ul className="list-disc pl-5 space-y-0.5">{plan.reqNew.map((r) => <li key={r.group + r.title} className="wrap-any">{r.group ? `${r.group}: ` : ''}{r.title}</li>)}</ul></details>}
            {dropped.length > 0 && <p className="text-xs text-muted">{dropped.join(' ')}</p>}
            {plan.refused.length > 0 && (
              <div role="alert" className="text-sm text-bad space-y-0.5">
                <p className="font-medium">Not added, because they contain something that looks like a secret:</p>
                <ul className="list-disc pl-5">{plan.refused.map((r) => <li key={r.type + r.title} className="wrap-any">{r.title} ({r.why})</li>)}</ul>
              </div>
            )}
            {plan.warnings.length > 0 && (
              <div className="text-sm space-y-1">
                <p role="alert" className="text-warn font-medium">These contain details that look personal (such as an address or a number). Check them before adding:</p>
                <ul className="list-disc pl-5">{plan.warnings.map((w) => <li key={w.type + w.title} className="wrap-any">{w.title} ({w.what})</li>)}</ul>
                <Checkbox checked={checked} onChange={setChecked} label="I have checked these and they are fine to keep on this device" />
              </div>
            )}
            {nothing ? <p className="text-sm text-muted">Everything in this pack is already here.</p> : (
              <Button variant="primary" disabled={plan.warnings.length > 0 && !checked} onClick={add}>Add to this device</Button>
            )}
          </Card>
        )}
      </div>
    </Collapsible>
  );
}
