import { useEffect, useMemo, useRef, useState } from 'react';
import { store, useCollection } from '../data/hooks';
import { saveCreatedFile } from '../data/files';
import { guideToText } from '../lib/agent';
import { setLogDraft } from '../lib/handoff';
import { joinClauses, structureNotes } from '../lib/notes';
import { dictationSupported, startDictation } from '../lib/transcribe';
import type { Dictation } from '../lib/transcribe';
import { buildWalkthrough, walkthroughToGuide } from '../lib/walkthrough';
import { scrubText } from '../lib/scrub';
import { NOTE_TAG_LABEL } from '../data/types';
import type { JobNote, JobNoteLine, NoteTag } from '../data/types';
import { hasVisuals, modelFromGuide } from '../lib/visual';
import { Badge, Button, Card, Chip, CopyButton, Empty, Field, Modal, PageHeader, SectionTitle, TextInput } from '../ui/primitives';
import { VisualGuide } from '../ui/VisualGuide';
import { navigate } from '../ui/router';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';
import { timeAgo } from '../lib/util';

const TAGS = Object.keys(NOTE_TAG_LABEL) as NoteTag[];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const lineText = (l: JobNoteLine) => (l.tag === 'note' ? l.text : `${NOTE_TAG_LABEL[l.tag]}: ${l.text}`);
export const noteToText = (n: JobNote): string => [`${n.title}`, `Started ${new Date(n.startedAt).toLocaleString('en-GB')}`, '', ...n.lines.map((l) => `${hhmm(l.at)}  ${lineText(l)}`)].join('\n');
const uid = () => Math.random().toString(36).slice(2, 10);

