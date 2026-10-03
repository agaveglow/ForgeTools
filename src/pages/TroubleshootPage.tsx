import { useEffect, useMemo, useState } from 'react';
import { WORKFLOWS, WORKFLOW_BY_ID, WORKFLOW_CATEGORIES } from '../content/workflows';
import type { DecisionNode, DecisionOption, DecisionTree, Workflow, WorkflowCategory } from '../content/types';
import { SKILL_BY_ID } from '../content/skills';
import { store, useCollection, useRecord } from '../data/hooks';
import type { SessionStep, StepState, TroubleshootSession } from '../data/types';
import { setLogDraft } from '../lib/handoff';
import { clsx, nowIso, timeAgo } from '../lib/util';
import { Badge, Button, Card, Checkbox, Chip, Collapsible, DemoBadge, Empty, Field, Modal, PageHeader, SectionTitle, TextArea, TextInput } from '../ui/primitives';
import { Link, navigate } from '../ui/router';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';
import { CommandLinks } from './CommandsPage';

// ---------- Browser ----------

export function TroubleshootPage() {
  useTitle('Troubleshooting');
  const sessions = useCollection('sessions');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'All' | WorkflowCategory>('All');
  const open = sessions.filter((s) => s.status === 'open').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return WORKFLOWS.filter((w) => cat === 'All' || w.category === cat).filter((w) => {
      if (!words.length) return true;
      const hay = [w.title, w.summary, w.tags.join(' '), w.symptoms.join(' '), w.category].join(' ').toLowerCase();
      return words.every((x) => hay.includes(x));
    });
  }, [q, cat]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Troubleshooting" sub={`${WORKFLOWS.length} guided workflows. Pick a symptom, work through it, and turn it into a work log.`} />
      {open.length > 0 && (
        <div className="mb-4">
          <SectionTitle>Open sessions</SectionTitle>
          <ul className="space-y-2">
            {open.map((s) => (
              <li key={s.id}>
                <Link to={`/session/${s.id}`} className="block bg-surface border border-accent/50 rounded-md p-3 hover:bg-surface2">
                  <span className="font-medium">{s.title}</span> {s.demo && <DemoBadge />}
                  <span className="block text-xs text-muted">Updated {timeAgo(s.updatedAt)}{s.ticket ? ` · ${s.ticket}` : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <TextInput type="search" aria-label="Search troubleshooting" placeholder="Search symptoms, e.g. no internet, paper jam, outlook…" value={q} onChange={(e: { target: { value: string } }) => setQ(e.target.value)} />
      <div className="flex gap-1.5 overflow-x-auto py-2 -mx-1 px-1" role="group" aria-label="Filter by category">
        <Chip active={cat === 'All'} onClick={() => setCat('All')}>All</Chip>
        {WORKFLOW_CATEGORIES.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>
      {rows.length === 0 ? <Empty title="Nothing matches." /> : (
        <ul className="grid gap-2 md:grid-cols-2">
          {rows.map((w) => (
            <li key={w.id}>
              <Link to={`/troubleshoot/${w.id}`} className="block h-full bg-surface border border-line rounded-md p-3 hover:bg-surface2">
                <Badge>{w.category}</Badge>
                <p className="font-medium mt-1">{w.title}</p>
                <p className="text-sm text-muted line-clamp-2">{w.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Workflow reference ----------

function WorkflowSections({ w }: { w: Workflow }) {
  return (
    <div className="space-y-3">
      <Collapsible title="Symptoms" defaultOpen><ul className="list-disc pl-5 space-y-0.5 text-sm">{w.symptoms.map((s) => <li key={s}>{s}</li>)}</ul></Collapsible>
      <Collapsible title="Initial checks" defaultOpen><ul className="list-disc pl-5 space-y-0.5 text-sm">{w.initialChecks.map((s) => <li key={s}>{s}</li>)}</ul></Collapsible>
      <Collapsible title={`Diagnostic steps (${w.steps.length})`} defaultOpen>
        <ol className="space-y-3 text-sm">
          {w.steps.map((s, i) => (
            <li key={s.id}>
              <p className="font-medium">{i + 1}. {s.title}</p>
              <p className="wrap-any">{s.detail}</p>
              <CommandLinks ids={s.commandIds} />
              {s.lookFor && <p className="mt-1"><span className="font-medium">Look for: </span>{s.lookFor}</p>}
              {s.meaning && <p><span className="font-medium">It may mean: </span>{s.meaning}</p>}
              {s.ifAbnormal && <p><span className="font-medium">If abnormal: </span>{s.ifAbnormal}</p>}
            </li>
          ))}
        </ol>
      </Collapsible>
      <Collapsible title="Possible causes"><ul className="space-y-2 text-sm">{w.causes.map((c) => <li key={c.cause}><span className="font-medium">{c.cause}</span><br /><span className="text-muted">{c.indicators}</span></li>)}</ul></Collapsible>
      <Collapsible title="Remediation">
        <ul className="space-y-3 text-sm">
          {w.remediation.map((r) => (
            <li key={r.title}>
              <p className="font-medium">{r.title}</p><p className="wrap-any">{r.detail}</p>
              {r.caution && <p className="mt-1 rounded-sm border border-warn/50 bg-warn/5 p-2"><strong>Caution: </strong>{r.caution}</p>}
              <CommandLinks ids={r.commandIds} />
            </li>
          ))}
        </ul>
      </Collapsible>
      <Collapsible title="Verification"><ul className="list-disc pl-5 space-y-0.5 text-sm">{w.verification.map((s) => <li key={s}>{s}</li>)}</ul></Collapsible>
      <Collapsible title="What to document"><ul className="list-disc pl-5 space-y-0.5 text-sm">{w.documentation.map((s) => <li key={s}>{s}</li>)}</ul></Collapsible>
    </div>
  );
}

export function WorkflowView({ id }: { id: string }) {
  const w = WORKFLOW_BY_ID[id];
  useTitle(w?.title ?? 'Troubleshooting');
  useEffect(() => { if (w) store.trackUsage('workflow', w.id, w.title, `/troubleshoot/${w.id}`); }, [w]);
  if (!w) return <Empty title="Workflow not found."><Link to="/troubleshoot" className="underline">Back</Link></Empty>;
  const start = () => {
    const s = store.upsert('sessions', { workflowId: w.id, title: w.title, ticket: '', device: '', status: 'open', steps: {}, checks: {}, notes: '', treePath: [], demo: false });
    navigate(`/session/${s.id}`);
  };
  return (
    <div className="max-w-3xl">
      <PageHeader title={w.title} sub={<><Badge>{w.category}</Badge> <span className="ml-1">{w.summary}</span></>} actions={<Button variant="primary" onClick={start}>Start session</Button>} />
      <div className="flex flex-wrap gap-1.5 mb-3">{w.skills.map((s) => <Badge key={s} tone="accent">{SKILL_BY_ID[s]?.name ?? s}</Badge>)}</div>
      <WorkflowSections w={w} />
      <p className="text-xs text-muted mt-4">This is guidance, not a guarantee. Confirm you are authorised to work on the device and take a backup before changes that could lose data.</p>
    </div>
  );
}

// ---------- Decision tree ----------

function TreeRunner({ tree, path, onPath }: { tree: DecisionTree; path: string[]; onPath: (p: string[]) => void }) {
  const nodes: Record<string, DecisionNode> = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
  // Replay the path to find the current node. Each path entry is "Prompt → Answer".
  let nodeId: string | undefined = tree.start as string;
  let conclusion: string | undefined;
  for (const line of path) {
    const n: DecisionNode | undefined = nodeId ? nodes[nodeId] : undefined;
    if (!n) break;
    const opt: DecisionOption | undefined = n.options.find((o) => `${n.prompt} → ${o.label}` === line);
    if (!opt) break;
    if (opt.conclusion) { conclusion = opt.conclusion; nodeId = undefined; } else nodeId = opt.next;
  }
  const node = nodeId ? nodes[nodeId] : undefined;
  return (
    <div className="space-y-2">
      {path.length > 0 && <ol className="text-sm text-muted list-decimal pl-5 space-y-0.5">{path.map((p) => <li key={p} className="wrap-any">{p}</li>)}</ol>}
      {node && (
        <div className="border border-accent/50 rounded-md p-3 bg-accent/5">
          <p className="font-medium">{node.prompt}</p>
          {node.help && <p className="text-sm text-muted mt-0.5">{node.help}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {node.options.map((o) => <Button key={o.label} onClick={() => onPath([...path, `${node.prompt} → ${o.label}`])}>{o.label}</Button>)}
          </div>
        </div>
      )}
      {conclusion && <div className="border border-ok/50 bg-ok/5 rounded-md p-3 text-sm"><p className="font-semibold">Where this points</p><p className="wrap-any">{conclusion}</p></div>}
      {path.length > 0 && <div className="flex gap-2"><Button size="sm" onClick={() => onPath(path.slice(0, -1))}>Back one</Button><Button size="sm" variant="ghost" onClick={() => onPath([])}>Restart</Button></div>}
    </div>
  );
}

// ---------- Session runner ----------

const STEP_STATES: Array<[StepState, string]> = [['done', 'Done'], ['issue', 'Found issue'], ['skipped', 'Skipped']];

export function SessionRunner({ id }: { id: string }) {
  const s = useRecord('sessions', id);
  const w = s ? WORKFLOW_BY_ID[s.workflowId] : undefined;
  useTitle(s?.title ?? 'Session');
  const [local, setLocal] = useState<{ notes: string; ticket: string; device: string } | null>(null);
  useEffect(() => { if (s && !local) setLocal({ notes: s.notes, ticket: s.ticket, device: s.device }); }, [s, local]);
  const [confirmClose, setConfirmClose] = useState(false);
  const fields = { notes: local?.notes ?? '', device: local?.device ?? '', stepnotes: s ? Object.values(s.steps).map((x) => x.note).join('\n') : '' };
  const guard = useSaveGuard(fields);

  if (!s || !w) return <Empty title="Session not found."><Link to="/troubleshoot" className="underline">Back</Link></Empty>;
  const sess: TroubleshootSession = s;
  const wf: Workflow = w;
  const patch = (p: Partial<TroubleshootSession>) => store.upsert('sessions', { ...sess, ...p });
  const stepOf = (sid: string): SessionStep => sess.steps[sid] ?? { state: 'pending', note: '' };
  const setStep = (sid: string, p: Partial<SessionStep>) => patch({ steps: { ...sess.steps, [sid]: { ...stepOf(sid), ...p } } });
  const doneCount = wf.steps.filter((x) => stepOf(x.id).state !== 'pending').length;
  const saveMeta = () => local && patch({ notes: local.notes, ticket: local.ticket, device: local.device });
  const closed = sess.status === 'closed';

  const makeLog = () => {
    const lines = wf.steps.filter((x) => ['done', 'issue'].includes(stepOf(x.id).state)).map((x) => {
      const st = stepOf(x.id);
      return `${x.title}${st.state === 'issue' ? ' (issue found)' : ''}${st.note ? ': ' + st.note : ''}.`;
    });
    const checks = wf.initialChecks.filter((_, i) => sess.checks[String(i)]).map((c) => c.replace(/\.$/, '') + '.');
    setLogDraft({
      problem: wf.title, category: wf.category, device: sess.device, ticket: sess.ticket,
      investigation: [...checks, ...lines, ...sess.treePath.map((p) => p + '.')].join(' '),
      actions: '', result: '', followUp: '', status: 'follow-up',
      skills: doneCount > 0 ? wf.skills.slice(0, 3) : [], sourceSessionId: sess.id,
    });
    navigate('/logs/new');
  };

  return (
    <div className="max-w-3xl pb-8">
      <PageHeader title={sess.title} sub={<span>{wf.category} · {doneCount}/{wf.steps.length} steps · {closed ? 'Closed' : 'Open'} {sess.demo && <DemoBadge />}</span>} actions={<Link to={`/troubleshoot/${wf.id}`} className="inline-flex items-center min-h-11 px-3 rounded-sm border border-line text-sm hover:bg-surface2">Full guide</Link>} />
      <Card className="p-3 mb-3 grid gap-3 sm:grid-cols-2">
        <Field label="Ticket" htmlFor="s-ticket"><TextInput id="s-ticket" value={local?.ticket ?? ''} onChange={(e: { target: { value: string } }) => setLocal((l) => (l ? { ...l, ticket: e.target.value } : l))} onBlur={saveMeta} /></Field>
        <Field label="Device" htmlFor="s-device" hint="Model or role only."><TextInput id="s-device" value={local?.device ?? ''} onChange={(e: { target: { value: string } }) => setLocal((l) => (l ? { ...l, device: e.target.value } : l))} onBlur={saveMeta} /></Field>
      </Card>

      {wf.tree && <div className="mb-3"><SectionTitle>Guided questions</SectionTitle><Card className="p-3"><TreeRunner tree={wf.tree} path={sess.treePath} onPath={(p) => patch({ treePath: p })} /></Card></div>}

      <SectionTitle>Initial checks</SectionTitle>
      <Card className="p-3 mb-3">
        {wf.initialChecks.map((c, i) => <Checkbox key={i} checked={!!sess.checks[String(i)]} onChange={(v) => patch({ checks: { ...sess.checks, [String(i)]: v } })} label={c} />)}
      </Card>

      <SectionTitle>Diagnostic steps</SectionTitle>
      <ol className="space-y-2 mb-3">
        {wf.steps.map((st, i) => {
          const cur = stepOf(st.id);
          return (
            <li key={st.id}>
              <Card className={clsx('p-3', cur.state === 'issue' && 'border-warn', cur.state === 'done' && 'border-ok/60')}>
                <p className="font-medium">{i + 1}. {st.title} {cur.state !== 'pending' && <Badge tone={cur.state === 'done' ? 'ok' : cur.state === 'issue' ? 'warn' : 'neutral'}>{cur.state === 'issue' ? 'issue' : cur.state}</Badge>}</p>
                <p className="text-sm wrap-any">{st.detail}</p>
                <CommandLinks ids={st.commandIds} />
                {(st.lookFor || st.meaning || st.ifAbnormal) && (
                  <details className="mt-1.5 text-sm"><summary className="cursor-pointer min-h-8 flex items-center text-muted">What to look for</summary>
                    {st.lookFor && <p><span className="font-medium">Look for: </span>{st.lookFor}</p>}
                    {st.meaning && <p><span className="font-medium">It may mean: </span>{st.meaning}</p>}
                    {st.ifAbnormal && <p><span className="font-medium">If abnormal: </span>{st.ifAbnormal}</p>}
                  </details>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label={`Status of step ${i + 1}`}>
                  {STEP_STATES.map(([v, label]) => <Chip key={v} active={cur.state === v} onClick={() => setStep(st.id, { state: cur.state === v ? 'pending' : v })}>{label}</Chip>)}
                </div>
                <TextInput className="mt-2" aria-label={`Note for step ${i + 1}`} placeholder="What you saw (optional)" value={cur.note} onChange={(e: { target: { value: string } }) => setStep(st.id, { note: e.target.value })} />
              </Card>
            </li>
          );
        })}
      </ol>

      <Collapsible title="Causes, remediation and verification">
        <WorkflowSections w={{ ...wf, symptoms: [], initialChecks: [], steps: [] }} />
      </Collapsible>

      <div className="mt-3 space-y-3">
        <Field label="Session notes" htmlFor="s-notes"><TextArea id="s-notes" rows={3} value={local?.notes ?? ''} onChange={(e: { target: { value: string } }) => setLocal((l) => (l ? { ...l, notes: e.target.value } : l))} onBlur={saveMeta} /></Field>
        <SensitivePanel guard={guard} fieldLabels={{ notes: 'Session notes', device: 'Device', stepnotes: 'Step notes' }} onRedactAll={() => { const r = guard.redactAll(fields); setLocal((l) => (l ? { ...l, notes: r.notes, device: r.device } : l)); patch({ notes: r.notes, device: r.device }); }} onRedactKind={() => undefined} />
        <PrivacyNote />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={makeLog}>Create work log from session</Button>
          {!closed ? <Button onClick={() => { saveMeta(); setConfirmClose(true); }}>Close session</Button> : <Button onClick={() => patch({ status: 'open', closedAt: undefined })}>Reopen</Button>}
          <Button variant="danger" onClick={() => { store.remove('sessions', sess.id); navigate('/troubleshoot'); }}>Delete session</Button>
        </div>
      </div>
      {confirmClose && (
        <Modal title="Close this session?" onClose={() => setConfirmClose(false)} footer={<><Button onClick={() => setConfirmClose(false)}>Keep open</Button><Button variant="primary" onClick={() => { patch({ status: 'closed', closedAt: nowIso(), notes: local?.notes ?? sess.notes }); setConfirmClose(false); }}>Close</Button></>}>
          <p>You can reopen it later. Remember to create a work log if this work should be recorded.</p>
        </Modal>
      )}
    </div>
  );
}
