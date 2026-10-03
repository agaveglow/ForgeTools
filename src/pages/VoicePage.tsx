import { useEffect, useMemo, useRef, useState } from 'react';
import { store, useCollection, useSettings } from '../data/hooks';
import { saveCreatedFile } from '../data/files';
import { guideToText } from '../lib/agent';
import { setLogDraft } from '../lib/handoff';
import { joinClauses, structureNotes } from '../lib/notes';
import { dictationSupported, getTranscribeKey, isAudioFile, isTranscriptFile, parseTranscriptText, startDictation, transcribeAudio } from '../lib/transcribe';
import type { Dictation } from '../lib/transcribe';
import { buildWalkthrough, walkthroughBody, walkthroughToGuide } from '../lib/walkthrough';
import { scrubText } from '../lib/scrub';
import type { ScrubResult } from '../lib/scrub';
import { mergeScrub, ScrubPanel } from '../ui/ScrubPanel';
import { Badge, Button, Card, Checkbox, CopyButton, Field, PageHeader, SectionTitle, TextArea, TextInput } from '../ui/primitives';
import { GuideView, Sources } from '../ui/GuideView';
import { hasVisuals, modelFromGuide } from '../lib/visual';
import { VisualGuide } from '../ui/VisualGuide';
import { Link, navigate } from '../ui/router';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';

