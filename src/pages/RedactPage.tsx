import { useCallback, useEffect, useRef, useState } from 'react';
import { saveCreatedFile } from '../data/files';
import { fitSize, pixelBlock, rectFromPoints, toImage } from '../lib/redact';
import type { Rect, RedactMode } from '../lib/redact';
import { Button, Card, Chip, Field, PageHeader, TextInput } from '../ui/primitives';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

interface Box extends Rect { mode: RedactMode }
interface PtrEvt { clientX: number; clientY: number; pointerId: number; currentTarget: { setPointerCapture?: (id: number) => void } }

function paint(ctx: CanvasRenderingContext2D, base: HTMLCanvasElement, boxes: Box[], live?: Box | null) {
  ctx.clearRect(0, 0, base.width, base.height);
  ctx.drawImage(base, 0, 0);
  for (const b of live ? [...boxes, live] : boxes) {
    if (b.mode === 'solid') { ctx.fillStyle = '#000'; ctx.fillRect(b.x, b.y, b.w, b.h); continue; }
    const k = pixelBlock(b);
    const tw = Math.max(1, Math.ceil(b.w / k)), th = Math.max(1, Math.ceil(b.h / k));
    const t = document.createElement('canvas'); t.width = tw; t.height = th;
    const tc = t.getContext('2d'); if (!tc) continue;
    tc.drawImage(base, b.x, b.y, b.w, b.h, 0, 0, tw, th);
    ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, tw, th, b.x, b.y, tw * k, th * k); ctx.restore();
  }
}

