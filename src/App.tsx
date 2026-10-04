import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from './lib/util';
import { Link, match, usePath } from './ui/router';
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
import { TodayPage } from './pages/TodayPage';
import { AllAppsPage, AreaHub } from './pages/AreasPage';
import { Icon } from './ui/Bubble';
import { areaOfPath, parentPath } from './lib/areas';
import { WorkflowPage } from './pages/WorkflowPage';
import { ManualReaderPage, ManualsPage } from './pages/ManualsPage';
import { GuideList, GuideView } from './pages/GuidesPage';
import { CablePage, CalcPage, KitPage, NotePage, ToolsHub } from './pages/ToolsPages';
import { EventsPage, HardenPage, HashPage, HeaderPage } from './pages/SecurityPages';
import { RedactPage } from './pages/RedactPage';
import { SlaPage } from './pages/SlaPage';
import { BoardPage } from './pages/BoardPage';
import { TasksPage } from './pages/TasksPage';
import { ImportPage } from './pages/ImportPage';
import { RequirementsPage } from './pages/RequirementsPage';
import { ApprenticeshipPage } from './pages/ApprenticeshipPage';
import { KbDetail, KbEditor, KbList } from './pages/KbPage';
import { SkillsPage } from './pages/SkillsPage';
import { SettingsPage } from './pages/SettingsPage';

function route(path: string): ReactNode {
  let p: Record<string, string> | null;
  if (path === '/') return <Dashboard />;
  if (path === '/apps') return <AllAppsPage />;
  if ((p = match('/a/:id', path))) return <AreaHub id={p.id} key={p.id} />;
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
  if (path === '/tools') return <ToolsHub />;
  if (path === '/tools/cable') return <CablePage />;
  if (path === '/tools/calc') return <CalcPage />;
  if (path === '/tools/notes') return <NotePage />;
  if (path === '/tools/kit') return <KitPage />;
  if (path === '/tools/redact') return <RedactPage />;
  if (path === '/tools/events') return <EventsPage />;
  if (path === '/tools/hash') return <HashPage />;
  if (path === '/tools/header') return <HeaderPage />;
  if (path === '/tools/harden') return <HardenPage />;
  if (path === '/procedures') return <GuideList set="procedures" />;
  if (path === '/library') return <GuideList set="library" />;
  if ((p = match('/procedures/:id', path))) return <GuideView id={p.id} />;
  if ((p = match('/library/:id', path))) return <GuideView id={p.id} />;
  if (path === '/today') return <TodayPage />;
  if (path === '/workflow') return <WorkflowPage />;
  if (path === '/manuals') return <ManualsPage />;
  if ((p = match('/manuals/:id', path))) return <ManualReaderPage id={p.id} key={p.id} />;
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

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [path]);

  const editing = path === '/logs/new' || /^\/logs\/[^/]+\/edit$/.test(path) || path === '/kb/new' || /^\/kb\/[^/]+\/edit$/.test(path);
  const parent = parentPath(path);
  const area = areaOfPath(path);
  const pill = 'min-h-11 px-3 sm:px-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface text-sm hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <div className="min-h-dvh flex flex-col">
      <a href="#main" onClick={(e: { preventDefault(): void }) => { e.preventDefault(); document.getElementById('main')?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:border focus:border-line focus:rounded-sm focus:px-3 focus:py-2">Skip to content</a>

      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-line pt-safe">
        <div className="mx-auto max-w-5xl flex items-center gap-2 px-3 h-14">
          {parent !== null && <Link to={parent} aria-label="Back" className="grid place-items-center size-11 rounded-full border border-line bg-surface hover:bg-surface2 shrink-0"><Icon name="back" size={20} /></Link>}
          <Link to="/" className={clsx('items-center gap-2 font-semibold min-h-11 min-w-0', parent !== null ? 'hidden sm:flex' : 'flex')}><span className="inline-grid place-items-center size-8 rounded-full bg-accent text-accent-ink font-mono text-sm shrink-0">{(appName || 'F').charAt(0).toUpperCase()}</span><span className={clsx('truncate', parent !== null && 'hidden sm:inline')}>{appName || 'ForgeTools'}</span></Link>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/" aria-label="Home" aria-current={path === '/' ? 'page' : undefined} data-testid="home-button" className={clsx('grid place-items-center size-11 rounded-full border bg-surface hover:bg-surface2', path === '/' ? 'border-accent text-accent' : 'border-line')}><Icon name="home" size={20} /></Link>
            <Link to="/live" aria-label={hasOpenNote ? 'Live note, one is open' : 'Live notes'} className={clsx(pill, hasOpenNote && 'border-accent text-accent')}>{hasOpenNote && <span aria-hidden className="size-2 rounded-full bg-accent" />}Note</Link>
            <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)} className={pill}>Search</button>
            <Link to="/apps" aria-label="All apps" className="grid place-items-center size-11 rounded-full border border-line bg-surface hover:bg-surface2"><Icon name="grid" size={20} /></Link>
          </div>
        </div>
        {area && area.pages.length > 1 && !editing && !path.startsWith('/a/') && (
          <nav aria-label={area.label} className="mx-auto max-w-5xl px-3 pb-2 -mt-0.5">
            <ul className="flex gap-1.5 overflow-x-auto" data-testid="area-tabs">
              {area.pages.map((pg) => {
                const on = path === pg.to || path.startsWith(pg.to + '/') || (pg.to === '/troubleshoot' && path.startsWith('/session'));
                return <li key={pg.to} className="shrink-0"><Link to={pg.to} aria-current={on ? 'page' : undefined} className={clsx('inline-flex items-center min-h-9 px-3.5 rounded-full text-sm border', on ? 'bg-accent text-accent-ink border-accent font-medium' : 'border-line bg-surface text-muted hover:text-ink')}>{pg.label}</Link></li>;
              })}
            </ul>
          </nav>
        )}
      </header>

      <main id="main" tabIndex={-1} className="flex-1 px-4 py-5 md:px-8 md:py-7 pb-16 outline-none">
        <div id="page" className="mx-auto w-full max-w-5xl">{route(path)}</div>
      </main>
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
