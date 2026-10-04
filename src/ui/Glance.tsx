import { useEffect, useMemo, useState } from 'react';
import { useCollection, useSettings } from '../data/hooks';
import { DEFAULT_DAILY_JOBS, dayProgress, parseDay, watchState } from '../lib/dailyJobs';
import { GLANCE_APPS, GLANCE_ICONS, honeycombRows, ringDash, ringFraction } from '../lib/glance';
import { activeTasks, taskDone } from '../lib/progress';
import { clsx } from '../lib/util';
import { Link } from './router';

const HUE = { accent: 'var(--c-accent)', ok: 'var(--c-ok)', info: 'var(--c-info)', warn: 'var(--c-warn)', bad: 'var(--c-bad)' } as const;

export function Glance() {
  const settings = useSettings();
  const tasks = useCollection('tasks');
  const notes = useCollection('jobNotes');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);

  const jobs = settings.dailyJobs ?? DEFAULT_DAILY_JOBS;
  const day = useMemo(() => { try { return parseDay(localStorage.getItem('forgetools:todayState'), now); } catch { return parseDay(null, now); } }, [now]);
  const act = activeTasks(tasks);
  const daily = act.filter((t) => t.kind === 'daily'), weekly = act.filter((t) => t.kind === 'weekly');
  const dj = dayProgress(jobs, day);
  const rings = [
    { id: 'jobs', label: 'Jobs', v: dj.done, m: dj.total, color: HUE.accent, to: '/today', r: 88 },
    { id: 'checks', label: 'Checks', v: daily.filter((t) => taskDone(t, now)).length, m: daily.length, color: HUE.ok, to: '/tasks', r: 68 },
    { id: 'week', label: 'Week', v: weekly.filter((t) => taskDone(t, now)).length, m: weekly.length, color: HUE.info, to: '/tasks', r: 48 },
  ];
  const due = jobs.filter((j) => j.kind === 'watch' && watchState(j, day.checked[j.id], now) === 'due');
  const openNote = notes.find((n) => n.status === 'open');
  const rows = honeycombRows(GLANCE_APPS);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="max-w-md mx-auto pb-28 md:pb-10 space-y-5 text-center" data-testid="glance">
      <Link to="/today" className="block mx-auto w-64 max-w-full rounded-full focus-visible:outline-2 focus-visible:outline-accent" aria-label={`${time}, ${date}. ${rings.map((r) => `${r.label} ${r.v} of ${r.m}`).join(', ')}. Open daily jobs.`}>
        <svg viewBox="0 0 200 200" className="w-full h-auto" role="img" aria-hidden="true">
          {rings.map((r) => (
            <g key={r.id} transform="rotate(-90 100 100)">
              <circle cx="100" cy="100" r={r.r} fill="none" stroke="var(--c-surface2)" strokeWidth="14" />
              {ringFraction(r.v, r.m) > 0 && <circle cx="100" cy="100" r={r.r} fill="none" stroke={r.color} strokeWidth="14" strokeLinecap="round" strokeDasharray={ringDash(r.r, ringFraction(r.v, r.m))} style={{ transition: 'stroke-dasharray .6s ease' }} />}
            </g>
          ))}
          <text x="100" y="98" textAnchor="middle" dominantBaseline="central" fontSize="25" fontWeight="600" fill="var(--c-ink)" data-testid="glance-time">{time}</text>
          <text x="100" y="120" textAnchor="middle" fontSize="9.5" fill="var(--c-muted)">{now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</text>
        </svg>
      </Link>

      <ul className="grid grid-cols-3 gap-2" data-testid="glance-legend">
        {rings.map((r) => (
          <li key={r.id}><Link to={r.to} className="block rounded-2xl bg-surface border border-line py-2 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent">
            <span className="block text-xl font-semibold leading-tight" style={{ color: r.color }}>{r.m > 0 ? `${r.v}/${r.m}` : '–'}</span>
            <span className="block text-xs text-muted">{r.label}</span>
          </Link></li>
        ))}
      </ul>

      {(due.length > 0 || openNote) && (
        <ul className="flex flex-wrap justify-center gap-2" data-testid="glance-pills">
          {due.map((j) => <li key={j.id}><Link to="/today" className="inline-flex items-center min-h-11 px-4 rounded-full bg-warn/15 border border-warn text-sm font-medium">{j.text.replace(/^Check /i, 'Check ')} · due</Link></li>)}
          {openNote && <li><Link to="/live" className="inline-flex items-center min-h-11 px-4 rounded-full bg-bad/10 border border-bad text-sm font-medium">● Note open</Link></li>}
        </ul>
      )}

      <nav aria-label="Apps" data-testid="glance-apps" className="pt-1">
        {rows.map((row, ri) => (
          <div key={ri} className={clsx('flex justify-center gap-3', ri > 0 && 'mt-2')}>
            {row.map((a) => (
              <Link key={a.id} to={a.to} aria-label={a.label} className="group flex flex-col items-center w-[22vw] max-w-[88px] min-w-[68px] outline-none">
                <span className="grid place-items-center rounded-full size-[18vw] max-size-[72px] min-w-[56px] min-h-[56px] max-w-[72px] max-h-[72px] border border-line transition-transform duration-150 group-active:scale-90 group-hover:scale-105 group-focus-visible:outline-2 group-focus-visible:outline-accent" style={{ color: HUE[a.hue], background: `color-mix(in srgb, ${HUE[a.hue]} 20%, var(--c-surface))` }}>
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{GLANCE_ICONS[a.icon].map((d) => <path key={d} d={d} />)}</svg>
                </span>
                <span className="mt-1 text-[11px] leading-tight text-muted">{a.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}
