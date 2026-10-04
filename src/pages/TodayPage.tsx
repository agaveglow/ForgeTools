import { useEffect, useMemo, useState } from 'react';
import { store, useCollection, useSettings } from '../data/hooks';
import type { DailyJob } from '../data/types';
import { guideForTitle } from '../content/checkGuides';
import { agoText, DEFAULT_DAILY_JOBS, dayProgress, minutesSince, parseDay, timeText, watchState, WATCH_INTERVALS } from '../lib/dailyJobs';
import type { DayState } from '../lib/dailyJobs';
import { activeTasks, taskDone, toggleTask } from '../lib/progress';
import { nowIso, uid } from '../lib/util';
import { Badge, Button, Card, Checkbox, Empty, Field, PageHeader, SectionTitle, Select, TextInput } from '../ui/primitives';
import { Link } from '../ui/router';
import { PageCustomizer } from '../ui/PageCustomizer';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';

const KEY = 'forgetools:todayState';
type Ev = { target: { value: string } };

function useDay() {
  const [st, setSt] = useState<DayState>(() => { try { return parseDay(localStorage.getItem(KEY), new Date()); } catch { return parseDay(null, new Date()); } });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* storage unavailable */ } }, [st]);
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date(); setNow(n);
      setSt((s) => (parseDay(JSON.stringify(s), n).day === s.day ? s : parseDay(null, n)));
    }, 20000);
    return () => clearInterval(t);
  }, []);
  return { st, setSt, now };
}

