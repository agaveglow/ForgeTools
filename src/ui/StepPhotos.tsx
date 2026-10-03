import { useEffect, useState } from 'react';
import { store } from '../data/hooks';
import { files, notifyFilesChanged, saveCreatedFile } from '../data/files';
import type { KbEntry } from '../data/types';
import { ImageError, isImageData, prepareImage } from '../lib/media';
import { Button, Checkbox, Field, TextInput } from './primitives';
import { PrivacyNote, useSaveGuard } from './SensitivePanel';

/** Loads the attached photos of a KB entry as data URLs, keyed by step number. */
export function useEntryImages(entry: KbEntry): Record<number, Array<{ src: string; caption: string; path: string }>> {
  const [map, setMap] = useState<Record<number, Array<{ src: string; caption: string; path: string }>>>({});
  const key = (entry.images ?? []).map((i) => i.path + i.step + i.caption).join('|');
  useEffect(() => {
    let live = true;
    (async () => {
      const out: Record<number, Array<{ src: string; caption: string; path: string }>> = {};
      for (const im of entry.images ?? []) {
        try { const d = await files().read(im.path); if (isImageData(d)) (out[im.step] ??= []).push({ src: d, caption: im.caption, path: im.path }); } catch { /* skip unreadable */ }
      }
      if (live) setMap(out);
    })();
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return map;
}

export function StepPhotos({ entry, stepCount, images }: { entry: KbEntry; stepCount: number; images: Record<number, Array<{ src: string; caption: string; path: string }>> }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [caption, setCaption] = useState('');
  const [checked, setChecked] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const guard = useSaveGuard({ caption });

  const pick = async (e: { target: { files: FileList | null; value: string } }) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setErr(''); setChecked(false);
    try { setPreview(await prepareImage(f)); } catch (x) { setPreview(null); setErr(x instanceof ImageError ? x.message : 'That image could not be used.'); }
  };
  const save = async () => {
    if (!preview || !checked || !guard.canSave) return;
    setBusy(true); setErr('');
    try {
      const path = await saveCreatedFile('images', `${entry.title}-${step || 'general'}`, 'txt', preview);
      const cur = store.get('kbEntries', entry.id) ?? entry;
      store.upsert('kbEntries', { ...cur, images: [...(cur.images ?? []), { path, step, caption: caption.trim() }] });
      setPreview(null); setCaption(''); setChecked(false);
    } catch { setErr('The image could not be saved.'); }
    setBusy(false);
  };
  const remove = async (path: string) => {
    try { await files().remove(path); } catch { /* already gone */ }
    const cur = store.get('kbEntries', entry.id) ?? entry;
    store.upsert('kbEntries', { ...cur, images: (cur.images ?? []).filter((i) => i.path !== path) });
    notifyFilesChanged();
  };
  const all = Object.entries(images).flatMap(([st, list]) => list.map((i) => ({ ...i, step: Number(st) })));

  return (
    <div className="space-y-3">
      <div role="note" className="text-sm rounded-sm border border-warn/50 bg-warn/5 p-2">Photos and screenshots can show passwords, customer names, account numbers or locations. Check each one before attaching. The app can’t read what is inside an image. It re-saves the picture, which removes location data, and keeps it on this device only.</div>
      <label className="inline-flex items-center justify-center min-h-11 px-3.5 rounded-sm border border-line bg-surface hover:bg-surface2 text-sm font-medium cursor-pointer focus-within:outline-2 focus-within:outline-accent">
        Add photo or screenshot
        <input type="file" accept="image/*" className="sr-only" aria-label="Add photo or screenshot" onChange={pick} />
      </label>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      {preview && (
        <div className="space-y-2 border border-line rounded-md p-3">
          <img src={preview} alt="Preview of the image you are about to attach" className="max-h-60 w-auto max-w-full rounded-sm border border-line" />
          <Field label="Attach to" htmlFor="ph-step">
            <select id="ph-step" className="min-h-11 rounded-sm border border-line bg-surface px-2 text-sm" value={step} onChange={(e: { target: { value: string } }) => setStep(Number(e.target.value))}>
              <option value="0">The guide in general</option>
              {Array.from({ length: stepCount }, (_, i) => <option key={i} value={i + 1}>Step {i + 1}</option>)}
            </select>
          </Field>
          <Field label="Caption (optional)" htmlFor="ph-cap"><TextInput id="ph-cap" value={caption} onChange={(e: { target: { value: string } }) => setCaption(e.target.value)} /></Field>
          {guard.findings.length > 0 && <p role="alert" className="text-sm text-bad">The caption contains something that looks private or secret. Remove it before saving.</p>}
          <Checkbox checked={checked} onChange={setChecked} label="I have checked this image for passwords and private details" />
          <div className="flex gap-2"><Button variant="primary" disabled={!checked || busy || !guard.canSave} onClick={save}>{busy ? 'Saving…' : 'Attach'}</Button><Button onClick={() => setPreview(null)}>Cancel</Button></div>
        </div>
      )}
      {all.length === 0 ? <p className="text-sm text-muted">No photos attached yet.</p> : (
        <ul className="grid grid-cols-2 gap-2">
          {all.map((i) => (
            <li key={i.path} className="border border-line rounded-md p-1.5 space-y-1">
              <img src={i.src} alt={i.caption || (i.step ? `Photo for step ${i.step}` : 'Photo for the guide')} className="w-full h-28 object-cover rounded-sm" />
              <p className="text-xs text-muted wrap-any">{i.step ? `Step ${i.step}` : 'General'}{i.caption ? ` · ${i.caption}` : ''}</p>
              <Button size="sm" variant="ghost" aria-label={`Remove photo ${i.caption || (i.step ? 'for step ' + i.step : '')}`} onClick={() => remove(i.path)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
      <PrivacyNote />
    </div>
  );
}
