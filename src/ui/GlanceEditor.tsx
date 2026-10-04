import { useState } from 'react';
import { store, useSettings } from '../data/hooks';
import type { CustomWidget, GlanceAppSetting } from '../data/types';
import { cleanLabel, defaultAppSettings, moveItem, newBubbleId, pageChoices } from '../lib/glance';
import { Badge, Button, Card, Field, SectionTitle, Select, TextInput } from './primitives';
import { ColourField } from './ColourField';
import { blankWidget, CustomWidgetEditor, WIDGET_TYPES } from './CustomWidgets';
import { Icon } from './Bubble';

const RING_LABELS: Array<['jobs' | 'checks' | 'week', string]> = [['jobs', 'Jobs ring'], ['checks', 'Checks ring'], ['week', 'Week ring']];

/** Everything for changing the Glance home screen: ring colours, bubbles and cards. Saves as you go, on this device only. */
export function GlanceEditor({ onDone }: { onDone: () => void }) {
  const s = useSettings();
  const apps: GlanceAppSetting[] = s.glanceApps && s.glanceApps.length ? s.glanceApps : defaultAppSettings();
  const customs = s.customWidgets ?? [];
  const onHome = customs.filter((c) => c.glance);
  const off = customs.filter((c) => !c.glance);
  const [editor, setEditor] = useState<{ w: CustomWidget; isNew: boolean } | null>(null);
  const [pick, setPick] = useState('');
  const saveApps = (next: GlanceAppSetting[]) => store.updateSettings({ glanceApps: next });
  const patchApp = (id: string, patch: Partial<GlanceAppSetting>) => saveApps(apps.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const saveCustoms = (next: CustomWidget[]) => store.updateSettings({ customWidgets: next });
  const upsert = (w: CustomWidget) => saveCustoms(customs.some((c) => c.id === w.id) ? customs.map((c) => (c.id === w.id ? w : c)) : [...customs, w]);
  const moveCard = (id: string, dir: -1 | 1) => {
    const ids = onHome.map((c) => c.id); const i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const a = customs.findIndex((c) => c.id === ids[i]), b = customs.findIndex((c) => c.id === ids[j]);
    const out = customs.slice(); [out[a], out[b]] = [out[b], out[a]]; saveCustoms(out);
  };
  const choices = pageChoices().filter((p) => !apps.some((a) => a.to === p.to));

  return (
    <section aria-label="Edit home screen" className="text-left space-y-4" data-testid="glance-editor">
      <p role="status" className="text-sm rounded-sm border border-accent/50 bg-accent/5 p-2.5">Editing the home screen. Changes save as you go and stay on this device. Keep text free of customer details.</p>

      <Card className="p-3 space-y-3">
        <SectionTitle>Ring colours</SectionTitle>
        {RING_LABELS.map(([k, label]) => (
          <ColourField key={k} label={label} value={s.glanceRings?.[k]} defaultLabel="Default" onChange={(c) => store.updateSettings({ glanceRings: { ...(s.glanceRings ?? {}), [k]: c } })} />
        ))}
      </Card>

      <Card className="p-3 space-y-3">
        <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => store.updateSettings({ glanceApps: undefined })}>Reset bubbles</Button>}>Bubbles</SectionTitle>
        <ul className="space-y-2" data-testid="bubble-list">
          {apps.map((a, i) => (
            <li key={a.id} className="rounded-md border border-line p-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="grid place-items-center size-9 rounded-full border border-line shrink-0" style={a.color ? { background: `color-mix(in srgb, ${a.color} 20%, var(--c-surface))`, color: `color-mix(in srgb, ${a.color} 72%, var(--c-ink))` } : undefined}><Icon name={a.icon} size={18} /></span>
                <TextInput aria-label={`Name of bubble ${i + 1}`} value={a.label} maxLength={20} onChange={(e: { target: { value: string } }) => patchApp(a.id, { label: e.target.value })} onBlur={() => patchApp(a.id, { label: cleanLabel(a.label) || 'Page' })} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" aria-label={`Move ${a.label} earlier`} disabled={i === 0} onClick={() => saveApps(moveItem(apps, a.id, -1))}>Earlier</Button>
                <Button size="sm" aria-label={`Move ${a.label} later`} disabled={i === apps.length - 1} onClick={() => saveApps(moveItem(apps, a.id, 1))}>Later</Button>
                <Button size="sm" variant="danger" aria-label={`Remove ${a.label}`} disabled={apps.length <= 1} onClick={() => saveApps(apps.filter((x) => x.id !== a.id))}>Remove</Button>
              </div>
              <details><summary className="cursor-pointer min-h-9 flex items-center text-sm">Colour</summary><div className="pt-1"><ColourField label={`Colour of ${a.label}`} value={a.color} onChange={(c) => patchApp(a.id, { color: c })} defaultLabel="Default" /></div></details>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 items-end">
          <Field label="Add a bubble" htmlFor="gl-add" className="flex-1"><Select id="gl-add" value={pick} onChange={(e: { target: { value: string } }) => setPick(e.target.value)}><option value="">Choose a page</option>{choices.map((c) => <option key={c.to} value={c.to}>{c.label}</option>)}</Select></Field>
          <Button disabled={!pick} onClick={() => { const c = choices.find((x) => x.to === pick); if (c) saveApps([...apps, { id: newBubbleId(), label: cleanLabel(c.label), to: c.to, icon: c.icon }]); setPick(''); }}>Add</Button>
        </div>
      </Card>

      <Card className="p-3 space-y-3">
        <SectionTitle>Cards on the home screen</SectionTitle>
        {onHome.length === 0 && <p className="text-sm text-muted">None yet. Add one below.</p>}
        <ul className="space-y-2" data-testid="home-cards">
          {onHome.map((c, i) => (
            <li key={c.id} className="rounded-md border border-line p-2 flex flex-wrap items-center gap-2">
              <span className="size-3 rounded-full shrink-0" style={{ background: c.color ?? 'var(--c-accent)' }} aria-hidden />
              <span className="font-medium text-sm flex-1 min-w-0 wrap-any">{c.title}</span><Badge>{WIDGET_TYPES.find((t) => t.type === c.type)?.label}</Badge>
              <Button size="sm" disabled={i === 0} aria-label={`Move ${c.title} up`} onClick={() => moveCard(c.id, -1)}>Up</Button>
              <Button size="sm" disabled={i === onHome.length - 1} aria-label={`Move ${c.title} down`} onClick={() => moveCard(c.id, 1)}>Down</Button>
              <Button size="sm" aria-label={`Edit ${c.title}`} onClick={() => setEditor({ w: c, isNew: false })}>Edit</Button>
              <Button size="sm" variant="ghost" aria-label={`Take ${c.title} off the home screen`} onClick={() => upsert({ ...c, glance: false })}>Hide</Button>
            </li>
          ))}
        </ul>
        {off.length > 0 && (
          <div><p className="text-sm font-medium mb-1">Your other cards</p>
            <ul className="space-y-1.5">{off.map((c) => <li key={c.id} className="flex items-center gap-2"><span className="text-sm flex-1 min-w-0 wrap-any">{c.title}</span><Button size="sm" aria-label={`Show ${c.title} on the home screen`} onClick={() => upsert({ ...c, glance: true })}>Show on home</Button></li>)}</ul>
          </div>
        )}
        <div><p className="text-sm font-medium mb-1">Add a new card</p>
          <ul className="grid gap-2 sm:grid-cols-2">{WIDGET_TYPES.map((t) => (
            <li key={t.type}><button type="button" onClick={() => setEditor({ w: { ...blankWidget(t.type), glance: true }, isNew: true })} className="w-full text-left rounded-md border border-line bg-surface hover:bg-surface2 p-2.5 min-h-11"><span className="block text-sm font-medium">{t.label}</span><span className="block text-xs text-muted">{t.about}</span></button></li>
          ))}</ul>
        </div>
      </Card>

      <div className="flex justify-center"><Button variant="primary" onClick={onDone}>Done</Button></div>
      {editor && <CustomWidgetEditor key={editor.w.id} initial={editor.w} isNew={editor.isNew} onClose={() => setEditor(null)} onSave={(w) => { upsert(w); setEditor(null); }} onDelete={editor.isNew ? undefined : () => { saveCustoms(customs.filter((c) => c.id !== editor.w.id)); setEditor(null); }} />}
    </section>
  );
}
