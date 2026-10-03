import { useState } from 'react';
import { CHECKLISTS, CHECKLIST_BY_ID } from '../content/checklist';
import { store, useCollection, useRecord } from '../data/hooks';
import { CHECK_STATE_LABEL } from '../data/types';
import type { CheckState, ChecklistRun } from '../data/types';
import { setLogDraft } from '../lib/handoff';
import { clsx, formatDateTime, nowIso, timeAgo } from '../lib/util';
import { Badge, Button, Card, Chip, Empty, Field, Modal, PageHeader, SectionTitle, TextInput } from '../ui/primitives';
import { Link, navigate } from '../ui/router';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';
import { CommandLinks } from './CommandsPage';

const STATES: CheckState[] = ['unchecked', 'pass', 'fail', 'na'];

export function summarise(run: ChecklistRun) {
  const tpl = CHECKLIST_BY_ID[run.templateId];
  const ids = tpl.sections.flatMap((s) => s.items.map((i) => i.id));
  const count = (st: CheckState) => ids.filter((id) => (run.items[id]?.state ?? 'unchecked') === st).length;
  return { total: ids.length, pass: count('pass'), fail: count('fail'), na: count('na'), unchecked: count('unchecked') };
}

export function SecurityList() {
  useTitle('Security checklist');
  const runs = useCollection('checklistRuns').slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [ticket, setTicket] = useState('');
  const tpl = CHECKLISTS[0];
  const guard = useSaveGuard({ label });
  const start = () => {
    if (!guard.canSave) return;
    const r = store.upsert('checklistRuns', { templateId: tpl.id, label: label.trim() || 'Unnamed device', ticket: ticket.trim(), items: {}, status: 'open', demo: false });
    store.trackUsage('checklist', tpl.id, tpl.title, `/security/${r.id}`);
    navigate(`/security/${r.id}`);
  };
  return (
    <div className="max-w-3xl">
      <PageHeader title="Security maintenance" sub={tpl.description} actions={<Button variant="primary" onClick={() => setCreating(true)}>New check</Button>} />
      {runs.length === 0 ? <Empty title="No checks yet.">Start a check for a device you are authorised to maintain.</Empty> : (
        <ul className="space-y-2">
          {runs.map((r) => {
            const sm = summarise(r);
            return (
              <li key={r.id}>
                <Link to={`/security/${r.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2">
                  <span className="font-medium">{r.label}</span>
                  <span className="block text-xs text-muted">{r.status === 'complete' ? 'Complete' : 'In progress'} · updated {timeAgo(r.updatedAt)}{r.ticket ? ` · ${r.ticket}` : ''}</span>
                  <span className="flex flex-wrap gap-1.5 mt-1.5"><Badge tone="ok">{sm.pass} passed</Badge>{sm.fail > 0 && <Badge tone="bad">{sm.fail} failed</Badge>}<Badge>{sm.unchecked} not checked</Badge></span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {creating && (
        <Modal title="New security check" onClose={() => setCreating(false)} footer={<><Button onClick={() => setCreating(false)}>Cancel</Button><Button variant="primary" onClick={start} disabled={!guard.canSave}>Start</Button></>}>
          <div className="space-y-3">
            <Field label="Device label" htmlFor="c-label" hint="Role or model, such as “reception PC”. Avoid serial numbers and customer names."><TextInput id="c-label" value={label} onChange={(e: { target: { value: string } }) => setLabel(e.target.value)} /></Field>
            <Field label="Ticket reference" htmlFor="c-ticket"><TextInput id="c-ticket" value={ticket} onChange={(e: { target: { value: string } }) => setTicket(e.target.value)} /></Field>
            <SensitivePanel guard={guard} onRedactAll={() => setLabel(guard.redactAll({ label }).label)} onRedactKind={() => undefined} />
          </div>
        </Modal>
      )}
    </div>
  );
}

export function SecurityRun({ id }: { id: string }) {
  const run = useRecord('checklistRuns', id);
  useTitle(run?.label ?? 'Security check');
  const [confirmDel, setConfirmDel] = useState(false);
  const noteText = run ? Object.values(run.items).map((i) => i.note).join('\n') : '';
  const guard = useSaveGuard({ notes: noteText, label: run?.label ?? '' });
  if (!run) return <Empty title="Check not found."><Link to="/security" className="underline">Back</Link></Empty>;
  const r: ChecklistRun = run;
  const tpl = CHECKLIST_BY_ID[r.templateId];
  const sm = summarise(r);
  const item = (iid: string) => r.items[iid] ?? { state: 'unchecked' as CheckState, note: '' };
  const setItem = (iid: string, p: Partial<{ state: CheckState; note: string }>) => store.upsert('checklistRuns', { ...r, items: { ...r.items, [iid]: { ...item(iid), ...p } } });
  const failed = tpl.sections.flatMap((s) => s.items.filter((i) => item(i.id).state === 'fail'));
  const makeLog = () => {
    const inv = tpl.sections.flatMap((s) => s.items.filter((i) => item(i.id).state !== 'unchecked').map((i) => `${i.title}: ${CHECK_STATE_LABEL[item(i.id).state]}${item(i.id).note ? ` (${item(i.id).note})` : ''}.`)).join(' ');
    setLogDraft({ problem: `Security maintenance check${r.label ? ' on ' + r.label : ''}`, category: 'Cybersecurity', device: r.label, ticket: r.ticket, investigation: inv, actions: '', result: '', followUp: failed.length ? `Failed checks to address: ${failed.map((f) => f.title).join('; ')}.` : '', status: failed.length ? 'follow-up' : 'resolved', skills: ['endpoint-security'], sourceRunId: r.id });
    navigate('/logs/new');
  };
  const complete = r.status === 'complete';
  return (
    <div className="max-w-3xl pb-8">
      <PageHeader title={r.label} sub={<span>{tpl.title} · {r.ticket || 'no ticket'}</span>} actions={<Link to="/security" className="inline-flex items-center min-h-11 px-3 rounded-sm border border-line text-sm hover:bg-surface2">All checks</Link>} />
      <Card className="p-3 mb-3 sticky top-0 z-10">
        <div className="flex flex-wrap gap-1.5 items-center" aria-live="polite">
          <Badge tone="ok">{sm.pass} passed</Badge><Badge tone="bad">{sm.fail} failed</Badge><Badge>{sm.na} not applicable</Badge><Badge>{sm.unchecked} not checked</Badge>
          <span className="text-xs text-muted ml-auto">{sm.total - sm.unchecked}/{sm.total} recorded</span>
        </div>
        <div className="h-1.5 bg-surface2 rounded-xs mt-2 overflow-hidden" aria-hidden><div className="h-full bg-accent" style={{ width: `${((sm.total - sm.unchecked) / sm.total) * 100}%` }} /></div>
      </Card>
      {tpl.sections.map((sec) => (
        <div key={sec.id} className="mb-4">
          <SectionTitle>{sec.title}</SectionTitle>
          {sec.intro && <p className="text-sm text-muted mb-2">{sec.intro}</p>}
          <ul className="space-y-2">
            {sec.items.map((it) => {
              const cur = item(it.id);
              return (
                <li key={it.id}>
                  <Card className={clsx('p-3', cur.state === 'fail' && 'border-bad', cur.state === 'pass' && 'border-ok/60')}>
                    <p className="font-medium">{it.title}</p>
                    <p className="text-sm wrap-any">{it.how}</p>
                    <p className="text-sm text-muted"><span className="font-medium">Passed when: </span>{it.passWhen}</p>
                    <CommandLinks ids={it.commandIds} />
                    <div className="flex flex-wrap gap-1.5 mt-2" role="radiogroup" aria-label={`Result for ${it.title}`}>
                      {STATES.map((st) => <Chip key={st} active={cur.state === st} onClick={() => setItem(it.id, { state: st })}>{CHECK_STATE_LABEL[st]}</Chip>)}
                    </div>
                    <TextInput className="mt-2" aria-label={`Note for ${it.title}`} placeholder="Note (optional)" value={cur.note} onChange={(e: { target: { value: string } }) => setItem(it.id, { note: e.target.value })} />
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {failed.length > 0 && (
        <Card className="p-3 mb-3 border-bad"><p className="font-semibold">Failed items</p><ul className="list-disc pl-5 text-sm">{failed.map((f) => <li key={f.id}>{f.title}</li>)}</ul></Card>
      )}
      <SensitivePanel guard={guard} fieldLabels={{ notes: 'Item notes', label: 'Label' }} onRedactAll={() => store.upsert('checklistRuns', { ...r, items: Object.fromEntries(Object.entries(r.items).map(([k, v]) => [k, { ...v, note: guard.redactAll({ n: v.note }).n }])) })} onRedactKind={() => undefined} />
      <PrivacyNote />
      <div className="flex flex-wrap gap-2 mt-3">
        <Button variant="primary" onClick={makeLog}>Create work log</Button>
        {!complete ? <Button onClick={() => store.upsert('checklistRuns', { ...r, status: 'complete', completedAt: nowIso() })}>Mark complete</Button> : <Button onClick={() => store.upsert('checklistRuns', { ...r, status: 'open', completedAt: undefined })}>Reopen</Button>}
        <Button variant="danger" onClick={() => setConfirmDel(true)}>Delete</Button>
      </div>
      {complete && r.completedAt && <p className="text-xs text-muted mt-2">Completed {formatDateTime(r.completedAt)}</p>}
      {confirmDel && <Modal title="Delete this check?" onClose={() => setConfirmDel(false)} footer={<><Button onClick={() => setConfirmDel(false)}>Cancel</Button><Button variant="danger" onClick={() => { store.remove('checklistRuns', r.id); navigate('/security'); }}>Delete</Button></>}><p>This removes the record from this device.</p></Modal>}
    </div>
  );
}
