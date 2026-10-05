import { useMemo, useState } from 'react';
import { store, useCollection } from '../data/hooks';
import { useSettings } from '../data/hooks';
import { CHECKLIST_BY_ID } from '../content/checklist';
import { BOARD_LABEL, REQUIREMENT_KIND_LABEL, REQUIREMENT_STATUS_LABEL } from '../data/types';
import type { RequirementStatus } from '../data/types';
import type { RequirementKind } from '../data/types';
import { activeTasks, activityCounts, activityDays, boardStatus, daysLeftInPeriod, heatmapWeeks, weeklyHoursSeries, nextRequirements, requirementProgress, streak, taskDone, taskState, taskSummary, totalHours, weekDays, weekHours, ymd } from '../lib/progress';
import { plural, timeAgo } from '../lib/util';
import { Badge, Button, Card, Empty, SectionTitle, TextInput } from '../ui/primitives';
import { Bar, Stat } from '../ui/Progress';
import { BarChart, Heatmap, Ring, StackBar } from '../ui/Charts';
import { PRIORITIES } from '../lib/sla';
import { moveWidget, resolveLayout, toLayout, WIDGETS } from '../lib/widgets';
import type { ResolvedWidget, WidgetSize } from '../lib/widgets';
import type { ReactNode } from 'react';
import type { CustomWidget } from '../data/types';
import { blankWidget, CustomWidgetBody, CustomWidgetEditor, WIDGET_TYPES } from '../ui/CustomWidgets';
import { Link, currentQuery, navigate } from '../ui/router';
import { Glance } from '../ui/Glance';
import { useTitle } from '../ui/hooks';
import { LogRow } from './LogsPage';
import { summarise } from './SecurityPage';
import { TaskRow } from './TasksPage';

