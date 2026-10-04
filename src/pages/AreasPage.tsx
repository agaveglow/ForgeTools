import { useMemo } from 'react';
import { useCollection } from '../data/hooks';
import { DEFAULT_DAILY_JOBS, dayProgress, parseDay } from '../lib/dailyJobs';
import { AREAS, areaById } from '../lib/areas';
import type { Area } from '../lib/areas';
import { activeTasks, taskDone, weekHours } from '../lib/progress';
import { plural } from '../lib/util';
import { useSettings } from '../data/hooks';
import { Empty } from '../ui/primitives';
import { Icon, RoundIcon } from '../ui/Bubble';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

/** A short live line for pages where one number helps at a glance. */
function useStats(): Record<string, string> {
  const tasks = useCollection('tasks');
  const logs = useCollection('workLogs');
  const kb = useCollection('kbEntries');
  const notes = useCollection('jobNotes');
  const hours = useCollection('apprenticeLogs');
  const reqs = useCollection('requirements');
  const s = useSettings();
  return useMemo(() => {
    const now = new Date();
    const out: Record<string, string> = {};
    let day; try { day = parseDay(localStorage.getItem('forgetools:todayState'), now); } catch { day = parseDay(null, now); }
    const dj = dayProgress(s.dailyJobs ?? DEFAULT_DAILY_JOBS, day);
    if (dj.total) out['/today'] = `${dj.done} of ${dj.total} done`;
    const act = activeTasks(tasks);
    const left = act.filter((t) => t.kind === 'daily' && !taskDone(t, now)).length;
    if (act.some((t) => t.kind === 'daily')) out['/tasks'] = left ? `${left} left today` : 'All done today';
    out['/live'] = notes.some((n) => n.status === 'open') ? 'A note is open' : 'Start a note';
    if (logs.length) out['/logs'] = plural(logs.length, 'log');
    if (kb.length) out['/kb'] = plural(kb.length, 'guide');
    const wk = weekHours(hours, now);
    if (hours.length) out['/apprenticeship'] = `${wk} h this week`;
    const rq = reqs.length; if (rq) out['/requirements'] = `${reqs.filter((r) => r.status === 'signed-off' || r.status === 'evidenced').length} of ${rq} evidenced`;
    return out;
  }, [tasks, logs, kb, notes, hours, reqs, s.dailyJobs]);
}

export function AreaHub({ id }: { id: string }) {
  const area = areaById(id);
  useTitle(area?.label ?? 'Area');
  const stats = useStats();
  if (!area) return <Empty title="Not found.">Go <Link to="/" className="underline">home</Link>.</Empty>;
  return (
    <div className="max-w-2xl pb-10 space-y-5" data-testid={`area-${area.id}`}>
      <header className="flex items-center gap-3">
        <RoundIcon name={area.icon} hue={area.hue} size={56} />
        <div><h1 className="text-2xl font-semibold tracking-tight">{area.label}</h1><p className="text-sm text-muted">{area.blurb}</p></div>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {area.pages.map((pg) => (
          <li key={pg.to}>
            <Link to={pg.to} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 min-h-20 hover:bg-surface2 active:scale-[.98] transition-transform focus-visible:outline-2 focus-visible:outline-accent">
              <RoundIcon name={pg.icon} hue={area.hue} />
              <span className="min-w-0">
                <span className="block text-base font-semibold leading-tight">{pg.label}</span>
                <span className="block text-sm text-muted wrap-any">{stats[pg.to] ?? pg.blurb}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AllAppsPage() {
  useTitle('All apps');
  return (
    <div className="max-w-2xl pb-10 space-y-6" data-testid="all-apps">
      <header><h1 className="text-2xl font-semibold tracking-tight">All apps</h1><p className="text-sm text-muted">Everything in ForgeTools, in five areas.</p></header>
      {AREAS.map((a: Area) => (
        <section key={a.id} aria-label={a.label}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{a.label}</h2>
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {a.pages.map((pg) => (
              <li key={pg.to}><Link to={pg.to} className="flex flex-col items-center gap-1.5 rounded-3xl p-2 text-center hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent">
                <RoundIcon name={pg.icon} hue={a.hue} size={56} />
                <span className="text-xs leading-tight wrap-any">{pg.label}</span>
              </Link></li>
            ))}
          </ul>
        </section>
      ))}
      <Link to="/" className="inline-flex items-center gap-1 text-sm underline"><Icon name="back" size={16} /> Back to home</Link>
    </div>
  );
}
