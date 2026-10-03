import { useEffect, useMemo, useState } from 'react';
import { store, useCollection, useRecord, useSettings } from '../data/hooks';
import { LOG_CATEGORIES, LOG_STATUS_LABEL } from '../data/types';
import type { LogCategory, LogStatus, ResearchItem, WorkLog } from '../data/types';
import { SKILLS, SKILL_BY_ID } from '../content/skills';
import { CONCEPTS } from '../content/concepts';
import { clsx, formatDateTime, fromLocalInput, toLocalInput, uid, nowIso, plural } from '../lib/util';
import { takeLogDraft, workLogToText } from '../lib/handoff';
import type { LogDraft } from '../lib/handoff';
import { Badge, Button, Card, Chip, Collapsible, CopyButton, Empty, Field, Modal, PageHeader, Select, TextArea, TextInput } from '../ui/primitives';
import { Link, navigate } from '../ui/router';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { NoteAssistant } from '../ui/NoteAssistant';
import type { AssistantResult } from '../ui/NoteAssistant';
import { useIsMobile, useTitle } from '../ui/hooks';

const statusTone = (s: LogStatus) => (s === 'resolved' ? 'ok' : s === 'unresolved' ? 'bad' : s === 'follow-up' ? 'warn' : 'neutral') as 'ok' | 'bad' | 'warn' | 'neutral';

// ---------------- List ----------------

export function LogList() {
  useTitle('Work logs');
  const logs = useCollection('workLogs');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'All' | LogCategory>('All');
  const [status, setStatus] = useState<'All' | LogStatus>('All');
  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return logs
      .filter((l) => cat === 'All' || l.category === cat)
      .filter((l) => status === 'All' || l.status === status)
      .filter((l) => {
        if (!words.length) return true;
        const hay = [l.ref, l.client, l.device, l.problem, l.investigation, l.actions, l.result, l.ticket, l.category].join(' ').toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [logs, q, cat, status]);

  return (
    <div>
      <PageHeader title="Work logs" sub={plural(logs.length, 'log')} actions={<Link to="/logs/new" className="inline-flex items-center justify-center min-h-11 px-3.5 rounded-sm bg-accent text-accent-ink font-medium text-sm">+ New work log</Link>} />
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] mb-3">
        <TextInput type="search" aria-label="Search work logs" placeholder="Search logs…" value={q} onChange={(e: { target: { value: string } }) => setQ(e.target.value)} />
        <Select aria-label="Filter by category" value={cat} onChange={(e: { target: { value: string } }) => setCat(e.target.value as 'All' | LogCategory)}>
          <option>All</option>
          {LOG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select aria-label="Filter by status" value={status} onChange={(e: { target: { value: string } }) => setStatus(e.target.value as 'All' | LogStatus)}>
          <option value="All">All</option>
          {(Object.keys(LOG_STATUS_LABEL) as LogStatus[]).map((s) => <option key={s} value={s}>{LOG_STATUS_LABEL[s]}</option>)}
        </Select>
      </div>
      {rows.length === 0 ? (
        <Empty title={logs.length ? 'No logs match.' : 'No work logs yet.'}>Record what happened, what you did and the result. It takes under a minute.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((l) => <li key={l.id}><LogRow log={l} /></li>)}
        </ul>
      )}
    </div>
  );
}

