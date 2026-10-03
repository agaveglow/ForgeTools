import { useMemo } from 'react';
import { useCollection } from '../data/hooks';
import { useSettings } from '../data/hooks';
import { CHECKLIST_BY_ID } from '../content/checklist';
import { REQUIREMENT_KIND_LABEL, REQUIREMENT_STATUS_LABEL } from '../data/types';
import type { RequirementKind } from '../data/types';
import { activeTasks, activityDays, nextRequirements, requirementProgress, streak, taskDone, taskState, taskSummary, totalHours, weekDays, weekHours, ymd } from '../lib/progress';
import { plural, timeAgo } from '../lib/util';
import { Badge, Button, Card, Empty, SectionTitle } from '../ui/primitives';
import { Bar, Stat } from '../ui/Progress';
import { Link, navigate } from '../ui/router';
import { useTitle } from '../ui/hooks';
import { LogRow } from './LogsPage';
import { summarise } from './SecurityPage';
import { TaskRow } from './TasksPage';

const QUICK: Array<[string, string]> = [
  ['+ Work log', '/logs/new'], ['Guide agent', '/agent'], ['Voice note', '/voice'], ['Troubleshoot', '/troubleshoot'], ['Security', '/security'], ['Commands', '/commands'], ['Notes', '/kb'],
];
const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function Dashboard() {
  useTitle('Dashboard');
  const s = useSettings();
  const logs = useCollection('workLogs');
  const sessions = useCollection('sessions');
  const runs = useCollection('checklistRuns');
  const kb = useCollection('kbEntries');
  const tasks = useCollection('tasks');
  const reqs = useCollection('requirements');
  const entries = useCollection('apprenticeLogs');
  const now = new Date();
  const today = ymd(now);

  const act = activeTasks(tasks);
  const ts = taskSummary(tasks, now);
  const daily = act.filter((t) => t.kind === 'daily');
  const weekly = act.filter((t) => t.kind === 'weekly');
  const once = act.filter((t) => t.kind === 'once' && (!taskDone(t, now) || t.doneOn.includes(today)));
  const dueOnce = once.filter((t) => taskState(t, now) !== 'upcoming' || t.doneOn.includes(today));
  const days = activityDays(logs, entries, tasks);
  const run = streak(days, now);
  const week = weekDays(now);
  const logsToday = logs.filter((l) => ymd(new Date(l.occurredAt)) === today).length;
  const wk = weekHours(entries, now);
  const tot = totalHours(entries);
  const recent = [...logs].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 3);
  const guides = kb.filter((k) => k.tags.includes('generated')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  const followUps = logs.filter((l) => l.status === 'follow-up' || l.status === 'unresolved');
  const openSessions = sessions.filter((x) => x.status === 'open');
  const openRuns = runs.filter((r) => r.status === 'open');
  const failedRuns = openRuns.map((r) => ({ r, sm: summarise(r) })).filter((x) => x.sm.fail > 0);
  const openResearch = logs.flatMap((l) => (l.learning?.toResearch ?? []).filter((r) => !r.done).map((r) => ({ log: l, r })));
  const lastEntry = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  const kinds = useMemo(() => (['job', 'apprenticeship'] as RequirementKind[]).map((k) => ({ k, p: requirementProgress(reqs.filter((r) => r.kind === k)) })), [reqs]);
  const upNext = nextRequirements(reqs, 4);
  const attention = ts.overdue + followUps.length + failedRuns.length;
  const hour = now.getHours();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}</h1>
          <p className="text-sm text-muted">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap"><Badge tone={run > 0 ? 'ok' : 'neutral'}>{run > 0 ? `${plural(run, 'day')} in a row` : 'No streak yet'}</Badge>{attention > 0 && <Badge tone="warn">{attention} need attention</Badge>}</div>
      </header>

      <section aria-label="Quick actions" className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {QUICK.map(([label, to], i) => <Link key={to} to={to} className={'shrink-0 inline-flex items-center min-h-11 px-3.5 rounded-sm border text-sm font-medium ' + (i === 0 ? 'bg-accent text-accent-ink border-accent' : 'bg-surface border-line hover:bg-surface2')}>{label}</Link>)}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <section aria-label="Today">
            <SectionTitle action={<Link to="/tasks" className="text-sm underline inline-flex items-center min-h-9 px-1">Manage tasks</Link>}>Today</SectionTitle>
            <Card className="p-3">
              {daily.length === 0 && dueOnce.length === 0 ? (
                <Empty title="No tasks for today.">Add daily routines and one-off jobs on the Tasks page.</Empty>
              ) : (
                <>
                  {daily.length > 0 && <div className="mb-1"><div className="flex justify-between text-xs text-muted mb-1"><span>Daily routine</span><span>{ts.dailyDone} / {ts.dailyTotal}</span></div><Bar value={ts.dailyDone} max={ts.dailyTotal} label="Daily tasks done" tone="ok" /></div>}
                  <ul className="divide-y divide-line">{[...daily, ...dueOnce].map((t) => <li key={t.id}><TaskRow t={t} now={now} /></li>)}</ul>
                </>
              )}
              <p className="text-xs text-muted mt-2 pt-2 border-t border-line">{logsToday === 0 ? 'No work logged yet today.' : `${plural(logsToday, 'work log')} today.`} <Link to="/logs/new" className="underline">Log work</Link></p>
            </Card>
          </section>

          <section aria-label="This week">
            <SectionTitle>This week</SectionTitle>
            <Card className="p-3 space-y-3">
              <ol className="grid grid-cols-7 gap-1 text-center" aria-label="Days with activity this week">
                {week.map((d, i) => {
                  const has = days.has(d); const isToday = d === today;
                  return <li key={d} className="space-y-1"><span className="text-xs text-muted block">{DAY[i]}</span><span aria-label={`${d}${has ? ', activity recorded' : ', nothing recorded'}${isToday ? ', today' : ''}`} className={'mx-auto grid place-items-center size-8 rounded-full text-xs border ' + (has ? 'bg-ok text-canvas border-ok' : isToday ? 'border-accent text-accent' : 'border-line text-muted')}>{has ? '✓' : d.slice(8)}</span></li>;
                })}
              </ol>
              {weekly.length > 0 && <div><div className="flex justify-between text-xs text-muted mb-1"><span>Weekly tasks</span><span>{ts.weeklyDone} / {ts.weeklyTotal}</span></div><Bar value={ts.weeklyDone} max={ts.weeklyTotal} label="Weekly tasks done" tone="ok" /><ul className="divide-y divide-line mt-1">{weekly.map((t) => <li key={t.id}><TaskRow t={t} now={now} /></li>)}</ul></div>}
              {s.otjWeeklyHours ? <div><div className="flex justify-between text-xs text-muted mb-1"><span>Off-the-job hours</span><span>{wk} / {s.otjWeeklyHours} h</span></div><Bar value={wk} max={s.otjWeeklyHours} label="Off-the-job hours this week" /></div> : <p className="text-xs text-muted">{wk} off-the-job hours this week. <Link to="/apprenticeship" className="underline">Set a weekly target</Link></p>}
            </Card>
          </section>

          <section aria-label="Requirements">
            <SectionTitle action={<Link to="/requirements" className="text-sm underline inline-flex items-center min-h-9 px-1">All requirements</Link>}>Job and apprenticeship requirements</SectionTitle>
            <Card className="p-3 space-y-3">
              {reqs.length === 0 ? <Empty title="No requirements added.">Enter what your job and apprenticeship expect, then track each one.<div className="mt-2"><Button onClick={() => navigate('/requirements')}>Add requirements</Button></div></Empty> : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">{kinds.filter((x) => x.p.total > 0).map(({ k, p }) => (
                    <div key={k}><div className="flex justify-between text-sm mb-1"><span>{REQUIREMENT_KIND_LABEL[k]}</span><span className="text-muted">{p.done} / {p.total}</span></div><Bar value={p.done} max={p.total} label={`${REQUIREMENT_KIND_LABEL[k]} progress`} tone="ok" /></div>
                  ))}</div>
                  {upNext.length > 0 && <div><p className="text-xs text-muted mb-1">Next up</p><ul className="space-y-1">{upNext.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm"><span className="wrap-any flex-1 min-w-40">{r.title}</span><Badge>{REQUIREMENT_STATUS_LABEL[r.status]}</Badge>{r.target && <span className="text-xs text-muted">by {r.target}</span>}</li>)}</ul></div>}
                </>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle action={<Link to="/logs" className="text-sm underline inline-flex items-center min-h-9 px-1">All logs</Link>}>Recent work</SectionTitle>
            {recent.length === 0 ? <Empty title="No work logged yet.">Add a log as you finish each job.</Empty> : <ul className="space-y-2">{recent.map((l) => <li key={l.id}><LogRow log={l} /></li>)}</ul>}
          </section>
        </div>

        <div className="space-y-5">
          <section aria-label="Apprenticeship">
            <SectionTitle action={<Link to="/apprenticeship" className="text-sm underline inline-flex items-center min-h-9 px-1">Open</Link>}>Apprenticeship</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Hours this week" value={`${wk} h`} sub={s.otjWeeklyHours ? `of ${s.otjWeeklyHours} h` : undefined} />
              <Stat label="Hours in total" value={`${tot} h`} sub={s.otjTotalHours ? `of ${s.otjTotalHours} h` : undefined} />
            </div>
            {!!s.otjTotalHours && <div className="mt-2"><Bar value={tot} max={s.otjTotalHours} label="Total off-the-job hours against target" tone="ok" /></div>}
            <p className="text-xs text-muted mt-2">{lastEntry ? `Last entry ${lastEntry.date}${lastEntry.title ? ': ' + lastEntry.title : ''}.` : 'No entries yet.'}</p>
            <div className="mt-2"><Button onClick={() => navigate('/apprenticeship')}>Log learning time</Button></div>
          </section>

          {attention > 0 && (
            <section aria-label="Needs attention">
              <SectionTitle>Needs attention</SectionTitle>
              <ul className="space-y-1.5">
                {ts.overdue > 0 && <li><Link to="/tasks" className="block text-sm bg-surface border border-line rounded-md p-2.5 hover:bg-surface2"><Badge tone="bad">{ts.overdue} overdue</Badge> tasks</Link></li>}
                {followUps.slice(0, 3).map((l) => <li key={l.id}><Link to={`/logs/${l.id}`} className="block text-sm bg-surface border border-line rounded-md p-2.5 hover:bg-surface2 wrap-any"><span className="font-mono text-xs text-muted">{l.ref}</span> {l.followUp || l.problem}</Link></li>)}
                {failedRuns.map(({ r, sm }) => <li key={r.id}><Link to={`/security/${r.id}`} className="block text-sm bg-surface border border-line rounded-md p-2.5 hover:bg-surface2 wrap-any"><Badge tone="bad">{sm.fail} failed</Badge> {r.label}: {CHECKLIST_BY_ID[r.templateId].title}</Link></li>)}
              </ul>
            </section>
          )}

          <section>
            <SectionTitle action={<Link to="/skills" className="text-sm underline inline-flex items-center min-h-9 px-1">Skills</Link>}>Learning</SectionTitle>
            <Card className="p-3 text-sm space-y-1">
              <p>{plural(openResearch.length, 'research item')} open</p>
              {openResearch.slice(0, 3).map((x) => <p key={x.r.id} className="text-muted wrap-any">• {x.r.text}</p>)}
            </Card>
          </section>

          {openSessions.length > 0 && (
            <section>
              <SectionTitle>Open troubleshooting</SectionTitle>
              <ul className="space-y-2">{openSessions.slice(0, 3).map((x) => <li key={x.id}><Link to={`/session/${x.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2"><span className="font-medium">{x.title}</span><span className="block text-xs text-muted">Updated {timeAgo(x.updatedAt)}</span></Link></li>)}</ul>
            </section>
          )}

          <section>
            <SectionTitle action={<Link to="/agent" className="text-sm underline inline-flex items-center min-h-9 px-1">Guide agent</Link>}>Recent guides</SectionTitle>
            {guides.length === 0 ? <Empty title="No saved guides.">Ask the guide agent and save the result.</Empty> : (
              <ul className="space-y-2">{guides.map((g) => <li key={g.id}><Link to={`/kb/${g.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2"><span className="text-sm font-medium wrap-any">{g.title}</span><span className="block text-xs text-muted">{g.category} · {timeAgo(g.updatedAt)}</span></Link></li>)}</ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
