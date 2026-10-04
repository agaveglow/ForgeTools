import { useMemo, useState } from 'react';
import { store, useCollection, useSettings } from '../data/hooks';
import type { ApprenticeEntry } from '../data/types';
import { hoursIn, totalHours, weekDays, weekHours, ymd, parseYmd } from '../lib/progress';
import { formatDate, plural } from '../lib/util';
import { Badge, Button, Card, Checkbox, Chip, CopyButton, Empty, Field, Modal, PageHeader, SectionTitle, Select, TextArea, TextInput, Collapsible } from '../ui/primitives';
import { Bar, Stat } from '../ui/Progress';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';
import { fetchVideoInfo, LEARNING_PROMPTS, parseVideoId, suggestRequirements, watchUrl, whatIDidFor } from '../lib/video';
import { acceptedHours, AP_STATUS, AP_TYPES, AP_WHEN, aptemFields, aptemText, DEFAULT_COMPONENTS, descriptionFor, descriptionOf, DESCRIPTION_MAX, BEFORE_SAVE, filterComponents, hoursFromMinutes, isFutureDate, MAX_MINUTES, minutesOf, parseComponentList, possibleDuplicate, splitMinutes, timeText, toMinutes, typeLabel } from '../lib/aptem';
import type { AptemStatus, AptemType, AptemWhen } from '../lib/aptem';
import { harvardWeb } from '../lib/harvard';

type Ev = { target: { value: string } };
interface Form { date: string; hrs: string; mins: string; aptemType: AptemType; when: AptemWhen; description: string; title: string; component: string; requirementIds: string[]; link: string; reference: string }
const blank = (): Form => ({ date: ymd(new Date()), hrs: '', mins: '', aptemType: 'otj', when: 'paid', description: '', title: '', component: '', requirementIds: [], link: '', reference: '' });

export function weeklySummary(entries: ApprenticeEntry[], now: Date, reqTitle: (id: string) => string | undefined): string {
  const w = weekDays(now);
  const list = entries.filter((e) => e.date >= w[0] && e.date <= w[6]).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return `Week of ${w[0]}: no entries recorded.`;
  const lines = [`Week of ${w[0]}`, `Off-the-job hours: ${hoursIn(entries, w[0], w[6])}  (all logged hours: ${hoursIn(entries, w[0], w[6], false)})`, ''];
  for (const e of list) {
    lines.push(`${e.date} · ${timeText(minutesOf(e))} · ${typeLabel(e.aptemType ?? (e.offTheJob ? 'otj' : 'other'))}${e.component ? ' · ' + e.component : ''}`);
    const d = descriptionOf(e); if (d) lines.push(`  ${d.replace(/\n+/g, ' ')}`);
    const rt = e.requirementIds.map(reqTitle).filter(Boolean);
    if (rt.length) lines.push(`  Relates to: ${rt.join('; ')}`);
  }
  return lines.join('\n');
}

function Radio({ name, value, checked, onChange, label }: { name: string; value: string; checked: boolean; onChange: () => void; label: string }) {
  const id = `${name}-${value}`;
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 min-h-11 py-1.5 cursor-pointer text-sm">
      <input id={id} type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-0.5 size-5 accent-[var(--c-accent)] shrink-0" />
      <span>{label}</span>
    </label>
  );
}

/** Search-as-you-type picker for the learning plan component, like the one in Aptem. */
function ComponentPicker({ list, value, onChange }: { list: string[]; value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const shown = filterComponents(list, q);
  if (value && !open) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="component-chosen">
        <span className="text-sm font-medium wrap-any border border-accent rounded-md px-3 py-2 bg-surface2">{value}</span>
        <Button size="sm" onClick={() => { setQ(''); setOpen(true); }}>Change</Button>
        <Button size="sm" variant="ghost" onClick={() => onChange('')}>Clear</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <TextInput id="ap-comp" role="combobox" aria-expanded aria-controls="ap-comp-list" aria-label="Which component does this activity apply to?" placeholder="Search…" autoComplete="off" value={q} onChange={(e: Ev) => setQ(e.target.value)} />
      <ul id="ap-comp-list" className="max-h-56 overflow-auto space-y-1.5" aria-label="Components">
        {shown.length === 0 && <li className="text-sm text-muted">Nothing matches. Check the spelling, or add it under “My component list” below.</li>}
        {shown.map((c) => (
          <li key={c}><button type="button" className="w-full text-left min-h-11 px-3 py-2 rounded-md border border-line bg-surface hover:bg-surface2 text-sm" onClick={() => { onChange(c); setOpen(false); setQ(''); }}>{c}</button></li>
        ))}
      </ul>
    </div>
  );
}

