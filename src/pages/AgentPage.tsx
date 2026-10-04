import { useEffect, useMemo, useRef, useState } from 'react';
import { store, useCollection } from '../data/hooks';
import { LOG_CATEGORIES } from '../data/types';
import type { LogCategory } from '../data/types';
import { saveCreatedFile } from '../data/files';
import { buildCustomGuide, buildGuide, guideToText, localAgent } from '../lib/agent';
import type { Answer, Guide, TopicAnalysis } from '../lib/agent';
import { safeHref } from '../lib/safeUrl';
import { fetchReadable, searchWeb, webSection } from '../lib/web';
import type { WebResult } from '../lib/web';
import { timeAgo } from '../lib/util';
import { Badge, Button, Card, Checkbox, CopyButton, Empty, Field, PageHeader, SectionTitle, Select, TextArea, TextInput } from '../ui/primitives';
import { GuideView, Sources } from '../ui/GuideView';
import { hasVisuals, modelFromGuide } from '../lib/visual';
import { dictationSupported, startDictation } from '../lib/transcribe';
import type { Dictation } from '../lib/transcribe';
import { speak, speakFailMessage, speechSupported, stopSpeaking } from '../lib/speech';
import { VisualGuide } from '../ui/VisualGuide';
import { Link, navigate } from '../ui/router';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';

interface Msg { id: number; role: 'you' | 'agent'; text?: string; answer?: Answer }

const EXAMPLES = ['How do I clear a stuck print queue?', 'What does sfc /scannow do?', 'Outlook can’t open a shared mailbox', 'Laptop very slow since the update', 'Printer jams from tray 2'];
const FOLLOW_UPS = ['What should I check first?', 'Which commands will I need?', 'What are the risks?', 'What could be the cause?', 'How do I verify it’s fixed?', 'Have I seen anything like this?', 'What should I record?'];
const KIND_LABEL = { command: 'Command guide', problem: 'Troubleshooting guide', howto: 'How-to guide' } as const;

function AnswerView({ a }: { a: Answer }) {
  return (
    <div className="space-y-2 text-sm">
      {a.blocks.map((b, i) => (
        <div key={i}>
          {b.heading && <p className="font-semibold">{b.heading}</p>}
          {b.ordered ? <ol className="list-decimal pl-5 space-y-0.5">{b.lines.map((l, j) => <li key={j} className="wrap-any">{l}</li>)}</ol>
            : b.heading ? <ul className="list-disc pl-5 space-y-0.5">{b.lines.map((l, j) => <li key={j} className="wrap-any">{l}</li>)}</ul>
            : b.lines.map((l, j) => <p key={j} className="wrap-any">{l}</p>)}
        </div>
      ))}
      <Sources items={a.sources} />
    </div>
  );
}

function WebLookup({ initial, onAdd }: { initial: string; onAdd: (url: string, titleHint?: string) => Promise<string | null> }) {
  const [q, setQ] = useState(initial.slice(0, 160));
  const [results, setResults] = useState<WebResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [link, setLink] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const guard = useSaveGuard({ q, link });

  const search = async () => {
    if (!guard.canSave) return;
    setBusy(true); setErr(''); setResults(null);
    try { setResults(await searchWeb(q)); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const add = async (url: string) => {
    setBusy(true); setErr('');
    const e = await onAdd(url);
    if (e) setErr(e); else setAdded((a) => [...a, url]);
    setBusy(false);
  };
  return (
    <Card className="p-4 space-y-3" data-testid="web-lookup">
      <div>
        <h3 className="font-semibold">Look it up online</h3>
        <p className="text-xs text-muted">Needs a connection. Your search words are sent to learn.microsoft.com. Pages you add are saved into the guide with their source and date.</p>
      </div>
      <form className="flex gap-2" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); search(); }}>
        <TextInput aria-label="Search the web" value={q} onChange={(e: { target: { value: string } }) => setQ(e.target.value)} />
        <Button variant="primary" type="submit" disabled={busy || !q.trim() || !guard.canSave}>Search</Button>
      </form>
      <SensitivePanel guard={guard} fieldLabels={{ q: 'Search', link: 'Link' }} onRedactAll={() => setQ(guard.redactAll({ q }).q)} onRedactKind={(k) => setQ(guard.redactOneKind({ q }, k).q)} />
      {busy && <p role="status" className="text-sm text-muted">Working…</p>}
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      {results && (results.length === 0 ? <p className="text-sm text-muted">No results.</p> : (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.url} className="border border-line rounded-sm p-2.5">
              {safeHref(r.url) ? <a href={safeHref(r.url)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline wrap-any">{r.title} ↗</a> : <span className="text-sm font-medium wrap-any">{r.title}</span>}
              {r.description && <p className="text-xs text-muted wrap-any mt-0.5">{r.description}</p>}
              <div className="mt-1.5">{added.includes(r.url) ? <Badge tone="ok">Added to guide</Badge> : <Button size="sm" disabled={busy} onClick={() => add(r.url)}>Add to guide</Button>}</div>
            </li>
          ))}
        </ul>
      ))}
      <form className="flex gap-2" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); if (link.trim()) add(link.trim()); }}>
        <TextInput aria-label="Web address to add" placeholder="Or paste a link to a page…" value={link} onChange={(e: { target: { value: string } }) => setLink(e.target.value)} />
        <Button type="submit" disabled={busy || !link.trim()}>Add page</Button>
      </form>
    </Card>
  );
}


