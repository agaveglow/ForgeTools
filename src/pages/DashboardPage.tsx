import { useMemo } from 'react';
import { store, useCollection, useSettings } from '../data/hooks';
import { CHECKLIST_BY_ID } from '../content/checklist';
import { isSameLocalDay, plural, timeAgo } from '../lib/util';
import { Badge, Button, Card, Empty, SectionTitle } from '../ui/primitives';
import { Link, navigate } from '../ui/router';
import { useTitle } from '../ui/hooks';
import { LogRow } from './LogsPage';
import { summarise } from './SecurityPage';

const ACTIONS: Array<[string, string, string]> = [
  ['+ New work log', '/logs/new', 'Record what you did'],
  ['Guide agent', '/agent', 'Ask and get a guide'],
  ['Voice note', '/voice', 'Speak, get a guide'],
  ['Troubleshoot', '/troubleshoot', 'Guided workflows'],
  ['Security check', '/security', 'Device checklist'],
  ['Commands', '/commands', 'CMD / PowerShell'],
  ['Knowledge base', '/kb', 'Your notes'],
];

export function Dashboard() {
  useTitle('Dashboard');
  const settings = useSettings();
  const allLogs = useCollection('workLogs');
  const sessions = useCollection('sessions');
  const runs = useCollection('checklistRuns');
  const kb = useCollection('kbEntries');
  const usage = useCollection('usage');
  const logs = allLogs.filter((l) => settings.showDemo || !l.demo);
  const now = new Date();

  const today = logs.filter((l) => isSameLocalDay(new Date(l.occurredAt), now));
  const recent = logs.filter((l) => !today.includes(l)).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5);
  const guides = kb.filter((k) => k.tags.includes('generated')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  const open = sessions.filter((s) => s.status === 'open' && (settings.showDemo || !s.demo));
  const followUps = logs.filter((l) => l.status === 'follow-up' || l.status === 'unresolved');
  const frequent = useMemo(() => {
    const m = new Map<string, { label: string; route: string; n: number; kind: string }>();
    for (const u of usage) {
      const k = u.kind + ':' + u.refId;
      const cur = m.get(k);
      m.set(k, { label: u.label, route: u.route, kind: u.kind, n: (cur?.n ?? 0) + 1 });
    }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 5);
  }, [usage]);
  const openResearch = logs.flatMap((l) => (l.learning?.toResearch ?? []).filter((r) => !r.done).map((r) => ({ log: l, r })));
  const nextActs = logs.filter((l) => l.learning?.nextActivity).slice(0, 3);
  const openRuns = runs.filter((r) => r.status === 'open' && (settings.showDemo || !r.demo));
  const failedRuns = openRuns.map((r) => ({ r, sm: summarise(r) })).filter((x) => x.sm.fail > 0);
  const lastComplete = runs.filter((r) => r.status === 'complete' && !r.demo).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'}</h1>
        <p className="text-sm text-muted">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {plural(today.length, 'log')} today</p>
      </header>

      {store.hasDemo() && settings.showDemo && (
        <div role="note" className="text-sm rounded-md border border-warn/50 bg-warn/5 p-3 flex flex-wrap items-center justify-between gap-2">
          <span><strong>Sample data is showing.</strong> Records marked DEMO are fictional and never count towards your skills.</span>
          <Button size="sm" onClick={() => navigate('/settings')}>Manage data</Button>
        </div>
      )}

      <section aria-label="Quick actions">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
          {ACTIONS.map(([label, to, sub], i) => (
            <Link key={to} to={to} className={'block rounded-md border p-3 min-h-16 ' + (i === 0 ? 'bg-accent text-accent-ink border-accent' : 'bg-surface border-line hover:bg-surface2')}>
              <span className="font-medium block">{label}</span><span className={'text-xs ' + (i === 0 ? 'opacity-80' : 'text-muted')}>{sub}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <section>
            <SectionTitle>Today's work</SectionTitle>
            {today.length === 0 ? <Empty title="Nothing logged today.">Add a log as you finish each job. It is quickest done while it is fresh.</Empty> : <ul className="space-y-2">{today.map((l) => <li key={l.id}><LogRow log={l} /></li>)}</ul>}
          </section>
          <section>
            <SectionTitle action={<Link to="/logs" className="text-sm underline inline-flex items-center min-h-9 px-1">All logs</Link>}>Recent logs</SectionTitle>
            {recent.length === 0 ? <Empty title="No logs yet." /> : <ul className="space-y-2">{recent.map((l) => <li key={l.id}><LogRow log={l} /></li>)}</ul>}
          </section>
          <section>
            <SectionTitle action={<Link to="/agent" className="text-sm underline inline-flex items-center min-h-9 px-1">Guide agent</Link>}>Recent guides</SectionTitle>
            {guides.length === 0 ? <Empty title="No generated guides saved.">Ask the guide agent for a how-to and save it.</Empty> : (
              <ul className="space-y-2">{guides.map((g) => (
                <li key={g.id}><Link to={`/kb/${g.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2"><span className="text-sm font-medium wrap-any">{g.title}</span><span className="block text-xs text-muted">{g.category} · {timeAgo(g.updatedAt)}</span></Link></li>
              ))}</ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section>
            <SectionTitle>Open troubleshooting</SectionTitle>
            {open.length === 0 ? <Empty title="No open sessions." /> : <ul className="space-y-2">{open.map((s) => <li key={s.id}><Link to={`/session/${s.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2"><span className="font-medium">{s.title}</span><span className="block text-xs text-muted">Updated {timeAgo(s.updatedAt)}</span></Link></li>)}</ul>}
          </section>
          {followUps.length > 0 && (
            <section>
              <SectionTitle>Needs follow-up</SectionTitle>
              <ul className="space-y-1.5">{followUps.slice(0, 4).map((l) => <li key={l.id}><Link to={`/logs/${l.id}`} className="block text-sm bg-surface border border-line rounded-md p-2.5 hover:bg-surface2 wrap-any"><span className="font-mono text-xs text-muted">{l.ref}</span> {l.followUp || l.problem}</Link></li>)}</ul>
            </section>
          )}
          <section>
            <SectionTitle>Frequently used</SectionTitle>
            {frequent.length === 0 ? <Empty title="Nothing yet.">Tools you open often will appear here.</Empty> : <ul className="space-y-1.5">{frequent.map((f) => <li key={f.kind + f.label}><Link to={f.route} className="flex items-center justify-between gap-2 text-sm bg-surface border border-line rounded-md p-2.5 hover:bg-surface2"><span className="wrap-any">{f.label}</span><Badge>{f.kind} ×{f.n}</Badge></Link></li>)}</ul>}
          </section>
          <section>
            <SectionTitle action={<Link to="/skills" className="text-sm underline inline-flex items-center min-h-9 px-1">Skills</Link>}>Learning</SectionTitle>
            <Card className="p-3 text-sm space-y-1">
              <p>{plural(openResearch.length, 'research item')} open</p>
              {openResearch.slice(0, 3).map((x) => <p key={x.r.id} className="text-muted wrap-any">• {x.r.text}</p>)}
              {nextActs[0] && <p className="pt-1 border-t border-line"><span className="font-medium">Next practice: </span>{nextActs[0].learning!.nextActivity}</p>}
            </Card>
          </section>
          <section>
            <SectionTitle action={<Link to="/security" className="text-sm underline inline-flex items-center min-h-9 px-1">Security</Link>}>Security reminders</SectionTitle>
            <Card className="p-3 text-sm space-y-1.5">
              {failedRuns.length === 0 && openRuns.length === 0 && <p className="text-muted">No checks in progress.</p>}
              {failedRuns.map(({ r, sm }) => <p key={r.id}><Badge tone="bad">{sm.fail} failed</Badge> <Link to={`/security/${r.id}`} className="underline">{r.label}</Link> — {CHECKLIST_BY_ID[r.templateId].title}</p>)}
              {openRuns.filter((r) => !failedRuns.some((f) => f.r.id === r.id)).map((r) => <p key={r.id}><Link to={`/security/${r.id}`} className="underline">{r.label}</Link> in progress</p>)}
              <p className="text-muted">{lastComplete?.completedAt ? `Last completed check: ${timeAgo(lastComplete.completedAt)}.` : 'You have not completed a check yet.'}</p>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
