import { useMemo, useState } from 'react';
import { Block, Blocks } from '../ui/PageCustomizer';
import { store, useCollection } from '../data/hooks';
import { REQUIREMENT_KIND_LABEL, REQUIREMENT_STATUS_LABEL } from '../data/types';
import type { Requirement, RequirementKind, RequirementStatus } from '../data/types';
import { requirementProgress } from '../lib/progress';
import { Badge, Button, Card, Chip, Collapsible, Empty, Field, Modal, PageHeader, SectionTitle, Select, TextArea, TextInput } from '../ui/primitives';
import { Bar } from '../ui/Progress';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';
import { ROADMAP } from '../content/roadmap';

const STATUSES = Object.keys(REQUIREMENT_STATUS_LABEL) as RequirementStatus[];
const tone = (s: RequirementStatus) => (s === 'signed-off' ? 'ok' : s === 'evidenced' ? 'info' : s === 'in-progress' ? 'warn' : 'neutral') as 'ok' | 'info' | 'warn' | 'neutral';

function SuggestedGoals() {
  const reqs = useCollection('requirements');
  const [msg, setMsg] = useState('');
  const have = new Set(reqs.map((r) => `${r.group}|${r.title}`.toLowerCase()));
  const fresh = ROADMAP.filter((g) => !have.has(`${g.group}|${g.title}`.toLowerCase()));
  const add = () => {
    for (const g of fresh) store.upsert('requirements', { title: g.title, kind: 'apprenticeship' as RequirementKind, group: g.group, notes: '', status: 'not-started' as RequirementStatus });
    setMsg(`Added ${fresh.length} goal${fresh.length === 1 ? '' : 's'}.`);
  };
  return (
    <Collapsible title="Suggested learning goals for an IT support apprentice">
      <div className="space-y-2" data-testid="suggested-goals">
        <p className="text-xs text-muted">A general roadmap in ten stages, from how support works through hardware, networking, Microsoft 365 and printers. Adding it creates ordinary requirements you can edit, rename or delete. Anything already on your list is skipped.</p>
        <ul className="text-sm list-disc pl-5">{[...new Set(ROADMAP.map((g) => g.group))].map((g) => <li key={g}>{g}</li>)}</ul>
        {msg && <p role="status" className="text-sm text-ok" data-testid="goals-done">{msg}</p>}
        <Button variant="primary" disabled={fresh.length === 0} onClick={add}>{fresh.length === 0 ? 'All suggested goals are on your list' : `Add ${fresh.length} suggested goals`}</Button>
      </div>
    </Collapsible>
  );
}

