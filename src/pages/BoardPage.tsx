import { useMemo, useState } from 'react';
import { store, useCollection } from '../data/hooks';
import { BOARD_LABEL } from '../data/types';
import type { BoardStatus, Task } from '../data/types';
import { activeTasks, boardStatus, moveTask, ymd } from '../lib/progress';
import { Badge, Button, Card, Field, Modal, PageHeader, Select, TextInput } from '../ui/primitives';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';
import { Link } from '../ui/router';

const COLUMNS: BoardStatus[] = ['todo', 'doing', 'blocked', 'done'];

/** Manual task board for one-off jobs. Cards move between columns with buttons, so it works on a phone. */
export function BoardPage() {
  useTitle('Task board');
  const all = useCollection('tasks');
  const now = useMemo(() => new Date(), []);
  const cards = activeTasks(all).filter((t) => t.kind === 'once');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [col, setCol] = useState<BoardStatus>('todo');
  const [editing, setEditing] = useState<Task | null>(null);
  const [del, setDel] = useState<Task | null>(null);
  const guard = useSaveGuard({ title });
  const today = ymd(now);

  const save = () => {
    if (!title.trim() || !guard.canSave) return;
    if (editing) store.upsert('tasks', { ...editing, title: title.trim(), due: due || undefined });
    else store.upsert('tasks', { title: title.trim(), kind: 'once', due: due || undefined, doneOn: col === 'done' ? [today] : [], status: col });
    setTitle(''); setDue(''); setEditing(null); guard.setConfirmed(false);
  };
  const move = (t: Task, to: BoardStatus) => store.upsert('tasks', moveTask(t, to, now));
  const done = cards.filter((t) => boardStatus(t) === 'done');

  return (
    <div className="pb-10 space-y-4">
      <PageHeader title="Task board" sub="One-off jobs. Add a card, then move it along as you work." actions={<Link to="/tasks"><Button>Recurring tasks</Button></Link>} />
      <Card className="p-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); save(); }}>
          <Field label={editing ? 'Edit card' : 'New card'} htmlFor="bd-title" hint="Describe the job, not the customer. Leave out names and numbers.">
            <TextInput id="bd-title" value={title} onChange={(e: { target: { value: string } }) => setTitle(e.target.value)} placeholder="e.g. Plan firmware update window" />
          </Field>
          <Field label="Due (optional)" htmlFor="bd-due"><TextInput id="bd-due" type="date" value={due} onChange={(e: { target: { value: string } }) => setDue(e.target.value)} /></Field>
          {!editing && <Field label="Column" htmlFor="bd-col"><Select id="bd-col" value={col} onChange={(e: { target: { value: string } }) => setCol(e.target.value as BoardStatus)}>{COLUMNS.map((c) => <option key={c} value={c}>{BOARD_LABEL[c]}</option>)}</Select></Field>}
          <div className="flex gap-2"><Button variant="primary" type="submit" disabled={!title.trim() || !guard.canSave}>{editing ? 'Save card' : 'Add card'}</Button>{editing && <Button onClick={() => { setEditing(null); setTitle(''); setDue(''); }}>Cancel</Button>}</div>
        </form>
        <div className="mt-3"><SensitivePanel guard={guard} fieldLabels={{ title: 'Card' }} onRedactAll={() => { setTitle(guard.redactAll({ title }).title); guard.setConfirmed(false); }} onRedactKind={(k) => { setTitle(guard.redactOneKind({ title }, k).title); guard.setConfirmed(false); }} /></div>
      </Card>
      <PrivacyNote />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((c, ci) => {
          const rows = cards.filter((t) => boardStatus(t) === c);
          return (
            <section key={c} aria-label={`${BOARD_LABEL[c]} column`} data-testid={`col-${c}`} className="rounded-md border border-line bg-surface2/40 p-2 space-y-2 min-h-24">
              <h2 className="flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted"><span>{BOARD_LABEL[c]}</span><Badge>{rows.length}</Badge></h2>
              {rows.length === 0 && <p className="text-xs text-muted px-1 py-2">Empty</p>}
              {rows.map((t) => (
                <article key={t.id} className="rounded-sm border border-line bg-surface p-2.5 space-y-2">
                  <p className="text-sm wrap-any">{t.title}</p>
                  {t.due && c !== 'done' && <Badge tone={t.due < today ? 'bad' : t.due === today ? 'warn' : 'neutral'}>{t.due < today ? 'Overdue ' : 'Due '}{t.due.slice(5).split('-').reverse().join('/')}</Badge>}
                  <div className="flex flex-wrap items-center gap-1">
                    <Button size="sm" disabled={ci === 0} onClick={() => move(t, COLUMNS[ci - 1])} aria-label={`Move ${t.title} to ${BOARD_LABEL[COLUMNS[Math.max(0, ci - 1)]]}`}>◀</Button>
                    <Button size="sm" disabled={ci === COLUMNS.length - 1} onClick={() => move(t, COLUMNS[ci + 1])} aria-label={`Move ${t.title} to ${BOARD_LABEL[COLUMNS[Math.min(COLUMNS.length - 1, ci + 1)]]}`}>▶</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setTitle(t.title); setDue(t.due ?? ''); window.scrollTo({ top: 0 }); }} aria-label={`Edit ${t.title}`}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDel(t)} aria-label={`Delete ${t.title}`}>Delete</Button>
                  </div>
                </article>
              ))}
              {c === 'done' && done.length > 0 && <Button size="sm" onClick={() => done.forEach((t) => store.upsert('tasks', { ...t, archived: true }))}>Clear done</Button>}
            </section>
          );
        })}
      </div>
      {del && <Modal title="Delete this card?" onClose={() => setDel(null)} footer={<><Button onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => { store.remove('tasks', del.id); setDel(null); }}>Delete</Button></>}><p className="text-sm wrap-any">{del.title}</p></Modal>}
    </div>
  );
}
