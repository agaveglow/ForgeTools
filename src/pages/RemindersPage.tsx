import { useEffect, useMemo, useState } from 'react';
import { store, useCollection } from '../data/hooks';
import type { Reminder, ReminderRepeat } from '../data/types';
import { REPEAT_LABELS, sortReminders } from '../lib/reminders';
import { cancelOne, isNativeApp, nativeReminders, syncOne } from '../lib/reminderBridge';
import { Badge, Button, Card, Empty, Field, PageHeader, Select, TextArea, TextInput } from '../ui/primitives';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';
import { uid } from '../lib/util';

type Ev = { target: { value: string } };

function CapabilityNotice() {
  const [status, setStatus] = useState<'checking' | 'granted' | 'denied' | 'none'>('checking');
  const native = isNativeApp();
  useEffect(() => {
    if (!native) { setStatus(typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'granted' : 'none'); return; }
    nativeReminders()!.permissionStatus().then((r) => setStatus(r.granted ? 'granted' : 'denied')).catch(() => setStatus('none'));
  }, [native]);
  const ask = async () => {
    if (native) { const r = await nativeReminders()!.requestPermission(); setStatus(r.granted ? 'granted' : 'denied'); }
    else if (typeof Notification !== 'undefined') { const p = await Notification.requestPermission(); setStatus(p === 'granted' ? 'granted' : 'none'); }
  };
  return (
    <Card className="p-3 space-y-1.5 text-sm" data-testid="reminder-capability">
      {native ? (
        <>
          <p><strong>App notifications:</strong> {status === 'granted' ? 'On. Reminders still fire when ForgeTools is closed.' : status === 'denied' ? 'Off. Turn notifications on for ForgeTools in your phone’s settings, or tap below.' : 'Checking…'}</p>
          {status === 'denied' && <Button size="sm" onClick={ask}>Turn on notifications</Button>}
        </>
      ) : (
        <>
          <p><strong>This is the website, not the installed app:</strong> a reminder can only pop up while this tab is open in front of you. Closing the tab, or your phone's browser going to sleep, stops it. Install the app (Settings → Phone app) for reminders that still fire when it is closed.</p>
          {status === 'none' && typeof Notification !== 'undefined' && <Button size="sm" onClick={ask}>Allow this tab to show a notification</Button>}
        </>
      )}
      <p className="text-xs text-muted">Reminder text shows in your notification tray and (on the phone app) can appear on the lock screen as a generic "Reminder" until unlocked. Keep it free of customer names, numbers and other details, same as everywhere else.</p>
    </Card>
  );
}

function ReminderForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [at, setAt] = useState('');
  const [repeat, setRepeat] = useState<ReminderRepeat>('none');
  const guard = useSaveGuard({ title, text });
  const canSave = title.trim() && at && guard.canSave;
  const save = async () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    const r: Reminder = { id: uid(), createdAt: now, updatedAt: now, title: title.trim().slice(0, 60), text: text.trim().slice(0, 300) || undefined, at: new Date(at).toISOString(), repeat, enabled: true };
    store.upsert('reminders', r);
    await syncOne(r);
    onDone();
  };
  return (
    <Card className="p-3 space-y-3" data-testid="reminder-form">
      <Field label="Title" htmlFor="rem-title"><TextInput id="rem-title" value={title} maxLength={60} onChange={(e: Ev) => setTitle(e.target.value)} placeholder="e.g. Check the shared mailbox" /></Field>
      <Field label="Note (optional)" htmlFor="rem-text"><TextArea id="rem-text" value={text} maxLength={300} onChange={(e: Ev) => setText(e.target.value)} rows={2} /></Field>
      <div className="flex flex-wrap gap-3">
        <Field label="Date and time" htmlFor="rem-at"><input id="rem-at" type="datetime-local" value={at} onChange={(e: Ev) => setAt(e.target.value)} className="bg-surface text-ink border border-line rounded-sm px-3 py-2 text-[16px] md:text-sm min-h-11" /></Field>
        <Field label="Repeat" htmlFor="rem-repeat"><Select id="rem-repeat" value={repeat} onChange={(e: Ev) => setRepeat(e.target.value as ReminderRepeat)}>{Object.entries(REPEAT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      </div>
      <SensitivePanel guard={guard} fieldLabels={{ title: 'Title', text: 'Note' }} onRedactAll={() => { const r = guard.redactAll({ title, text }); setTitle(r.title); setText(r.text); }} onRedactKind={(k) => { const r = guard.redactOneKind({ title, text }, k); setTitle(r.title); setText(r.text); }} />
      <PrivacyNote />
      <div className="flex gap-2"><Button variant="primary" disabled={!canSave} onClick={save}>Add reminder</Button><Button variant="ghost" onClick={onDone}>Cancel</Button></div>
    </Card>
  );
}

function ReminderRow({ r, now }: { r: Reminder; now: Date }) {
  const toggle = async () => { const next = { ...r, enabled: !r.enabled }; store.upsert('reminders', next); await syncOne(next, now); };
  const del = async () => { if (!window.confirm(`Delete "${r.title}"?`)) return; await cancelOne(r.id); store.remove('reminders', r.id); };
  const past = r.repeat === 'none' && new Date(r.at).getTime() < now.getTime();
  return (
    <li className="rounded-md border border-line p-3 space-y-1" data-testid="reminder-row">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="font-medium wrap-any">{r.title}</p>{r.text && <p className="text-sm text-muted wrap-any">{r.text}</p>}</div>
        {!r.enabled && <Badge>Off</Badge>}{r.enabled && past && <Badge tone="neutral">Passed</Badge>}
      </div>
      <p className="text-xs text-muted">{new Date(r.at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {REPEAT_LABELS[r.repeat]}</p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button size="sm" aria-label={`${r.enabled ? 'Turn off' : 'Turn on'} ${r.title}`} onClick={toggle}>{r.enabled ? 'Turn off' : 'Turn on'}</Button>
        <Button size="sm" variant="danger" aria-label={`Delete ${r.title}`} onClick={del}>Delete</Button>
      </div>
    </li>
  );
}

export function RemindersPage() {
  useTitle('Reminders');
  const list = useCollection('reminders');
  const [adding, setAdding] = useState(false);
  const [now] = useState(() => new Date());
  const sorted = useMemo(() => sortReminders(list, now), [list, now]);
  return (
    <div className="max-w-2xl pb-10 space-y-4" data-testid="reminders">
      <PageHeader title="Reminders" sub="Local reminders only: nothing is sent anywhere, and there is no account to sign in to." actions={!adding && <Button variant="primary" onClick={() => setAdding(true)}>Add reminder</Button>} />
      <CapabilityNotice />
      {adding && <ReminderForm onDone={() => setAdding(false)} />}
      {sorted.length === 0 ? <Empty title="No reminders yet.">Add one above — a one-off, or a daily, weekday or weekly repeat.</Empty> : (
        <ul className="space-y-2" data-testid="reminder-list">{sorted.map((r) => <ReminderRow key={r.id} r={r} now={now} />)}</ul>
      )}
    </div>
  );
}
