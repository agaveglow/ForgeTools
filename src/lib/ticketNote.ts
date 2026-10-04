/** Builds a closure note and a customer update from a few plain fields. No data leaves the device. */
export interface NoteFields { reported: string; scope: string; checks: string; cause: string; action: string; test: string; followUp: string; escalated: boolean }

export const EMPTY_NOTE: NoteFields = { reported: '', scope: '', checks: '', cause: '', action: '', test: '', followUp: '', escalated: false };

const sentence = (s: string): string => { const t = s.trim().replace(/\s+/g, ' '); return t ? (/[.!?]$/.test(t) ? t : t + '.') : ''; };
const line = (label: string, s: string): string => (s.trim() ? `${label}: ${sentence(s)}` : '');

export function closureNote(f: NoteFields): string {
  return [
    line('Reported', f.reported), line('Scope', f.scope), line('Checks', f.checks),
    line('Cause', f.cause.trim() ? f.cause : ''), line('Action', f.action), line('Test', f.test),
    f.escalated ? 'Escalated: yes.' : '', line('Follow-up', f.followUp),
  ].filter(Boolean).join('\n');
}

export function customerUpdate(f: NoteFields): string {
  const parts = ['Hello,', ''];
  if (f.escalated) {
    parts.push(`I have looked into this${f.reported.trim() ? ` (${f.reported.trim().replace(/[.!?]+$/, '')})` : ''} and passed it to a senior colleague for the next stage.`);
    if (f.checks.trim()) parts.push(`So far I have checked: ${f.checks.trim().replace(/[.!?]+$/, '')}.`);
    if (f.followUp.trim()) parts.push(`Next: ${f.followUp.trim().replace(/[.!?]+$/, '')}.`);
  } else {
    parts.push(`I have looked into this${f.reported.trim() ? ` (${f.reported.trim().replace(/[.!?]+$/, '')})` : ''}.`);
    if (f.cause.trim()) parts.push(`The cause was ${f.cause.trim().replace(/[.!?]+$/, '')}.`);
    if (f.action.trim()) parts.push(`I have ${f.action.trim().replace(/[.!?]+$/, '').replace(/^I have /i, '')}.`);
    if (f.test.trim()) parts.push(`I tested it: ${f.test.trim().replace(/[.!?]+$/, '')}, and it is working.`);
    if (f.followUp.trim()) parts.push(`Next: ${f.followUp.trim().replace(/[.!?]+$/, '')}.`);
  }
  parts.push('', 'If anything else happens, reply to this message.', 'Thank you.');
  return parts.join('\n');
}

export const isEmptyNote = (f: NoteFields): boolean => !(f.reported || f.scope || f.checks || f.cause || f.action || f.test || f.followUp).trim();
