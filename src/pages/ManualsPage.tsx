import { useEffect, useMemo, useRef, useState } from 'react';
import { store, useCollection } from '../data/hooks';
import { saveCreatedFile } from '../data/files';
import { ImageError, prepareImage } from '../lib/media';
import { BRANDS, formatBytes, guessBrand } from '../lib/manualSearch';
import type { PageHit } from '../lib/manualSearch';
import { openPdf } from '../lib/pdfjs';
import type { PdfDoc } from '../lib/pdfjs';
import { addMark, addManual, askPersistent, getBlob, getManual, getPageText, indexManual, listManuals, listMarks, ManualError, putMeta, removeMark, removeManual, searchAll, searchManual } from '../lib/manuals';
import type { ManualMark, ManualMeta } from '../lib/manuals';
import { Badge, Button, Card, Checkbox, Empty, Field, PageHeader, SectionTitle, TextInput } from '../ui/primitives';
import { Link, currentQuery, navigate } from '../ui/router';
import { PrivacyNote, useSaveGuard } from '../ui/SensitivePanel';
import { useTitle } from '../ui/hooks';

type Ev = { target: { value: string } };

/** Starts background text reading for any manual that is not fully indexed. One at a time. */
function useIndexer(manuals: ManualMeta[], reload: () => void) {
  const [progress, setProgress] = useState<{ id: string; done: number; total: number } | null>(null);
  const running = useRef(false);
  const stop = useRef({ stop: false });
  const todo = manuals.find((m) => m.indexed < m.pages);
  useEffect(() => {
    if (!todo || running.current) return;
    running.current = true; stop.current = { stop: false };
    indexManual(todo.id, (done, total) => setProgress({ id: todo.id, done, total }), stop.current)
      .catch(() => undefined)
      .finally(() => { running.current = false; setProgress(null); reload(); });
  }, [todo?.id, todo?.indexed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { stop.current.stop = true; }, []);
  return progress;
}

export function ManualsPage() {
  useTitle('Printer guides');
  const [manuals, setManuals] = useState<ManualMeta[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [brand, setBrand] = useState('Auto');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Array<PageHit & { manual: ManualMeta }> | null>(null);
  const reload = () => { listManuals().then((m) => { setManuals(m); setLoaded(true); }).catch(() => { setLoaded(true); setErr('Saved manuals could not be read on this device.'); }); };
  useEffect(reload, []);
  const progress = useIndexer(manuals, reload);

  const onFiles = async (e: { target: { files: FileList | null; value: string } }) => {
    const fs = Array.from(e.target.files ?? []); e.target.value = '';
    if (!fs.length) return;
    setErr('');
    for (const f of fs) {
      setBusy(`Adding ${f.name}…`);
      try { await addManual(f, brand === 'Auto' ? guessBrand(f.name) : brand); await askPersistent(); } catch (x) { setErr(`${f.name}: ${x instanceof ManualError ? x.message : 'could not be added.'}`); }
    }
    setBusy(''); reload();
  };
  const remove = async (m: ManualMeta) => {
    if (!window.confirm(`Remove “${m.title}” from this device? Your guides are not affected.`)) return;
    await removeManual(m.id); reload();
  };
  const search = async () => { setHits(q.trim() ? await searchAll(q) : null); };
  const groups = useMemo(() => BRANDS.map((b) => ({ b, list: manuals.filter((m) => m.brand === b) })).filter((g) => g.list.length), [manuals]);

  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Printer guides" sub="Official manuals you add yourself. They stay on this device and open as real pages." />
      <p className="text-xs text-muted" role="note">Manuals are kept only in this browser or app, never uploaded and never in the project’s public code. Only add manuals you are entitled to keep. Check the revision matches the model before following any service-manual step.</p>

      <Card className="p-3 space-y-3">
        <SectionTitle>Add a manual</SectionTitle>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Brand" htmlFor="m-brand">
            <select id="m-brand" className="min-h-11 rounded-sm border border-line bg-surface px-2 text-sm" value={brand} onChange={(e: Ev) => setBrand(e.target.value)}>
              <option>Auto</option>{BRANDS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <label className="inline-flex items-center justify-center min-h-11 px-3.5 rounded-sm border border-accent bg-accent text-accent-ink text-sm font-medium cursor-pointer focus-within:outline-2 focus-within:outline-accent">
            Choose PDF files
            <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" aria-label="Choose PDF files" data-testid="manual-file" onChange={onFiles} />
          </label>
        </div>
        {busy && <p role="status" className="text-sm text-muted">{busy}</p>}
        {err && <p role="alert" className="text-sm text-bad wrap-any">{err}</p>}
        <p className="text-xs text-muted">Large manuals are fine. Pages are read from the file as you open them. After adding, the app reads the text in the background so search works.</p>
      </Card>

      {progress && <p role="status" className="text-sm text-muted" data-testid="index-progress">Reading text for search: page {progress.done} of {progress.total}…</p>}

      {manuals.length > 0 && (
        <Card className="p-3 space-y-2">
          <SectionTitle>Search all manuals</SectionTitle>
          <form className="flex gap-2" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); search(); }}>
            <TextInput aria-label="Search all manuals" placeholder="e.g. paper jam, SMB scan, C6000" value={q} onChange={(e: Ev) => setQ(e.target.value)} />
            <Button variant="primary" type="submit">Search</Button>
          </form>
          <p className="text-xs text-muted">Type a fault code or a topic. Don’t type customer details.</p>
          {hits && (hits.length === 0 ? <p className="text-sm text-muted">No pages matched. Manuals still being read will fill in as they finish.</p> : (
            <ul className="space-y-2" data-testid="all-hits">{hits.map((h) => (
              <li key={h.manual.id + h.page}><Link to={`/manuals/${h.manual.id}?p=${h.page}`} className="block border border-line rounded-md p-2 hover:bg-surface2">
                <span className="text-sm font-medium wrap-any">{h.manual.title} · page {h.page}</span>
                <span className="block text-xs text-muted wrap-any">{h.snippet}</span>
              </Link></li>
            ))}</ul>
          ))}
        </Card>
      )}

      {loaded && manuals.length === 0 && <Empty title="No manuals yet.">Add a PDF above. Your Ricoh, Develop, UTAX, Sharp and Epson manuals can all go here.</Empty>}
      {groups.map(({ b, list }) => (
        <section key={b} aria-label={b}>
          <SectionTitle>{b}</SectionTitle>
          <ul className="space-y-2">{list.map((m) => (
            <li key={m.id} className="bg-surface border border-line rounded-md p-3 flex items-start justify-between gap-2">
              <Link to={`/manuals/${m.id}`} className="min-w-0 flex-1">
                <span className="block text-sm font-medium wrap-any">{m.title}</span>
                <span className="block text-xs text-muted">{m.pages} pages · {formatBytes(m.size)} {m.indexed < m.pages ? '· search still preparing' : '· searchable'}</span>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                {m.indexed >= m.pages ? <Badge tone="ok">Ready</Badge> : <Badge tone="warn">Reading</Badge>}
                <Button size="sm" variant="ghost" aria-label={`Remove ${m.title}`} onClick={() => remove(m)}>Remove</Button>
              </div>
            </li>
          ))}</ul>
        </section>
      ))}
    </div>
  );
}

