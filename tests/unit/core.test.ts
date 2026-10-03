import { describe, expect, test } from 'bun:test';
import { scanText, redactText, hasBlockers } from '../../src/lib/sensitive';
import { structureNotes } from '../../src/lib/notes';
import { evaluateSkills, suggestLevel } from '../../src/lib/skills-eval';
import { createStore } from '../../src/data/store';
import { MemoryAdapter } from '../../src/data/storage';
import type { WorkLog } from '../../src/data/types';

describe('sensitive scanner', () => {
  test('blocks passwords', () => {
    const f = scanText('the password is Hunter2!x');
    expect(hasBlockers(f)).toBe(true);
  });
  test('warns on email and IP', () => {
    const f = scanText('user bob@acmelaw.co.uk on 192.168.1.20');
    expect(f.length).toBeGreaterThanOrEqual(2);
    expect(hasBlockers(f)).toBe(false);
  });
  test('no false positive on benign pin text', () => {
    expect(hasBlockers(scanText('the pin is bent on the connector'))).toBe(false);
  });
  test('redaction removes the value', () => {
    expect(redactText('mail bob@acmelaw.co.uk now')).not.toContain('bob@acmelaw.co.uk');
  });
});

describe('notes structurer', () => {
  test('does not invent a result', () => {
    const n = structureNotes('Printer jammed. Cleaned rollers.');
    expect(n.result).toHaveLength(0);
    expect(n.missing).toContain('result');
  });
  test('bare "tested" is an action not a result', () => {
    const n = structureNotes('tested');
    expect(n.result).toHaveLength(0);
    expect(n.actions).toEqual(['Tested.']);
  });
  test('splits clauses', () => {
    const n = structureNotes('User could not print, checked queue, cleared spooler, printing works now');
    expect(n.investigation.length).toBe(1);
    expect(n.actions.length).toBe(1);
    expect(n.result.length).toBe(1);
  });
  test('possible areas are not claimed as done', () => {
    const n = structureNotes('Outlook shared mailbox will not open. Recreated profile.');
    expect(n.actions.join(' ')).not.toMatch(/permission/i);
  });
});

const log = (over: Partial<WorkLog>): WorkLog => ({
  id: Math.random().toString(), createdAt: '', updatedAt: '', ref: 'x', occurredAt: '2026-01-01T10:00:00Z', client: '', device: '', category: 'Other',
  problem: '', investigation: '', actions: '', result: '', followUp: '', status: 'resolved', skills: [], learned: '', evidence: '', ticket: '', ...over,
});

describe('skills evaluation', () => {
  test('levels from days', () => {
    expect(suggestLevel(0)).toBeNull();
    expect(suggestLevel(1)).toBe('Exposure');
    expect(suggestLevel(3)).toBe('Developing');
    expect(suggestLevel(5)).toBe('Practised');
    expect(suggestLevel(9)).toBe('Confident');
  });
  test('demo logs do not count', () => {
    const r = evaluateSkills([log({ skills: ['networking'], demo: true })], []);
    expect(r.find((x) => x.skillId === 'networking')!.days).toBe(0);
  });
  test('same day counts once', () => {
    const r = evaluateSkills([log({ skills: ['networking'] }), log({ skills: ['networking'] })], []);
    expect(r.find((x) => x.skillId === 'networking')!.days).toBe(1);
  });
  test('Demonstrated warns without evidence', () => {
    const r = evaluateSkills([log({ skills: ['networking'] })], [{ id: 'a', createdAt: '', updatedAt: '', skillId: 'networking', level: 'Demonstrated', note: '' }]);
    expect(r.find((x) => x.skillId === 'networking')!.warning).toBeTruthy();
  });
});