export function LogRow({ log: l }: { log: WorkLog }) {
  return (
    <Link to={`/logs/${l.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <span className="font-mono">{l.ref}</span>
        <span>·</span>
        <span>{formatDateTime(l.occurredAt)}</span>
      </div>
      <p className="font-medium mt-0.5 wrap-any">{l.problem || '(no problem recorded)'}</p>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <Badge>{l.category}</Badge>
        <Badge tone={statusTone(l.status)}>{LOG_STATUS_LABEL[l.status]}</Badge>
        {l.device && <Badge>{l.device}</Badge>}
        {l.ticket && <Badge tone="info">{l.ticket}</Badge>}
      </div>
    </Link>
  );
}

// ---------------- Detail ----------------

function Section({ title, text }: { title: string; text?: string }) {
  if (!text?.trim()) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <p className="whitespace-pre-wrap wrap-any mt-0.5">{text}</p>
    </div>
  );
}

export function LogDetail({ id }: { id: string }) {
  const log = useRecord('workLogs', id);
  useTitle(log?.ref ?? 'Work log');
  const [confirmDel, setConfirmDel] = useState(false);
  if (!log) return <Empty title="Work log not found."><Link to="/logs" className="underline">Back to work logs</Link></Empty>;
  const l = log;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={l.problem || l.ref}
        sub={<span className="inline-flex flex-wrap items-center gap-1.5"><span className="font-mono">{l.ref}</span> · {formatDateTime(l.occurredAt)}</span>}
        actions={
          <>
            <Button onClick={() => navigate(`/logs/${l.id}/edit`)}>Edit</Button>
            <CopyButton text={workLogToText(l)} label="Copy as text" size="md" />
            <Button variant="danger" onClick={() => setConfirmDel(true)}>Delete</Button>
          </>
        }
      />
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{l.category}</Badge>
          <Badge tone={statusTone(l.status)}>{LOG_STATUS_LABEL[l.status]}</Badge>
          {l.client && <Badge>Client: {l.client}</Badge>}
          {l.device && <Badge>Device: {l.device}</Badge>}
          {l.ticket && <Badge tone="info">Ticket {l.ticket}</Badge>}
        </div>
        <Section title="Problem" text={l.problem} />
        <Section title="Investigation" text={l.investigation} />
        <Section title="Actions taken" text={l.actions} />
        <Section title="Result" text={l.result} />
        <Section title="Follow-up" text={l.followUp} />
        <Section title="What I learned" text={l.learned} />
        <Section title="Evidence" text={l.evidence} />
        {l.skills.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Skills claimed</h3>
            <div className="flex flex-wrap gap-1.5 mt-1">{l.skills.map((s) => <Badge key={s} tone="accent">{SKILL_BY_ID[s]?.name ?? s}</Badge>)}</div>
          </div>
        )}
        {l.learning && (l.learning.demonstrated || l.learning.concepts.length > 0 || l.learning.toResearch.length > 0 || l.learning.nextActivity) && (
          <div className="border-t border-line pt-3 space-y-3">
            <h3 className="font-semibold">Learning reflection</h3>
            <Section title="What this demonstrated" text={l.learning.demonstrated} />
            {l.learning.concepts.length > 0 && <div className="flex flex-wrap gap-1.5">{l.learning.concepts.map((c) => <Badge key={c}>{c}</Badge>)}</div>}
            {l.learning.toResearch.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">To research</h3>
                <ul className="mt-1 space-y-1">
                  {l.learning.toResearch.map((r) => (
                    <li key={r.id} className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1 size-5 accent-[var(--c-accent)]" aria-label={r.text} checked={r.done} onChange={() => store.upsert('workLogs', { ...l, learning: { ...l.learning!, toResearch: l.learning!.toResearch.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)) } })} />
                      <span className={clsx('wrap-any', r.done && 'line-through text-muted')}>{r.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Section title="Next practice activity" text={l.learning.nextActivity} />
          </div>
        )}
      </Card>
      {confirmDel && (
        <Modal title="Delete this work log?" onClose={() => setConfirmDel(false)} footer={<><Button onClick={() => setConfirmDel(false)}>Cancel</Button><Button variant="danger" onClick={() => { store.remove('workLogs', l.id); navigate('/logs'); }}>Delete</Button></>}>
          <p>{l.ref} will be removed from this device. This cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Editor ----------------

interface Form {
  occurredAt: string;
  client: string;
  device: string;
  category: LogCategory;
  problem: string;
  investigation: string;
  actions: string;
  result: string;
  followUp: string;
  status: LogStatus;
  skills: string[];
  learned: string;
  evidence: string;
  ticket: string;
  demonstrated: string;
  concepts: string[];
  toResearch: ResearchItem[];
  nextActivity: string;
}

function blankForm(): Form {
  return { occurredAt: toLocalInput(nowIso()), client: '', device: '', category: 'Other', problem: '', investigation: '', actions: '', result: '', followUp: '', status: 'info', skills: [], learned: '', evidence: '', ticket: '', demonstrated: '', concepts: [], toResearch: [], nextActivity: '' };
}
function formFrom(l: WorkLog): Form {
  return { ...blankForm(), occurredAt: toLocalInput(l.occurredAt), client: l.client, device: l.device, category: l.category, problem: l.problem, investigation: l.investigation, actions: l.actions, result: l.result, followUp: l.followUp, status: l.status, skills: l.skills, learned: l.learned, evidence: l.evidence, ticket: l.ticket, demonstrated: l.learning?.demonstrated ?? '', concepts: l.learning?.concepts ?? [], toResearch: l.learning?.toResearch ?? [], nextActivity: l.learning?.nextActivity ?? '' };
}
function formFromDraft(d: LogDraft): Form {
  const b = blankForm();
  return { ...b, ...(d as Partial<Form>), occurredAt: d.occurredAt ? toLocalInput(d.occurredAt) : b.occurredAt };
}

export function LogEditor({ id }: { id?: string }) {
  const existing = useRecord('workLogs', id);
  const settings = useSettings();
  const isMobile = useIsMobile();
  useTitle(id ? 'Edit work log' : 'New work log');
  const [form, setForm] = useState<Form>(() => {
    if (id && store.get('workLogs', id)) return formFrom(store.get('workLogs', id)!);
    const d = takeLogDraft();
    return d ? formFromDraft(d) : blankForm();
  });
  // Status follows what you wrote until you pick one yourself. A log with no result is never marked Resolved by default.
  const [statusTouched, setStatusTouched] = useState(() => !!id || form.status !== 'info');
  useEffect(() => {
    if (statusTouched) return;
    const resolved = /\b(?:works|working|resolved|fixed|passed|sorted|successful)\b/i.test(form.result);
    const next: LogStatus = resolved ? (form.followUp.trim() ? 'follow-up' : 'resolved') : form.followUp.trim() ? 'follow-up' : 'info';
    if (next !== form.status) setForm((f) => ({ ...f, status: next }));
  }, [statusTouched, form.result, form.followUp, form.status]);
  const [loadedId, setLoadedId] = useState(id);
  useEffect(() => {
    if (id !== loadedId) {
      setLoadedId(id);
      setForm(id && existing ? formFrom(existing) : blankForm());
    }
  }, [id, loadedId, existing]);

  const mode = settings.logMode === 'auto' ? (isMobile ? 'quick' : 'full') : settings.logMode;
  const [showAssistant, setShowAssistant] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof Form) => ({
    value: form[k] as string,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  });

  const fields: Record<string, string> = {
    client: form.client, device: form.device, problem: form.problem, investigation: form.investigation, actions: form.actions, result: form.result,
    followUp: form.followUp, learned: form.learned, evidence: form.evidence, demonstrated: form.demonstrated, nextActivity: form.nextActivity,
    toResearch: form.toResearch.map((r) => r.text).join('\n'),
  };
  const labels: Record<string, string> = { problem: 'What happened', investigation: 'Investigation', actions: 'What you did', result: 'Result', followUp: 'Follow-up', learned: 'What I learned', evidence: 'Evidence', client: 'Client', device: 'Device', demonstrated: 'What this demonstrated', nextActivity: 'Next activity', toResearch: 'To research' };
  const guard = useSaveGuard(fields);
  const applyRedaction = (r: Record<string, string>) => {
    setForm((f) => ({
      ...f,
      client: r.client, device: r.device, problem: r.problem, investigation: r.investigation, actions: r.actions, result: r.result, followUp: r.followUp,
      learned: r.learned, evidence: r.evidence, demonstrated: r.demonstrated, nextActivity: r.nextActivity,
      toResearch: f.toResearch.map((x, i) => ({ ...x, text: r.toResearch.split('\n')[i] ?? '' })),
    }));
    guard.setConfirmed(false);
  };

  const [error, setError] = useState('');
  const save = () => {
    if (!form.problem.trim()) { setError('Add what happened so you can find this log later.'); return; }
    if (!guard.canSave) { setError(guard.blocked ? 'Remove the secret above before saving.' : 'Confirm the sensitive details above, or redact them.'); return; }
    const hasLearning = form.demonstrated.trim() || form.concepts.length || form.toResearch.length || form.nextActivity.trim();
    const data = {
      ref: existing?.ref ?? store.nextWorkLogRef(),
      occurredAt: fromLocalInput(form.occurredAt) || nowIso(),
      client: form.client.trim(), device: form.device.trim(), category: form.category,
      problem: form.problem.trim(), investigation: form.investigation.trim(), actions: form.actions.trim(), result: form.result.trim(), followUp: form.followUp.trim(),
      status: form.status, skills: form.skills, learned: form.learned.trim(), evidence: form.evidence.trim(), ticket: form.ticket.trim(),
      learning: hasLearning ? { demonstrated: form.demonstrated.trim(), learned: form.learned.trim(), concepts: form.concepts, toResearch: form.toResearch.filter((r) => r.text.trim()), nextActivity: form.nextActivity.trim() } : undefined,
    };
    const saved = store.upsert('workLogs', existing ? { ...existing, ...data } : { ...data, demo: false });
    navigate(`/logs/${saved.id}`);
  };

  const applyAssistant = (r: AssistantResult) => {
    setForm((f) => ({
      ...f,
      problem: r.problem || f.problem, investigation: r.investigation || f.investigation, actions: r.actions || f.actions, result: r.result || f.result, followUp: r.followUp || f.followUp,
      category: r.category !== 'Other' ? r.category : f.category,
      device: f.device || r.device || '',
      skills: [...new Set([...f.skills, ...r.skills])],
    }));
    setShowAssistant(false);
  };

  const concepts = CONCEPTS[form.category];
  const [detailsOpenByDefault] = useState(() => mode === 'full' || !!(form.investigation || form.followUp || form.client || form.device || form.ticket || form.evidence));

  const extras = (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client" htmlFor="client" hint="A team or site name is enough."><TextInput id="client" {...text('client')} /></Field>
        <Field label="Device" htmlFor="device" hint="Model or role. Avoid serial numbers."><TextInput id="device" {...text('device')} /></Field>
        <Field label="Category" htmlFor="category">
          <Select id="category" value={form.category} onChange={(e: { target: { value: string } }) => set('category', e.target.value as LogCategory)}>
            {LOG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Ticket reference (optional)" htmlFor="ticket"><TextInput id="ticket" {...text('ticket')} /></Field>
        <Field label="Date and time" htmlFor="when"><TextInput id="when" type="datetime-local" {...text('occurredAt')} /></Field>
      </div>
      {mode === 'quick' && (
        <Field label="Investigation" htmlFor="inv-q"><TextArea id="inv-q" rows={2} {...text('investigation')} placeholder="What you checked and found" /></Field>
      )}
      <Field label="Follow-up needed" htmlFor="fu"><TextArea id="fu" rows={2} {...text('followUp')} /></Field>
      <Field label="Evidence" htmlFor="ev" hint="A reference such as a screenshot filename or ticket link. Files are not stored."><TextInput id="ev" {...text('evidence')} /></Field>
      <fieldset>
        <legend className="text-sm font-medium">Skills used</legend>
        <p className="text-xs text-muted mb-1">Only claim skills you actually used in this work.</p>
        <div className="flex flex-wrap gap-1.5">
          {SKILLS.map((s) => <Chip key={s.id} active={form.skills.includes(s.id)} onClick={() => set('skills', form.skills.includes(s.id) ? form.skills.filter((x) => x !== s.id) : [...form.skills, s.id])}>{s.name}</Chip>)}
        </div>
      </fieldset>
      <Collapsible title="Learning reflection" defaultOpen={false}>
        <div className="space-y-3 pt-2">
          <Field label="What I learned" htmlFor="learned"><TextArea id="learned" rows={2} {...text('learned')} /></Field>
          <Field label="What this demonstrated" htmlFor="demo-d" hint="Your own judgement of what the work showed."><TextArea id="demo-d" rows={2} {...text('demonstrated')} /></Field>
          <div>
            <p className="text-sm font-medium mb-1">Concepts to understand</p>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...concepts.concepts, ...form.concepts])].map((c) => <Chip key={c} active={form.concepts.includes(c)} onClick={() => set('concepts', form.concepts.includes(c) ? form.concepts.filter((x) => x !== c) : [...form.concepts, c])}>{c}</Chip>)}
            </div>
            <p className="text-xs text-muted mt-1">Suggestions for this category. Select what you want to study.</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">To research</p>
            <ul className="space-y-1.5">
              {form.toResearch.map((r, i) => (
                <li key={r.id} className="flex gap-2">
                  <TextInput aria-label={`Research item ${i + 1}`} value={r.text} onChange={(e: { target: { value: string } }) => set('toResearch', form.toResearch.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)))} />
                  <Button variant="ghost" aria-label="Remove item" onClick={() => set('toResearch', form.toResearch.filter((x) => x.id !== r.id))}>✕</Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button size="sm" onClick={() => set('toResearch', [...form.toResearch, { id: uid(), text: '', done: false }])}>Add item</Button>
              <Button size="sm" onClick={() => set('toResearch', [...form.toResearch, ...concepts.research.filter((t) => !form.toResearch.some((x) => x.text === t)).map((t) => ({ id: uid(), text: t, done: false }))])}>Add suggestions</Button>
            </div>
          </div>
          <Field label="Next practice activity" htmlFor="next"><TextArea id="next" rows={2} {...text('nextActivity')} /></Field>
        </div>
      </Collapsible>
    </div>
  );

  return (
    <div className="max-w-3xl pb-24 md:pb-4">
      <PageHeader title={id ? `Edit ${existing?.ref ?? 'work log'}` : 'New work log'} sub={mode === 'quick' ? 'Quick mode: three fields, everything else optional.' : 'Full mode'} actions={
        <>
          <Button onClick={() => setShowAssistant(true)}>Structure rough notes</Button>
          <Button variant="ghost" onClick={() => store.updateSettings({ logMode: mode === 'quick' ? 'full' : 'quick' })}>{mode === 'quick' ? 'Switch to full form' : 'Switch to quick form'}</Button>
        </>
      } />
      <form onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); save(); }} className="space-y-4">
        <Card className="p-4 space-y-4">
          <Field label="What happened?" htmlFor="problem"><TextArea id="problem" rows={mode === 'quick' ? 3 : 2} {...text('problem')} placeholder="The issue, in a sentence or two" /></Field>
          {mode === 'full' && <Field label="Investigation" htmlFor="inv"><TextArea id="inv" rows={3} {...text('investigation')} placeholder="What you checked and what you found" /></Field>}
          <Field label="What did you do?" htmlFor="actions"><TextArea id="actions" rows={mode === 'quick' ? 3 : 3} {...text('actions')} placeholder="Changes you made" /></Field>
          <Field label="Result" htmlFor="result"><TextArea id="result" rows={2} {...text('result')} placeholder="What happened afterwards, as you observed it" /></Field>
          <fieldset>
            <legend className="text-sm font-medium mb-1">Status</legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Status">
              {(Object.keys(LOG_STATUS_LABEL) as LogStatus[]).map((s) => <Chip key={s} active={form.status === s} onClick={() => { setStatusTouched(true); set('status', s); }}>{LOG_STATUS_LABEL[s]}</Chip>)}
            </div>
          </fieldset>
        </Card>
        {mode === 'quick' ? <Collapsible title="More details (optional)" defaultOpen={detailsOpenByDefault}>{extras}</Collapsible> : <Card className="p-4">{extras}</Card>}
        <SensitivePanel guard={guard} fieldLabels={labels} onRedactAll={() => applyRedaction(guard.redactAll(fields))} onRedactKind={(k) => applyRedaction(guard.redactOneKind(fields, k))} />
        <PrivacyNote />
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <div className="fixed md:static bottom-0 inset-x-0 z-30 bg-surface md:bg-transparent border-t md:border-0 border-line p-3 md:p-0 pb-safe flex gap-2 justify-end">
          <Button className="flex-1 md:flex-none" onClick={() => navigate(id ? `/logs/${id}` : '/logs')}>Cancel</Button>
          <Button variant="primary" className="flex-1 md:flex-none" type="submit" disabled={guard.blocked}>Save work log</Button>
        </div>
      </form>
      {showAssistant && (
        <Modal title="Structure rough notes" onClose={() => setShowAssistant(false)}>
          <NoteAssistant onApply={applyAssistant} />
        </Modal>
      )}
    </div>
  );
}
