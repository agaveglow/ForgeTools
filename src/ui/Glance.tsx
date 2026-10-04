import { useEffect, useMemo, useState } from 'react';
import { useCollection, useSettings } from '../data/hooks';
import { DEFAULT_DAILY_JOBS, dayProgress, parseDay, watchState } from '../lib/dailyJobs';
import { BLOCKS, BUBBLE_PX, GLANCE_FONTS, cleanLinks, honeycombRows, isExternal, moveBlock, readableTint, resolveApps, resolveBlocks, shapeStyle, toggleBlock } from '../lib/glance';
import { RingFace } from './GlanceRings';
import { normalizeHex } from '../lib/look';
import { CustomWidgetBody } from './CustomWidgets';
import { GlanceEditor } from './GlanceEditor';
import { store } from '../data/hooks';
import { HUE, Icon } from './Bubble';
import { activeTasks, taskDone } from '../lib/progress';
import { clsx } from '../lib/util';
import type { ReactNode } from 'react';
import { Link } from './router';

export function Glance() {
  const settings = useSettings();
  const [editing, setEditing] = useState(false);
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
    { id: 'jobs', label: 'Jobs', v: dj.done, m: dj.total, color: normalizeHex(settings.glanceRings?.jobs) ?? HUE.accent, to: '/today', r: 88 },
    { id: 'checks', label: 'Checks', v: daily.filter((t) => taskDone(t, now)).length, m: daily.length, color: normalizeHex(settings.glanceRings?.checks) ?? HUE.ok, to: '/tasks', r: 68 },
    { id: 'week', label: 'Week', v: weekly.filter((t) => taskDone(t, now)).length, m: weekly.length, color: normalizeHex(settings.glanceRings?.week) ?? HUE.info, to: '/tasks', r: 48 },
  ];
  const due = jobs.filter((j) => j.kind === 'watch' && watchState(j, day.checked[j.id], now) === 'due');
  const openNote = notes.find((n) => n.status === 'open');
  const st = settings.glanceStyle ?? {};
  const px = BUBBLE_PX[st.bubbleSize ?? 'md'];
  const rows = honeycombRows(resolveApps(settings.glanceApps), px >= 84 ? [3, 3] : [3, 4]);
  const quick = cleanLinks(settings.glanceLinks);
  const cards = (settings.customWidgets ?? []).filter((c) => c.glance);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const fontStack = GLANCE_FONTS[st.font ?? 'default'].stack;
  const tileCls = { rounded: 'rounded-2xl', sharp: 'rounded-none', pill: 'rounded-full', outline: 'rounded-2xl bg-transparent' }[st.tileShape ?? 'rounded'];
  const bubbleLook = (color: string | undefined, fallback: string) => ({ color: color ? readableTint(color) : fallback, background: `color-mix(in srgb, ${color ?? fallback} 20%, var(--c-surface))` });
  const labelStyle = st.labelColor ? { color: st.labelColor } : undefined;

  const blocks: Record<string, ReactNode> = {
    clock: (
      <Link to="/today" className="block mx-auto w-64 max-w-full rounded-full focus-visible:outline-2 focus-visible:outline-accent" aria-label={`${time}, ${date}. ${rings.map((r) => `${r.label} ${r.v} of ${r.m}`).join(', ')}. Open daily jobs.`}>
        <RingFace rings={rings} design={st.ring ?? 'classic'} time={time} date={shortDate} clockColor={normalizeHex(st.clockColor)} hideDate={st.hideDate} />
      </Link>
    ),
    legend: (
      <ul className="grid grid-cols-3 gap-2" data-testid="glance-legend">
        {rings.map((r) => (
          <li key={r.id}><Link to={r.to} className={clsx('block border border-line py-2 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent', st.tileShape === 'outline' ? '' : 'bg-surface', tileCls)} style={st.tileColor ? { borderColor: st.tileColor } : undefined}>
            <span className="block text-xl font-semibold leading-tight" style={{ color: r.color }}>{r.m > 0 ? `${r.v}/${r.m}` : '–'}</span>
            <span className="block text-xs text-muted" style={labelStyle}>{r.label}</span>
          </Link></li>
        ))}
      </ul>
    ),
    pills: (due.length > 0 || openNote) ? (
      <ul className="flex flex-wrap justify-center gap-2" data-testid="glance-pills">
        {due.map((j) => <li key={j.id}><Link to="/today" className="inline-flex items-center min-h-11 px-4 rounded-full bg-warn/15 border border-warn text-sm font-medium">{j.text} · due</Link></li>)}
        {openNote && <li><Link to="/live" className="inline-flex items-center min-h-11 px-4 rounded-full bg-bad/10 border border-bad text-sm font-medium">● Note open</Link></li>}
      </ul>
    ) : null,
    apps: (
      <nav aria-label="Apps" data-testid="glance-apps" className="pt-1">
        {rows.map((row, ri) => (
          <div key={ri} className={clsx('flex justify-center gap-3', ri > 0 && 'mt-2')}>
            {row.map((a) => (
              <Link key={a.id} to={a.to} aria-label={a.label} className="group flex flex-col items-center outline-none" style={{ width: Math.max(px + 14, st.bubbleShape === 'pill' ? px * 1.35 + 10 : 0) }}>
                <span className="grid place-items-center border border-line transition-transform duration-150 group-active:scale-90 group-hover:scale-105 group-focus-visible:outline-2 group-focus-visible:outline-accent" style={{ ...shapeStyle(st.bubbleShape, px), ...bubbleLook(a.color, HUE[a.hue]) }}>
                  <Icon name={a.icon} size={Math.round(px * 0.4)} />
                </span>
                <span className="mt-1 text-[11px] leading-tight text-muted" style={labelStyle}>{a.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    ),
    quick: quick.length > 0 ? (
      <nav aria-label="Quick links" data-testid="glance-quick" className="flex flex-wrap justify-center gap-3">
        {quick.map((q) => {
          const inner = (<>
            <span className="grid place-items-center border border-line transition-transform duration-150 group-active:scale-90 group-hover:scale-105" style={{ ...shapeStyle(st.quickShape ?? st.bubbleShape, Math.round(px * 0.85)), ...bubbleLook(q.color, 'var(--c-accent)') }}><Icon name={q.icon} size={Math.round(px * 0.34)} /></span>
            <span className="mt-1 text-[11px] leading-tight text-muted wrap-any" style={labelStyle}>{q.label}{isExternal(q.to) ? ' ↗' : ''}</span>
          </>);
          const cls = 'group flex flex-col items-center w-20 outline-none';
          return isExternal(q.to) ? <a key={q.id} href={q.to} target="_blank" rel="noopener noreferrer" aria-label={`${q.label} (opens in a new tab)`} className={cls}>{inner}</a> : <Link key={q.id} to={q.to} aria-label={q.label} className={cls}>{inner}</Link>;
        })}
      </nav>
    ) : null,
    cards: cards.length > 0 ? (
      <section aria-label="Your cards" className="space-y-3 text-left" data-testid="glance-cards">
        {cards.map((c) => (
          <div key={c.id} data-card={c.id}>
            <h2 className="text-sm font-semibold mb-1.5">{c.title}</h2>
            <div className={clsx('border border-line bg-surface p-3', tileCls)} style={c.color ? { borderLeft: `6px solid ${c.color}`, background: `color-mix(in srgb, ${c.color} 8%, var(--c-surface))` } : { borderLeft: '6px solid var(--c-accent)' }}>
              <CustomWidgetBody w={c} now={now} onChange={(w) => store.updateSettings({ customWidgets: (settings.customWidgets ?? []).map((x) => (x.id === w.id ? w : x)) })} />
            </div>
          </div>
        ))}
      </section>
    ) : null,
  };
  const layout = resolveBlocks(settings.glanceBlocks);

  return (
    <div className="max-w-md mx-auto pb-28 md:pb-10 space-y-5 text-center" data-testid="glance" style={fontStack ? { fontFamily: fontStack } : undefined}>
      <h1 className="sr-only">Home</h1>
      <div className="flex justify-end"><button type="button" aria-pressed={editing} onClick={() => setEditing(!editing)} className="min-h-9 px-3 rounded-full border border-line text-sm text-muted hover:text-ink hover:bg-surface2" data-testid="glance-edit">{editing ? 'Done' : 'Edit home'}</button></div>
      {layout.map((b, i) => {
        const node = blocks[b.id];
        if (!editing) return b.hidden || !node ? null : <div key={b.id}>{node}</div>;
        return (
          <div key={b.id} data-block={b.id} className={clsx('rounded-xl border border-dashed border-accent/60 p-2', b.hidden && 'opacity-50')}>
            <div className="flex items-center gap-1.5 mb-2 text-left">
              <span className="text-xs font-semibold flex-1 min-w-0">{BLOCKS.find((x) => x.id === b.id)?.label}{b.hidden ? ' (hidden)' : ''}{!node && !b.hidden ? ' (empty)' : ''}</span>
              <button type="button" disabled={i === 0} aria-label={`Move ${b.label} up`} onClick={() => store.updateSettings({ glanceBlocks: moveBlock(settings.glanceBlocks, b.id, -1) })} className="min-h-9 min-w-9 rounded-md border border-line text-sm disabled:opacity-40">↑</button>
              <button type="button" disabled={i === layout.length - 1} aria-label={`Move ${b.label} down`} onClick={() => store.updateSettings({ glanceBlocks: moveBlock(settings.glanceBlocks, b.id, 1) })} className="min-h-9 min-w-9 rounded-md border border-line text-sm disabled:opacity-40">↓</button>
              <button type="button" aria-label={`${b.hidden ? 'Show' : 'Hide'} ${b.label}`} onClick={() => store.updateSettings({ glanceBlocks: toggleBlock(settings.glanceBlocks, b.id) })} className="min-h-9 px-2 rounded-md border border-line text-xs">{b.hidden ? 'Show' : 'Hide'}</button>
            </div>
            {node ?? <p className="text-xs text-muted py-2">Nothing here yet.</p>}
          </div>
        );
      })}
      {editing && <GlanceEditor onDone={() => setEditing(false)} />}
    </div>
  );
}
