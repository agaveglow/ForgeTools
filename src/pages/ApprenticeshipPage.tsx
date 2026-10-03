import { useMemo, useState } from 'react';
import { store, useCollection, useSettings } from '../data/hooks';
import { ACTIVITY_TYPES } from '../data/types';
import type { ActivityType, ApprenticeEntry } from '../data/types';
import { clampHours, hoursIn, totalHours, weekDays, weekHours, ymd, parseYmd } from '../lib/progress';
import { formatDate, plural } from '../lib/util';
import { Badge, Button, Card, Checkbox, CopyButton, Empty, Field, Modal, PageHeader, SectionTitle, Select, TextArea, TextInput, Collapsible } from '../ui/primitives';
import { Bar, Stat } from '../ui/Progress';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';

interface Form { date: string; hours: string; activity: ActivityType; offTheJob: boolean; title: string; whatIDid: string; learned: string; reflection: string; requirementIds: string[] }
const blank = (): Form => ({ date: ymd(new Date()), hours: '1', activity: 'Study', offTheJob: true, title: '', whatIDid: '', learned: '', reflection: '', requirementIds: [] });

export function weeklySummary(entries: ApprenticeEntry[], now: Date, reqTitle: (id: string) => string | undefined): string {
  const w = weekDays(now);
  const list = entries.filter((e) => e.date >= w[0] && e.date <= w[6]).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return `Week of ${w[0]}: no entries recorded.`;
  const lines = [`Week of ${w[0]}`, `Off-the-job hours: ${hoursIn(entries, w[0], w[6])}  (all logged hours: ${hoursIn(entries, w[0], w[6], false)})`, ''];
  for (const e of list) {
    lines.push(`${e.date} · ${e.hours}h · ${e.activity}${e.offTheJob ? '' : ' (not off-the-job)'}${e.title ? ' · ' + e.title : ''}`);
    if (e.whatIDid) lines.push(`  Did: ${e.whatIDid}`);
    if (e.learned) lines.push(`  Learned: ${e.learned}`);
    if (e.reflection) lines.push(`  Reflection: ${e.reflection}`);
    const rt = e.requirementIds.map(reqTitle).filter(Boolean);
    if (rt.length) lines.push(`  Relates to: ${rt.join('; ')}`);
  }
  return lines.join('\n');
}