function Builder({ analysis, text, onBuild, onOutline }: { analysis: TopicAnalysis; text: string; onBuild: (g: Guide) => void; onOutline: () => void }) {
  const [goal, setGoal] = useState(text);
  const [area, setArea] = useState<LogCategory>(analysis.category);
  const [admin, setAdmin] = useState(false);
  const [steps, setSteps] = useState('');
  const [verify, setVerify] = useState('');
  const [watch, setWatch] = useState('');
  const guard = useSaveGuard({ goal, steps, verify, watch });
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => { const el = ref.current; if (el) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); el.focus({ preventScroll: true }); } }, []);
  const redact = (r: Record<string, string>) => { setGoal(r.goal); setSteps(r.steps); setVerify(r.verify); setWatch(r.watch); guard.setConfirmed(false); };
  const set = (f: (v: string) => void) => (e: { target: { value: string } }) => f(e.target.value);
  return (
    <section ref={ref} tabIndex={-1} className="mt-4 rounded-md border-2 border-warn bg-warn/10 p-4 space-y-3 outline-none" data-testid="guide-builder" aria-label="Teach the library this topic">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid place-items-center size-9 shrink-0 rounded-full bg-warn text-accent-ink font-bold text-lg">?</span>
        <div>
          <h2 className="font-semibold text-base">I don’t know this one yet. Help me add it.</h2>
          <p className="text-sm">{analysis.unmatched.length ? `Nothing in your library covers: ${analysis.unmatched.join(', ')}.` : 'Nothing in your library covers it closely.'} I won’t guess steps. Fill in what you know below and I’ll build a guide you can keep.</p>
        </div>
      </div>
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium" aria-label="What happens next">
        <li><span className="inline-grid place-items-center size-5 rounded-full bg-warn text-accent-ink mr-1">1</span>Answer the questions</li>
        <li><span className="inline-grid place-items-center size-5 rounded-full bg-surface2 border border-line mr-1">2</span>Build the guide</li>
        <li><span className="inline-grid place-items-center size-5 rounded-full bg-surface2 border border-line mr-1">3</span>Add from the web, then save it</li>
      </ol>
      {analysis.related.length > 0 && (
        <div data-testid="related-items">
          <p className="text-sm font-medium">Related, but not the answer</p>
          <ul className="text-sm space-y-0.5 mt-1">{analysis.related.map((r) => <li key={r.route}><Link to={r.route} className="underline">{r.label}</Link></li>)}</ul>
        </div>
      )}
      <Field label="1. What is the job, in one sentence?" htmlFor="gb-goal"><TextInput id="gb-goal" value={goal} onChange={set(setGoal)} /></Field>
      <Field label="2. Which area is it in?" htmlFor="gb-area"><Select id="gb-area" value={area} onChange={(e: { target: { value: string } }) => setArea(e.target.value as LogCategory)}>{LOG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
      <Checkbox checked={admin} onChange={setAdmin} label="3. It needs administrator rights" />
      <Field label="4. Do you know the steps? Type them here, one per line" htmlFor="gb-steps" hint="Leave blank to start with an outline, then look the steps up online or add them later.">
        <TextArea id="gb-steps" rows={5} value={steps} onChange={set(setSteps)} placeholder={'Open the admin portal\nFind the user\n…'} />
      </Field>
      <Field label="5. How do you know it worked?" htmlFor="gb-verify"><TextInput id="gb-verify" value={verify} onChange={set(setVerify)} /></Field>
      <Field label="6. Anything to watch out for?" htmlFor="gb-watch"><TextInput id="gb-watch" value={watch} onChange={set(setWatch)} /></Field>
      <SensitivePanel guard={guard} fieldLabels={{ goal: 'Job', steps: 'Steps', verify: 'How you know', watch: 'Watch out for' }} onRedactAll={() => redact(guard.redactAll({ goal, steps, verify, watch }))} onRedactKind={(k) => redact(guard.redactOneKind({ goal, steps, verify, watch }, k))} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!goal.trim() || !guard.canSave} onClick={() => onBuild(buildCustomGuide({ goal, area, needsAdmin: admin, steps: steps.split('\n'), verify, watch }))}>Build my guide</Button>
        {analysis.kind === 'problem' && <Button onClick={onOutline}>Show a general troubleshooting outline instead</Button>}
      </div>
    </section>
  );
}