export function RequirementsPage() {
  useTitle('Requirements');
  const reqs = useCollection('requirements');
  const entries = useCollection('apprenticeLogs');
  const tasks = useCollection('tasks');
  const [kind, setKind] = useState<RequirementKind>('job');
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('');
  const [target, setTarget] = useState('');
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState<Requirement | null>(null);
  const [del, setDel] = useState<Requirement | null>(null);
  const [filter, setFilter] = useState<'all' | RequirementKind>('all');
  const fields = { title, group, notes };
  const guard = useSaveGuard(fields);
  const groups = useMemo(() => [...new Set(reqs.map((r) => r.group).filter(Boolean))], [reqs]);

  const save = () => {
    if (!title.trim() || !guard.canSave) return;
    const data = { title: title.trim(), kind, group: group.trim(), target: target || undefined, notes: notes.trim() };
    store.upsert('requirements', editing ? { ...editing, ...data } : { ...data, status: 'not-started' as RequirementStatus });
    reset();
  };
  const reset = () => { setEditing(null); setTitle(''); setGroup(''); setTarget(''); setNotes(''); guard.setConfirmed(false); };
  const edit = (r: Requirement) => { setEditing(r); setKind(r.kind); setTitle(r.title); setGroup(r.group); setTarget(r.target ?? ''); setNotes(r.notes); window.scrollTo({ top: 0 }); };
  const redact = (x: Record<string, string>) => { setTitle(x.title); setGroup(x.group); setNotes(x.notes); guard.setConfirmed(false); };
  const shown = reqs.filter((r) => filter === 'all' || r.kind === filter);

  const section = (k: RequirementKind) => {
    const list = reqs.filter((r) => r.kind === k);
    if (filter !== 'all' && filter !== k) return null;
    const p = requirementProgress(list);
    const byGroup = new Map<string, Requirement[]>();
    for (const r of list) byGroup.set(r.group || 'General', [...(byGroup.get(r.group || 'General') ?? []), r]);
    return (
      <section key={k}>
        <SectionTitle>{REQUIREMENT_KIND_LABEL[k]}s</SectionTitle>
        <Card className="p-3 space-y-3">
          {list.length === 0 ? <p className="text-sm text-muted">None added yet.</p> : (
            <>
              <div><div className="flex justify-between text-sm mb-1"><span>{p.done} of {p.total} evidenced or signed off</span><span className="text-muted">{p.pct}%</span></div><Bar value={p.done} max={p.total} label={`${REQUIREMENT_KIND_LABEL[k]} progress`} tone="ok" /></div>
              {[...byGroup.entries()].map(([g, rs]) => (
                <div key={g}>
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{g}</h3>
                  <ul className="divide-y divide-line">{rs.map((r) => {
                    const linked = entries.filter((e) => e.requirementIds.includes(r.id)).length + tasks.filter((t) => t.requirementId === r.id).length;
                    return (
                      <li key={r.id} className="py-2 space-y-1.5">
                        <div className="flex flex-wrap items-start gap-2"><span className="text-sm font-medium wrap-any flex-1 min-w-40">{r.title}</span><Badge tone={tone(r.status)}>{REQUIREMENT_STATUS_LABEL[r.status]}</Badge></div>
                        {r.notes && <p className="text-xs text-muted wrap-any">{r.notes}</p>}
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-xs inline-flex items-center gap-1.5">Status
                            <Select aria-label={`Status of ${r.title}`} className="!min-h-9 !py-0 text-sm" value={r.status} onChange={(e: { target: { value: string } }) => store.upsert('requirements', { ...r, status: e.target.value as RequirementStatus })}>{STATUSES.map((s) => <option key={s} value={s}>{REQUIREMENT_STATUS_LABEL[s]}</option>)}</Select>
                          </label>
                          {r.target && <span className="text-xs text-muted">Target {r.target}</span>}
                          <span className="text-xs text-muted">{linked} linked {linked === 1 ? 'entry' : 'entries'}</span>
                          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => edit(r)} aria-label={`Edit ${r.title}`}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDel(r)} aria-label={`Delete ${r.title}`}>Delete</Button>
                        </div>
                      </li>
                    );
                  })}</ul>
                </div>
              ))}
            </>
          )}
        </Card>
      </section>
    );
  };

  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Requirements" sub="What your job and apprenticeship expect of you, and how far along each is." />
      <Blocks pageKey="RequirementsPage" group="RequirementsPage" className="space-y-5">
        <Block title="Note">
      <p className="text-xs text-muted" role="note">ForgeTools doesn’t ship a requirements list. Enter yours from your job description and apprenticeship plan, using your own wording. Status is your judgement; link tasks and apprenticeship entries to show the evidence.</p>
        </Block>
        <Block title="Section 2">
      <SuggestedGoals />
        </Block>
        <Block title="Type">
      <Card className="p-4">
        <form className="space-y-3" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); save(); }}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type">{(Object.keys(REQUIREMENT_KIND_LABEL) as RequirementKind[]).map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{REQUIREMENT_KIND_LABEL[k]}</Chip>)}</div>
          <Field label={editing ? 'Edit requirement' : 'New requirement'} htmlFor="rq-title"><TextInput id="rq-title" value={title} onChange={(e: { target: { value: string } }) => setTitle(e.target.value)} placeholder="e.g. Can troubleshoot managed print fleet issues" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Group (optional)" htmlFor="rq-group" hint="For example Knowledge, Skills, Behaviours, Print, Telecoms."><TextInput id="rq-group" list="rq-groups" value={group} onChange={(e: { target: { value: string } }) => setGroup(e.target.value)} /><datalist id="rq-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></Field>
            <Field label="Target date (optional)" htmlFor="rq-target"><TextInput id="rq-target" type="date" value={target} onChange={(e: { target: { value: string } }) => setTarget(e.target.value)} /></Field>
          </div>
          <Field label="Notes (optional)" htmlFor="rq-notes"><TextArea id="rq-notes" rows={2} value={notes} onChange={(e: { target: { value: string } }) => setNotes(e.target.value)} /></Field>
          <SensitivePanel guard={guard} fieldLabels={{ title: 'Requirement', group: 'Group', notes: 'Notes' }} onRedactAll={() => redact(guard.redactAll(fields))} onRedactKind={(k) => redact(guard.redactOneKind(fields, k))} />
          <div className="flex gap-2"><Button variant="primary" type="submit" disabled={!title.trim() || !guard.canSave}>{editing ? 'Save requirement' : 'Add requirement'}</Button>{editing && <Button onClick={reset}>Cancel</Button>}</div>
        </form>
      </Card>
        </Block>
        <Block title="Section 4">
      <PrivacyNote />
        </Block>
        <Block title="Show">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">{([['all', 'All'], ['job', 'Job'], ['apprenticeship', 'Apprenticeship']] as const).map(([v, l]) => <Chip key={v} active={filter === v} onClick={() => setFilter(v)}>{l}</Chip>)}</div>
        </Block>
      </Blocks>
      {section('job')}
      {section('apprenticeship')}
      {reqs.length === 0 && <Empty title="No requirements yet.">Add the first one above.</Empty>}
      {shown.length === 0 && reqs.length > 0 && <Empty title="Nothing in this view." />}
      {del && <Modal title="Delete this requirement?" onClose={() => setDel(null)} footer={<><Button onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => { store.remove('requirements', del.id); setDel(null); }}>Delete</Button></>}><p className="text-sm wrap-any">{del.title}. Linked tasks and entries are kept.</p></Modal>}
    </div>
  );
}
