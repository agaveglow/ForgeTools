/** Watch-style home screen: round app bubbles in a staggered (honeycomb) layout, and ring maths. */

export interface GlanceApp { id: string; label: string; to: string; icon: string; hue: 'accent' | 'ok' | 'info' | 'warn' | 'bad' }

export const GLANCE_APPS: GlanceApp[] = [
  { id: 'today', label: 'Daily jobs', to: '/today', icon: 'clock', hue: 'accent' },
  { id: 'checks', label: 'Checks', to: '/checks', icon: 'check', hue: 'ok' },
  { id: 'tasks', label: 'Tasks', to: '/tasks', icon: 'list', hue: 'info' },
  { id: 'live', label: 'Live notes', to: '/live', icon: 'mic', hue: 'bad' },
  { id: 'manuals', label: 'Printer guides', to: '/manuals', icon: 'book', hue: 'warn' },
  { id: 'agent', label: 'Guide agent', to: '/agent', icon: 'spark', hue: 'accent' },
  { id: 'workflow', label: 'Workflow', to: '/workflow', icon: 'loop', hue: 'ok' },
  { id: 'sla', label: 'Response times', to: '/sla', icon: 'timer', hue: 'info' },
  { id: 'fix', label: 'Fix it', to: '/troubleshoot', icon: 'search', hue: 'warn' },
  { id: 'commands', label: 'Commands', to: '/commands', icon: 'terminal', hue: 'accent' },
  { id: 'logs', label: 'Work logs', to: '/logs', icon: 'file', hue: 'info' },
  { id: 'kb', label: 'Knowledge', to: '/kb', icon: 'mark', hue: 'ok' },
  { id: 'security', label: 'Security', to: '/security', icon: 'shield', hue: 'bad' },
  { id: 'settings', label: 'Settings', to: '/settings', icon: 'sliders', hue: 'info' },
];

/** Stroke paths on a 24x24 grid. */
export const GLANCE_ICONS: Record<string, string[]> = {
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  check: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M8 12l3 3 5-6'],
  list: ['M8 6h12M8 12h12M8 18h12', 'M4 6h.01M4 12h.01M4 18h.01'],
  mic: ['M9 3h6a0 0 0 0 1 0 0v8a3 3 0 0 1-6 0V3z', 'M5 11a7 7 0 0 0 14 0M12 18v3'],
  book: ['M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z', 'M5 18a2 2 0 0 1 2-2h12'],
  spark: ['M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'],
  loop: ['M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5', 'M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5'],
  timer: ['M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 9v4l2 2M9 2h6'],
  search: ['M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M16 16l5 5'],
  terminal: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M7 9l3 3-3 3M12 15h5'],
  file: ['M6 3h9l4 4v14H6z', 'M14 3v5h5M9 13h6M9 17h6'],
  mark: ['M6 3h12v18l-6-4-6 4z'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  board: ['M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z'],
  sliders: ['M4 7h10M18 7h2M4 17h2M10 17h10', 'M16 5v4M8 15v4'],
};

/** Splits items into alternating rows (3, 4, 3, 4...) so the bubbles stagger like a watch app screen. */
export function honeycombRows<T>(items: T[], widths: number[] = [3, 4]): T[][] {
  const rows: T[][] = []; let i = 0, r = 0;
  while (i < items.length) { const w = widths[r % widths.length]; rows.push(items.slice(i, i + w)); i += w; r++; }
  return rows;
}

export const ringFraction = (value: number, max: number): number => (max > 0 ? Math.max(0, Math.min(1, value / max)) : 0);
export const ringDash = (radius: number, frac: number): string => { const c = 2 * Math.PI * radius; return `${(c * frac).toFixed(2)} ${c.toFixed(2)}`; };
