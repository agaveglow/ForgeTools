/** The five areas of the app and the pages inside them. The home screen is the hub. */

export interface AreaPage { to: string; label: string; blurb: string; icon: string }
export interface Area { id: string; to: string; label: string; blurb: string; icon: string; hue: 'accent' | 'ok' | 'info' | 'warn' | 'bad'; pages: AreaPage[] }

export const AREAS: Area[] = [
  { id: 'today', to: '/a/today', label: 'Today', blurb: 'Your jobs, tasks and checks for the day.', icon: 'clock', hue: 'accent', pages: [
    { to: '/today', label: 'Daily jobs', blurb: 'Clock in, watch the inbox and queue', icon: 'clock' },
    { to: '/workflow', label: 'Daily workflow', blurb: 'Start, prioritise, work, close', icon: 'loop' },
    { to: '/tasks', label: 'Tasks', blurb: 'Daily to quarterly and one-off', icon: 'list' },
    { to: '/board', label: 'Task board', blurb: 'To do, doing, blocked, done', icon: 'board' },
    { to: '/checks', label: 'Check guides', blurb: 'How to do and monitor each check', icon: 'check' },
    { to: '/sla', label: 'Response times', blurb: 'Priorities and deadlines', icon: 'timer' },
  ] },
  { id: 'fix', to: '/a/fix', label: 'Fix & guides', blurb: 'Find the steps for a job or a fault.', icon: 'tools', hue: 'warn', pages: [
    { to: '/agent', label: 'Guide agent', blurb: 'Ask how to do something', icon: 'spark' },
    { to: '/troubleshoot', label: 'Troubleshooting', blurb: 'Step-by-step fault finding', icon: 'search' },
    { to: '/procedures', label: 'Procedures', blurb: 'Build, install, reset, onboard', icon: 'list' },
    { to: '/commands', label: 'Commands', blurb: 'What each command does', icon: 'terminal' },
    { to: '/manuals', label: 'Printer guides', blurb: 'Your manuals, page by page', icon: 'book' },
    { to: '/security', label: 'Security checklist', blurb: 'Checks for a device or account', icon: 'shield' },
    { to: '/kb', label: 'Knowledge base', blurb: 'Guides you have saved', icon: 'mark' },
    { to: '/tools', label: 'Toolbox', blurb: 'Print, network, security and desk tools, plus the lab', icon: 'tools' },
  ] },
  { id: 'notes', to: '/a/notes', label: 'Notes', blurb: 'Keep the paper trail.', icon: 'file', hue: 'info', pages: [
    { to: '/live', label: 'Live notes', blurb: 'Notes as you work', icon: 'mic' },
    { to: '/logs', label: 'Work logs', blurb: 'What was done and why', icon: 'file' },
    { to: '/voice', label: 'Voice notes', blurb: 'Speak, then tidy up', icon: 'wave' },
    { to: '/import', label: 'Import documents', blurb: 'Turn a document into a guide', icon: 'upload' },
    { to: '/files', label: 'Files', blurb: 'Everything saved on this device', icon: 'folder' },
  ] },
  { id: 'learn', to: '/a/learn', label: 'Learning', blurb: 'Apprenticeship hours and goals.', icon: 'cap', hue: 'ok', pages: [
    { to: '/apprenticeship', label: 'Apprenticeship', blurb: 'Log hours, from a video too', icon: 'cap' },
    { to: '/library', label: 'Study library', blurb: 'Networking, copiers, Windows', icon: 'book' },
    { to: '/requirements', label: 'Requirements', blurb: 'Your job and course goals', icon: 'target' },
    { to: '/skills', label: 'Skills profile', blurb: 'Skills you can evidence', icon: 'star' },
  ] },
  { id: 'settings', to: '/settings', label: 'Settings', blurb: 'Look, security and your data.', icon: 'sliders', hue: 'info', pages: [
    { to: '/settings', label: 'Settings and data', blurb: 'Look, lock, backups', icon: 'sliders' },
  ] },
];

/** Pages that belong to a page's area even though their path starts differently. */
const ALIAS: Array<[RegExp, string]> = [[/^\/session(\/|$)/, '/troubleshoot']];

export function areaOfPath(path: string): Area | undefined {
  const a = ALIAS.find(([re]) => re.test(path));
  const p = a ? a[1] : path;
  return AREAS.find((ar) => ar.pages.some((pg) => p === pg.to || p.startsWith(pg.to + '/')));
}

/** Where Back goes. Deterministic, so it works even when the page was opened from a link. */
export function parentPath(path: string): string | null {
  if (path === '/') return null;
  const a = ALIAS.find(([re]) => re.test(path));
  if (a) return a[1];
  if (path === '/apps' || path.startsWith('/a/') || path === '/settings') return '/';
  const segs = path.split('/').filter(Boolean);
  if (segs.length > 1) return '/' + segs.slice(0, -1).join('/');
  const area = areaOfPath(path);
  return area ? (area.pages.length > 1 ? area.to : '/') : '/';
}

export const areaById = (id: string): Area | undefined => AREAS.find((a) => a.id === id);
