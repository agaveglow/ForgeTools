import { useMemo, useState } from 'react';
import { store, useCollection } from '../data/hooks';
import { TASK_KIND_LABEL } from '../data/types';
import type { Task, TaskKind } from '../data/types';
import { taskDone, taskState, toggleTask, activeTasks } from '../lib/progress';
import { Badge, Button, Card, Chip, Collapsible, Empty, Field, Modal, PageHeader, Select, SectionTitle, TextInput } from '../ui/primitives';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';

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
      <PageHeader title="Tasks" sub="Daily and weekly routines, and one-off jobs to tick off." />
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

      <section><SectionTitle>Every day</SectionTitle><Card className="p-3">{list('daily', 'No daily tasks yet. Add routines such as checking alerts or reviewing open jobs.')}</Card></section>
      <section><SectionTitle>Every week</SectionTitle><Card className="p-3">{list('weekly', 'No weekly tasks yet. Add things like a backup check or a review with your mentor.')}</Card></section>
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