/** Live notes: a timestamped trail for one job, typed or dictated as you work, with a guide that builds itself. */
export function LivePage() {
  useTitle('Live notes');
  const notes = useCollection('jobNotes');
  const logs = useCollection('workLogs');
  const kb = useCollection('kbEntries');
  const ctx = useMemo(() => ({ logs, kb }), [logs, kb]);
  const open = notes.filter((n) => n.status === 'open').sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const [pick, setPick] = useState<string | undefined>(undefined);
  const note = notes.find((n) => n.id === pick) ?? open[0];
  const closed = notes.filter((n) => n.status === 'closed' && n.id !== note?.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [tag, setTag] = useState<NoteTag>('note');
  const [removed, setRemoved] = useState(0);
  const [interim, setInterim] = useState('');
  const [dictating, setDictating] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [del, setDel] = useState<JobNote | null>(null);
  const dict = useRef<Dictation | null>(null);
  const canDictate = useMemo(() => dictationSupported(), []);
  const noteRef = useRef<JobNote | undefined>(note);
  noteRef.current = note;
  const guard = useSaveGuard({ title });
  useEffect(() => () => dict.current?.stop(), []);

  const start = () => {
    if (!guard.canSave) return;
    const now = new Date().toISOString();
    const rec = store.upsert('jobNotes', { title: title.trim() || 'Job note ' + new Date().toLocaleDateString('en-GB'), status: 'open', startedAt: now, lines: [] });
    setPick(rec.id); setTitle(''); guard.setConfirmed(false);
  };

  const addLine = (raw: string, t: NoteTag = tag) => {
    const n = noteRef.current;
    if (!n || !raw.trim()) return;
    const r = scrubText(raw.trim());
    if (!r.text.trim()) return;
    setRemoved((x) => x + r.items.length);
    const line: JobNoteLine = { id: uid(), at: new Date().toISOString(), text: r.text.trim(), tag: t };
    store.upsert('jobNotes', { ...n, lines: [...n.lines, line] });
  };
  const submit = () => { addLine(text); setText(''); };

  const toggleDictation = () => {
    if (dictating) { dict.current?.stop(); return; }
    setErr('');
    const d = startDictation({
      onFinal: (t) => addLine(t),
      onInterim: setInterim,
      onError: (m) => { setErr(m); setDictating(false); },
      onEnd: () => { setDictating(false); setInterim(''); },
    });
    if (d) { dict.current = d; setDictating(true); }
  };

  const linesText = note ? note.lines.map(lineText).join('\n') : '';
  const wt = useMemo(() => buildWalkthrough(linesText), [linesText]);
  const guide = useMemo(() => (note && note.lines.length ? walkthroughToGuide(wt, ctx, note.title) : null), [note, wt, ctx]);
  const vmodel = useMemo(() => (guide ? modelFromGuide(guide) : { title: '', steps: [], cautions: [] }), [guide]);

  const finish = () => { if (note) store.upsert('jobNotes', { ...note, status: 'closed', endedAt: new Date().toISOString() }); };
  const reopen = (n: JobNote) => { store.upsert('jobNotes', { ...n, status: 'open', endedAt: undefined }); setPick(n.id); };
  const removeLine = (id: string) => { if (note) store.upsert('jobNotes', { ...note, lines: note.lines.filter((l) => l.id !== id) }); };
  const saveGuide = async () => {
    if (!guide || !note) return;
    const body = guideToText(guide);
    const rec = store.upsert('kbEntries', { title: guide.title, category: guide.kbCategory, tags: [...guide.tags, 'live-note'], body, pinned: false, demo: false });
    try { await saveCreatedFile('guides', guide.title, 'md', `# ${guide.title}\n\n${body}\n`); setMsg('Guide saved to the Knowledge base and Files.'); }
    catch { setMsg('Guide saved to the Knowledge base. The file could not be written.'); }
    setTimeout(() => setMsg(''), 4000);
    return rec;
  };
  const toLog = () => {
    const n = structureNotes(linesText);
    setLogDraft({ problem: joinClauses(n.problem), investigation: joinClauses(n.investigation), actions: joinClauses(n.actions), result: joinClauses(n.result), followUp: joinClauses(n.followUp), category: n.category, device: n.deviceGuess ?? '', skills: [] });
    navigate('/logs/new');
  };

  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Live notes" sub="A timestamped trail for the job you are on. Type or dictate as you go." />
      <p className="text-xs text-muted" role="note">Each line is cleaned of names, numbers and secrets as you add it, before it is stored. Notes stay on this device, and are encrypted if you turned encryption on.</p>

      {!note ? (
        <Card className="p-4 space-y-3">
          <form className="space-y-3" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); start(); }}>
            <Field label="Job label (optional)" htmlFor="ln-title" hint="Something neutral like “Scan to email fault”. Never a customer name."><TextInput id="ln-title" value={title} onChange={(e: { target: { value: string } }) => setTitle(e.target.value)} /></Field>
            <SensitivePanel guard={guard} fieldLabels={{ title: 'Label' }} onRedactAll={() => { setTitle(guard.redactAll({ title }).title); guard.setConfirmed(false); }} onRedactKind={(k) => { setTitle(guard.redactOneKind({ title }, k).title); guard.setConfirmed(false); }} />
            <Button type="submit" variant="primary" disabled={!guard.canSave}>Start a live note</Button>
          </form>
        </Card>
      ) : (
        <>
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0"><h2 className="font-semibold wrap-any">{note.title}</h2><p className="text-xs text-muted">{note.status === 'open' ? 'Open' : 'Finished'} · started {hhmm(note.startedAt)} · {note.lines.length} {note.lines.length === 1 ? 'line' : 'lines'}</p></div>
              {note.status === 'open' && <Button size="sm" onClick={finish}>Finish note</Button>}
            </div>
            {note.status === 'open' && (
              <>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kind of note">{TAGS.map((t) => <Chip key={t} active={tag === t} onClick={() => setTag(t)}>{NOTE_TAG_LABEL[t]}</Chip>)}</div>
                <form className="flex gap-2" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); submit(); }}>
                  <TextInput aria-label="Add a line" placeholder="What just happened?" value={text} onChange={(e: { target: { value: string } }) => setText(e.target.value)} autoFocus />
                  <Button type="submit" variant="primary" disabled={!text.trim()}>Add</Button>
                  {canDictate && <Button onClick={toggleDictation} aria-pressed={dictating} variant={dictating ? 'danger' : 'secondary'} aria-label={dictating ? 'Stop dictating' : 'Dictate'}>{dictating ? '■' : '🎙'}</Button>}
                </form>
                {dictating && <p role="status" className="text-sm text-muted">Listening… {interim}</p>}
                {canDictate && <p className="text-xs text-muted">Dictation uses your phone or browser’s speech recognition, which may process audio on the vendor’s servers. Don’t speak passwords or customer details.</p>}
                {err && <p role="alert" className="text-sm text-bad">{err}</p>}
                {removed > 0 && <p role="status" className="text-xs text-warn">{removed} detail{removed === 1 ? '' : 's'} removed from what you entered, so no names or numbers are kept.</p>}
              </>
            )}
            {note.lines.length === 0 ? <Empty title="No lines yet.">Add what you see and do, one line at a time.</Empty> : (
              <ol className="divide-y divide-line" aria-label="Timeline">
                {note.lines.map((l) => (
                  <li key={l.id} className="py-1.5 flex items-start gap-2">
                    <span className="font-mono text-xs text-muted pt-0.5 shrink-0">{hhmm(l.at)}</span>
                    {l.tag !== 'note' && <Badge tone={l.tag === 'caution' ? 'warn' : l.tag === 'fixed' ? 'ok' : 'neutral'}>{NOTE_TAG_LABEL[l.tag]}</Badge>}
                    <span className="text-sm wrap-any flex-1">{l.text}</span>
                    {note.status === 'open' && <Button size="sm" variant="ghost" aria-label={`Remove line at ${hhmm(l.at)}`} onClick={() => removeLine(l.id)}>✕</Button>}
                  </li>
                ))}
              </ol>
            )}
            <div className="flex flex-wrap gap-2">
              <CopyButton text={noteToText(note)} label="Copy trail" size="md" />
              {note.status === 'closed' && <Button onClick={() => reopen(note)}>Reopen</Button>}
              <Button variant="danger" onClick={() => setDel(note)}>Delete note</Button>
            </div>
          </Card>

          <section aria-label="Guide so far">
            <SectionTitle>Guide so far</SectionTitle>
            {!guide || !hasVisuals(vmodel) ? <Empty title="Not enough yet.">Keep adding steps. A diagram and guide appear here once there are two or more.</Empty> : (
              <Card className="p-4 space-y-3">
                <VisualGuide model={vmodel} />
                <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={saveGuide}>Save guide</Button><Button onClick={toLog}>Make a work log</Button></div>
                {msg && <p role="status" className="text-sm text-ok">{msg}</p>}
                <p className="text-xs text-muted">Built from your lines on this device. It only reorganises what you wrote and never adds steps. The saved guide holds the steps, not the timeline.</p>
              </Card>
            )}
          </section>
        </>
      )}

      {note && note.status === 'closed' && <div><Button onClick={() => setPick(undefined)}>Start another note</Button></div>}
      {closed.length > 0 && (
        <section aria-label="Earlier notes"><SectionTitle>Earlier notes</SectionTitle>
          <ul className="space-y-2">{closed.slice(0, 20).map((n) => <li key={n.id}><button type="button" onClick={() => setPick(n.id)} className="w-full text-left bg-surface border border-line rounded-md p-3 hover:bg-surface2"><span className="text-sm font-medium wrap-any">{n.title}</span><span className="block text-xs text-muted">{n.lines.length} lines · {timeAgo(n.updatedAt)}</span></button></li>)}</ul>
        </section>
      )}
      {del && <Modal title="Delete this note?" onClose={() => setDel(null)} footer={<><Button onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => { store.remove('jobNotes', del.id); setDel(null); setPick(undefined); }}>Delete</Button></>}><p className="text-sm wrap-any">{del.title} ({del.lines.length} lines)</p></Modal>}
      <PrivacyNote />
    </div>
  );
}