export function ApprenticeshipPage() {
  useTitle('Apprenticeship');
  const entries = useCollection('apprenticeLogs');
  const reqs = useCollection('requirements').filter((r) => r.kind === 'apprenticeship');
  const s = useSettings();
  const now = useMemo(() => new Date(), []);
  const [f, setF] = useState<Form>(blank());
  const [editing, setEditing] = useState<ApprenticeEntry | null>(null);
  const [del, setDel] = useState<ApprenticeEntry | null>(null);
  const [all, setAll] = useState(false);
  const [err, setErr] = useState('');
  const fields = { title: f.title, whatIDid: f.whatIDid, learned: f.learned, reflection: f.reflection };
  const guard = useSaveGuard(fields);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  const shown = all ? sorted : sorted.slice(0, 15);
  const wk = weekHours(entries, now);
  const tot = totalHours(entries);
  const reqTitle = (id: string) => reqs.find((r) => r.id === id)?.title;
  const daysLeft = s.apprenticeshipEnd ? Math.ceil((parseYmd(s.apprenticeshipEnd).getTime() - now.getTime()) / 86400000) : null;

  const save = () => {
    const hours = clampHours(Number(f.hours));
    if (!hours) { setErr('Enter the hours, in quarter-hour steps (for example 1.5).'); return; }
    if (!f.title.trim() && !f.whatIDid.trim()) { setErr('Add a short title or say what you did.'); return; }
    if (!guard.canSave) { setErr(guard.blocked ? 'Remove the secret above before saving.' : 'Confirm or redact the sensitive details above.'); return; }
    const data = { date: f.date, hours, activity: f.activity, offTheJob: f.offTheJob, title: f.title.trim(), whatIDid: f.whatIDid.trim(), learned: f.learned.trim(), reflection: f.reflection.trim(), requirementIds: f.requirementIds };
    store.upsert('apprenticeLogs', editing ? { ...editing, ...data } : data);
    setErr(''); setEditing(null); setF(blank()); guard.setConfirmed(false);
  };
  const edit = (e: ApprenticeEntry) => { setEditing(e); setF({ date: e.date, hours: String(e.hours), activity: e.activity, offTheJob: e.offTheJob, title: e.title, whatIDid: e.whatIDid, learned: e.learned, reflection: e.reflection, requirementIds: e.requirementIds }); window.scrollTo({ top: 0 }); };
  const redact = (r: Record<string, string>) => { setF((x) => ({ ...x, title: r.title, whatIDid: r.whatIDid, learned: r.learned, reflection: r.reflection })); guard.setConfirmed(false); };
  const num = (v: string) => { const n = Number(v); return v === '' || !Number.isFinite(n) || n < 0 ? undefined : n; };

  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Apprenticeship" sub="Log study, training and practical work, and track your off-the-job hours." />

      <section aria-label="Progress" className="grid gap-3 sm:grid-cols-3">
        <Stat label="This week (off-the-job)" value={`${wk} h`} sub={s.otjWeeklyHours ? `Target ${s.otjWeeklyHours} h` : 'No weekly target set'} />
        <Stat label="Total (off-the-job)" value={`${tot} h`} sub={s.otjTotalHours ? `Target ${s.otjTotalHours} h` : 'No total target set'} />
        <Stat label="Time left" value={daysLeft === null ? '–' : daysLeft < 0 ? 'Ended' : `${daysLeft} days`} sub={s.apprenticeshipEnd ? `Ends ${s.apprenticeshipEnd}` : 'No end date set'} />
      </section>
      {(s.otjWeeklyHours || s.otjTotalHours) && (
        <Card className="p-3 space-y-3">
          {!!s.otjWeeklyHours && <div><div className="flex justify-between text-sm mb-1"><span>This week</span><span className="text-muted">{wk} / {s.otjWeeklyHours} h</span></div><Bar value={wk} max={s.otjWeeklyHours} label="Hours this week against target" /></div>}
          {!!s.otjTotalHours && <div><div className="flex justify-between text-sm mb-1"><span>Overall</span><span className="text-muted">{tot} / {s.otjTotalHours} h</span></div><Bar value={tot} max={s.otjTotalHours} label="Total hours against target" tone="ok" /></div>}
        </Card>
      )}

      <Collapsible title="Targets and dates">
        <p className="text-xs text-muted mb-2">Enter the figures from your own apprenticeship plan. ForgeTools doesn’t assume any, and your provider or employer is the authority on them.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Weekly off-the-job hours" htmlFor="ap-w"><TextInput id="ap-w" inputMode="decimal" value={s.otjWeeklyHours ?? ''} onChange={(e: { target: { value: string } }) => store.updateSettings({ otjWeeklyHours: num(e.target.value) })} /></Field>
          <Field label="Total off-the-job hours" htmlFor="ap-t"><TextInput id="ap-t" inputMode="decimal" value={s.otjTotalHours ?? ''} onChange={(e: { target: { value: string } }) => store.updateSettings({ otjTotalHours: num(e.target.value) })} /></Field>
          <Field label="Start date" htmlFor="ap-s"><TextInput id="ap-s" type="date" value={s.apprenticeshipStart ?? ''} onChange={(e: { target: { value: string } }) => store.updateSettings({ apprenticeshipStart: e.target.value || undefined })} /></Field>
          <Field label="End date" htmlFor="ap-e"><TextInput id="ap-e" type="date" value={s.apprenticeshipEnd ?? ''} onChange={(e: { target: { value: string } }) => store.updateSettings({ apprenticeshipEnd: e.target.value || undefined })} /></Field>
        </div>
      </Collapsible>

      <Card className="p-4">
        <form className="space-y-3" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); save(); }}>
          <h2 className="font-semibold">{editing ? 'Edit entry' : 'New entry'}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date" htmlFor="ap-date"><TextInput id="ap-date" type="date" value={f.date} onChange={(e: { target: { value: string } }) => set('date', e.target.value)} /></Field>
            <Field label="Hours" htmlFor="ap-hours"><TextInput id="ap-hours" inputMode="decimal" value={f.hours} onChange={(e: { target: { value: string } }) => set('hours', e.target.value)} /></Field>
            <Field label="Type" htmlFor="ap-type"><Select id="ap-type" value={f.activity} onChange={(e: { target: { value: string } }) => set('activity', e.target.value as ActivityType)}>{ACTIVITY_TYPES.map((a) => <option key={a}>{a}</option>)}</Select></Field>
          </div>
          <Checkbox checked={f.offTheJob} onChange={(v) => set('offTheJob', v)} label="Counts as off-the-job training" />
          <Field label="Title" htmlFor="ap-title"><TextInput id="ap-title" value={f.title} onChange={(e: { target: { value: string } }) => set('title', e.target.value)} placeholder="e.g. Networking fundamentals module" /></Field>
          <Field label="What I did" htmlFor="ap-did"><TextArea id="ap-did" rows={2} value={f.whatIDid} onChange={(e: { target: { value: string } }) => set('whatIDid', e.target.value)} /></Field>
          <Field label="What I learned" htmlFor="ap-learned"><TextArea id="ap-learned" rows={2} value={f.learned} onChange={(e: { target: { value: string } }) => set('learned', e.target.value)} /></Field>
          <Field label="Reflection (optional)" htmlFor="ap-refl" hint="What went well, what you would do differently."><TextArea id="ap-refl" rows={2} value={f.reflection} onChange={(e: { target: { value: string } }) => set('reflection', e.target.value)} /></Field>
          {reqs.length > 0 && (
            <fieldset className="space-y-1"><legend className="text-sm font-medium">Relates to</legend>
              {reqs.map((r) => <Checkbox key={r.id} checked={f.requirementIds.includes(r.id)} onChange={(v) => set('requirementIds', v ? [...f.requirementIds, r.id] : f.requirementIds.filter((x) => x !== r.id))} label={r.title} />)}
            </fieldset>
          )}
          <SensitivePanel guard={guard} fieldLabels={{ title: 'Title', whatIDid: 'What I did', learned: 'What I learned', reflection: 'Reflection' }} onRedactAll={() => redact(guard.redactAll(fields))} onRedactKind={(k) => redact(guard.redactOneKind(fields, k))} />
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <div className="flex gap-2"><Button variant="primary" type="submit" disabled={guard.blocked}>{editing ? 'Save entry' : 'Add entry'}</Button>{editing && <Button onClick={() => { setEditing(null); setF(blank()); setErr(''); }}>Cancel</Button>}</div>
        </form>
      </Card>
      <PrivacyNote />

      <section>
        <SectionTitle action={<CopyButton text={weeklySummary(entries, now, reqTitle)} label="Copy this week’s summary" size="md" />}>Entries · {plural(entries.length, 'entry', 'entries')}</SectionTitle>
        {entries.length === 0 ? <Empty title="No entries yet.">Log your first study or training session above.</Empty> : (
          <>
            <ul className="space-y-2">
              {shown.map((e) => (
                <li key={e.id}>
                  <Card className="p-3 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-sm wrap-any">{e.title || e.activity}</span><Badge tone="accent">{e.hours} h</Badge><Badge>{e.activity}</Badge>{!e.offTheJob && <Badge tone="warn">Not off-the-job</Badge>}<span className="text-xs text-muted ml-auto">{formatDate(parseYmd(e.date).toISOString())}</span></div>
                    {e.whatIDid && <p className="text-sm wrap-any"><span className="text-muted">Did: </span>{e.whatIDid}</p>}
                    {e.learned && <p className="text-sm wrap-any"><span className="text-muted">Learned: </span>{e.learned}</p>}
                    {e.reflection && <p className="text-sm wrap-any"><span className="text-muted">Reflection: </span>{e.reflection}</p>}
                    {e.requirementIds.length > 0 && <p className="text-xs text-muted wrap-any">Relates to: {e.requirementIds.map(reqTitle).filter(Boolean).join('; ')}</p>}
                    <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => edit(e)} aria-label={`Edit entry ${e.title || e.activity}`}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setDel(e)} aria-label={`Delete entry ${e.title || e.activity}`}>Delete</Button></div>
                  </Card>
                </li>
              ))}
            </ul>
            {sorted.length > 15 && <div className="mt-2"><Button onClick={() => setAll((a) => !a)}>{all ? 'Show recent only' : `Show all ${sorted.length}`}</Button></div>}
          </>
        )}
      </section>
      {del && <Modal title="Delete this entry?" onClose={() => setDel(null)} footer={<><Button onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => { store.remove('apprenticeLogs', del.id); setDel(null); }}>Delete</Button></>}><p className="text-sm wrap-any">{del.title || del.activity}, {del.hours} h on {del.date}.</p></Modal>}
    </div>
  );
}
