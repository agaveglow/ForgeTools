import { useMemo, useState } from 'react';
import { store, useCollection } from '../data/hooks';
import { TASK_KIND_LABEL } from '../data/types';
import type { Task, TaskKind } from '../data/types';
import { taskDone, taskState, toggleTask, activeTasks, lastDone, daysLeftInPeriod } from '../lib/progress';
import { STARTER_LISTS, parseTaskLines } from '../content/routines';
import { TextArea } from '../ui/primitives';
import { scanText } from '../lib/sensitive';
import { Badge, Button, Card, Chip, Collapsible, Empty, Field, Modal, PageHeader, Select, SectionTitle, TextInput } from '../ui/primitives';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';
import { Link } from '../ui/router';

export function TaskRow({ t, now }: { t: Task; now: Date }) {
  const done = taskDone(t, now);
  const st = taskState(t, now);
  return (
    <div className="flex items-center gap-3 min-h-12">
      <button type="button" role="checkbox" aria-checked={done} aria-label={`${t.title}${done ? ', done' : ''}`} onClick={() => store.upsert('tasks', { ...t, doneOn: toggleTask(t, now) })}
        className={'shrink-0 size-7 rounded-sm border-2 grid place-items-center ' + (done ? 'bg-ok border-ok text-canvas' : 'border-line bg-surface hover:border-accent')}>
        {done && <span aria-hidden>✓</span>}
      </button>
      <span className={'text-sm wrap-any flex-1 ' + (done ? 'line-through text-muted' : '')}>{t.title}</span>
      {t.kind !== 'once' && t.kind !== 'daily' && !done && daysLeftInPeriod(t.kind, now) !== undefined && <Badge tone={(daysLeftInPeriod(t.kind, now) ?? 99) <= 7 ? 'warn' : 'neutral'}>{daysLeftInPeriod(t.kind, now)} days left</Badge>}
      {t.kind !== 'once' && lastDone(t) && <span className="text-xs text-muted whitespace-nowrap">Last {lastDone(t)}</span>}
      {st === 'overdue' && <Badge tone="bad">Overdue</Badge>}
      {st === 'due' && t.kind === 'once' && t.due && <Badge tone="warn">Due today</Badge>}
      {st === 'upcoming' && t.due && <Badge>Due {t.due.slice(5).split('-').reverse().join('/')}</Badge>}
    </div>
  );
}

export function TasksPage() {
  useTitle('Tasks');
  const tasks = useCollection('tasks');
  const reqs = useCollection('requirements');
  const now = useMemo(() => new Date(), []);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TaskKind>('daily');
  const [due, setDue] = useState('');
  const [req, setReq] = useState('');
  const [del, setDel] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const guard = useSaveGuard({ title });

  const act = activeTasks(tasks);
  const group = (k: TaskKind) => act.filter((t) => t.kind === k);
  const add = () => {
    if (!title.trim() || !guard.canSave) return;
    const data = { title: title.trim(), kind, due: kind === 'once' && due ? due : undefined, requirementId: req || undefined, doneOn: editing?.doneOn ?? [] };
    store.upsert('tasks', editing ? { ...editing, ...data } : data);
    setTitle(''); setDue(''); setReq(''); setEditing(null); guard.setConfirmed(false);
  };
  const edit = (t: Task) => { setEditing(t); setTitle(t.title); setKind(t.kind); setDue(t.due ?? ''); setReq(t.requirementId ?? ''); window.scrollTo({ top: 0 }); };
  const reqTitle = (id?: string) => reqs.find((r) => r.id === id)?.title;

  const list = (k: TaskKind, empty: string) => {
    const rows = group(k).filter((t) => k !== 'once' || !taskDone(t, now));
    return rows.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
      <ul className="divide-y divide-line">{rows.map((t) => (
        <li key={t.id} className="py-0.5">
          <TaskRow t={t} now={now} />
          <div className="flex gap-1 pl-10 pb-1 items-center">
            {reqTitle(t.requirementId) && <span className="text-xs text-muted wrap-any mr-auto">→ {reqTitle(t.requirementId)}</span>}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => edit(t)} aria-label={`Edit ${t.title}`}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => setDel(t)} aria-label={`Delete ${t.title}`}>Delete</Button>
          </div>
        </li>
      ))}</ul>
    );
  };
  const finished = group('once').filter((t) => taskDone(t, now));

  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Tasks" sub="Daily, weekly, monthly and quarterly routines, and one-off jobs." actions={<Link to="/board"><Button>Open task board</Button></Link>} />
      <Card className="p-4 space-y-3">
        <form className="space-y-3" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); add(); }}>
          <Field label={editing ? 'Edit task' : 'New task'} htmlFor="tk-title" hint="Describe the routine, not the customer. Leave out names and numbers.">
            <TextInput id="tk-title" value={title} onChange={(e: { target: { value: string } }) => setTitle(e.target.value)} placeholder="e.g. Check the print queue alerts" />
          </Field>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="How often">{(Object.keys(TASK_KIND_LABEL) as TaskKind[]).map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{TASK_KIND_LABEL[k]}</Chip>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {kind === 'once' && <Field label="Due date (optional)" htmlFor="tk-due"><TextInput id="tk-due" type="date" value={due} onChange={(e: { target: { value: string } }) => setDue(e.target.value)} /></Field>}
            {reqs.length > 0 && <Field label="Works towards (optional)" htmlFor="tk-req"><Select id="tk-req" value={req} onChange={(e: { target: { value: string } }) => setReq(e.target.value)}><option value="">None</option>{reqs.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</Select></Field>}
          </div>
          <SensitivePanel guard={guard} fieldLabels={{ title: 'Task' }} onRedactAll={() => { setTitle(guard.redactAll({ title }).title); guard.setConfirmed(false); }} onRedactKind={(k) => { setTitle(guard.redactOneKind({ title }, k).title); guard.setConfirmed(false); }} />
          <div className="flex gap-2"><Button variant="primary" type="submit" disabled={!title.trim() || !guard.canSave}>{editing ? 'Save task' : 'Add task'}</Button>{editing && <Button onClick={() => { setEditing(null); setTitle(''); setDue(''); setReq(''); }}>Cancel</Button>}</div>
        </form>
      </Card>
      <PrivacyNote />
      <BulkAdd existing={tasks.map((t) => t.title.toLowerCase())} />

      <section><SectionTitle>Every day</SectionTitle><Card className="p-3">{list('daily', 'No daily tasks yet. Add routines such as checking alerts or reviewing open jobs.')}</Card></section>
      <section><SectionTitle>Every week</SectionTitle><Card className="p-3">{list('weekly', 'No weekly tasks yet. Add things like a backup check or a review with your mentor.')}</Card></section>
      <section><SectionTitle>Every month</SectionTitle><Card className="p-3">{list('monthly', 'No monthly checks yet. Add the starter list or paste your own below.')}</Card></section>
      <section><SectionTitle>Every quarter</SectionTitle><Card className="p-3">{list('quarterly', 'No quarterly checks yet. Add the starter list or paste your own below.')}</Card></section>
      <section><SectionTitle>One-off</SectionTitle><Card className="p-3">{list('once', 'Nothing open.')}</Card></section>
      {finished.length > 0 && (
        <Collapsible title="Completed one-off tasks" badge={<Badge>{finished.length}</Badge>}>
          <ul className="divide-y divide-line">{finished.map((t) => <li key={t.id}><TaskRow t={t} now={now} /></li>)}</ul>
        </Collapsible>
      )}
      {act.length === 0 && <Empty title="Nothing here yet.">Add your first task above.</Empty>}

      {del && <Modal title="Delete this task?" onClose={() => setDel(null)} footer={<><Button onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => { store.remove('tasks', del.id); setDel(null); }}>Delete</Button></>}><p className="text-sm wrap-any">{del.title}</p></Modal>}
    </div>
  );
}

