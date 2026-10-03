/** Dashboard widget list and layout rules. Pure, so it can be tested without the page. */
import type { DashboardLayout } from '../data/types';

export type WidgetSize = 1 | 2 | 3;
export interface WidgetDef { id: string; title: string; size: WidgetSize; about: string }

export const WIDGETS: WidgetDef[] = [
  { id: 'quick', title: 'Quick actions', size: 3, about: 'Shortcuts to the most used pages.' },
  { id: 'today', title: 'Today', size: 2, about: 'Daily routine and jobs due today.' },
  { id: 'rings', title: 'Progress rings', size: 1, about: 'Daily, weekly, monthly and quarterly progress at a glance.' },
  { id: 'week', title: 'This week', size: 2, about: 'Days with activity and your weekly, monthly and quarterly checks.' },
  { id: 'activity', title: 'Activity', size: 2, about: 'The last 12 weeks as a calendar heat map.' },
  { id: 'requirements', title: 'Job and apprenticeship requirements', size: 2, about: 'Progress against each requirement.' },
  { id: 'hours', title: 'Off-the-job hours', size: 2, about: 'Hours logged per week as a chart.' },
  { id: 'due', title: 'Due soon', size: 1, about: 'Monthly and quarterly checks not yet done, soonest first.' },
  { id: 'sla', title: 'Response times', size: 1, about: 'Target response and update times by call priority, with a deadline clock.' },
  { id: 'board', title: 'Task board', size: 1, about: 'One-off jobs split by column.' },
  { id: 'recent', title: 'Recent work', size: 2, about: 'Your latest work logs.' },
  { id: 'apprenticeship', title: 'Apprenticeship', size: 1, about: 'Hours this week and in total.' },
  { id: 'attention', title: 'Needs attention', size: 1, about: 'Overdue tasks, follow-ups and failed checks. Hidden when there is nothing.' },
  { id: 'learning', title: 'Learning', size: 1, about: 'Open research items from your logs.' },
  { id: 'troubleshooting', title: 'Open troubleshooting', size: 1, about: 'Sessions you have not finished. Hidden when there are none.' },
  { id: 'guides', title: 'Recent guides', size: 1, about: 'Guides you saved lately.' },
  { id: 'pinned', title: 'Pinned notes', size: 1, about: 'Notes you pinned in the knowledge base.' },
];

export interface ResolvedWidget { id: string; title: string; size: WidgetSize; hidden: boolean; defaultTitle: string }


/** Saved layout plus anything new: unknown ids are dropped, new widgets are appended in default order. */
export function resolveLayout(layout: DashboardLayout | undefined, customs: Array<{ id: string; title: string }> = []): ResolvedWidget[] {
  const defs = [...WIDGETS, ...customs.map((c): WidgetDef => ({ id: c.id, title: c.title, size: 1, about: 'A card you made.' }))];
  const byId = new Map(defs.map((w) => [w.id, w]));
  const order = [...new Set((layout?.order ?? []).filter((id) => byId.has(id)))];
  for (const w of defs) if (!order.includes(w.id)) order.push(w.id);
  const hidden = new Set(layout?.hidden ?? []);
  return order.map((id) => {
    const d = byId.get(id)!;
    const t = layout?.titles?.[id]?.trim();
    const sz = layout?.sizes?.[id];
    return { id, defaultTitle: d.title, title: t || d.title, size: sz === 1 || sz === 2 || sz === 3 ? sz : d.size, hidden: hidden.has(id) };
  });
}

/** Full layout from a resolved list, ready to save. Defaults are not stored. */
export function toLayout(list: ResolvedWidget[]): DashboardLayout {
  const sizes: Record<string, WidgetSize> = {}, titles: Record<string, string> = {};
  const builtin = new Map(WIDGETS.map((w) => [w.id, w]));
  for (const w of list) {
    const d = builtin.get(w.id);
    if (w.size !== (d?.size ?? 1)) sizes[w.id] = w.size;
    if (d && w.title !== d.title) titles[w.id] = w.title;
  }
  return { order: list.map((w) => w.id), hidden: list.filter((w) => w.hidden).map((w) => w.id), sizes, titles };
}

/** Move a widget up or down among the visible ones (hidden ones keep their place). */
export function moveWidget(list: ResolvedWidget[], id: string, dir: -1 | 1): ResolvedWidget[] {
  const vis = list.filter((w) => !w.hidden).map((w) => w.id);
  const i = vis.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= vis.length) return list;
  const a = list.findIndex((w) => w.id === id), b = list.findIndex((w) => w.id === vis[j]);
  const out = list.slice();
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}
