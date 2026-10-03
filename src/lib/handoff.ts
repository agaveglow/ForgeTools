import type { WorkLog } from '../data/types';

/** One-shot, in-memory hand-off between screens (e.g. session -> work log draft). Never persisted. */
export interface LogDraft extends Partial<Omit<WorkLog, 'id' | 'createdAt' | 'updatedAt'>> {
  rawNotes?: string;
}
let pending: LogDraft | null = null;
export const setLogDraft = (d: LogDraft) => { pending = d; };
export const takeLogDraft = (): LogDraft | null => { const d = pending; pending = null; return d; };

export function workLogToText(l: WorkLog): string {
  const lines = [
    `${l.ref}${l.ticket ? ' · Ticket ' + l.ticket : ''}`,
    `Date: ${new Date(l.occurredAt).toLocaleString('en-GB')}`,
    l.client ? `Client: ${l.client}` : undefined,
    l.device ? `Device: ${l.device}` : undefined,
    `Category: ${l.category}`,
    '',
    `Problem: ${l.problem}`,
    l.investigation ? `Investigation: ${l.investigation}` : undefined,
    l.actions ? `Actions: ${l.actions}` : undefined,
    l.result ? `Result: ${l.result}` : undefined,
    l.followUp ? `Follow-up: ${l.followUp}` : undefined,
    l.learned ? `Learned: ${l.learned}` : undefined,
  ];
  return lines.filter((x): x is string => typeof x === 'string').join('\n');
}