/** Add many routines at once: starter lists or pasted lines. Nothing is added until the person confirms. */
function BulkAdd({ existing }: { existing: string[] }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<TaskKind>('weekly');
  const [msg, setMsg] = useState('');
  const lines = parseTaskLines(text);
  const flagged = scanText(text).length > 0;
  const have = new Set(existing);
  const fresh = lines.filter((l) => !have.has(l.toLowerCase()));
  const addMany = (titles: string[], k: TaskKind) => {
    const todo = titles.filter((t) => !have.has(t.toLowerCase()));
    for (const title of todo) store.upsert('tasks', { title, kind: k, doneOn: [] });
    setMsg(todo.length ? `Added ${todo.length} ${TASK_KIND_LABEL[k].toLowerCase()} task${todo.length === 1 ? '' : 's'}.` : 'Those are already on your list.');
  };
  return (
    <Collapsible title="Add many at once" defaultOpen={false}>
      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Starter checklists</p>
          {STARTER_LISTS.map((l) => (
            <div key={l.id} className="rounded-sm border border-line p-3 space-y-1.5">
              <p className="text-sm font-medium">{l.title} <Badge>{l.items.length}</Badge></p>
              {l.note && <p className="text-xs text-muted">{l.note}</p>}
              <ul className="text-sm list-disc pl-5 space-y-0.5">{l.items.map((i) => <li key={i} className="wrap-any">{i}</li>)}</ul>
              <Button size="sm" onClick={() => addMany(l.items, l.kind)} aria-label={`Add ${l.title}`}>Add these {l.items.length}</Button>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Field label="Paste a list" htmlFor="bulk-text" hint="One task per line. Bullets, numbers and tick boxes are removed. Describe the routine, not the customer.">
            <TextArea id="bulk-text" rows={6} value={text} onChange={(e: { target: { value: string } }) => setText(e.target.value)} placeholder={'Check backup job status\nReview patch compliance report'} />
          </Field>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="How often for the pasted list">{(['daily', 'weekly', 'monthly', 'quarterly'] as TaskKind[]).map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{TASK_KIND_LABEL[k]}</Chip>)}</div>
          {flagged && <p role="alert" className="text-sm text-warn">This looks like it has a name, number or secret in it. Remove it before adding.</p>}
          {lines.length > 0 && <p className="text-xs text-muted">{fresh.length} new of {lines.length} lines.</p>}
          <Button variant="primary" disabled={!fresh.length || flagged} onClick={() => { addMany(lines, kind); setText(''); }}>Add {fresh.length || ''} {TASK_KIND_LABEL[kind].toLowerCase()} task{fresh.length === 1 ? '' : 's'}</Button>
        </div>
        {msg && <p role="status" className="text-sm text-ok">{msg}</p>}
      </div>
    </Collapsible>
  );
}
