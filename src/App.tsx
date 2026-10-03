import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from './lib/util';
import { Link, match, usePath } from './ui/router';
import { Modal } from './ui/primitives';
import { SearchPalette } from './ui/SearchPalette';
import { Dashboard } from './pages/DashboardPage';
import { LogDetail, LogEditor, LogList } from './pages/LogsPage';
import { SessionRunner, TroubleshootPage, WorkflowView } from './pages/TroubleshootPage';
import { CommandsPage } from './pages/CommandsPage';
import { SecurityList, SecurityRun } from './pages/SecurityPage';
import { AgentPage } from './pages/AgentPage';
import { LockScreen } from './ui/LockScreen';
import { store, useCollection, useSettings, useVault } from './data/hooks';
import { VoicePage } from './pages/VoicePage';
import { FilesPage } from './pages/FilesPage';
import { applyLook } from './lib/look';
import { LivePage } from './pages/LivePage';
import { CheckGuidePage, ChecksPage } from './pages/ChecksPage';
import { SlaPage } from './pages/SlaPage';
import { BoardPage } from './pages/BoardPage';
import { TasksPage } from './pages/TasksPage';
import { ImportPage } from './pages/ImportPage';
import { RequirementsPage } from './pages/RequirementsPage';
import { ApprenticeshipPage } from './pages/ApprenticeshipPage';
import { KbDetail, KbEditor, KbList } from './pages/KbPage';
import { SkillsPage } from './pages/SkillsPage';
import { SettingsPage } from './pages/SettingsPage';

interface NavItem { to: string; label: string; short: string; icon: string; root: string }
const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: '⌂', root: '/' },
  { to: '/tasks', label: 'Tasks', short: 'Tasks', icon: '☑', root: '/tasks' },
  { to: '/live', label: 'Live notes', short: 'Notes', icon: '✎', root: '/live' },
  { to: '/checks', label: 'Check guides', short: 'Checks', icon: '✔', root: '/checks' },
  { to: '/sla', label: 'Response times', short: 'SLA', icon: '⏱', root: '/sla' },
  { to: '/board', label: 'Task board', short: 'Board', icon: '▥', root: '/board' },
  { to: '/logs', label: 'Work logs', short: 'Logs', icon: '☰', root: '/logs' },
  { to: '/requirements', label: 'Requirements', short: 'Goals', icon: '◎', root: '/requirements' },
  { to: '/apprenticeship', label: 'Apprenticeship', short: 'Learn', icon: '✎', root: '/apprenticeship' },
  { to: '/import', label: 'Import documents', short: 'Import', icon: '⇪', root: '/import' },
  { to: '/voice', label: 'Voice notes', short: 'Voice', icon: '◉', root: '/voice' },
  { to: '/troubleshoot', label: 'Troubleshooting', short: 'Fix', icon: '⚒', root: '/troubleshoot' },
  { to: '/commands', label: 'Commands', short: 'Cmds', icon: '>_', root: '/commands' },
  { to: '/security', label: 'Security checklist', short: 'Security', icon: '⛨', root: '/security' },
  { to: '/agent', label: 'Guide agent', short: 'Agent', icon: '✦', root: '/agent' },
  { to: '/kb', label: 'Knowledge base', short: 'Notes', icon: '❒', root: '/kb' },
  { to: '/skills', label: 'Skills profile', short: 'Skills', icon: '◆', root: '/skills' },
  { to: '/files', label: 'Files', short: 'Files', icon: '▤', root: '/files' },
  { to: '/settings', label: 'Settings and data', short: 'Settings', icon: '⚙', root: '/settings' },
];
const MOBILE_MAIN = ['/', '/tasks', '/logs', '/agent'];

function isActive(n: NavItem, path: string): boolean {
  if (n.root === '/') return path === '/';
  if (n.root === '/troubleshoot') return path.startsWith('/troubleshoot') || path.startsWith('/session');
  return path === n.root || path.startsWith(n.root + '/');
}

