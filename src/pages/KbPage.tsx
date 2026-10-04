import { useEffect, useMemo, useState } from 'react';
import { store, useCollection, useRecord } from '../data/hooks';
import { guideById } from '../content/library';
import { copyFromGuide } from '../lib/guideLibrary';
import { KB_CATEGORIES } from '../data/types';
import type { KbCategory, KbEntry } from '../data/types';
import { parseTags, timeAgo } from '../lib/util';
import { Badge, Button, Card, Chip, CodeBlock, Empty, Field, Modal, PageHeader, SectionTitle, Select, TextArea, TextInput } from '../ui/primitives';
import { files, notifyFilesChanged } from '../data/files';
import { hasVisuals, modelFromText } from '../lib/visual';
import { VisualGuide } from '../ui/VisualGuide';
import { StepPhotos, useEntryImages } from '../ui/StepPhotos';
import { Link, navigate } from '../ui/router';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';

export function KbBody({ text }: { text: string }) {
  const parts = text.split(/```[a-zA-Z]*\n?/);
  return (
    <div className="kb-body">
      {parts.map((p, i) => (i % 2 === 1 ? <CodeBlock key={i} code={p.replace(/\n$/, '')} /> : p.trim() ? <p key={i}>{p.trim()}</p> : null))}
    </div>
  );
}

export function KbList() {
  useTitle('Knowledge base');
  const entries = useCollection('kbEntries');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'All' | KbCategory>('All');
  const [tag, setTag] = useState('');
  const visible = entries;
  const tags = useMemo(() => [...new Set(visible.flatMap((e) => e.tags))].sort(), [visible]);
  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return visible
      .filter((e) => cat === 'All' || e.category === cat)
      .filter((e) => !tag || e.tags.includes(tag))
      .filter((e) => !words.length || words.every((w) => [e.title, e.body, e.tags.join(' '), e.category].join(' ').toLowerCase().includes(w)))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, [visible, q, cat, tag]);
  const recent = visible.filter((e) => e.lastUsedAt).sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')).slice(0, 4);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Knowledge base" sub="Your own notes, procedures and lessons learned." actions={<Link to="/kb/new" className="inline-flex items-center min-h-11 px-3.5 rounded-sm bg-accent text-accent-ink font-medium text-sm">+ New entry</Link>} />
      <TextInput type="search" aria-label="Search knowledge base" placeholder="Search notes…" value={q} onChange={(e: { target: { value: string } }) => setQ(e.target.value)} />
      <div className="flex gap-1.5 overflow-x-auto py-2 -mx-1 px-1" role="group" aria-label="Filter by category">
        <Chip active={cat === 'All'} onClick={() => setCat('All')}>All</Chip>
        {KB_CATEGORIES.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>
      {tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap pb-2" role="group" aria-label="Filter by tag">
          {tags.map((t) => <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? '' : t)}>#{t}</Chip>)}
        </div>
      )}
      {!q && !tag && cat === 'All' && recent.length > 0 && (
        <p className="text-sm text-muted mb-2">Recently used: {recent.map((e, i) => <span key={e.id}>{i > 0 && ', '}<Link to={`/kb/${e.id}`} className="underline">{e.title}</Link></span>)}</p>
      )}
      {rows.length === 0 ? <Empty title="No entries match." /> : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id}>
              <Link to={`/kb/${e.id}`} className="block bg-surface border border-line rounded-md p-3 hover:bg-surface2">
                <span className="flex items-center gap-2 flex-wrap">{e.pinned && <span aria-label="Pinned" title="Pinned">📌</span>}<span className="font-medium wrap-any">{e.title}</span></span>
                <span className="flex flex-wrap gap-1.5 mt-1"><Badge>{e.category}</Badge>{e.tags.map((t) => <Badge key={t} tone="info">#{t}</Badge>)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function KbDetail({ id }: { id: string }) {
  const e = useRecord('kbEntries', id);
  useTitle(e?.title ?? 'Knowledge base');
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => {
    const cur = store.get('kbEntries', id);
    if (cur) {
      store.trackUsage('kb', cur.id, cur.title, `/kb/${cur.id}`);
      store.markKbUsed(cur.id);
    }
  }, [id]);
  if (!e) return <Empty title="Entry not found."><Link to="/kb" className="underline">Back</Link></Empty>;
  const en: KbEntry = e;
  return <KbDetailView en={en} confirmDel={confirmDel} setConfirmDel={setConfirmDel} />;
}

function KbDetailView({ en, confirmDel, setConfirmDel }: { en: KbEntry; confirmDel: boolean; setConfirmDel: (v: boolean) => void }) {
  const model = useMemo(() => modelFromText(en.title, en.body), [en.title, en.body]);
  const imgs = useEntryImages(en);
  const imgMap = useMemo(() => Object.fromEntries(Object.entries(imgs).map(([k, v]) => [Number(k), v.map(({ src, caption }) => ({ src, caption }))])), [imgs]);
  const original = en.basedOn ? guideById(en.basedOn) : undefined;
  const originalPath = original ? `/${original.set === 'procedures' ? 'procedures' : 'library'}/${original.id}` : '';
  const remove = () => {
    (en.images ?? []).forEach((i) => files().remove(i.path).catch(() => undefined));
    store.remove('kbEntries', en.id); notifyFilesChanged();
    navigate(original ? originalPath : '/guides');
  };
  return (
    <div className="max-w-3xl">
      <PageHeader title={en.title} sub={<span className="inline-flex flex-wrap gap-1.5 items-center"><Badge>{en.category}</Badge>{original && <Badge tone="ok">Edited by you</Badge>}{en.tags.map((t) => <Badge key={t} tone="info">#{t}</Badge>)}<span>· {timeAgo(en.updatedAt)}</span></span>} actions={
        <>
          <Button aria-pressed={en.pinned} onClick={() => store.upsert('kbEntries', { ...en, pinned: !en.pinned })}>{en.pinned ? 'Unpin' : 'Pin'}</Button>
          <Button onClick={() => navigate(`/kb/${en.id}/edit`)}>Edit</Button>
          <Button variant="danger" onClick={() => setConfirmDel(true)}>{original ? 'Restore the original' : 'Delete'}</Button>
        </>
      } />
      {original && <Card className="p-3 mb-4 text-sm" data-testid="edited-note">This is your edited copy of a built-in guide. <Link to={originalPath} className="underline">View the original</Link>. Restoring the original removes this copy and its photos.</Card>}
      {hasVisuals(model) && (
        <section className="mb-4" aria-label="Visual guide">
          <SectionTitle>Visual guide</SectionTitle>
          <Card className="p-4"><VisualGuide model={model} images={imgMap} /></Card>
        </section>
      )}
      <SectionTitle>Summary and steps</SectionTitle>
      <Card className="p-4"><KbBody text={en.body} /></Card>
      <section className="mt-4" aria-label="Photos" data-testid="guide-photos">
        <SectionTitle>Photos</SectionTitle>
        <Card className="p-4"><StepPhotos entry={en} stepCount={model.steps.length} images={imgs} /></Card>
      </section>
      {confirmDel && <Modal title={original ? 'Restore the original?' : 'Delete this entry?'} onClose={() => setConfirmDel(false)} footer={<><Button onClick={() => setConfirmDel(false)}>Cancel</Button><Button variant="danger" onClick={remove}>{original ? 'Restore the original' : 'Delete'}</Button></>}><p>{original ? 'Your edited copy and its photos will be removed from this device and the built-in guide will be shown again.' : 'It will be removed from this device.'}</p></Modal>}
    </div>
  );
}

function EditorPhotos({ entry }: { entry: KbEntry }) {
  const imgs = useEntryImages(entry);
  const steps = useMemo(() => modelFromText(entry.title, entry.body).steps.length, [entry.title, entry.body]);
  return <StepPhotos entry={entry} stepCount={steps} images={imgs} />;
}

export function KbEditor({ id, fromGuide }: { id?: string; fromGuide?: string }) {
  const existing = useRecord('kbEntries', id);
  const seed = fromGuide ? guideById(fromGuide) : undefined;
  const base = seed ? copyFromGuide(seed) : undefined;
  useTitle(id ? 'Edit guide' : base ? 'Edit a copy' : 'New guide');
  const [title, setTitle] = useState(existing?.title ?? base?.title ?? '');
  const [category, setCategory] = useState<KbCategory>(existing?.category ?? base?.category ?? 'Procedures');
  const [tags, setTags] = useState((existing?.tags ?? base?.tags ?? []).join(', '));
  const [body, setBody] = useState(existing?.body ?? base?.body ?? '');
  const [loaded, setLoaded] = useState(!id || !!existing);
  useEffect(() => {
    if (!loaded && existing) { setTitle(existing.title); setCategory(existing.category); setTags(existing.tags.join(', ')); setBody(existing.body); setLoaded(true); }
  }, [existing, loaded]);
  const [error, setError] = useState('');
  const fields = { title, tags, body };
  const guard = useSaveGuard(fields);
  const save = () => {
    if (!title.trim() || !body.trim()) { setError('A title and some content are required.'); return; }
    if (!guard.canSave) { setError(guard.blocked ? 'Remove the secret above before saving.' : 'Confirm the sensitive details above, or redact them.'); return; }
    const saved = store.upsert('kbEntries', existing ? { ...existing, title: title.trim(), category, tags: parseTags(tags), body } : { title: title.trim(), category, tags: parseTags(tags), body, pinned: false, demo: false, ...(base ? { basedOn: base.basedOn } : {}) });
    navigate(`/kb/${saved.id}`);
  };
  const redact = (r: Record<string, string>) => { setTitle(r.title); setTags(r.tags); setBody(r.body); guard.setConfirmed(false); };
  return (
    <div className="max-w-3xl pb-20">
      <PageHeader title={id ? 'Edit guide' : base ? 'Edit a copy of this guide' : 'New guide'} sub={base ? 'The built-in guide is not changed. Your edited copy takes its place in the library, and you can restore the original at any time.' : undefined} />
      <form onSubmit={(ev: { preventDefault(): void }) => { ev.preventDefault(); save(); }} className="space-y-3">
        <Card className="p-4 space-y-3">
          <Field label="Title" htmlFor="kb-title"><TextInput id="kb-title" value={title} onChange={(e: { target: { value: string } }) => setTitle(e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category" htmlFor="kb-cat"><Select id="kb-cat" value={category} onChange={(e: { target: { value: string } }) => setCategory(e.target.value as KbCategory)}>{KB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Tags" htmlFor="kb-tags" hint="Comma separated."><TextInput id="kb-tags" value={tags} onChange={(e: { target: { value: string } }) => setTags(e.target.value)} /></Field>
          </div>
          <Field label="Content" htmlFor="kb-body" hint="Put a heading line such as STEPS in capitals, then numbered lines, for a visual guide. Wrap commands in triple backticks for code blocks with a copy button."><TextArea id="kb-body" rows={12} value={body} onChange={(e: { target: { value: string } }) => setBody(e.target.value)} /></Field>
        </Card>
        {existing
          ? <Card className="p-4 space-y-2" data-testid="editor-photos"><SectionTitle>Photos</SectionTitle><EditorPhotos entry={existing} /></Card>
          : <p className="text-sm text-muted">Save the guide first, then add photos or screenshots on its page.</p>}
        <SensitivePanel guard={guard} fieldLabels={{ title: 'Title', tags: 'Tags', body: 'Content' }} onRedactAll={() => redact(guard.redactAll(fields))} onRedactKind={(k) => redact(guard.redactOneKind(fields, k))} />
        <PrivacyNote />
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <div className="flex gap-2 justify-end"><Button onClick={() => navigate(id ? `/kb/${id}` : fromGuide ? `/${seed?.set === 'procedures' ? 'procedures' : 'library'}/${fromGuide}` : '/guides')}>Cancel</Button><Button variant="primary" type="submit" disabled={guard.blocked}>Save guide</Button></div>
      </form>
    </div>
  );
}