export function TodayPage() {
  useTitle('Daily jobs');
  const settings = useSettings();
  const jobs: DailyJob[] = settings.dailyJobs ?? DEFAULT_DAILY_JOBS;
  const { st, setSt, now } = useDay();
  const tasks = useCollection('tasks');
  const [editing, setEditing] = useState(false);
  const saveJobs = (next: DailyJob[]) => store.updateSettings({ dailyJobs: next });

  const progress = dayProgress(jobs, st);
  const dailyTasks = useMemo(() => activeTasks(tasks).filter((t) => t.kind === 'daily'), [tasks]);
  const tasksDone = dailyTasks.filter((t) => taskDone(t, now)).length;
  const toggleJob = (j: DailyJob, on: boolean) => setSt((s) => {
    const done = { ...s.done };
    if (on) done[j.id] = nowIso(); else delete done[j.id];
    return { ...s, done };
  });
  const checkNow = (j: DailyJob) => setSt((s) => ({ ...s, checked: { ...s.checked, [j.id]: nowIso() }, counts: { ...s.counts, [j.id]: Math.min(999, (s.counts[j.id] ?? 0) + 1) } }));
  const toggleTaskRow = (id: string) => { const t = tasks.find((x) => x.id === id); if (t) store.upsert('tasks', { ...t, doneOn: toggleTask(t, now) }); };

  const watches = jobs.filter((j) => j.kind === 'watch');
  const plain = jobs.filter((j) => j.kind === 'job');
  const overdue = watches.filter((w) => watchState(w, st.checked[w.id], now) === 'due');

  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Daily jobs" sub={now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} actions={<><Link to="/workflow"><Button>Daily workflow</Button></Link><Button onClick={() => setEditing((e) => !e)} aria-expanded={editing}>{editing ? 'Done editing' : 'Edit my jobs'}</Button></>} />

      {overdue.length > 0 && (
        <div role="alert" className="rounded-md border border-warn bg-warn/10 p-3 text-sm" data-testid="overdue">
          Time to check: {overdue.map((w) => w.text.replace(/^Check /i, '')).join(', ')}.
        </div>
      )}

      {editing ? <JobEditor jobs={jobs} onSave={saveJobs} onReset={() => saveJobs(DEFAULT_DAILY_JOBS)} /> : (
        <>
          <PageCustomizer pageKey="today" className="space-y-5" label="Daily jobs" blocks={[
    { id: 'start', title: 'Start and finish', render: (title: string) => (
          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2"><SectionTitle>{title}</SectionTitle><Badge tone={progress.total && progress.done === progress.total ? 'ok' : 'neutral'}>{progress.done}/{progress.total}</Badge></div>
            {plain.length === 0 ? <p className="text-sm text-muted">No jobs yet. Use Edit my jobs to add some.</p> : (
              <ul className="space-y-1" data-testid="jobs">{plain.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2">
                  <Checkbox id={`job-${j.id}`} checked={!!st.done[j.id]} onChange={(v: boolean) => toggleJob(j, v)} label={j.text} />
                  {j.stamp && st.done[j.id] && <span className="text-xs text-muted shrink-0" data-testid={`stamp-${j.id}`}>at {timeText(st.done[j.id])}</span>}
                </li>
              ))}</ul>
            )}
            <p className="text-xs text-muted">The time is noted from your own tick on this device. It doesn’t talk to BrightHR, so clock in and out there as normal.</p>
          </Card>
    ) },
    { id: 'watch', title: 'Keep watching', render: (title: string) => (
          <Card className="p-3 space-y-2">
            <SectionTitle>{title}</SectionTitle>
            {watches.length === 0 ? <p className="text-sm text-muted">Nothing to watch. Use Edit my jobs to add your inbox or ticket queue.</p> : (
              <ul className="space-y-2" data-testid="watches">{watches.map((w) => {
                const s = watchState(w, st.checked[w.id], now);
                const m = minutesSince(st.checked[w.id], now);
                return (
                  <li key={w.id} className="flex items-center justify-between gap-2 border border-line rounded-md p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium wrap-any">{w.text}</p>
                      <p className="text-xs text-muted">Last checked: {agoText(m)} · every {w.everyMin ?? 30} min · {st.counts[w.id] ?? 0} today</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s === 'due' && <Badge tone="warn">Due</Badge>}
                      {s === 'never' && <Badge tone="warn">Not yet</Badge>}
                      {s === 'ok' && <Badge tone="ok">OK</Badge>}
                      <Button size="sm" variant="primary" aria-label={`I have checked: ${w.text.replace(/^Check /i, '')}`} onClick={() => checkNow(w)}>Checked</Button>
                    </div>
                  </li>
                );
              })}</ul>
            )}
            <p className="text-xs text-muted">Tap Checked each time you look. The reminder shows when it has been longer than the interval. Keep this page open or pinned to see it. It won’t send alerts when closed.</p>
          </Card>
    ) },
    { id: 'checks', title: 'Daily checks', render: (title: string) => (
          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2"><SectionTitle>{title}</SectionTitle><Badge tone={dailyTasks.length && tasksDone === dailyTasks.length ? 'ok' : 'neutral'}>{tasksDone}/{dailyTasks.length}</Badge></div>
            {dailyTasks.length === 0 ? <Empty title="No daily checks yet.">Add the starter list in <Link to="/tasks" className="underline">Tasks</Link>.</Empty> : (
              <ul className="space-y-1" data-testid="daily-checks">{dailyTasks.map((t) => {
                const g = guideForTitle(t.title);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <Checkbox id={`dt-${t.id}`} checked={taskDone(t, now)} onChange={() => toggleTaskRow(t.id)} label={t.title} />
                    {g && <Link to={`/checks/${g.id}`} className="text-xs underline shrink-0">How to</Link>}
                  </li>
                );
              })}</ul>
            )}
          </Card>
    ) },
          ]} />
          <p className="text-xs text-muted" role="note">Ticks and times here belong to today and clear tomorrow. Daily checks are your Tasks, so they stay in step with the rest of the app. For the full day plan see <Link to="/workflow" className="underline">Daily workflow</Link>, and use <Link to="/live" className="underline">Live notes</Link> for the paper trail.</p>
        </>
      )}
    </div>
  );
}