function route(path: string): ReactNode {
  let p: Record<string, string> | null;
  if (path === '/') return <Dashboard />;
  if (path === '/logs') return <LogList />;
  if (path === '/logs/new') return <LogEditor />;
  if ((p = match('/logs/:id/edit', path))) return <LogEditor id={p.id} key={p.id} />;
  if ((p = match('/logs/:id', path))) return <LogDetail id={p.id} />;
  if (path === '/troubleshoot') return <TroubleshootPage />;
  if ((p = match('/troubleshoot/:id', path))) return <WorkflowView id={p.id} />;
  if ((p = match('/session/:id', path))) return <SessionRunner id={p.id} key={p.id} />;
  if (path === '/commands') return <CommandsPage />;
  if ((p = match('/commands/:id', path))) return <CommandsPage id={p.id} />;
  if (path === '/security') return <SecurityList />;
  if ((p = match('/security/:id', path))) return <SecurityRun id={p.id} key={p.id} />;
  if (path === '/agent') return <AgentPage />;
  if (path === '/voice') return <VoicePage />;
  if (path === '/files') return <FilesPage />;
  if (path === '/import') return <ImportPage />;
  if (path === '/tasks') return <TasksPage />;
  if (path === '/board') return <BoardPage />;
  if (path === '/live') return <LivePage />;
  if (path === '/checks') return <ChecksPage />;
  if (path === '/sla') return <SlaPage />;
  if ((p = match('/checks/:id', path))) return <CheckGuidePage id={p.id} />;
  if (path === '/requirements') return <RequirementsPage />;
  if (path === '/apprenticeship') return <ApprenticeshipPage />;
  if (path === '/kb') return <KbList />;
  if (path === '/kb/new') return <KbEditor />;
  if ((p = match('/kb/:id/edit', path))) return <KbEditor id={p.id} key={p.id} />;
  if ((p = match('/kb/:id', path))) return <KbDetail id={p.id} />;
  if (path === '/skills') return <SkillsPage />;
  if (path === '/settings') return <SettingsPage />;
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted mt-1">That address does not exist.</p>
      <Link to="/" className="underline mt-3 inline-block">Go to the dashboard</Link>
    </div>
  );
}

function useTheme() {
  const { theme, accent, textScale, fontStyle, corners } = useSettings();
  useEffect(() => {
    const apply = () => {
      const t = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
      document.documentElement.setAttribute('data-theme', t);
      applyLook({ accent, textScale, fontStyle, corners }, t);
    };
    apply();
    try { if (theme === 'system') localStorage.removeItem('forgetools:theme'); else localStorage.setItem('forgetools:theme', theme); } catch { /* storage unavailable */ }
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, accent, textScale, fontStyle, corners]);
}

export function App() {
  const v = useVault();
  useTheme();
  if (v.state === 'locked') return <LockScreen />;
  return <Shell />;
}

function useAutoLock() {
  const v = useVault();
  const mins = useSettings().autoLockMinutes ?? 5;
  useEffect(() => {
    if (v.state !== 'unlocked') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hiddenAt = 0;
    const lock = () => { v.lock().then(() => store.reload()); };
    const arm = () => { if (timer) clearTimeout(timer); if (mins > 0) timer = setTimeout(lock, mins * 60_000); };
    const vis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && mins > 0 && Date.now() - hiddenAt > Math.min(mins, 1) * 60_000) lock();
      else arm();
    };
    const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
    evs.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    document.addEventListener('visibilitychange', vis);
    arm();
    return () => { if (timer) clearTimeout(timer); evs.forEach((e) => window.removeEventListener(e, arm)); document.removeEventListener('visibilitychange', vis); };
  }, [v, v.state, mins]);
}