export function VoicePage() {
  useTitle('Voice notes');
  const settings = useSettings();
  const logs = useCollection('workLogs');
  const kb = useCollection('kbEntries');
  const ctx = useMemo(() => ({ logs, kb }), [logs, kb]);

  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [dictating, setDictating] = useState(false);
  const [made, setMade] = useState(false);
  const [title, setTitle] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState('');
  const [scrub, setScrub] = useState<ScrubResult | null>(null);
  const [keepTranscript, setKeepTranscript] = useState(false);
  const dict = useRef<Dictation | null>(null);
  const canDictate = useMemo(() => dictationSupported(), []);
  const fields = { transcript, title };
  const guard = useSaveGuard(fields);

  useEffect(() => () => dict.current?.stop(), []);

  const wt = useMemo(() => buildWalkthrough(transcript), [transcript]);
  const guide = useMemo(() => (made ? walkthroughToGuide(wt, ctx, title.trim() || undefined) : null), [made, wt, ctx, title]);

  const vmodel = useMemo(() => (guide ? modelFromGuide(guide) : { title: '', steps: [], cautions: [] }), [guide]);

  const onFiles = async (e: { target: { files: FileList | null; value: string } }) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!list.length) return;
    setErr(''); setInfo(''); setMade(false); setSavedId(undefined);
    const texts: string[] = [];
    for (const f of list) {
      try {
        if (isTranscriptFile(f)) {
          texts.push(parseTranscriptText(f.name, await f.text()));
        } else if (isAudioFile(f)) {
          if (!settings.transcribeUrl) {
            setErr('To turn a recording into text you need a transcription service. Add its address in Settings, or upload a transcript file (.txt, .srt, .vtt) from your voice-memo app, or use Dictate below.');
            continue;
          }
          setBusy(`Transcribing ${f.name}…`);
          texts.push(await transcribeAudio(f, { url: settings.transcribeUrl, model: settings.transcribeModel, key: getTranscribeKey() }));
        } else {
          setErr(`${f.name} is not a recording or transcript I can read. Use audio, .txt, .md, .srt or .vtt.`);
        }
      } catch (ex) { setErr((ex as Error).message); }
    }
    setBusy('');
    if (texts.length) { const r = scrubText(texts.join('\n\n')); setTranscript((t) => [t.trim(), r.text].filter(Boolean).join('\n\n')); setScrub((o) => mergeScrub(o, r)); setInfo('Transcript loaded and cleaned of names and numbers. Check it, then make the walkthrough.'); }
  };

  const toggleDictation = () => {
    if (dictating) { dict.current?.stop(); return; }
    setErr(''); setInfo(''); setMade(false);
    const d = startDictation({
      onFinal: (t) => setTranscript((x) => (x.trim() ? x.trimEnd() + ' ' : '') + t),
      onInterim: setInterim,
      onError: (m) => { setErr(m); setDictating(false); },
      onEnd: () => { setDictating(false); setInterim(''); setTranscript((t) => { const r = scrubText(t); setScrub((o) => mergeScrub(o, r)); return r.text; }); },
    });
    if (d) { dict.current = d; setDictating(true); }
  };

  const make = () => { setMade(true); setSavedId(undefined); setTitle(wt.title); setNotice(''); };
  const flash = (t: string) => { setNotice(t); setTimeout(() => setNotice(''), 3500); };
  const save = async () => {
    if (!guide) return;
    if (!guard.canSave) { flash(guard.blocked ? 'Remove the secret before saving.' : 'Confirm or redact the sensitive details first.'); return; }
    const text = guideToText(guide);
    const body = keepTranscript ? walkthroughBody(text, transcript) : text;
    const rec = store.upsert('kbEntries', { ...(savedId ? { id: savedId } : {}), title: guide.title, category: guide.kbCategory, tags: guide.tags, body, pinned: false, demo: false });
    setSavedId(rec.id);
    try {
      await saveCreatedFile('guides', guide.title, 'md', `# ${guide.title}\n\n${body}\n`);
      if (keepTranscript) await saveCreatedFile('transcripts', guide.title, 'txt', transcript.trim() + '\n');
      flash(keepTranscript ? 'Saved to Knowledge base and Files, with the transcript.' : 'Saved to Knowledge base and Files. The transcript was not kept.');
    } catch { flash('Saved to Knowledge base. The files could not be written.'); }
  };
  const toLog = () => {
    const n = structureNotes(transcript);
    setLogDraft({ problem: joinClauses(n.problem), investigation: joinClauses(n.investigation), actions: joinClauses(n.actions), result: joinClauses(n.result), followUp: joinClauses(n.followUp), category: n.category, device: n.deviceGuess ?? '', skills: [] });
    navigate('/logs/new');
  };
  const redact = (r: Record<string, string>) => { setTranscript(r.transcript); setTitle(r.title); guard.setConfirmed(false); };

  return (
    <div className="max-w-3xl pb-10">
      <PageHeader title="Voice notes" sub="Record or upload, get a step-by-step walkthrough you can keep." />
      <p className="text-xs text-muted mb-3" role="note">Turning speech into text needs a speech service, so there are three routes below. The walkthrough itself is built on this device. It only reorganises what was said and never adds steps.</p>

      <Card className="p-4 space-y-4">
        <div>
          <p className="text-sm font-medium mb-1">1. Add what was said</p>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="inline-flex items-center justify-center min-h-11 px-3.5 rounded-sm border border-line bg-surface hover:bg-surface2 text-sm font-medium cursor-pointer focus-within:outline-2 focus-within:outline-accent">
              Upload recording or transcript
              <input type="file" multiple accept="audio/*,.m4a,.mp3,.wav,.ogg,.opus,.aac,.txt,.md,.srt,.vtt" className="sr-only" aria-label="Upload recording or transcript" onChange={onFiles} />
            </label>
            {canDictate
              ? <Button onClick={toggleDictation} aria-pressed={dictating} variant={dictating ? 'danger' : 'secondary'}>{dictating ? '■ Stop dictating' : '● Dictate'}</Button>
              : <span className="text-xs text-muted">Dictation is not available in this browser.</span>}
          </div>
          <ul className="text-xs text-muted mt-2 space-y-0.5 list-disc pl-4">
            <li><strong>Transcript file</strong> (.txt, .md, .srt, .vtt): read on this device. Most voice-memo apps can export one.</li>
            <li><strong>Audio file</strong>: sent to the transcription service set in <Link to="/settings" className="underline">Settings</Link>{settings.transcribeUrl ? '' : ' (none set yet)'}.</li>
            <li><strong>Dictate</strong>: uses your phone or browser’s speech recognition, which may process audio on the vendor’s servers. Don’t dictate passwords or customer details.</li>
          </ul>
          {busy && <p role="status" className="text-sm mt-2">{busy}</p>}
          {info && <p role="status" className="text-sm text-ok mt-2">{info}</p>}
          {err && <p role="alert" className="text-sm text-bad mt-2">{err}</p>}
        </div>

        <Field label="2. Transcript" htmlFor="vn-transcript" hint="Edit freely: fix mis-heard words and add “first”, “then”, “finally” where the order is unclear.">
          <TextArea id="vn-transcript" rows={9} onPaste={(e: { clipboardData: DataTransfer | null; preventDefault(): void }) => { const raw = e.clipboardData?.getData('text'); if (!raw) return; e.preventDefault(); const r = scrubText(raw); setTranscript((t) => (t.trim() ? t.trimEnd() + '\n\n' : '') + r.text); setScrub((o) => mergeScrub(o, r)); setMade(false); }} value={transcript} onChange={(e: { target: { value: string } }) => { setTranscript(e.target.value); setMade(false); }} placeholder="The transcript appears here. You can also paste or type notes." />
          {interim && <p className="text-xs text-muted mt-1" aria-live="polite">Hearing: {interim}</p>}
        </Field>
        <ScrubPanel result={scrub} onRescrub={() => { const r = scrubText(transcript); setTranscript(r.text); setScrub((o) => mergeScrub(o, r)); setMade(false); }} onAddTerms={(t) => { const r = scrubText(transcript, t); setTranscript(r.text); setScrub((o) => mergeScrub(o, r)); setMade(false); }} />
        <SensitivePanel guard={guard} fieldLabels={{ transcript: 'Transcript', title: 'Title' }} onRedactAll={() => redact(guard.redactAll(fields))} onRedactKind={(k) => redact(guard.redactOneKind(fields, k))} />
        <Button variant="primary" disabled={!transcript.trim()} onClick={make}>{made ? 'Rebuild walkthrough' : '3. Make walkthrough'}</Button>
      </Card>
      <div className="mt-2"><PrivacyNote /></div>

      {made && guide && (
        <div className="mt-4" data-testid="walkthrough">
          <SectionTitle>Walkthrough</SectionTitle>
          <Card className="p-4 space-y-3">
            <Field label="Title" htmlFor="vn-title"><TextInput id="vn-title" value={title} onChange={(e: { target: { value: string } }) => setTitle(e.target.value)} /></Field>
            {wt.warnings.length > 0 && (
              <ul role="status" className="text-sm rounded-sm border border-warn/50 bg-warn/5 p-2 space-y-1">{wt.warnings.map((x) => <li key={x}>{x}</li>)}</ul>
            )}
            <div className="flex flex-wrap gap-1.5"><Badge tone="accent">{wt.steps.length} {wt.steps.length === 1 ? 'step' : 'steps'}</Badge>{wt.commands.length > 0 && <Badge>{wt.commands.length} {wt.commands.length === 1 ? 'command' : 'commands'}</Badge>}{wt.cautions.length > 0 && <Badge tone="warn">{wt.cautions.length} {wt.cautions.length === 1 ? 'caution' : 'cautions'}</Badge>}</div>
            {hasVisuals(vmodel) && <section aria-label="Visual guide"><VisualGuide model={vmodel} /><p className="text-xs text-muted mt-2">Save the guide, then open it in the Knowledge base to attach photos or screenshots to steps.</p></section>}
            <GuideView guide={guide} />
            <Sources items={guide.sources} />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="primary" onClick={() => save()} disabled={!guard.canSave}>{savedId ? 'Update saved guide' : 'Save guide'}</Button>
              <CopyButton text={guideToText(guide)} label="Copy guide" size="md" />
              <Button onClick={toLog}>Start a work log from this</Button>
              {savedId && <Link to={`/kb/${savedId}`} className="inline-flex items-center min-h-11 px-2 text-sm underline">Open in Knowledge base</Link>}
              {notice && <Badge tone={notice.startsWith('Saved') ? 'ok' : 'warn'} className="!whitespace-normal">{notice}</Badge>}
            </div>
            <Checkbox checked={keepTranscript} onChange={setKeepTranscript} label="Also keep the cleaned transcript with the guide (may still contain names the cleaner missed)" />
            <p className="text-xs text-muted">By default only the guide is saved. The audio is never stored.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