describe('store', () => {
  test('seeds demo, clears demo, exports without demo', () => {
    const s = createStore(new MemoryAdapter());
    expect(s.hasDemo()).toBe(true);
    expect(s.exportAll().data.collections.workLogs.length).toBe(0);
    s.clearDemo();
    expect(s.hasDemo()).toBe(false);
  });
  test('export / import roundtrip', () => {
    const a = createStore(new MemoryAdapter(), { seed: false });
    a.upsert('kbEntries', { title: 't', category: 'Commands', tags: [], body: 'b', pinned: false });
    const file = JSON.parse(JSON.stringify(a.exportAll()));
    const b = createStore(new MemoryAdapter(), { seed: false });
    const r = b.importAll(file, 'merge');
    expect(r.ok).toBe(true);
    expect(b.list('kbEntries').length).toBe(1);
    expect(b.importAll({ app: 'other' }, 'merge').ok).toBe(false);
  });
  test('work log refs increment', () => {
    const s = createStore(new MemoryAdapter(), { seed: false });
    const r1 = s.nextWorkLogRef();
    const r2 = s.nextWorkLogRef();
    expect(r1).not.toBe(r2);
  });
});

describe('redaction is idempotent', () => {
  test('redacted text no longer blocks', () => {
    const r = redactText('Reset it. The password is Summer2024!x');
    expect(hasBlockers(scanText(r))).toBe(false);
    expect(scanText(r)).toHaveLength(0);
  });
  test('all placeholders are clean', () => {
    const r = redactText('mail bob@acmelaw.co.uk from 192.168.1.20 key AKIAABCDEFGHIJKLMNOP');
    expect(scanText(r)).toHaveLength(0);
  });
});

import { analyseTopic, answerQuestion, buildGuide, guideToText } from '../../src/lib/agent';

describe('guide agent', () => {
  const ctx = { logs: [], kb: [] };
  const an = (t: string) => analyseTopic(t, ctx);
  test('problem description matches the printer workflow', () => {
    const a = an('Reception Ricoh IM C3000 jams when printing from tray 2');
    expect(a.kind).toBe('problem');
    expect(a.category).toBe('Printers');
    expect(a.matches[0].workflow.id).toBe('prn-paper-misfeed');
    expect(a.device).toMatch(/ricoh/i);
  });
  test('how-to question gets a how-to guide with no "ask the user" noise', () => {
    const a = an('How do I clear a stuck print queue?');
    expect(a.kind).toBe('howto');
    expect(a.missing).toHaveLength(0);
    expect(buildGuide(a).title).toMatch(/^Guide: /);
  });
  test('command question gets that command', () => {
    const a = an('What does sfc /scannow do?');
    expect(a.kind).toBe('command');
    const g = buildGuide(a);
    expect(g.title).toBe('sfc /scannow');
    expect(g.sections.map((s) => s.title)).toEqual(expect.arrayContaining(['Syntax', 'Example', 'Risks']));
    expect(guideToText(g)).toContain('```');
  });
  test('flags a possible security incident', () => {
    const a = an('Got a suspicious email and clicked the link, odd sign-in alerts now');
    expect(a.securityIncident).toBe(true);
    expect(guideToText(buildGuide(a))).toMatch(/incident/i);
  });
  test('does not ask what the description already says', () => {
    const a = an('Outlook shared mailbox fails since yesterday for one user, error 0x800 shown, tried a restart, works in web');
    expect(a.missing.join(' ')).not.toMatch(/When did it start/);
    expect(a.missing.join(' ')).not.toMatch(/exact error/);
  });
  test('general guide when nothing matches', () => {
    const g = buildGuide(an('Please order a new keyboard for Sam'));
    expect(g.summary).toMatch(/general/i);
    expect(g.workflowId).toBeUndefined();
  });
  test('says it cannot answer off-topic questions', () => {
    const a = an('Printer jams from tray 2');
    const r = answerQuestion('what is the capital of France', a, ctx);
    expect(r.grounded).toBe(false);
    expect(r.sources).toHaveLength(0);
  });
  test('answers carry sources', () => {
    const a = an('Printer jams from tray 2');
    expect(answerQuestion('what should I check first', a, ctx).sources.length).toBeGreaterThan(0);
  });
  test('slow laptop and shared mailbox', () => {
    expect(an('Laptop very slow since the update').matches[0].workflow.id).toBe('win-slow-computer');
    expect(an('Cannot open shared mailbox in Outlook').matches[0].workflow.id).toBe('m365-shared-mailbox');
  });
});