function Shell() {
  const { appName } = useSettings();
  const hasOpenNote = useCollection('jobNotes').some((n) => n.status === 'open');
  useAutoLock();
  const path = usePath();
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, []);
  useEffect(() => { setMoreOpen(false); window.scrollTo({ top: 0 }); }, [path]);

  const editing = path === '/logs/new' || /^\/logs\/[^/]+\/edit$/.test(path) || path === '/kb/new' || /^\/kb\/[^/]+\/edit$/.test(path);
  const showFab = ['/', '/logs', '/troubleshoot', '/commands', '/kb', '/skills', '/agent', '/files', '/requirements', '/apprenticeship', '/import'].includes(path);
  const moreItems = NAV.filter((n) => !MOBILE_MAIN.includes(n.to));
  const moreActive = moreItems.some((n) => isActive(n, path));

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" onClick={(e: { preventDefault(): void }) => { e.preventDefault(); document.getElementById('main')?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-accent focus:text-accent-ink focus:px-3 focus:py-2 focus:rounded-sm">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-line bg-surface sticky top-0 h-dvh">
        <div className="px-4 py-4 border-b border-line">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-lg"><span className="inline-grid place-items-center size-7 rounded-sm bg-accent text-accent-ink font-mono text-sm">{(appName || 'ForgeTools')[0]?.toUpperCase()}</span><span className="wrap-any">{appName || 'ForgeTools'}</span></Link>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} aria-current={isActive(n, path) ? 'page' : undefined} className={clsx('flex items-center gap-3 px-3 min-h-10 rounded-sm text-sm', isActive(n, path) ? 'bg-accent/10 text-accent font-medium' : 'hover:bg-surface2')}>
              <span aria-hidden className="w-5 text-center font-mono">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-line space-y-1">
          <button type="button" onClick={() => setSearchOpen(true)} className="w-full min-h-10 px-3 rounded-sm border border-line text-sm text-muted flex items-center justify-between hover:bg-surface2"><span>Search…</span><kbd className="font-mono text-xs">Ctrl K</kbd></button>
          <Link to="/logs/new" className="flex items-center justify-center min-h-10 rounded-sm bg-accent text-accent-ink font-medium text-sm">+ New work log</Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-surface border-b border-line pt-safe">
          <div className="flex items-center justify-between px-4 h-12">
            <Link to="/" className="flex items-center gap-2 font-semibold min-h-11"><span className="inline-grid place-items-center size-6 rounded-sm bg-accent text-accent-ink font-mono text-xs">{(appName || 'ForgeTools')[0]?.toUpperCase()}</span>{appName || 'ForgeTools'}</Link>
            <Link to="/live" aria-label={hasOpenNote ? 'Live note, one is open' : 'Live notes'} className={clsx('min-h-11 px-3 inline-flex items-center gap-1 rounded-sm border text-sm ml-auto mr-2', hasOpenNote ? 'border-accent text-accent font-medium' : 'border-line hover:bg-surface2')}>{hasOpenNote && <span aria-hidden className="size-2 rounded-full bg-accent" />}Note</Link>
            <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)} className="min-h-11 px-3 rounded-sm border border-line text-sm hover:bg-surface2">Search</button>
          </div>
        </header>

        <main id="main" tabIndex={-1} className={clsx('flex-1 px-4 py-4 md:px-8 md:py-6 outline-none', !editing && 'pb-28 md:pb-8')}>
          {route(path)}
        </main>

        {/* Mobile quick-log FAB + bottom nav */}
        {!editing && showFab && (
          <Link to="/logs/new" aria-label="New work log" className="md:hidden fixed right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 min-h-12 px-4 rounded-full bg-accent text-accent-ink font-semibold shadow-lg inline-flex items-center gap-1">+ Log</Link>
        )}
        {!editing && (
          <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line pb-safe grid grid-cols-5">
            {NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map((n) => (
              <Link key={n.to} to={n.to} aria-current={isActive(n, path) ? 'page' : undefined} className={clsx('flex flex-col items-center justify-center min-h-14 text-[11px] gap-0.5', isActive(n, path) ? 'text-accent font-semibold' : 'text-muted')}>
                <span aria-hidden className="text-base leading-none font-mono">{n.icon}</span>{n.short}
              </Link>
            ))}
            <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={clsx('flex flex-col items-center justify-center min-h-14 text-[11px] gap-0.5', moreActive ? 'text-accent font-semibold' : 'text-muted')}>
              <span aria-hidden className="text-base leading-none">⋯</span>More
            </button>
          </nav>
        )}
      </div>

      {moreOpen && (
        <Modal title="More" onClose={() => setMoreOpen(false)}>
          <ul className="space-y-1">{moreItems.map((n) => <li key={n.to}><Link to={n.to} className="flex items-center gap-3 min-h-12 px-2 rounded-sm hover:bg-surface2"><span aria-hidden className="w-6 text-center font-mono">{n.icon}</span>{n.label}</Link></li>)}</ul>
        </Modal>
      )}
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