function JobEditor({ jobs, onSave, onReset }: { jobs: DailyJob[]; onSave: (j: DailyJob[]) => void; onReset: () => void }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'job' | 'watch'>('job');
  const [every, setEvery] = useState(30);
  const [stamp, setStamp] = useState(false);
  const guard = useSaveGuard({ text });
  const add = () => {
    const t = text.trim();
    if (!t || !guard.canSave) return;
    onSave([...jobs, kind === 'watch' ? { id: uid(), text: t.slice(0, 80), kind, everyMin: every } : { id: uid(), text: t.slice(0, 80), kind, stamp }]);
    setText(''); setStamp(false);
  };
  const move = (i: number, d: number) => { const n = [...jobs]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onSave(n); };
  const patch = (i: number, p: Partial<DailyJob>) => onSave(jobs.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <Card className="p-3 space-y-3">
      <SectionTitle>Edit my jobs</SectionTitle>
      <ul className="space-y-2" data-testid="job-editor">{jobs.map((j, i) => (
        <li key={j.id} className="border border-line rounded-md p-2 space-y-1.5">
          <TextInput aria-label={`Job ${i + 1} text`} value={j.text} onChange={(e: Ev) => patch(i, { text: e.target.value.slice(0, 80) })} />
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{j.kind === 'watch' ? 'Keep watching' : 'Once a day'}</Badge>
            {j.kind === 'watch' && <Select aria-label={`Check every, job ${i + 1}`} value={String(j.everyMin ?? 30)} onChange={(e: Ev) => patch(i, { everyMin: Number(e.target.value) })}>{WATCH_INTERVALS.map((m) => <option key={m} value={m}>every {m} min</option>)}</Select>}
            {j.kind === 'job' && <Checkbox checked={!!j.stamp} onChange={(v: boolean) => patch(i, { stamp: v })} label="Note the time" />}
            <Button size="sm" variant="ghost" aria-label={`Move ${j.text} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
            <Button size="sm" variant="ghost" aria-label={`Move ${j.text} down`} disabled={i === jobs.length - 1} onClick={() => move(i, 1)}>↓</Button>
            <Button size="sm" variant="danger" aria-label={`Delete ${j.text}`} onClick={() => onSave(jobs.filter((_, k) => k !== i))}>Delete</Button>
          </div>
        </li>
      ))}</ul>
      <div className="border-t border-line pt-3 space-y-2">
        <Field label="Add a job" htmlFor="dj-text"><TextInput id="dj-text" placeholder="e.g. Check the shared mailbox" value={text} onChange={(e: Ev) => setText(e.target.value)} /></Field>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Type" htmlFor="dj-kind"><Select id="dj-kind" value={kind} onChange={(e: Ev) => setKind(e.target.value as 'job' | 'watch')}><option value="job">Once a day</option><option value="watch">Keep watching</option></Select></Field>
          {kind === 'watch' ? <Field label="Check every" htmlFor="dj-every"><Select id="dj-every" value={String(every)} onChange={(e: Ev) => setEvery(Number(e.target.value))}>{WATCH_INTERVALS.map((m) => <option key={m} value={m}>{m} min</option>)}</Select></Field> : <Checkbox checked={stamp} onChange={setStamp} label="Note the time (clocking in or out)" />}
          <Button variant="primary" disabled={!text.trim() || !guard.canSave} onClick={add}>Add job</Button>
        </div>
        <SensitivePanel guard={guard} fieldLabels={{ text: 'Job' }} onRedactAll={() => setText(guard.redactAll({ text }).text)} onRedactKind={(k) => setText(guard.redactOneKind({ text }, k).text)} />
      </div>
      <PrivacyNote />
      <Button variant="ghost" onClick={() => { if (window.confirm('Put the original four jobs back? Your own jobs will be removed.')) onReset(); }}>Reset to the original jobs</Button>
    </Card>
  );
}
