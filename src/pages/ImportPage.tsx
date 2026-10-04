import { useMemo, useState } from 'react';
import { store, useCollection } from '../data/hooks';
import { saveCreatedFile } from '../data/files';
import { guideToText } from '../lib/agent';
import { DocError, docToGuide, extractText } from '../lib/docs';
import { scrubText } from '../lib/scrub';
import type { ScrubResult } from '../lib/scrub';
import { hasVisuals, modelFromGuide } from '../lib/visual';
import { Badge, Button, Card, Checkbox, CopyButton, Field, PageHeader, SectionTitle, TextArea, TextInput } from '../ui/primitives';
import { GuideView, Sources } from '../ui/GuideView';
import { Link } from '../ui/router';
import { mergeScrub, ScrubPanel } from '../ui/ScrubPanel';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { VisualGuide } from '../ui/VisualGuide';
import { PackImport } from '../ui/PackImport';
import { useTitle } from '../ui/hooks';

export function ImportPage() {
  useTitle('Import documents');
  const logs = useCollection('workLogs');
  const kb = useCollection('kbEntries');
  const ctx = useMemo(() => ({ logs, kb }), [logs, kb]);
  const [text, setText] = useState('');
  const [result, setResult] = useState<ScrubResult | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(false);
  const [title, setTitle] = useState('');
  const [checked, setChecked] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState('');
  const fields = { text, title };
  const guard = useSaveGuard(fields);

  const guide = useMemo(() => (made ? docToGuide(text, ctx, title.trim() || undefined) : null), [made, text, ctx, title]);
  const model = useMemo(() => (guide ? modelFromGuide(guide) : null), [guide]);

  const load = (raw: string, append = false) => {
    const r = scrubText(raw);
    setText((t) => (append && t.trim() ? t.trimEnd() + '\n\n' : '') + r.text);
    setResult((old) => mergeScrub(append ? old : null, r));
    setMade(false); setChecked(false); setSavedId(undefined);
  };
  const onFile = async (e: { target: { files: FileList | null; value: string } }) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setErr(''); setBusy(true);
    try { load(await extractText(f), true); } catch (x) { setErr(x instanceof DocError ? x.message : 'That file could not be read.'); }
    setBusy(false);
  };
  const onPaste = (e: { clipboardData: DataTransfer | null; preventDefault(): void }) => {
    const raw = e.clipboardData?.getData('text');
    if (!raw) return;
    e.preventDefault();
    load(raw, true);
  };
  const rescrub = () => { const r = scrubText(text); setText(r.text); setResult((old) => mergeScrub(old, r)); setMade(false); setChecked(false); };
  const addTerms = (terms: string[]) => { const r = scrubText(text, terms); setText(r.text); setResult((old) => mergeScrub(old, r)); setMade(false); setChecked(false); };
  const flash = (t: string) => { setNotice(t); setTimeout(() => setNotice(''), 3500); };
  const make = () => { setMade(true); setSavedId(undefined); const g = docToGuide(text, ctx); setTitle(g.title); };

  const save = async () => {
    if (!guide) return;
    if (!checked) { flash('Tick the box to confirm you have read it.'); return; }
    if (!guard.canSave) { flash(guard.blocked ? 'Remove the secret before saving.' : 'Confirm or redact the sensitive details first.'); return; }
    const body = guideToText(guide);
    const rec = store.upsert('kbEntries', { ...(savedId ? { id: savedId } : {}), title: guide.title, category: guide.kbCategory, tags: guide.tags, body, pinned: false });
    setSavedId(rec.id);
    try { await saveCreatedFile('guides', guide.title, 'md', `# ${guide.title}\n\n${body}\n`); flash('Saved to Knowledge base and Files. The source document was not kept.'); }
    catch { flash('Saved to Knowledge base. The file could not be written.'); }
  };
  const redact = (r: Record<string, string>) => { setText(r.text); setTitle(r.title); guard.setConfirmed(false); };

  return (
    <div className="max-w-3xl pb-10">
      <PageHeader title="Import documents" sub="Turn a document into a guide. Names and numbers are removed first, and the original is never kept." />
      <div className="mb-4"><PackImport /></div>
      <Card className="p-4 space-y-3">
        <div>
          <p className="text-sm font-medium mb-1">1. Add the document</p>
          <label className="inline-flex items-center justify-center min-h-11 px-3.5 rounded-sm border border-line bg-surface hover:bg-surface2 text-sm font-medium cursor-pointer focus-within:outline-2 focus-within:outline-accent">
            Choose a document
            <input type="file" accept=".docx,.pdf,.txt,.md,.markdown,.html,.htm,.csv,.log" className="sr-only" aria-label="Choose a document" onChange={onFile} />
          </label>
          <p className="text-xs text-muted mt-2">Word (.docx), PDF (with a text layer), text, Markdown and web pages are read on this device and nothing is uploaded. Photos aren’t read directly: use your phone’s “copy text from image”, then paste it below. For big manuals use Printer guides instead.</p>
          {busy && <p role="status" className="text-sm mt-1">Reading…</p>}
          {err && <p role="alert" className="text-sm text-bad mt-1">{err}</p>}
        </div>
        <Field label="2. Text (cleaned)" htmlFor="im-text" hint="Pasted text is cleaned as it goes in. You can edit it.">
          <TextArea id="im-text" rows={10} value={text} onChange={(e: { target: { value: string } }) => { setText(e.target.value); setMade(false); setChecked(false); }} onPaste={onPaste} placeholder="The cleaned text appears here, or paste text." />
        </Field>
        <ScrubPanel result={result} onAddTerms={addTerms} onRescrub={rescrub} />
        <SensitivePanel guard={guard} fieldLabels={{ text: 'Text', title: 'Title' }} onRedactAll={() => redact(guard.redactAll(fields))} onRedactKind={(k) => redact(guard.redactOneKind(fields, k))} />
        <Button variant="primary" disabled={!text.trim()} onClick={make}>{made ? 'Rebuild guide' : '3. Make guide'}</Button>
      </Card>
      <div className="mt-2"><PrivacyNote /></div>

      {guide && (
        <div className="mt-4" data-testid="import-guide">
          <SectionTitle>Guide</SectionTitle>
          <Card className="p-4 space-y-3">
            <Field label="Title" htmlFor="im-title"><TextInput id="im-title" value={title} onChange={(e: { target: { value: string } }) => setTitle(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-1.5"><Badge tone="accent">Imported</Badge><Badge>{guide.kbCategory}</Badge></div>
            {model && hasVisuals(model) && <section aria-label="Visual guide"><VisualGuide model={model} /></section>}
            <GuideView guide={guide} />
            <Sources items={[]} />
            <Checkbox checked={checked} onChange={setChecked} label="I have read this guide and it contains no customer names, numbers or other details I should not keep" />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => save()} disabled={!checked || !guard.canSave}>{savedId ? 'Update saved guide' : 'Save guide'}</Button>
              <CopyButton text={guideToText(guide)} label="Copy guide" size="md" />
              {savedId && <Link to={`/kb/${savedId}`} className="inline-flex items-center min-h-11 px-2 text-sm underline">Open in Knowledge base</Link>}
              {notice && <Badge tone={notice.startsWith('Saved') ? 'ok' : 'warn'} className="!whitespace-normal">{notice}</Badge>}
            </div>
            <p className="text-xs text-muted">Only the guide is saved. The original document and the removed details are not stored anywhere.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
