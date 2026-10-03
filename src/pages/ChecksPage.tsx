import { useMemo } from 'react';
import { store, useCollection } from '../data/hooks';
import { CHECK_GUIDES, CHECK_GUIDE_BY_ID, guideForTitle } from '../content/checkGuides';
import type { CheckGuide } from '../content/checkGuides';
import { activeTasks, lastDone, taskDone, toggleTask } from '../lib/progress';
import type { VisualModel } from '../lib/visual';
import { Badge, Button, Card, CodeBlock, Empty, PageHeader, SectionTitle } from '../ui/primitives';
import { VisualGuide } from '../ui/VisualGuide';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

export const modelFromCheck = (g: CheckGuide): VisualModel => ({
  title: g.title,
  steps: g.steps.map((s, i) => ({ n: i + 1, text: s.text, commands: s.command ? [s.command] : [], caution: false })),
  cautions: g.cautions,
});

const FREQ = { daily: 'Every day', weekly: 'Every week', monthly: 'Every month', quarterly: 'Every quarter' } as const;
const PERIOD = { daily: 'today', weekly: 'this week', monthly: 'this month', quarterly: 'this quarter' } as const;

export function ChecksPage() {
  useTitle('Check guides');
  const tasks = useCollection('tasks');
  const act = activeTasks(tasks);
  const now = useMemo(() => new Date(), []);
  const stateOf = (g: CheckGuide) => { const t = act.find((x) => guideForTitle(x.title)?.id === g.id); return t ? (taskDone(t, now) ? 'done' : 'due') : 'none'; };
  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Check guides" sub="How to complete and monitor each daily, weekly, monthly and quarterly check." actions={<Link to="/sla"><Button>Response times</Button></Link>} />
      <p className="text-xs text-muted" role="note">General good practice as a starting point. Adapt each guide to your own policies and procedures, and only run checks on systems you are authorised to check.</p>
      {(['daily', 'weekly', 'monthly', 'quarterly'] as const).map((f) => (
        <section key={f} aria-label={FREQ[f]}>
          <SectionTitle>{FREQ[f]}</SectionTitle>
          <ul className="space-y-2">{CHECK_GUIDES.filter((g) => g.frequency === f).map((g) => {
            const st = stateOf(g);
            return (
              <li key={g.id}><Link to={`/checks/${g.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2">
                <span className="flex items-start justify-between gap-2"><span className="text-sm font-medium wrap-any">{g.title}</span>{st === 'done' && <Badge tone="ok">Done {PERIOD[f]}</Badge>}{st === 'due' && <Badge tone="warn">Due</Badge>}</span>
                <span className="block text-xs text-muted mt-0.5">{g.summary}</span>
              </Link></li>
            );
          })}</ul>
        </section>
      ))}
    </div>
  );
}

export function CheckGuidePage({ id }: { id: string }) {
  const g = CHECK_GUIDE_BY_ID[id];
  useTitle(g?.title ?? 'Check guide');
  const tasks = useCollection('tasks');
  const now = useMemo(() => new Date(), []);
  if (!g) return <Empty title="Guide not found.">Go back to <Link to="/checks" className="underline">all check guides</Link>.</Empty>;
  const task = activeTasks(tasks).find((t) => guideForTitle(t.title)?.id === g.id);
  const done = task ? taskDone(task, now) : false;
  const model = modelFromCheck(g);
  const cmds = g.steps.filter((s) => s.command);
  const list = (items: string[]) => <ul className="list-disc pl-5 space-y-1 text-sm">{items.map((i) => <li key={i} className="wrap-any">{i}</li>)}</ul>;
  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title={g.title} sub={<>{FREQ[g.frequency]}. <Link to="/checks" className="underline">All guides</Link></>} />
      <p className="text-sm wrap-any">{g.summary}</p>

      <Card className="p-4"><VisualGuide model={model} /></Card>

      <section aria-label="Before you start"><SectionTitle>Before you start</SectionTitle><Card className="p-3">{list(g.before)}</Card></section>
      {cmds.length > 0 && <section aria-label="Commands"><SectionTitle>Commands used</SectionTitle><div className="space-y-2">{cmds.map((s) => <CodeBlock key={s.command} code={s.command!} />)}</div><p className="text-xs text-muted mt-1">Replace placeholders with your own values. Run only on systems you are authorised to check.</p></section>}
      <section aria-label="How to monitor"><SectionTitle>How to monitor between checks</SectionTitle><Card className="p-3">{list(g.monitor)}</Card></section>
      <section aria-label="Evidence to keep"><SectionTitle>Evidence to keep</SectionTitle><Card className="p-3 space-y-1">{list(g.evidence)}<p className="text-xs text-muted pt-1">Keep counts and outcomes. Leave out customer names, people’s names and any numbers that identify a customer.</p></Card></section>
      <section aria-label="Cautions"><SectionTitle>Cautions</SectionTitle><Card className="p-3 border-warn/60">{list(g.cautions)}</Card></section>

      <Card className="p-3 flex flex-wrap items-center gap-3">
        {task ? (
          <>
            <button type="button" role="checkbox" aria-checked={done} aria-label={`Mark ${g.title} done for ${PERIOD[g.frequency]}`} onClick={() => store.upsert('tasks', { ...task, doneOn: toggleTask(task, now) })} className={'shrink-0 size-8 rounded-sm border-2 grid place-items-center ' + (done ? 'bg-ok border-ok text-canvas' : 'border-line bg-surface hover:border-accent')}>{done && <span aria-hidden>✓</span>}</button>
            <span className="text-sm flex-1 min-w-40">{done ? 'Done ' + PERIOD[g.frequency] : 'Mark this check done'}{lastDone(task) ? <span className="text-muted"> · last done {lastDone(task)}</span> : null}</span>
          </>
        ) : (
          <>
            <span className="text-sm flex-1 min-w-40">This check is not on your task list yet.</span>
            <Button variant="primary" onClick={() => store.upsert('tasks', { title: g.task ?? g.title, kind: g.frequency, doneOn: [] })}>Add to my tasks</Button>
          </>
        )}
      </Card>
    </div>
  );
}
