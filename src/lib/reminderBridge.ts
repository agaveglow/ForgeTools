/**
 * Reaches the native Reminders plugin (phone app only) to schedule and cancel OS notifications, and falls back
 * to the browser Notification API while the app stays open. Nothing here stores or sends reminder text anywhere
 * but the device's own notification tray. Duck-typed against window.Capacitor, so the web build needs no extra package.
 */
import type { Reminder } from '../data/types';
import { nextOccurrence } from './reminders';

export interface RemindersPlugin {
  schedule(o: { id: string; title: string; body: string; at: number; repeatMinutes: number }): Promise<void>;
  cancel(o: { id: string }): Promise<void>;
  permissionStatus(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
}
interface CapGlobal { isNativePlatform?: () => boolean; registerPlugin?: (name: string) => unknown; Plugins?: Record<string, unknown> }

let cached: RemindersPlugin | undefined;
export function nativeReminders(): RemindersPlugin | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { Capacitor?: CapGlobal; __ftReminders?: RemindersPlugin };
  if (w.__ftReminders && window.location.hostname === 'localhost') return w.__ftReminders;
  const cap = w.Capacitor;
  if (!cap?.isNativePlatform?.()) return undefined;
  if (!cached) cached = (cap.registerPlugin ? cap.registerPlugin('Reminders') : cap.Plugins?.Reminders) as RemindersPlugin | undefined;
  return cached;
}

/** True once there is a native scheduler (the installed app), false in any browser including the one on a phone. */
export const isNativeApp = (): boolean => !!nativeReminders();

const REPEAT_MIN: Record<Reminder['repeat'], number> = { none: 0, daily: 1440, weekdays: 1440, weekly: 10080 };

/** Pushes one reminder to the OS scheduler. Weekday-skipping repeats are re-sent by the app each time it opens, since the OS side only knows a plain interval. */
export async function syncOne(r: Reminder, now = new Date()): Promise<void> {
  const plugin = nativeReminders();
  if (!plugin) return;
  const next = r.enabled ? nextOccurrence(r.at, r.repeat, now) : null;
  if (!next) { await plugin.cancel({ id: r.id }); return; }
  await plugin.schedule({ id: r.id, title: r.title, body: r.text ?? '', at: next.getTime(), repeatMinutes: r.repeat === 'weekdays' ? 0 : REPEAT_MIN[r.repeat] });
}

export async function cancelOne(id: string): Promise<void> {
  await nativeReminders()?.cancel({ id });
}

/** Re-sends every enabled reminder to the OS scheduler. Safe to call often (e.g. on every app start), since it only overwrites. */
export async function syncAll(list: Reminder[], now = new Date()): Promise<void> {
  if (!nativeReminders()) return;
  for (const r of list) await syncOne(r, now);
}
