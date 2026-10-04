import { useState } from 'react';
import { store, useSettings } from '../data/hooks';
import type { CustomWidget, GlanceAppSetting, GlanceLink, GlanceStyle } from '../data/types';
import { GLANCE_FONTS, GLANCE_ICONS, RING_DESIGNS, SHAPES, cleanLabel, defaultAppSettings, moveItem, newBubbleId, newLinkId, normalizeLinkTarget, pageChoices, shapeStyle } from '../lib/glance';
import { scanText } from '../lib/sensitive';
import { RingFace } from './GlanceRings';
import { Badge, Button, Card, Checkbox, Field, SectionTitle, Select, TextInput } from './primitives';
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
  const st: GlanceStyle = s.glanceStyle ?? {};
  const setStyle = (patch: Partial<GlanceStyle>) => store.updateSettings({ glanceStyle: { ...st, ...patch } });
  const links: GlanceLink[] = s.glanceLinks ?? [];
  const saveLinks = (next: GlanceLink[]) => store.updateSettings({ glanceLinks: next });
  const [qLabel, setQLabel] = useState(''), [qTo, setQTo] = useState(''), [qIcon, setQIcon] = useState('star'), [qErr, setQErr] = useState('');
  const addLink = () => {
    const to = normalizeLinkTarget(qTo);
    if (!to) { setQErr('Use an app page such as /tasks, or an https address such as https://example.com.'); return; }
    if (scanText(qLabel + ' ' + qTo).length) { setQErr('That looks like it holds customer or secret details. Keep links generic: no names, numbers or tokens in the address.'); return; }
    saveLinks([...links, { id: newLinkId(), label: cleanLabel(qLabel) || 'Link', to, icon: qIcon }]); setQLabel(''); setQTo(''); setQErr('');
  };
  const sample = [{ id: 'jobs', label: 'Jobs', v: 3, m: 5, color: s.glanceRings?.jobs ?? '#d9531e' }, { id: 'checks', label: 'Checks', v: 2, m: 4, color: s.glanceRings?.checks ?? '#16a34a' }, { id: 'week', label: 'Week', v: 1, m: 3, color: s.glanceRings?.week ?? '#2563eb' }];
  const Pick = ({ label, value, options, onPick }: { label: string; value: string; options: Array<{ id: string; label: string }>; onPick: (id: string) => void }) => (
    <fieldset className="space-y-1"><legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">{options.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onPick(o.id)} className={'min-h-9 px-3 rounded-full border text-sm ' + (value === o.id ? 'border-accent bg-accent/10 font-semibold' : 'border-line')}>{o.label}</button>)}</div>
    </fieldset>
  );
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

      <Card className="p-3 space-y-4" data-testid="style-card">
        <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => store.updateSettings({ glanceStyle: undefined })}>Reset style</Button>}>Look of the home screen</SectionTitle>
        <p className="text-sm text-muted">Tap a design to see it. Each one applies straight away.</p>
        <fieldset className="space-y-1.5"><legend className="text-sm font-medium">Ring design</legend>
          <ul className="grid grid-cols-3 gap-2" data-testid="ring-designs">{RING_DESIGNS.map((d) => (
            <li key={d.id}><button type="button" aria-pressed={(st.ring ?? 'classic') === d.id} aria-label={d.label} onClick={() => setStyle({ ring: d.id })} className={'w-full rounded-lg border p-1 ' + ((st.ring ?? 'classic') === d.id ? 'border-accent bg-accent/10' : 'border-line')}>
              <span className="block w-full max-w-[96px] mx-auto"><RingFace rings={sample} design={d.id} time="09:41" date="" hideDate /></span>
              <span className="block text-xs mt-0.5">{d.label}</span></button></li>
          ))}</ul>
        </fieldset>
        <Pick label="Bubble shape" value={st.bubbleShape ?? 'circle'} options={SHAPES} onPick={(id) => setStyle({ bubbleShape: id as GlanceStyle['bubbleShape'] })} />
        <div className="flex gap-2 items-center" aria-hidden>{SHAPES.map((o) => <span key={o.id} className="grid place-items-center border border-line bg-surface2 text-accent" style={shapeStyle(o.id, 40)}><Icon name="star" size={16} /></span>)}</div>
        <Pick label="Bubble size" value={st.bubbleSize ?? 'md'} options={[{ id: 'sm', label: 'Small' }, { id: 'md', label: 'Medium' }, { id: 'lg', label: 'Large' }]} onPick={(id) => setStyle({ bubbleSize: id as GlanceStyle['bubbleSize'] })} />
        <Pick label="Quick link shape" value={st.quickShape ?? st.bubbleShape ?? 'circle'} options={SHAPES} onPick={(id) => setStyle({ quickShape: id as GlanceStyle['quickShape'] })} />
        <Pick label="Number tiles" value={st.tileShape ?? 'rounded'} options={[{ id: 'rounded', label: 'Rounded' }, { id: 'sharp', label: 'Sharp' }, { id: 'pill', label: 'Pill' }, { id: 'outline', label: 'Outline' }]} onPick={(id) => setStyle({ tileShape: id as GlanceStyle['tileShape'] })} />
        <Pick label="Font" value={st.font ?? 'default'} options={Object.entries(GLANCE_FONTS).map(([id, f]) => ({ id, label: f.label }))} onPick={(id) => setStyle({ font: id as GlanceStyle['font'] })} />
        <Checkbox label="Hide the date under the clock" checked={!!st.hideDate} onChange={(v) => setStyle({ hideDate: v })} />
        <ColourField label="Clock colour" value={st.clockColor} onChange={(c) => setStyle({ clockColor: c })} />
        <ColourField label="Label colour" value={st.labelColor} onChange={(c) => setStyle({ labelColor: c })} />
        <ColourField label="Number tile edge" value={st.tileColor} onChange={(c) => setStyle({ tileColor: c })} />
      </Card>

      <Card className="p-3 space-y-3" data-testid="quick-editor">
        <SectionTitle>Quick links</SectionTitle>
        <p className="text-sm text-muted">Shown under the stock bubbles. Link to any page in the app or to a website. Keep addresses free of customer details and tokens.</p>
        <ul className="space-y-2" data-testid="quick-list">
          {links.map((l, i) => (
            <li key={l.id} className="rounded-md border border-line p-2 space-y-2">
              <div className="flex items-center gap-2">
                <TextInput aria-label={`Name of quick link ${i + 1}`} value={l.label} maxLength={20} onChange={(e: { target: { value: string } }) => saveLinks(links.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} />
                <span className="text-xs text-muted wrap-any max-w-[40%]">{l.to}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" aria-label={`Move ${l.label} earlier`} disabled={i === 0} onClick={() => saveLinks(moveItem(links, l.id, -1))}>Earlier</Button>
                <Button size="sm" aria-label={`Move ${l.label} later`} disabled={i === links.length - 1} onClick={() => saveLinks(moveItem(links, l.id, 1))}>Later</Button>
                <Button size="sm" variant="danger" aria-label={`Remove ${l.label}`} onClick={() => saveLinks(links.filter((x) => x.id !== l.id))}>Remove</Button>
              </div>
              <details><summary className="cursor-pointer min-h-9 flex items-center text-sm">Colour and icon</summary><div className="pt-1 space-y-2">
                <ColourField label={`Colour of ${l.label}`} value={l.color} onChange={(c) => saveLinks(links.map((x) => (x.id === l.id ? { ...x, color: c } : x)))} />
                <Select aria-label={`Icon of ${l.label}`} value={l.icon} onChange={(e: { target: { value: string } }) => saveLinks(links.map((x) => (x.id === l.id ? { ...x, icon: e.target.value } : x)))}>{Object.keys(GLANCE_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}</Select>
              </div></details>
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <Field label="Name" htmlFor="ql-label"><TextInput id="ql-label" value={qLabel} maxLength={20} onChange={(e: { target: { value: string } }) => setQLabel(e.target.value)} /></Field>
          <Field label="Page or website" htmlFor="ql-to" hint="For example /tasks or https://example.com"><TextInput id="ql-to" value={qTo} onChange={(e: { target: { value: string } }) => { setQTo(e.target.value); setQErr(''); }} /></Field>
          <Field label="Icon" htmlFor="ql-icon"><Select id="ql-icon" value={qIcon} onChange={(e: { target: { value: string } }) => setQIcon(e.target.value)}>{Object.keys(GLANCE_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}</Select></Field>
          {qErr && <p role="alert" className="text-sm text-bad">{qErr}</p>}
          <Button onClick={addLink} disabled={!qTo.trim()}>Add quick link</Button>
        </div>
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