export function RedactPage() {
  useTitle('Screenshot redactor');
  const view = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [mode, setMode] = useState<RedactMode>('solid');
  const [live, setLive] = useState<Box | null>(null);
  const start = useRef<[number, number] | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState('redacted-image');
  const [num, setNum] = useState({ x: '0', y: '0', w: '100', h: '20' });

  const redraw = useCallback(() => {
    const c = view.current, b = base.current; const ctx = c?.getContext('2d');
    if (c && b && ctx) paint(ctx, b, boxes, live);
  }, [boxes, live]);
  useEffect(() => { redraw(); }, [redraw, size]);

  const onFile = async (e: { target: { files: FileList | null; value: string } }) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setErr(''); setNote('');
    if (!/^image\//.test(f.type)) { setErr('That is not an image file.'); return; }
    if (f.size > 25 * 1024 * 1024) { setErr('That image is over 25 MB. Choose a smaller one.'); return; }
    try {
      const bmp = await createImageBitmap(f);
      const s = fitSize(bmp.width, bmp.height);
      const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
      const ctx = c.getContext('2d'); if (!ctx) throw new Error('no canvas');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, s.w, s.h); ctx.drawImage(bmp, 0, 0, s.w, s.h); bmp.close?.();
      base.current = c; setBoxes([]); setSize(s);
    } catch { setErr('That image could not be read. Try a JPEG or PNG.'); }
  };

  const pos = (e: { clientX: number; clientY: number }): [number, number] | null => {
    const c = view.current; if (!c || !size) return null;
    return toImage(e.clientX, e.clientY, c.getBoundingClientRect(), size.w, size.h);
  };
  const down = (e: PtrEvt) => { const p = pos(e); if (!p) return; start.current = p; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e: PtrEvt) => {
    const p = pos(e); if (!p || !start.current || !size) return;
    const r = rectFromPoints(start.current[0], start.current[1], p[0], p[1], size.w, size.h, 1);
    setLive(r ? { ...r, mode } : null);
  };
  const up = (e: PtrEvt) => {
    const p = pos(e); const s = start.current; start.current = null; setLive(null);
    if (!p || !s || !size) return;
    const r = rectFromPoints(s[0], s[1], p[0], p[1], size.w, size.h);
    if (r) setBoxes((b) => [...b, { ...r, mode }]);
  };

  const addByNumbers = () => {
    if (!size) return;
    const n = (v: string) => Math.min(100, Math.max(0, Number(v) || 0));
    const x = (n(num.x) / 100) * size.w, y = (n(num.y) / 100) * size.h;
    const r = rectFromPoints(x, y, x + (n(num.w) / 100) * size.w, y + (n(num.h) / 100) * size.h, size.w, size.h);
    if (r) setBoxes((b) => [...b, { ...r, mode }]);
  };

  const exportCanvas = (): HTMLCanvasElement | null => {
    const b = base.current; if (!b) return null;
    const c = document.createElement('canvas'); c.width = b.width; c.height = b.height;
    const ctx = c.getContext('2d'); if (!ctx) return null;
    paint(ctx, b, boxes); return c;
  };
  const download = () => {
    const c = exportCanvas(); if (!c) return;
    c.toBlob((blob) => {
      if (!blob) { setErr('The image could not be created.'); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(name || 'redacted-image').replace(/[^\w.-]+/g, '-')}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setNote('Downloaded. Delete the original from your gallery if it showed anything sensitive.');
    }, 'image/png');
  };
  const save = async () => {
    const c = exportCanvas(); if (!c) return;
    try { await saveCreatedFile('images', name || 'redacted-image', 'txt', c.toDataURL('image/jpeg', 0.85)); setNote('Saved to Files (images). Delete the original from your gallery if it showed anything sensitive.'); }
    catch { setErr('It could not be saved here.'); }
  };

  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Screenshot redactor" sub="Cover names, numbers and addresses before you keep or share an image. Everything happens on this device." actions={<Link to="/tools"><Button>Toolbox</Button></Link>} />
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center justify-center min-h-11 px-3.5 rounded-sm border border-line bg-surface hover:bg-surface2 text-sm font-medium cursor-pointer focus-within:outline-2 focus-within:outline-accent">
            Choose an image
            <input type="file" accept="image/*" className="sr-only" aria-label="Choose an image" data-testid="redact-file" onChange={onFile} />
          </label>
          <label className="inline-flex items-center justify-center min-h-11 px-3.5 rounded-sm border border-line bg-surface hover:bg-surface2 text-sm font-medium cursor-pointer focus-within:outline-2 focus-within:outline-accent">
            Take a photo
            <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a photo" onChange={onFile} />
          </label>
        </div>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        {!size && <p className="text-sm text-muted">Choose a screenshot or take a photo, then drag over anything that must not be kept.</p>}
      </Card>
      {size && (
        <>
          <Card className="p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1.5" role="group" aria-label="Cover style">
                <Chip active={mode === 'solid'} onClick={() => setMode('solid')}>Solid black (safest)</Chip>
                <Chip active={mode === 'pixel'} onClick={() => setMode('pixel')}>Coarse blocks</Chip>
              </div>
              <Button size="sm" disabled={!boxes.length} onClick={() => setBoxes((b) => b.slice(0, -1))}>Undo</Button>
              <Button size="sm" variant="ghost" disabled={!boxes.length} onClick={() => setBoxes([])}>Clear all</Button>
              <span className="text-xs text-muted" aria-live="polite" data-testid="redact-count">{boxes.length} covered</span>
            </div>
            <div className="overflow-auto rounded-md border border-line bg-surface2">
              <canvas ref={view} width={size.w} height={size.h} data-testid="redact-canvas" aria-label="Image to redact. Drag to cover an area." className="block max-w-full h-auto touch-none cursor-crosshair" style={{ touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setLive(null); }} />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer min-h-9 flex items-center">Cover an area by numbers (without dragging)</summary>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end mt-2">
                {(['x', 'y', 'w', 'h'] as const).map((k) => <Field key={k} label={{ x: 'Left %', y: 'Top %', w: 'Width %', h: 'Height %' }[k]} htmlFor={`rd-${k}`}><TextInput id={`rd-${k}`} inputMode="numeric" value={num[k]} onChange={(e: { target: { value: string } }) => setNum({ ...num, [k]: e.target.value })} /></Field>)}
                <Button onClick={addByNumbers}>Cover this area</Button>
              </div>
            </details>
          </Card>
          <Card className="p-3 space-y-3">
            <Field label="File name" htmlFor="rd-name"><TextInput id="rd-name" value={name} onChange={(e: { target: { value: string } }) => setName(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={download}>Download image</Button><Button onClick={save}>Save to Files</Button></div>
            {note && <p role="status" className="text-sm text-ok" data-testid="redact-note">{note}</p>}
            <p className="text-xs text-muted">Covered areas are burned into the new image, so they cannot be undone or read back, and location data is not carried over. The original photo is not changed or kept by this app: delete it from your gallery yourself if it showed anything sensitive. Check the result before you share it.</p>
          </Card>
        </>
      )}
    </div>
  );
}