export function AgentPage() {
  useTitle('Guide agent');
  const logs = useCollection('workLogs');
  const kb = useCollection('kbEntries');
  const saved = kb.filter((k) => k.tags.includes('generated')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const ctx = useMemo(() => ({ logs, kb }), [logs, kb]);

  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<TopicAnalysis | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(undefined);
  const [filePath, setFilePath] = useState('');
  const [notice, setNotice] = useState('');
  const nextId = useRef(1);
  const [readAnswers, setReadAnswers] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState('');
  const dict = useRef<Dictation | null>(null);
  const guard = useSaveGuard({ text });

  const generate = async (t = text) => {
    if (!t.trim()) return;
    const a = await localAgent.analyse(t, ctx);
    setAnalysis(a);
    setGuide(a.confidence === 'good' ? await localAgent.guide(a) : null);
    setMsgs([]); setSavedId(undefined); setFilePath('');
  };
  const ask = async (question: string) => {
    if (!analysis || !question.trim()) return;
    const answer = await localAgent.answer(question, analysis, ctx);
    setMsgs((m) => [...m, { id: nextId.current++, role: 'you', text: question }, { id: nextId.current++, role: 'agent', answer }]);
    setQ('');
    if (readAnswers) { const r = speak(answer.blocks.map((b) => [b.heading, ...b.lines].filter(Boolean).join('. ')).join('. ')); if (!r.ok) { setReadAnswers(false); setVoiceMsg(speakFailMessage(r)); } else setVoiceMsg(''); }
    setTimeout(() => document.getElementById('agent-end')?.scrollIntoView({ block: 'nearest' }), 30);
  };
  const listen = () => {
    if (listening) { dict.current?.stop(); return; }
    setVoiceMsg('');
    const d = startDictation({ onFinal: (t) => { ask(t); }, onInterim: () => undefined, onError: (m) => { setVoiceMsg(m); setListening(false); }, onEnd: () => setListening(false) });
    if (d) { dict.current = d; setListening(true); }
  };
  const flash = (t: string) => { setNotice(t); setTimeout(() => setNotice(''), 3500); };
  const save = async () => {
    if (!guide) return;
    if (!guard.canSave) { flash(guard.blocked ? 'Remove the secret before saving.' : 'Confirm or redact the sensitive details first.'); return; }
    const body = 'Generated by the guide agent from your ForgeTools library. Check it fits your situation before relying on it.\n\n' + guideToText(guide);
    const rec = store.upsert('kbEntries', { ...(savedId ? { id: savedId } : {}), title: guide.title, category: guide.kbCategory, tags: guide.tags, body, pinned: false, demo: false });
    setSavedId(rec.id);
    try { setFilePath(await saveCreatedFile('guides', guide.title, 'md', `# ${guide.title}\n\n${body}\n`)); flash('Saved to Knowledge base and Files.'); }
    catch { flash('Saved to Knowledge base. The file could not be written.'); }
  };
  const addWeb = async (url: string): Promise<string | null> => {
    try {
      const page = await fetchReadable(url);
      const section = webSection(page);
      setGuide((g) => (g ? { ...g, sections: [...g.sections.filter((s) => s.title !== section.title), section], sources: [...g.sources, { label: page.title, route: page.url, external: true }] } : g));
      return null;
    } catch (e) { return (e as Error).message; }
  };
  const startSession = () => {
    if (!guide?.workflowId) return;
    const s = store.upsert('sessions', { workflowId: guide.workflowId, title: guide.title.replace(/^Guide: /, ''), ticket: '', device: analysis?.device ?? '', status: 'open', steps: {}, checks: {}, notes: '', treePath: [], demo: false });
    navigate(`/session/${s.id}`);
  };
  const reset = () => { setAnalysis(null); setGuide(null); setMsgs([]); setText(''); setSavedId(undefined); setFilePath(''); guard.setConfirmed(false); };
  const model = useMemo(() => (guide ? modelFromGuide(guide) : { title: '', steps: [], cautions: [] }), [guide]);
  const redact = (r: Record<string, string>) => { setText(r.text); guard.setConfirmed(false); };

  return (
    <div className="max-w-3xl pb-10">
      <PageHeader title="Guide agent" sub="Ask how to do something or describe a problem. Get a guide and keep it." actions={analysis ? <Button onClick={reset}>New question</Button> : undefined} />
      <p className="text-xs text-muted mb-3" role="note">The guide is built on this device from your troubleshooting library, command reference, notes and past logs. It is not a cloud AI and does not diagnose. The optional web lookup below is the only part that uses the internet.</p>

      <Card className="p-4 space-y-3">
        <Field label="What do you need?" htmlFor="ag-text" hint="A how-to, a command, or a problem. Leave out names, passwords and other details you don’t need.">
          <TextArea id="ag-text" rows={analysis ? 2 : 4} value={text} onChange={(e: { target: { value: string } }) => setText(e.target.value)} placeholder="e.g. How do I clear a stuck print queue?" />
        </Field>
        {!analysis && (
          <div className="flex flex-wrap gap-1.5" aria-label="Examples">
            {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => { setText(x); generate(x); }} className="min-h-9 px-3 rounded-sm border border-line bg-surface text-sm hover:bg-surface2 text-left">{x}</button>)}
          </div>
        )}
        <SensitivePanel guard={guard} fieldLabels={{ text: 'Your question' }} onRedactAll={() => redact(guard.redactAll({ text }))} onRedactKind={(k) => redact(guard.redactOneKind({ text }, k))} />
        <Button variant="primary" disabled={!text.trim()} onClick={() => generate()}>{analysis ? 'Generate again' : 'Generate guide'}</Button>
      </Card>
      <div className="mt-2"><PrivacyNote /></div>

      {analysis && !guide && analysis.confidence === 'none' && <Builder key={analysis.text} analysis={analysis} text={analysis.text} onBuild={(g) => { setGuide(g); setSavedId(undefined); setFilePath(''); }} onOutline={() => setGuide(buildGuide(analysis))} />}

      {analysis && guide && (
        <>
          <div className="mt-4">
            <SectionTitle>Guide</SectionTitle>
            <Card className="p-4 space-y-3">
              <div>
                <div className="flex flex-wrap gap-1.5 mb-1"><Badge tone="accent">{KIND_LABEL[guide.kind]}</Badge><Badge>{analysis.category}</Badge>{analysis.device && <Badge>{analysis.device}</Badge>}{analysis.securityIncident && <Badge tone="warn">Possible security incident</Badge>}</div>
                <h2 className="text-lg font-semibold wrap-any">{guide.title}</h2>
              </div>
              {hasVisuals(model) && <section aria-label="Visual guide"><VisualGuide model={model} /><p className="text-xs text-muted mt-2">Save the guide, then open it in the Knowledge base to attach photos or screenshots to steps.</p></section>}
              {guide.sections.some((x) => x.items.length === 1 && x.items[0] === 'Steps still to be added.') && <p role="status" data-testid="steps-missing" className="rounded-sm border-2 border-warn bg-warn/10 p-3 text-sm"><strong>The steps are still empty.</strong> Add pages from “Look it up online” below, or build the guide again with your own steps.</p>}
              <GuideView guide={guide} />
              <Sources items={guide.sources} />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button variant="primary" onClick={() => save()} disabled={!guard.canSave}>{savedId ? 'Update saved guide' : 'Save guide'}</Button>
                <CopyButton text={guideToText(guide)} label="Copy guide" size="md" />
                {guide.workflowId && guide.kind !== 'command' && <Button onClick={startSession}>Start troubleshooting session</Button>}
                {savedId && <Link to={`/kb/${savedId}`} className="inline-flex items-center min-h-11 px-2 text-sm underline">Open in Knowledge base</Link>}
                {filePath && <Link to="/files" className="inline-flex items-center min-h-11 px-2 text-sm underline">See in Files</Link>}
                {notice && <Badge tone={notice.startsWith('Saved') ? 'ok' : 'warn'} className="!whitespace-normal">{notice}</Badge>}
              </div>
            </Card>
          </div>

          <div className="mt-4"><WebLookup key={guide.title} initial={text} onAdd={addWeb} /></div>

          <div className="mt-4">
            <SectionTitle>Ask a follow-up</SectionTitle>
            <div className="flex gap-1.5 flex-wrap mb-2">{FOLLOW_UPS.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="min-h-9 px-3 rounded-sm border border-line bg-surface text-sm hover:bg-surface2">{s}</button>)}</div>
            <ul className="space-y-2" aria-live="polite">
              {msgs.map((m) => (
                <li key={m.id} className={m.role === 'you' ? 'flex justify-end' : ''}>
                  {m.role === 'you' ? <p className="max-w-[85%] rounded-md bg-accent text-accent-ink px-3 py-2 text-sm wrap-any">{m.text}</p>
                    : <Card className="p-3 max-w-full">{m.answer && <AnswerView a={m.answer} />}</Card>}
                </li>
              ))}
            </ul>
            <form className="flex gap-2 mt-2" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); ask(q); }}>
              <TextInput aria-label="Ask a follow-up question" placeholder="Ask a follow-up…" value={q} onChange={(e: { target: { value: string } }) => setQ(e.target.value)} />
              <Button variant="primary" type="submit" disabled={!q.trim()}>Ask</Button>
              {dictationSupported() && <Button onClick={listen} aria-pressed={listening} variant={listening ? 'danger' : 'secondary'} aria-label={listening ? 'Stop listening' : 'Ask by voice'}>{listening ? '■' : '🎤'}</Button>}
            </form>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {speechSupported() && <Checkbox checked={readAnswers} onChange={(v) => { if (!v) stopSpeaking(); setReadAnswers(v); }} label="Read answers aloud (offline voice only)" />}
            </div>
            {voiceMsg && <p role="alert" className="text-sm text-warn mt-1">{voiceMsg}</p>}
            {dictationSupported() && <p className="text-xs text-muted mt-1">The microphone uses your phone or browser’s speech recognition, which may send audio to its vendor. Don’t say names, numbers or passwords.</p>}
            <div id="agent-end" />
          </div>
        </>
      )}

      <div className="mt-8">
        <SectionTitle action={<Link to="/kb" className="text-sm underline inline-flex items-center min-h-9 px-1">Knowledge base</Link>}>Saved guides</SectionTitle>
        {saved.length === 0 ? <Empty title="No saved guides yet.">Generate a guide and save it. It is kept in your Knowledge base, tagged “generated”, and as a file.</Empty> : (
          <ul className="space-y-2">
            {saved.map((k) => (
              <li key={k.id}><Link to={`/kb/${k.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2"><span className="text-sm font-medium wrap-any">{k.title}</span><span className="block text-xs text-muted">{k.category} · {timeAgo(k.updatedAt)}</span></Link></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