export function ManualReaderPage({ id }: { id: string }) {
  const [meta, setMeta] = useState<ManualMeta | null | undefined>(undefined);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [err, setErr] = useState('');
  const initial = Math.max(1, Number(currentQuery().get('p')) || 1);
  const [page, setPage] = useState(initial);
  const [jump, setJump] = useState(String(initial));
  const [zoom, setZoom] = useState(1);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PageHit[] | null>(null);
  const [marks, setMarks] = useState<ManualMark[]>([]);
  const [markLabel, setMarkLabel] = useState('');
  const [rendering, setRendering] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  useTitle(meta ? meta.title : 'Manual');
  const markGuard = useSaveGuard({ markLabel });
  useIndexer(meta ? [meta] : [], () => { getManual(id).then((m) => m && setMeta(m)); });

  useEffect(() => {
    let live = true; let d: PdfDoc | null = null;
    (async () => {
      const m = await getManual(id);
      if (!live) return;
      if (!m) { setMeta(null); return; }
      setMeta(m);
      const b = await getBlob(id);
      if (!b) { setErr('The file for this manual is missing from this device.'); return; }
      try { d = await openPdf(b); if (live) setDoc(d); } catch { if (live) setErr('This manual could not be opened.'); }
      setMarks(await listMarks(id));
    })();
    return () => { live = false; d?.destroy().catch(() => undefined); };
  }, [id]);

  const go = (n: number) => {
    if (!meta) return;
    const p = Math.min(meta.pages, Math.max(1, Math.round(n) || 1));
    setPage(p); setJump(String(p));
    navigate(`/manuals/${id}?p=${p}`, { replace: true });
  };

  useEffect(() => {
    if (!doc || !canvas.current || !wrap.current) return;
    let live = true; let task: { cancel(): void } | null = null;
    setRendering(true);
    (async () => {
      try {
        const pg = await doc.getPage(page);
        if (!live || !canvas.current || !wrap.current) return;
        const base = pg.getViewport({ scale: 1 });
        const fit = Math.max(200, (wrap.current.clientWidth || 600) - 2);
        const css = (fit / base.width) * zoom;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const vp = pg.getViewport({ scale: css * dpr });
        const c = canvas.current;
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        c.style.width = `${Math.floor(vp.width / dpr)}px`; c.style.height = `${Math.floor(vp.height / dpr)}px`;
        const r = pg.render({ canvasContext: c.getContext('2d'), viewport: vp });
        task = r; await r.promise; pg.cleanup();
        c.dataset.page = String(page); c.dataset.ready = '1';
      } catch { /* cancelled by a newer render */ }
      if (live) setRendering(false);
    })();
    return () => { live = false; task?.cancel(); if (canvas.current) canvas.current.dataset.ready = ''; };
  }, [doc, page, zoom]);

  useEffect(() => { getPageText(id, page).then(setText).catch(() => setText('')); }, [id, page, meta?.indexed]);

  const find = async () => setHits(q.trim() ? await searchManual(id, q) : null);
  const addBookmark = async () => {
    if (!markGuard.canSave) return;
    await addMark(id, page, markLabel.trim() || `Page ${page}`);
    setMarkLabel(''); setMarks(await listMarks(id));
  };
  const downloadPng = () => {
    canvas.current?.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${(meta?.title ?? 'manual').replace(/[^\w.-]+/g, '-')}-p${page}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  };
  const rename = async () => {
    if (!meta) return;
    const t = window.prompt('Manual name', meta.title);
    if (!t || !t.trim()) return;
    const next = { ...meta, title: t.trim().slice(0, 120) };
    await putMeta(next); setMeta(next);
  };

  if (meta === undefined) return <p className="text-sm text-muted">Opening…</p>;
  if (meta === null) return <Empty title="Manual not found.">It may have been removed from this device. <Link to="/manuals" className="underline">Back to Printer guides</Link>.</Empty>;

  return (
    <div className="max-w-5xl pb-10 space-y-3">
      <PageHeader title={meta.title} sub={`${meta.brand} · ${meta.pages} pages`} actions={<><Link to="/manuals"><Button>Library</Button></Link><Button onClick={rename}>Rename</Button></>} />
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}

      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Page controls">
        <Button size="sm" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">◀ Prev</Button>
        <form className="flex items-center gap-1" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); go(Number(jump)); }}>
          <label className="text-sm" htmlFor="pg-jump">Page</label>
          <input id="pg-jump" inputMode="numeric" className="w-16 min-h-9 rounded-sm border border-line bg-surface px-2 text-sm" value={jump} onChange={(e: Ev) => setJump(e.target.value)} />
          <span className="text-sm text-muted">of {meta.pages}</span>
        </form>
        <Button size="sm" disabled={page >= meta.pages} onClick={() => go(page + 1)} aria-label="Next page">Next ▶</Button>
        <span className="mx-1 text-muted" aria-hidden="true">|</span>
        <Button size="sm" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>−</Button>
        <span className="text-sm w-12 text-center" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <Button size="sm" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>+</Button>
        <Button size="sm" variant="ghost" onClick={() => setZoom(1)}>Fit width</Button>
      </div>

      <div ref={wrap} className="border border-line rounded-md bg-surface2 overflow-auto max-h-[75vh] p-1" data-testid="page-wrap">
        {rendering && <p className="text-xs text-muted p-1" role="status">Drawing page…</p>}
        <canvas ref={canvas} data-testid="page-canvas" role="img" aria-label={`${meta.title}, page ${page} of ${meta.pages}`} className="bg-white mx-auto block" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-3 space-y-2">
          <SectionTitle>Find in this manual</SectionTitle>
          <form className="flex gap-2" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); find(); }}>
            <TextInput aria-label="Find in this manual" placeholder="Fault code or topic" value={q} onChange={(e: Ev) => setQ(e.target.value)} />
            <Button variant="primary" type="submit">Find</Button>
          </form>
          {meta.indexed < meta.pages && <p className="text-xs text-muted">Search is still preparing ({meta.indexed} of {meta.pages} pages read). It keeps reading while this page is open.</p>}
          {hits && (hits.length === 0 ? <p className="text-sm text-muted">No pages matched.</p> : (
            <ul className="space-y-1.5 max-h-72 overflow-auto" data-testid="hits">{hits.map((h) => (
              <li key={h.page}><button type="button" className="w-full text-left border border-line rounded-sm p-2 hover:bg-surface2" onClick={() => go(h.page)}>
                <span className="text-sm font-medium">Page {h.page}</span>
                <span className="block text-xs text-muted wrap-any">{h.snippet}</span>
              </button></li>
            ))}</ul>
          ))}
        </Card>

        <Card className="p-3 space-y-2">
          <SectionTitle>Bookmarks</SectionTitle>
          <div className="flex gap-2">
            <TextInput aria-label="Bookmark label" placeholder={`Label for page ${page}`} value={markLabel} onChange={(e: Ev) => setMarkLabel(e.target.value)} />
            <Button onClick={addBookmark} disabled={!markGuard.canSave}>Bookmark</Button>
          </div>
          {markGuard.findings.length > 0 && <p role="alert" className="text-sm text-bad">That label looks private or secret. Remove it before saving.</p>}
          {marks.length === 0 ? <p className="text-sm text-muted">No bookmarks yet. Bookmark pages you use often, like a paper path diagram.</p> : (
            <ul className="space-y-1" data-testid="marks">{marks.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 border border-line rounded-sm p-1.5">
                <button type="button" className="text-left text-sm min-w-0 flex-1 wrap-any" onClick={() => go(m.page)}>Page {m.page} · {m.label}</button>
                <Button size="sm" variant="ghost" aria-label={`Remove bookmark ${m.label}`} onClick={async () => { await removeMark(m.id); setMarks(await listMarks(id)); }}>Remove</Button>
              </li>
            ))}</ul>
          )}
        </Card>
      </div>

      <details className="border border-line rounded-md p-3 bg-surface">
        <summary className="text-sm font-medium cursor-pointer">Text on this page</summary>
        <pre className="mt-2 text-xs whitespace-pre-wrap wrap-any max-h-60 overflow-auto" data-testid="page-text">{text || (meta.indexed < page ? 'Text for this page is not read yet.' : 'No selectable text on this page (it may be a picture).')}</pre>
      </details>

      <UseAsPhoto canvas={canvas} manual={meta} page={page} onDownload={downloadPng} />
    </div>
  );
}

