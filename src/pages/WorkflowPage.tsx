import { useEffect, useState } from 'react';
import { Block, Blocks } from '../ui/PageCustomizer';
import { CORE_PRINCIPLE, WORKFLOW_LISTS, WORKFLOW_LOOP, WORKFLOW_MONITOR, WORKFLOW_PRIORITIES, WORKFLOW_QUICK } from '../content/workflow';
import { Badge, Button, Card, Checkbox, Collapsible, PageHeader, SectionTitle } from '../ui/primitives';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

const KEY = 'forgetools:workflowTicks';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Ticks belong to one day and clear themselves the next day. Nothing sensitive is stored here. */
function readTicks(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return v && v.day === today() && Array.isArray(v.ids) ? v.ids.filter((x: unknown) => typeof x === 'string') : []; } catch { return []; }
}
function writeTicks(ids: string[]) { try { localStorage.setItem(KEY, JSON.stringify({ day: today(), ids })); } catch { /* storage unavailable */ } }

export function WorkflowPage() {
  useTitle('Daily workflow');
  const [ticks, setTicks] = useState<string[]>(readTicks);
  useEffect(() => { writeTicks(ticks); }, [ticks]);
  const total = WORKFLOW_LISTS.reduce((n, l) => n + l.items.length, 0);
  const done = ticks.length;
  const toggle = (id: string, on: boolean) => setTicks((t) => (on ? [...new Set([...t, id])] : t.filter((x) => x !== id)));
  const key = (l: string, i: number) => `${l}:${i}`;

  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Daily workflow" sub="Your daily operating guide: start, prioritise, work the loop, document, close." actions={<><Link to="/checks"><Button>Check guides</Button></Link><Link to="/sla"><Button>Response times</Button></Link></>} />
      <Blocks pageKey="WorkflowPage" group="WorkflowPage" className="space-y-5">
        <Block title="Section 1">
      <div className="rounded-md border border-accent/50 bg-accent/5 p-3" role="note">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Core principle</p>
        <p className="text-sm font-medium mt-0.5">{CORE_PRINCIPLE}</p>
      </div>
        </Block>
        <Block title="Section 2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" aria-live="polite" data-testid="wf-count">{done} of {total} ticked today</p>
        <Button size="sm" variant="ghost" disabled={!done} onClick={() => setTicks([])}>Clear today’s ticks</Button>
      </div>
        </Block>
        <Block title="2. Prioritise: what comes first">
      <Collapsible title="2. Prioritise: what comes first" defaultOpen>
        <p className="text-sm text-muted mb-2">Restore or protect service first, then return to planned work.</p>
        <ul className="space-y-2" data-testid="wf-priorities">{WORKFLOW_PRIORITIES.map((p) => (
          <li key={p.level} className="border border-line rounded-md p-2.5">
            <span className="block text-sm font-semibold">{p.level}</span>
            <span className="block text-xs text-muted wrap-any">{p.example}</span>
            <span className="block text-sm mt-1 wrap-any">{p.action}</span>
          </li>
        ))}</ul>
        <p className="text-xs text-muted mt-2">These are your working priorities. For contract response and update times use <Link to="/sla" className="underline">Response times</Link>.</p>
      </Collapsible>
        </Block>
        <Block title="Start of day">
      <section aria-label="Start of day">
        <ChecklistCard list={WORKFLOW_LISTS[0]} ticks={ticks} toggle={toggle} keyOf={key} />
      </section>
        </Block>
        <Block title="Operating loop">
      <section aria-label="Operating loop">
        <SectionTitle>3. During the day: the operating loop</SectionTitle>
        <p className="text-sm text-muted mb-2">Always a clear next action, while staying available to respond.</p>
        <ol className="grid gap-2 sm:grid-cols-5" data-testid="wf-loop">{WORKFLOW_LOOP.map((s, i) => (
          <li key={s.name} className="border border-line rounded-md p-2.5 bg-surface">
            <span className="flex items-center gap-1.5"><Badge tone="info">{i + 1}</Badge><span className="text-sm font-semibold uppercase tracking-wide">{s.name}</span></span>
            <span className="block text-xs text-muted mt-1">{s.text}</span>
          </li>
        ))}</ol>
      </section>
        </Block>
        <Block title="4. What to monitor continuously">
      <Collapsible title="4. What to monitor continuously">
        <ul className="space-y-2" data-testid="wf-monitor">{WORKFLOW_MONITOR.map((m) => (
          <li key={m.area} className="border border-line rounded-md p-2.5"><span className="block text-sm font-semibold">{m.area}</span><span className="block text-xs text-muted wrap-any">{m.look}</span></li>
        ))}</ul>
      </Collapsible>
        </Block>
      </Blocks>
      {WORKFLOW_LISTS.slice(1).map((l) => <section key={l.id} aria-label={l.title}><ChecklistCard list={l} ticks={ticks} toggle={toggle} keyOf={key} /></section>)}

      <Blocks pageKey="WorkflowPage-2" group="WorkflowPage" toolbar={false} className="space-y-5">
        <Block title="9. Quick daily reference">
      <Collapsible title="9. Quick daily reference">
        <ul className="space-y-2" data-testid="wf-quick">{WORKFLOW_QUICK.map((q) => (
          <li key={q.when} className="border border-line rounded-md p-2.5 text-sm"><span className="font-semibold">{q.when}</span><span className="block text-xs text-muted">Check: {q.check}</span><span className="block">Then: {q.then}</span></li>
        ))}</ul>
      </Collapsible>
        </Block>
        <Block title="Note">
      <p className="text-xs text-muted" role="note">The ticks only count today and clear themselves tomorrow. Nothing about customers or tickets is stored here. Use <Link to="/live" className="underline">Live notes</Link> to keep the paper trail while you work.</p>
        </Block>
      </Blocks>
    </div>
  );
}

function ChecklistCard({ list, ticks, toggle, keyOf }: { list: (typeof WORKFLOW_LISTS)[number]; ticks: string[]; toggle: (id: string, on: boolean) => void; keyOf: (l: string, i: number) => string }) {
  const n = list.items.filter((_, i) => ticks.includes(keyOf(list.id, i))).length;
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-2"><h2 className="text-sm font-semibold">{list.title}</h2><Badge tone={n === list.items.length ? 'ok' : 'neutral'}>{n}/{list.items.length}</Badge></div>
      <p className="text-xs text-muted">{list.intro}</p>
      <ul className="space-y-1">{list.items.map((t, i) => {
        const id = keyOf(list.id, i);
        return <li key={id}><Checkbox id={`wf-${id}`} checked={ticks.includes(id)} onChange={(v: boolean) => toggle(id, v)} label={t} /></li>;
      })}</ul>
    </Card>
  );
}