const QUICK: Array<[string, string]> = [
  ['+ Work log', '/logs/new'], ['Find a guide', '/agent'], ['Voice note', '/voice'], ['Import doc', '/import'], ['Troubleshoot', '/troubleshoot'], ['Security', '/security'], ['Commands', '/commands'], ['Notes', '/kb'],
];
const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function FullDashboard() {
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
  const monthly = act.filter((t) => t.kind === 'monthly');
  const quarterly = act.filter((t) => t.kind === 'quarterly');
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

  const counts = useMemo(() => activityCounts(logs, entries, tasks), [logs, entries, tasks]);
  const heat = useMemo(() => heatmapWeeks(counts, now, 12), [counts]); // eslint-disable-line react-hooks/exhaustive-deps
  const series = weeklyHoursSeries(entries, now, 8);
  const dueSoon = act.filter((t) => (t.kind === 'monthly' || t.kind === 'quarterly') && !taskDone(t, now)).map((t) => ({ t, left: daysLeftInPeriod(t.kind, now) ?? 99 })).sort((a, b) => a.left - b.left);
  const once1 = act.filter((t) => t.kind === 'once');
  const boardCounts = (['todo', 'doing', 'blocked', 'done'] as const).map((c) => ({ c, n: once1.filter((t) => boardStatus(t) === c).length }));
  const pinned = kb.filter((k) => k.pinned).slice(0, 5);
  const statusCounts = (['not-started', 'in-progress', 'evidenced', 'signed-off'] as RequirementStatus[]).map((st) => ({ st, n: reqs.filter((r) => r.status === st).length }));
  const [editing, setEditing] = useState(false);
  const customs = s.customWidgets ?? [];
  const customById = new Map(customs.map((c) => [c.id, c]));
  const list = resolveLayout(s.dashboard, customs);
  const [editor, setEditor] = useState<{ w: CustomWidget; isNew: boolean } | null>(null);
  const saveCustoms = (next: CustomWidget[]) => store.updateSettings({ customWidgets: next });
  const upsertCustom = (w: CustomWidget) => saveCustoms(customById.has(w.id) ? customs.map((c) => (c.id === w.id ? w : c)) : [...customs, w]);
  const save = (l: ResolvedWidget[]) => store.updateSettings({ dashboard: toLayout(l) });
  const link = (to: string, text: string) => <Link to={to} className="text-sm underline inline-flex items-center min-h-9 px-1">{text}</Link>;
  const ringItems = [
    { label: 'Today', v: ts.dailyDone, m: ts.dailyTotal }, { label: 'This week', v: ts.weeklyDone, m: ts.weeklyTotal },
    { label: 'This month', v: ts.monthlyDone, m: ts.monthlyTotal }, { label: 'This quarter', v: ts.quarterlyDone, m: ts.quarterlyTotal },
  ].filter((r) => r.m > 0);

  const body: Record<string, (title: string) => ReactNode> = {
    quick: () => <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">{QUICK.map(([label, to], i) => <Link key={to} to={to} className={'shrink-0 inline-flex items-center min-h-11 px-3.5 rounded-sm border text-sm font-medium ' + (i === 0 ? 'bg-accent text-accent-ink border-accent' : 'bg-surface border-line hover:bg-surface2')}>{label}</Link>)}</div>,
    today: (title) => (
      <>
        <SectionTitle action={link('/tasks', 'Manage tasks')}>{title}</SectionTitle>
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
      </>
    ),
    rings: (title) => (
      <>
        <SectionTitle action={link('/tasks', 'Tasks')}>{title}</SectionTitle>
        <Card className="p-3">
          {ringItems.length === 0 ? <Empty title="No routines yet.">Add daily to quarterly tasks to see progress rings.</Empty> : (
            <ul className="grid grid-cols-2 gap-3 justify-items-center">{ringItems.map((r) => <li key={r.label} className="text-center"><Ring value={r.v} max={r.m} label={r.label} center={`${r.v}/${r.m}`} /><span className="text-xs text-muted block mt-1">{r.label}</span></li>)}</ul>
          )}
        </Card>
      </>
    ),
    week: (title) => (
      <>
        <SectionTitle>{title}</SectionTitle>
        <Card className="p-3 space-y-3">
          <ol className="grid grid-cols-7 gap-1 text-center" aria-label="Days with activity this week">
            {week.map((d, i) => {
              const has = days.has(d); const isToday = d === today;
              return <li key={d} className="space-y-1"><span className="text-xs text-muted block">{DAY[i]}</span><span aria-label={`${d}${has ? ', activity recorded' : ', nothing recorded'}${isToday ? ', today' : ''}`} className={'mx-auto grid place-items-center size-8 rounded-full text-xs border ' + (has ? 'bg-ok text-canvas border-ok' : isToday ? 'border-accent text-accent' : 'border-line text-muted')}>{has ? '✓' : d.slice(8)}</span></li>;
            })}
          </ol>
          {weekly.length > 0 && <div><div className="flex justify-between text-xs text-muted mb-1"><span>Weekly tasks</span><span>{ts.weeklyDone} / {ts.weeklyTotal}</span></div><Bar value={ts.weeklyDone} max={ts.weeklyTotal} label="Weekly tasks done" tone="ok" /><ul className="divide-y divide-line mt-1">{weekly.map((t) => <li key={t.id}><TaskRow t={t} now={now} /></li>)}</ul></div>}
          {monthly.length > 0 && <div><div className="flex justify-between text-xs text-muted mb-1"><span>Monthly checks</span><span>{ts.monthlyDone} / {ts.monthlyTotal}</span></div><Bar value={ts.monthlyDone} max={ts.monthlyTotal} label="Monthly checks done" tone="ok" /><ul className="divide-y divide-line mt-1">{monthly.map((t) => <li key={t.id}><TaskRow t={t} now={now} /></li>)}</ul></div>}
          {quarterly.length > 0 && <div><div className="flex justify-between text-xs text-muted mb-1"><span>Quarterly checks</span><span>{ts.quarterlyDone} / {ts.quarterlyTotal}</span></div><Bar value={ts.quarterlyDone} max={ts.quarterlyTotal} label="Quarterly checks done" tone="ok" /><ul className="divide-y divide-line mt-1">{quarterly.map((t) => <li key={t.id}><TaskRow t={t} now={now} /></li>)}</ul></div>}
        </Card>
      </>
    ),
    activity: (title) => (
      <>
        <SectionTitle>{title}</SectionTitle>
        <Card className="p-3 space-y-2">
          <Heatmap weeks={heat} label={`Activity over the last 12 weeks: ${[...counts.keys()].filter((d) => heat.flat().some((c) => c.date === d)).length} active days`} />
          <p className="text-xs text-muted">Each square is a day. Darker means more logs, learning entries and ticked tasks.</p>
        </Card>
      </>
    ),
    requirements: (title) => (
      <>
        <SectionTitle action={link('/requirements', 'All requirements')}>{title}</SectionTitle>
        <Card className="p-3 space-y-3">
          {reqs.length === 0 ? <Empty title="No requirements added.">Enter what your job and apprenticeship expect, then track each one.<div className="mt-2"><Button onClick={() => navigate('/requirements')}>Add requirements</Button></div></Empty> : (
            <>
              <StackBar label="Requirements by status" parts={statusCounts.map(({ st, n }, i) => ({ label: REQUIREMENT_STATUS_LABEL[st], value: n, color: ['var(--c-muted)', 'var(--c-info)', 'var(--c-accent)', 'var(--c-ok)'][i] }))} />
              <div className="grid gap-3 sm:grid-cols-2">{kinds.filter((x) => x.p.total > 0).map(({ k, p }) => (
                <div key={k}><div className="flex justify-between text-sm mb-1"><span>{REQUIREMENT_KIND_LABEL[k]}</span><span className="text-muted">{p.done} / {p.total}</span></div><Bar value={p.done} max={p.total} label={`${REQUIREMENT_KIND_LABEL[k]} progress`} tone="ok" /></div>
              ))}</div>
              {upNext.length > 0 && <div><p className="text-xs text-muted mb-1">Next up</p><ul className="space-y-1">{upNext.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm"><span className="wrap-any flex-1 min-w-40">{r.title}</span><Badge>{REQUIREMENT_STATUS_LABEL[r.status]}</Badge>{r.target && <span className="text-xs text-muted">by {r.target}</span>}</li>)}</ul></div>}
            </>
          )}
        </Card>
      </>
    ),
    hours: (title) => (
      <>
        <SectionTitle action={link('/apprenticeship', 'Log time')}>{title}</SectionTitle>
        <Card className="p-3 space-y-2">
          {tot === 0 ? <Empty title="No hours logged yet.">Log learning time on the Apprenticeship page to see the weekly chart.</Empty> : (
            <>
              <BarChart label={`Off-the-job hours per week, last 8 weeks. This week ${wk} hours.`} data={series.map((x) => ({ label: x.start.slice(8) + '/' + x.start.slice(5, 7), value: x.hours }))} />
              {s.otjWeeklyHours ? <div><div className="flex justify-between text-xs text-muted mb-1"><span>This week</span><span>{wk} / {s.otjWeeklyHours} h</span></div><Bar value={wk} max={s.otjWeeklyHours} label="Off-the-job hours this week" /></div> : <p className="text-xs text-muted">{wk} h this week. <Link to="/apprenticeship" className="underline">Set a weekly target</Link></p>}
            </>
          )}
        </Card>
      </>
    ),
    due: (title) => (
      <>
        <SectionTitle action={link('/tasks', 'Tasks')}>{title}</SectionTitle>
        <Card className="p-3">
          {dueSoon.length === 0 ? <p className="text-sm text-muted">Nothing due this month or quarter.</p> : <ul className="space-y-1.5">{dueSoon.slice(0, 5).map(({ t, left }) => <li key={t.id} className="flex items-start gap-2 text-sm"><Badge tone={left <= 7 ? 'warn' : 'neutral'}>{left}d</Badge><span className="wrap-any flex-1">{t.title}</span></li>)}</ul>}
        </Card>
      </>
    ),
    sla: (title) => (
      <>
        <SectionTitle action={link('/sla', 'Deadline clock')}>{title}</SectionTitle>
        <Card className="p-3">
          <table className="w-full text-sm"><caption className="sr-only">Target response and update by priority</caption><thead className="text-xs text-muted text-left"><tr><th className="pb-1 font-normal">Priority</th><th className="pb-1 font-normal">Respond</th><th className="pb-1 font-normal">Update</th></tr></thead>
            <tbody>{PRIORITIES.map((x) => <tr key={x.id} className="border-t border-line"><th scope="row" className="py-1 text-left font-medium">{x.label}</th><td className="py-1">{x.targetResponse < 60 ? `${x.targetResponse} min` : `${x.targetResponse / 60} h`}</td><td className="py-1">{x.updateEvery.minutes >= 1440 ? '24 h' : `${x.updateEvery.minutes / 60} h`}</td></tr>)}</tbody></table>
        </Card>
      </>
    ),
    board: (title) => (
      <>
        <SectionTitle action={link('/board', 'Open board')}>{title}</SectionTitle>
        <Card className="p-3">
          {once1.length === 0 ? <p className="text-sm text-muted">No cards yet.</p> : <StackBar label="Task board" parts={boardCounts.map(({ c, n }, i) => ({ label: BOARD_LABEL[c], value: n, color: ['var(--c-muted)', 'var(--c-info)', 'var(--c-warn)', 'var(--c-ok)'][i] }))} />}
        </Card>
      </>
    ),
    recent: (title) => (
      <>
        <SectionTitle action={link('/logs', 'All logs')}>{title}</SectionTitle>
        {recent.length === 0 ? <Empty title="No work logged yet.">Add a log as you finish each job.</Empty> : <ul className="space-y-2">{recent.map((l) => <li key={l.id}><LogRow log={l} /></li>)}</ul>}
      </>
    ),
    apprenticeship: (title) => (
      <>
        <SectionTitle action={link('/apprenticeship', 'Open')}>{title}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Hours this week" value={`${wk} h`} sub={s.otjWeeklyHours ? `of ${s.otjWeeklyHours} h` : undefined} />
          <Stat label="Hours in total" value={`${tot} h`} sub={s.otjTotalHours ? `of ${s.otjTotalHours} h` : undefined} />
        </div>
        {!!s.otjTotalHours && <div className="mt-2"><Bar value={tot} max={s.otjTotalHours} label="Total off-the-job hours against target" tone="ok" /></div>}
        <p className="text-xs text-muted mt-2">{lastEntry ? `Last entry ${lastEntry.date}${lastEntry.title ? ': ' + lastEntry.title : ''}.` : 'No entries yet.'}</p>
        <div className="mt-2"><Button onClick={() => navigate('/apprenticeship')}>Log learning time</Button></div>
      </>
    ),
    attention: (title) => attention === 0 ? null : (
      <>
        <SectionTitle>{title}</SectionTitle>
        <ul className="space-y-1.5">
          {ts.overdue > 0 && <li><Link to="/tasks" className="block text-sm bg-surface border border-line rounded-md p-2.5 hover:bg-surface2"><Badge tone="bad">{ts.overdue} overdue</Badge> tasks</Link></li>}
          {followUps.slice(0, 3).map((l) => <li key={l.id}><Link to={`/logs/${l.id}`} className="block text-sm bg-surface border border-line rounded-md p-2.5 hover:bg-surface2 wrap-any"><span className="font-mono text-xs text-muted">{l.ref}</span> {l.followUp || l.problem}</Link></li>)}
          {failedRuns.map(({ r, sm }) => <li key={r.id}><Link to={`/security/${r.id}`} className="block text-sm bg-surface border border-line rounded-md p-2.5 hover:bg-surface2 wrap-any"><Badge tone="bad">{sm.fail} failed</Badge> {r.label}: {CHECKLIST_BY_ID[r.templateId].title}</Link></li>)}
        </ul>
      </>
    ),
    learning: (title) => (
      <>
        <SectionTitle action={link('/skills', 'Skills')}>{title}</SectionTitle>
        <Card className="p-3 text-sm space-y-1">
          <p>{plural(openResearch.length, 'research item')} open</p>
          {openResearch.slice(0, 3).map((x) => <p key={x.r.id} className="text-muted wrap-any">• {x.r.text}</p>)}
        </Card>
      </>
    ),
    troubleshooting: (title) => openSessions.length === 0 ? null : (
      <>
        <SectionTitle>{title}</SectionTitle>
        <ul className="space-y-2">{openSessions.slice(0, 3).map((x) => <li key={x.id}><Link to={`/session/${x.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2"><span className="font-medium">{x.title}</span><span className="block text-xs text-muted">Updated {timeAgo(x.updatedAt)}</span></Link></li>)}</ul>
      </>
    ),
    guides: (title) => (
      <>
        <SectionTitle action={link('/agent', 'Find a guide')}>{title}</SectionTitle>
        {guides.length === 0 ? <Empty title="No saved guides.">Ask the guide agent and save the result.</Empty> : (
          <ul className="space-y-2">{guides.map((g) => <li key={g.id}><Link to={`/kb/${g.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2"><span className="text-sm font-medium wrap-any">{g.title}</span><span className="block text-xs text-muted">{g.category} · {timeAgo(g.updatedAt)}</span></Link></li>)}</ul>
        )}
      </>
    ),
    pinned: (title) => (
      <>
        <SectionTitle action={link('/guides', 'Guides')}>{title}</SectionTitle>
        {pinned.length === 0 ? <Empty title="Nothing pinned.">Pin a note or guide to keep it here.</Empty> : <ul className="space-y-2">{pinned.map((k) => <li key={k.id}><Link to={`/kb/${k.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2 text-sm font-medium wrap-any">{k.title}</Link></li>)}</ul>}
      </>
    ),
  };

  const span = (z: WidgetSize) => ({ 1: '', 2: 'md:col-span-2', 3: 'md:col-span-2 lg:col-span-3' })[z];
  const change = (id: string, patch: Partial<ResolvedWidget>) => save(list.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const visible = list.filter((w) => !w.hidden);
  const hiddenList = list.filter((w) => w.hidden);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight wrap-any">{s.dashboardTitle || (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')}</h1>
          <p className="text-sm text-muted">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center"><Badge tone={run > 0 ? 'ok' : 'neutral'}>{run > 0 ? `${plural(run, 'day')} in a row` : 'No streak yet'}</Badge>{attention > 0 && <Badge tone="warn">{attention} need attention</Badge>}<Button size="sm" variant={editing ? 'primary' : 'secondary'} aria-pressed={editing} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Customise'}</Button></div>
      </header>

      {editing && <p role="status" className="text-sm rounded-sm border border-accent/50 bg-accent/5 p-2.5">Customising: rename, move, resize or hide each card. Changes save as you go and stay on this device.</p>}

      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-row-dense" data-testid="widgets">
        {visible.map((w, i) => {
          const cw = customById.get(w.id);
          const content = cw
            ? <><SectionTitle>{w.title}</SectionTitle><Card className="p-3" style={cw.color ? { borderLeft: `6px solid ${cw.color}` } : undefined}><CustomWidgetBody w={cw} now={now} onChange={upsertCustom} /></Card></>
            : body[w.id](w.title);
          if (content === null && !editing) return null;
          return (
            <section key={w.id} aria-label={w.title} data-widget={w.id} className={'min-w-0 ' + span(w.size) + (editing ? ' rounded-md border-2 border-dashed border-accent/60 p-2 space-y-2' : '')}>
              {editing && (
                <div className="flex flex-wrap items-end gap-2 pb-2 border-b border-line">
                  <label className="text-xs flex-1 min-w-36">Title<TextInput aria-label={`Title for ${w.defaultTitle}`} maxLength={40} value={w.title} onChange={(e: { target: { value: string } }) => (cw ? upsertCustom({ ...cw, title: e.target.value || cw.title }) : change(w.id, { title: e.target.value || w.defaultTitle }))} /></label>
                  <div className="flex gap-1" role="group" aria-label={`Size of ${w.title}`}>{([1, 2, 3] as WidgetSize[]).map((z) => <Button key={z} size="sm" variant={w.size === z ? 'primary' : 'secondary'} aria-pressed={w.size === z} onClick={() => change(w.id, { size: z })}>{['Small', 'Wide', 'Full'][z - 1]}</Button>)}</div>
                  <div className="flex gap-1">
                    <Button size="sm" disabled={i === 0} aria-label={`Move ${w.title} earlier`} onClick={() => save(moveWidget(list, w.id, -1))}>↑</Button>
                    <Button size="sm" disabled={i === visible.length - 1} aria-label={`Move ${w.title} later`} onClick={() => save(moveWidget(list, w.id, 1))}>↓</Button>
                    {cw && <Button size="sm" aria-label={`Edit ${w.title}`} onClick={() => setEditor({ w: cw, isNew: false })}>Edit</Button>}
                    <Button size="sm" aria-label={`Hide ${w.title}`} onClick={() => change(w.id, { hidden: true })}>Hide</Button>
                  </div>
                </div>
              )}
              {content === null ? <p className="text-sm text-muted">Nothing to show right now. This card appears when there is something to see.</p> : content}
            </section>
          );
        })}
      </div>

      {editing && (
        <section aria-label="Add a card" className="rounded-md border border-line bg-surface p-3 space-y-2">
          <SectionTitle>Add your own card</SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{WIDGET_TYPES.map((t) => <li key={t.type}><button type="button" onClick={() => setEditor({ w: blankWidget(t.type), isNew: true })} className="w-full text-left min-h-11 rounded-sm border border-line hover:bg-surface2 px-3 py-2"><span className="block text-sm font-medium">{t.label}</span><span className="block text-xs text-muted">{t.about}</span></button></li>)}</ul>
        </section>
      )}
      {editor && <CustomWidgetEditor key={editor.w.id} initial={editor.w} isNew={editor.isNew} onClose={() => setEditor(null)} onSave={(w) => { upsertCustom(w); setEditor(null); }} onDelete={editor.isNew ? undefined : () => { saveCustoms(customs.filter((c) => c.id !== editor.w.id)); setEditor(null); }} />}

      {editing && (
        <section aria-label="Hidden cards" className="rounded-md border border-line bg-surface p-3 space-y-2">
          <SectionTitle>Hidden cards</SectionTitle>
          {hiddenList.length === 0 ? <p className="text-sm text-muted">Every card is showing.</p> : <ul className="space-y-1.5">{hiddenList.map((w) => <li key={w.id} className="flex flex-wrap items-center gap-2"><span className="text-sm flex-1 min-w-40"><span className="font-medium">{w.title}</span> <span className="text-xs text-muted">{WIDGETS.find((d) => d.id === w.id)?.about}</span></span><Button size="sm" aria-label={`Show ${w.title}`} onClick={() => change(w.id, { hidden: false })}>Show</Button></li>)}</ul>}
          <Button size="sm" onClick={() => store.updateSettings({ dashboard: undefined })}>Reset layout</Button>
        </section>
      )}
    </div>
  );
}

/** Home screen: a calm watch-style view by default, with every widget one tap away. */
export function Dashboard() {
  const s = useSettings();
  const forced = currentQuery().get('view');
  const view: 'glance' | 'full' = forced === 'full' || forced === 'glance' ? forced : s.dashboardView ?? 'glance';
  useTitle('Dashboard');
  const set = (v: 'glance' | 'full') => { store.updateSettings({ dashboardView: v }); if (forced) navigate('/', { replace: true }); };
  return (
    <>
      <div className="flex justify-end mb-2" role="group" aria-label="Home screen style">
        <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
          {([['glance', 'Glance'], ['full', 'All widgets']] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => set(v)} className={'min-h-9 px-3.5 rounded-full text-sm ' + (view === v ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink')}>{label}</button>
          ))}
        </div>
      </div>
      {view === 'glance' ? <Glance /> : <FullDashboard />}
    </>
  );
}