function UseAsPhoto({ canvas, manual, page, onDownload }: { canvas: { current: HTMLCanvasElement | null }; manual: ManualMeta; page: number; onDownload: () => void }) {
  const entries = useCollection('kbEntries');
  const [open, setOpen] = useState(false);
  const [entryId, setEntryId] = useState('');
  const [step, setStep] = useState(0);
  const [caption, setCaption] = useState('');
  const [checked, setChecked] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const guard = useSaveGuard({ caption });
  const entry = entries.find((e) => e.id === entryId);
  const save = async () => {
    if (!entry || !canvas.current || !checked || !guard.canSave) return;
    setBusy(true); setMsg('');
    try {
      const blob: Blob | null = await new Promise((r) => canvas.current!.toBlob(r, 'image/png'));
      if (!blob) throw new ImageError('The page could not be captured.');
      const img = await prepareImage(blob);
      const path = await saveCreatedFile('images', `${entry.title}-p${page}`, 'txt', img);
      const cur = store.get('kbEntries', entry.id) ?? entry;
      const cap = (caption.trim() || `${manual.title} p.${page}`).slice(0, 120);
      store.upsert('kbEntries', { ...cur, images: [...(cur.images ?? []), { path, step, caption: cap }] });
      setMsg(`Attached to “${entry.title}”${step ? `, step ${step}` : ''}.`); setCaption(''); setChecked(false);
    } catch (x) { setMsg(x instanceof ImageError ? x.message : 'The page could not be attached.'); }
    setBusy(false);
  };
  return (
    <Card className="p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Use this page</SectionTitle>
        <div className="flex gap-2"><Button size="sm" onClick={onDownload}>Save as picture</Button><Button size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Attach to a guide</Button></div>
      </div>
      {open && (
        <div className="space-y-2">
          {entries.length === 0 ? <p className="text-sm text-muted">You have no guides in the library yet. Make or import one first.</p> : (
            <>
              <Field label="Guide" htmlFor="ph-entry"><select id="ph-entry" className="min-h-11 rounded-sm border border-line bg-surface px-2 text-sm w-full" value={entryId} onChange={(e: Ev) => { setEntryId(e.target.value); setMsg(''); }}><option value="">Choose a guide…</option>{entries.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></Field>
              <Field label="Step (0 = the guide in general)" htmlFor="ph-st"><TextInput id="ph-st" inputMode="numeric" value={String(step)} onChange={(e: Ev) => setStep(Math.max(0, Math.min(99, Number(e.target.value.replace(/\D/g, '')) || 0)))} /></Field>
              <Field label="Caption (optional)" htmlFor="ph-cp"><TextInput id="ph-cp" value={caption} onChange={(e: Ev) => setCaption(e.target.value)} /></Field>
              {guard.findings.length > 0 && <p role="alert" className="text-sm text-bad">The caption looks private or secret. Remove it before saving.</p>}
              <Checkbox checked={checked} onChange={setChecked} label="This page shows only manual content, nothing private" />
              <Button variant="primary" disabled={!entry || !checked || busy || !guard.canSave} onClick={save}>{busy ? 'Attaching…' : 'Attach page picture'}</Button>
            </>
          )}
          {msg && <p role="status" className="text-sm">{msg}</p>}
          <PrivacyNote />
        </div>
      )}
    </Card>
  );
}