/** The saved entry, laid out as Aptem's form, with a copy button for each field. */
function AptemPanel({ e }: { e: ApprenticeEntry }) {
  const fields = aptemFields(e);
  return (
    <div className="space-y-2">
      <ul className="space-y-2" data-testid="aptem-fields">
        {fields.map((x) => (
          <li key={x.label} className="border border-line rounded-md p-2 flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="text-xs text-muted">{x.label}</p><p className="text-sm wrap-any whitespace-pre-wrap">{x.value}</p></div>
            <CopyButton text={x.value} label="Copy" />
          </li>
        ))}
      </ul>
      <CopyButton text={aptemText(fields)} label="Copy everything" size="md" />
    </div>
  );
}

export function ApprenticeshipPage() {
  useTitle('Apprenticeship');
  const entries = useCollection('apprenticeLogs');
  const reqs = useCollection('requirements').filter((r) => r.kind === 'apprenticeship');
  const s = useSettings();
  const components = s.aptemComponents?.length ? s.aptemComponents : DEFAULT_COMPONENTS;
  const now = useMemo(() => new Date(), []);
  const [f, setF] = useState<Form>(blank());
  const [editing, setEditing] = useState<ApprenticeEntry | null>(null);
  const [del, setDel] = useState<ApprenticeEntry | null>(null);
  const [all, setAll] = useState(false);
  const [show, setShow] = useState<'todo' | 'fix' | 'all' | null>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [compText, setCompText] = useState('');
  const composed = descriptionFor(f.description, f.link);
  const fields = { description: f.description, link: f.link };
  const guard = useSaveGuard(fields);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const [vUrl, setVUrl] = useState('');
  const [vTitle, setVTitle] = useState('');
  const [vChannel, setVChannel] = useState('');
  const [vMin, setVMin] = useState('');
  const [vYear, setVYear] = useState('');
  const [vMsg, setVMsg] = useState('');
  const [vBusy, setVBusy] = useState(false);
  const vId = parseVideoId(vUrl);
  const vGuard = useSaveGuard({ vTitle, vChannel });
  const lookUp = async () => {
    setVMsg(''); setVBusy(true);
    try { const v = await fetchVideoInfo(vUrl); setVTitle(v.title); setVChannel(v.channel); setVMsg('Found the title and channel. Check them, then add how long you watched.'); }
    catch (x) { setVMsg(x instanceof Error ? x.message : 'The title could not be looked up.'); }
    setVBusy(false);
  };
  const startFromVideo = () => {
    if (!vId || !vTitle.trim() || !vGuard.canSave) return;
    const mins = Number(vMin);
    const t = mins > 0 ? splitMinutes(mins) : null;
    const link = watchUrl(vId);
    const guess = suggestRequirements(`${vTitle} ${vChannel}`, reqs).map((r) => r.id);
    setEditing(null); setSaved('');
    setF({ ...blank(), hrs: t ? String(t.hours) : '', mins: t ? String(t.minutes) : '', title: `Video: ${vTitle.trim()}`.slice(0, 150), description: whatIDidFor({ title: vTitle.trim(), channel: vChannel.trim() }, mins > 0 ? mins : undefined), requirementIds: guess, link, reference: harvardWeb({ author: vChannel, year: vYear, title: vTitle, url: link, accessed: new Date() }) });
    setErr(''); setVMsg('Entry started below. Add what you learned in your own words, choose the component, then save it.');
    setTimeout(() => { const el = document.getElementById('ap-desc') as HTMLTextAreaElement | null; el?.focus(); el?.setSelectionRange(el.value.length, el.value.length); }, 50);
  };

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  const todoCount = entries.filter((e) => e.aptemStatus === 'to-enter').length;
  const fixCount = entries.filter((e) => e.aptemStatus === 'rejected').length;
  const view = show ?? (fixCount > 0 ? 'fix' : todoCount > 0 ? 'todo' : 'all');
  const pool = view === 'todo' ? sorted.filter((e) => e.aptemStatus === 'to-enter') : view === 'fix' ? sorted.filter((e) => e.aptemStatus === 'rejected') : sorted;
  const shown = all ? pool : pool.slice(0, 15);
  const wk = weekHours(entries, now);
  const tot = totalHours(entries);
  const reqTitle = (id: string) => reqs.find((r) => r.id === id)?.title;
  const today = ymd(now);
  const accepted = acceptedHours(entries);
  const daysLeft = s.apprenticeshipEnd ? Math.ceil((parseYmd(s.apprenticeshipEnd).getTime() - now.getTime()) / 86400000) : null;

  const dup = possibleDuplicate(entries, { date: f.date, component: f.component, minutes: toMinutes(Number(f.hrs), Number(f.mins)) }, editing?.id);
  const save = () => {
    const minutes = toMinutes(Number(f.hrs), Number(f.mins));
    if (!f.description.trim()) { setErr('Describe the activity.'); return; }
    if (!minutes) { setErr('Enter the time spent, in hours and minutes.'); return; }
    if (minutes > MAX_MINUTES) { setErr('Aptem allows at most 12 hours in one entry. Split it into separate entries.'); return; }
    if (!f.date) { setErr('Choose the date of the activity.'); return; }
    if (isFutureDate(f.date, today)) { setErr('The date cannot be in the future.'); return; }
    if (composed.length > DESCRIPTION_MAX) { setErr(`Aptem allows ${DESCRIPTION_MAX} characters. Shorten the description by ${composed.length - DESCRIPTION_MAX}.`); return; }
    if (!f.component) { setErr('Choose the learning plan component. Aptem needs one.'); return; }
    if (f.link.trim() && !/^https:\/\//i.test(f.link.trim())) { setErr('The link must start with https://'); return; }
    if (!guard.canSave) { setErr(guard.blocked ? 'Remove the secret above before saving.' : 'Confirm or redact the sensitive details above.'); return; }
    const first = f.description.trim().split(/\n/)[0].slice(0, 60);
    const data = {
      date: f.date, hours: hoursFromMinutes(minutes), minutes, aptemType: f.aptemType, when: f.when, offTheJob: f.aptemType === 'otj',
      activity: editing ? editing.activity : (f.aptemType === 'otj' ? 'Study' as const : 'Other' as const),
      title: f.title.trim() || first, whatIDid: f.description.trim(), learned: '', reflection: '', requirementIds: f.requirementIds,
      link: f.link.trim() || undefined, component: f.component, aptemStatus: (editing ? editing.aptemStatus : 'to-enter') as AptemStatus | undefined, reference: f.reference.trim() || undefined,
    };
    store.upsert('apprenticeLogs', editing ? { ...editing, ...data } : data);
    setErr(''); setEditing(null); setF(blank()); guard.setConfirmed(false);
    setSaved(editing ? 'Entry updated.' : 'Saved. Open “Copy for Aptem” on the entry below, paste it into Aptem, then set its status to “Submitted”.');
    if (!editing) { setShow('todo'); }
  };
  const edit = (e: ApprenticeEntry) => {
    const t = splitMinutes(minutesOf(e));
    setEditing(e); setSaved('');
    setF({ date: e.date, hrs: String(t.hours), mins: String(t.minutes), aptemType: e.aptemType ?? (e.offTheJob ? 'otj' : 'other'), when: e.when ?? 'paid', description: [e.whatIDid, e.learned, e.reflection].map((x) => (x ?? '').trim()).filter(Boolean).join('\n\n'), title: e.title, component: e.component ?? '', requirementIds: e.requirementIds, link: e.link ?? '', reference: e.reference ?? '' });
    window.scrollTo({ top: 0 });
  };
  const redact = (r: Record<string, string>) => { setF((x) => ({ ...x, description: r.description, link: r.link })); guard.setConfirmed(false); };
  const num = (v: string) => { const n = Number(v); return v === '' || !Number.isFinite(n) || n < 0 ? undefined : n; };
  const digits = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);

  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Apprenticeship" sub="Log an activity the way Aptem asks for it, then copy it across." />

      <section aria-label="Progress" className="grid gap-3 sm:grid-cols-3">
        <Stat label="This week (off-the-job)" value={`${wk} h`} sub={s.otjWeeklyHours ? `Target ${s.otjWeeklyHours} h` : 'No weekly target set'} />
        <Stat label="Total (off-the-job)" value={`${tot} h`} sub={s.otjTotalHours ? `Target ${s.otjTotalHours} h` : 'No total target set'} />
        <Stat label="Accepted by tutor" value={`${accepted} h`} sub="Only accepted entries count as verified" />
      </section>
      {(s.otjWeeklyHours || s.otjTotalHours) && (
        <Card className="p-3 space-y-3">
          {!!s.otjWeeklyHours && <div><div className="flex justify-between text-sm mb-1"><span>This week</span><span className="text-muted">{wk} / {s.otjWeeklyHours} h</span></div><Bar value={wk} max={s.otjWeeklyHours} label="Hours this week against target" /></div>}
          {!!s.otjTotalHours && <div><div className="flex justify-between text-sm mb-1"><span>Overall</span><span className="text-muted">{tot} / {s.otjTotalHours} h</span></div><Bar value={tot} max={s.otjTotalHours} label="Total hours against target" tone="ok" /></div>}
        </Card>
      )}

      <Card className="p-4">
        <form className="space-y-5" noValidate onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); save(); }}>
          <h2 className="font-semibold text-lg">{editing ? 'Edit entry' : 'Activity details'}</h2>

          <fieldset>
            <legend className="text-sm font-medium mb-1">Type of activity</legend>
            {AP_TYPES.map((t) => <Radio key={t.id} name="ap-type" value={t.id} checked={f.aptemType === t.id} onChange={() => set('aptemType', t.id)} label={t.label} />)}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium mb-1">When did this activity take place?</legend>
            {AP_WHEN.map((w) => <Radio key={w.id} name="ap-when" value={w.id} checked={f.when === w.id} onChange={() => set('when', w.id)} label={w.label} />)}
          </fieldset>

          <Field label="Describe the activity" htmlFor="ap-desc" hint={`Say what you did, what you learned and how it applies to your work.${f.link ? ' ' + LEARNING_PROMPTS.join(' ') : ''}`}>
            <TextArea id="ap-desc" rows={5} placeholder="Enter a description of the activity…" value={f.description} onChange={(e: Ev) => set('description', e.target.value)} />
            <p className={`text-xs mt-1 text-right ${composed.length > DESCRIPTION_MAX ? 'text-bad font-medium' : 'text-muted'}`} data-testid="desc-count">Max {DESCRIPTION_MAX} characters: {composed.length} / {DESCRIPTION_MAX}{f.link ? ' (includes the link)' : ''}</p>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date of activity" htmlFor="ap-date"><TextInput id="ap-date" type="date" max={today} value={f.date} onChange={(e: Ev) => set('date', e.target.value)} /></Field>
            <fieldset>
              <legend className="text-sm font-medium mb-1">Time spent <span className="font-normal text-muted">(real time, up to 12 hours)</span></legend>
              <div className="flex gap-3">
                <Field label="Hours" htmlFor="ap-hrs" className="flex-1"><TextInput id="ap-hrs" inputMode="numeric" placeholder="0" value={f.hrs} onChange={(e: Ev) => set('hrs', digits(e.target.value, 2))} /></Field>
                <Field label="Minutes" htmlFor="ap-mins" className="flex-1"><TextInput id="ap-mins" inputMode="numeric" placeholder="0" value={f.mins} onChange={(e: Ev) => set('mins', digits(e.target.value, 2))} /></Field>
              </div>
            </fieldset>
          </div>

          <div>
            <p className="text-sm font-medium mb-1" id="ap-comp-label">Learning plan component</p>
            <ComponentPicker list={components} value={f.component} onChange={(v) => set('component', v)} />
          </div>

          <Collapsible title="Link or evidence (optional)">
            <Field label="Link" htmlFor="ap-link" hint="Added to the end of the description when you copy it, because Aptem has no link box."><TextInput id="ap-link" inputMode="url" placeholder="https://" value={f.link} onChange={(e: Ev) => set('link', e.target.value)} /></Field>
          </Collapsible>
          {reqs.length > 0 && (
            <Collapsible title="Link to my requirements (for my own tracking)" badge={f.requirementIds.length ? <Badge tone="accent">{f.requirementIds.length}</Badge> : undefined}>
              <fieldset className="space-y-1"><legend className="sr-only">Relates to</legend>
                {reqs.map((r) => <Checkbox key={r.id} checked={f.requirementIds.includes(r.id)} onChange={(v) => set('requirementIds', v ? [...f.requirementIds, r.id] : f.requirementIds.filter((x) => x !== r.id))} label={r.title} />)}
              </fieldset>
            </Collapsible>
          )}

          {dup && <p role="status" className="text-sm text-warn" data-testid="dup-warning">An entry for the same date, component and time is already here. Check it isn’t a repeat, as logging it twice could count the hours twice.</p>}
          <Collapsible title="Before you save">
            <ul className="list-disc pl-5 space-y-1 text-sm">{BEFORE_SAVE.map((q) => <li key={q}>{q}</li>)}</ul>
          </Collapsible>
          <SensitivePanel guard={guard} fieldLabels={{ description: 'Describe the activity', link: 'Link' }} onRedactAll={() => redact(guard.redactAll(fields))} onRedactKind={(k) => redact(guard.redactOneKind(fields, k))} />
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <div className="flex gap-2"><Button variant="primary" type="submit" disabled={guard.blocked}>{editing ? 'Save entry' : 'Add entry'}</Button>{editing && <Button onClick={() => { setEditing(null); setF(blank()); setErr(''); }}>Cancel</Button>}</div>
          {saved && <p role="status" className="text-sm text-ok">{saved}</p>}
        </form>
      </Card>
      <PrivacyNote />

      <Collapsible title="Log from a video link (YouTube)">
        <div className="space-y-3">
          <p className="text-xs text-muted">Paste a YouTube link. ForgeTools reads only the public title and channel name, then starts an entry for you. It can’t watch the video, so what you learned is yours to write. Nothing is saved until you press Add entry.</p>
          <Field label="YouTube link" htmlFor="vd-url"><TextInput id="vd-url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={vUrl} onChange={(e: Ev) => { setVUrl(e.target.value); setVMsg(''); }} /></Field>
          {vUrl.trim() && !vId && <p role="alert" className="text-sm text-bad">That does not look like a YouTube video link.</p>}
          <div className="flex gap-2"><Button disabled={!vId || vBusy} onClick={lookUp}>{vBusy ? 'Looking up…' : 'Look up title'}</Button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Video title" htmlFor="vd-title"><TextInput id="vd-title" value={vTitle} onChange={(e: Ev) => setVTitle(e.target.value)} /></Field>
            <Field label="Channel (optional)" htmlFor="vd-ch"><TextInput id="vd-ch" value={vChannel} onChange={(e: Ev) => setVChannel(e.target.value)} /></Field>
          </div>
          <Field label="Year published (optional)" htmlFor="vd-year" hint="For the Harvard reference. Leave blank if you don’t know and it will say n.d. (no date)."><TextInput id="vd-year" inputMode="numeric" value={vYear} onChange={(e: Ev) => setVYear(e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
          <Field label="Minutes you actually spent" htmlFor="vd-min" hint="Include time spent practising or taking notes. Only count real time."><TextInput id="vd-min" inputMode="numeric" value={vMin} onChange={(e: Ev) => setVMin(e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
          {vGuard.findings.length > 0 && <p role="alert" className="text-sm text-bad">The title looks private or secret. Remove it before continuing.</p>}
          {vMsg && <p role="status" className="text-sm">{vMsg}</p>}
          <Button variant="primary" disabled={!vId || !vTitle.trim() || !vGuard.canSave} onClick={startFromVideo}>Start an entry from this video</Button>
        </div>
      </Collapsible>

      <section>
        <SectionTitle action={<CopyButton text={weeklySummary(entries, now, reqTitle)} label="Copy this week’s summary" size="md" />}>Entries · {plural(entries.length, 'entry', 'entries')}</SectionTitle>
        {entries.length === 0 ? <Empty title="No entries yet.">Log your first activity above.</Empty> : (
          <>
            <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Which entries to show">
              <Chip active={view === 'todo'} onClick={() => { setShow('todo'); setAll(false); }}>To enter in Aptem ({todoCount})</Chip>
              <Chip active={view === 'fix'} onClick={() => { setShow('fix'); setAll(false); }}>Needs changes ({fixCount})</Chip>
              <Chip active={view === 'all'} onClick={() => { setShow('all'); setAll(false); }}>All ({entries.length})</Chip>
            </div>
            {pool.length === 0 && <p className="text-sm text-muted">{view === 'all' ? 'No entries.' : 'Nothing here.'}</p>}
            <ul className="space-y-2">
              {shown.map((e) => (
                <li key={e.id}>
                  <Card className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-sm wrap-any">{e.title || typeLabel(e.aptemType)}</span><Badge tone="accent">{timeText(minutesOf(e))}</Badge><Badge>{typeLabel(e.aptemType ?? (e.offTheJob ? 'otj' : 'other'))}</Badge><span className="text-xs text-muted ml-auto">{formatDate(parseYmd(e.date).toISOString())}</span></div>
                    {e.component && <p className="text-xs wrap-any"><span className="text-muted">Component: </span>{e.component}</p>}
                    <p className="text-sm wrap-any whitespace-pre-wrap">{[e.whatIDid, e.learned, e.reflection].map((x) => (x ?? '').trim()).filter(Boolean).join('\n\n')}</p>
                    {e.link && <p className="text-xs wrap-any"><span className="text-muted">Link: </span>{/^https:\/\//i.test(e.link) ? <a href={e.link} target="_blank" rel="noopener noreferrer" className="underline">{e.link}</a> : e.link}</p>}
                    {e.requirementIds.length > 0 && <p className="text-xs text-muted wrap-any">Relates to: {e.requirementIds.map(reqTitle).filter(Boolean).join('; ')}</p>}
                    {e.reference && <div className="border border-line rounded-md p-2 flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs text-muted">Harvard reference</p><p className="text-sm wrap-any">{e.reference}</p></div><CopyButton text={e.reference} label="Copy" /></div>}
                    {e.aptemStatus && (
                      <Field label="Status in Aptem" htmlFor={`st-${e.id}`}>
                        <Select id={`st-${e.id}`} value={e.aptemStatus} onChange={(ev: Ev) => store.upsert('apprenticeLogs', { ...e, aptemStatus: ev.target.value as AptemStatus })}>
                          {AP_STATUS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </Select>
                      </Field>
                    )}
                    <Collapsible title="Copy for Aptem"><AptemPanel e={e} /></Collapsible>
                    <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => edit(e)} aria-label={`Edit entry ${e.title || typeLabel(e.aptemType)}`}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setDel(e)} aria-label={`Delete entry ${e.title || typeLabel(e.aptemType)}`}>Delete</Button></div>
                  </Card>
                </li>
              ))}
            </ul>
            {pool.length > 15 && <div className="mt-2"><Button onClick={() => setAll((a) => !a)}>{all ? 'Show recent only' : `Show all ${pool.length}`}</Button></div>}
          </>
        )}
      </section>

      <Collapsible title="My component list">
        <div className="space-y-2">
          <p className="text-xs text-muted">The learning plan components as they are named in Aptem, one per line. The starting list was copied from your screenshots and may not be complete. Add any that are missing. These are kept on this device only.</p>
          <TextArea aria-label="Component names, one per line" rows={8} value={compText || components.join('\n')} onChange={(e: Ev) => setCompText(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => { const l = parseComponentList(compText || components.join('\n')); store.updateSettings({ aptemComponents: l.length ? l : undefined }); setCompText(''); }}>Save list</Button>
            <Button onClick={() => { store.updateSettings({ aptemComponents: undefined }); setCompText(''); }}>Reset to the starting list</Button>
          </div>
        </div>
      </Collapsible>

      <Collapsible title="Targets and dates">
        <p className="text-xs text-muted mb-2">Enter the figures from your own apprenticeship plan. ForgeTools doesn’t assume any, and your provider or employer is the authority on them.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Weekly off-the-job hours" htmlFor="ap-w"><TextInput id="ap-w" inputMode="decimal" value={s.otjWeeklyHours ?? ''} onChange={(e: Ev) => store.updateSettings({ otjWeeklyHours: num(e.target.value) })} /></Field>
          <Field label="Total off-the-job hours" htmlFor="ap-t"><TextInput id="ap-t" inputMode="decimal" value={s.otjTotalHours ?? ''} onChange={(e: Ev) => store.updateSettings({ otjTotalHours: num(e.target.value) })} /></Field>
          <Field label="Start date" htmlFor="ap-s"><TextInput id="ap-s" type="date" value={s.apprenticeshipStart ?? ''} onChange={(e: Ev) => store.updateSettings({ apprenticeshipStart: e.target.value || undefined })} /></Field>
          <Field label="End date" htmlFor="ap-e"><TextInput id="ap-e" type="date" value={s.apprenticeshipEnd ?? ''} onChange={(e: Ev) => store.updateSettings({ apprenticeshipEnd: e.target.value || undefined })} /></Field>
        </div>
        {daysLeft !== null && <p className="text-xs text-muted mt-2">{daysLeft < 0 ? 'Apprenticeship end date has passed.' : `${daysLeft} days left.`}</p>}
      </Collapsible>

      {del && <Modal title="Delete this entry?" onClose={() => setDel(null)} footer={<><Button onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => { store.remove('apprenticeLogs', del.id); setDel(null); }}>Delete</Button></>}><p className="text-sm wrap-any">{del.title || typeLabel(del.aptemType)}, {timeText(minutesOf(del))} on {del.date}.</p></Modal>}
    </div>
  );
}
