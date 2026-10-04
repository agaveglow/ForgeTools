import { useState } from 'react';
import type { CustomWidget, CustomWidgetType } from '../data/types';
import { Bar } from './Progress';
import { Button, Field, Modal, TextArea, TextInput } from './primitives';
import { Link } from './router';
import { PrivacyNote, SensitivePanel, useSaveGuard } from './SensitivePanel';
import { parseYmd, ymd } from '../lib/progress';
import { ColourField } from './ColourField';

export const LINK_TARGETS: Array<[string, string]> = [
  ['Tasks', '/tasks'], ['Task board', '/board'], ['Live notes', '/live'], ['Work logs', '/logs'], ['New work log', '/logs/new'], ['Guide agent', '/agent'], ['Voice notes', '/voice'],
  ['Import documents', '/import'], ['Troubleshoot', '/troubleshoot'], ['Commands', '/commands'], ['Security', '/security'], ['Notes', '/kb'], ['Requirements', '/requirements'], ['Apprenticeship', '/apprenticeship'], ['Skills', '/skills'],
];

export const WIDGET_TYPES: Array<{ type: CustomWidgetType; label: string; about: string }> = [
  { type: 'note', label: 'Note', about: 'A reminder or short text.' },
  { type: 'checklist', label: 'Checklist', about: 'A list you tick off.' },
  { type: 'counter', label: 'Counter', about: 'Count things with + and −.' },
  { type: 'progress', label: 'Progress bar', about: 'Track a number against a goal.' },
  { type: 'countdown', label: 'Countdown', about: 'Days until a date.' },
  { type: 'links', label: 'Shortcuts', about: 'Buttons to the pages you use most.' },
];

export const newId = () => 'c' + Math.random().toString(36).slice(2, 9);

export function blankWidget(type: CustomWidgetType): CustomWidget {
  const label = WIDGET_TYPES.find((t) => t.type === type)?.label ?? 'Card';
  const base = { id: newId(), type, title: label };
  switch (type) {
    case 'note': return { ...base, text: '' };
    case 'checklist': return { ...base, items: [] };
    case 'counter': return { ...base, value: 0, step: 1, unit: '' };
    case 'progress': return { ...base, value: 0, target: 10, step: 1, unit: '' };
    case 'countdown': return { ...base, date: '' };
    default: return { ...base, links: ['/tasks', '/live'] };
  }
}

export const daysUntil = (date: string, now: Date): number | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const a = parseYmd(ymd(now)), b = parseYmd(date);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

/** The card as it appears on the dashboard. Ticking, counting and progress update straight away. */
export function CustomWidgetBody({ w, now, onChange }: { w: CustomWidget; now: Date; onChange: (next: CustomWidget) => void }) {
  const unit = w.unit ? ' ' + w.unit : '';
  switch (w.type) {
    case 'note':
      return <p className="text-sm whitespace-pre-wrap wrap-any">{w.text || <span className="text-muted">Empty note. Use Customise to edit it.</span>}</p>;
    case 'checklist': {
      const items = w.items ?? [];
      const done = items.filter((i) => i.done).length;
      return items.length === 0 ? <p className="text-sm text-muted">No items yet. Use Customise to add some.</p> : (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted"><span>{done} of {items.length} done</span></div>
          <Bar value={done} max={items.length} label={`${w.title} progress`} tone="ok" />
          <ul className="divide-y divide-line">{items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 min-h-11">
              <button type="button" role="checkbox" aria-checked={i.done} aria-label={i.text} onClick={() => onChange({ ...w, items: items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)) })} className={'shrink-0 size-7 rounded-sm border-2 grid place-items-center ' + (i.done ? 'bg-ok border-ok text-canvas' : 'border-line bg-surface hover:border-accent')}>{i.done && <span aria-hidden>✓</span>}</button>
              <span className={'text-sm wrap-any ' + (i.done ? 'line-through text-muted' : '')}>{i.text}</span>
            </li>
          ))}</ul>
          {done > 0 && <Button size="sm" onClick={() => onChange({ ...w, items: items.map((x) => ({ ...x, done: false })) })}>Untick all</Button>}
        </div>
      );
    }
    case 'counter':
      return (
        <div className="flex items-center justify-between gap-3">
          <Button aria-label={`Decrease ${w.title}`} onClick={() => onChange({ ...w, value: (w.value ?? 0) - (w.step ?? 1) })}>−</Button>
          <p className="text-2xl font-semibold tabular-nums" aria-live="polite">{w.value ?? 0}<span className="text-sm text-muted font-normal">{unit}</span></p>
          <Button variant="primary" aria-label={`Increase ${w.title}`} onClick={() => onChange({ ...w, value: (w.value ?? 0) + (w.step ?? 1) })}>+</Button>
        </div>
      );
    case 'progress': {
      const v = w.value ?? 0, t = w.target ?? 0;
      return (
        <div className="space-y-2">
          <div className="flex justify-between text-sm"><span>{v}{unit} of {t}{unit}</span><span className="text-muted">{t > 0 ? Math.min(100, Math.round((v / t) * 100)) : 0}%</span></div>
          <Bar value={v} max={t} label={`${w.title} progress`} tone="ok" />
          <div className="flex gap-2"><Button size="sm" aria-label={`Decrease ${w.title}`} onClick={() => onChange({ ...w, value: Math.max(0, v - (w.step ?? 1)) })}>−</Button><Button size="sm" variant="primary" aria-label={`Increase ${w.title}`} onClick={() => onChange({ ...w, value: v + (w.step ?? 1) })}>+</Button></div>
        </div>
      );
    }
    case 'countdown': {
      const d = daysUntil(w.date ?? '', now);
      return d === undefined ? <p className="text-sm text-muted">No date set. Use Customise to pick one.</p> : (
        <p className="text-center"><span className="text-3xl font-semibold tabular-nums">{Math.abs(d)}</span> <span className="text-sm text-muted">{d === 0 ? 'today' : d > 0 ? (d === 1 ? 'day to go' : 'days to go') : (d === -1 ? 'day ago' : 'days ago')}</span><span className="block text-xs text-muted">{w.date}</span></p>
      );
    }
    default:
      return <div className="flex flex-wrap gap-1.5">{(w.links ?? []).map((r) => <Link key={r} to={r} className="inline-flex items-center min-h-11 px-3.5 rounded-sm border border-line bg-surface hover:bg-surface2 text-sm font-medium">{LINK_TARGETS.find((l) => l[1] === r)?.[0] ?? r}</Link>)}</div>;
  }
}

/** Form to create or edit a card. Text is checked for names, numbers and secrets before saving. */
export function CustomWidgetEditor({ initial, isNew, onSave, onDelete, onClose }: { initial: CustomWidget; isNew: boolean; onSave: (w: CustomWidget) => void; onDelete?: () => void; onClose: () => void }) {
  const [w, setW] = useState<CustomWidget>(initial);
  const [itemsText, setItemsText] = useState((initial.items ?? []).map((i) => i.text).join('\n'));
  const fields = { title: w.title, text: w.text ?? '', items: itemsText, unit: w.unit ?? '' };
  const guard = useSaveGuard(fields);
  const set = (patch: Partial<CustomWidget>) => setW((x) => ({ ...x, ...patch }));
  const num = (v: string) => (v === '' ? undefined : Number(v));
  const save = () => {
    if (!guard.canSave || !w.title.trim()) return;
    const out: CustomWidget = { ...w, title: w.title.trim() };
    if (w.type === 'checklist') {
      const old = new Map((initial.items ?? []).map((i) => [i.text, i]));
      out.items = itemsText.split(/\r?\n/).map((t) => t.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 40).map((t) => ({ id: old.get(t)?.id ?? newId(), text: t, done: old.get(t)?.done ?? false }));
    }
    onSave(out);
  };
  const typeLabel = WIDGET_TYPES.find((t) => t.type === w.type)?.label ?? 'Card';
  return (
    <Modal title={`${isNew ? 'Add' : 'Edit'} ${typeLabel.toLowerCase()} card`} onClose={onClose} footer={<>{onDelete && <Button variant="danger" className="mr-auto" onClick={onDelete}>Delete card</Button>}<Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!guard.canSave || !w.title.trim()} onClick={save}>{isNew ? 'Add card' : 'Save card'}</Button></>}>
      <div className="space-y-3">
        <Field label="Title" htmlFor="cw-title"><TextInput id="cw-title" maxLength={40} value={w.title} onChange={(e: { target: { value: string } }) => set({ title: e.target.value })} /></Field>
        {w.type === 'note' && <Field label="Text" htmlFor="cw-text"><TextArea id="cw-text" rows={5} value={w.text ?? ''} onChange={(e: { target: { value: string } }) => set({ text: e.target.value })} /></Field>}
        {w.type === 'checklist' && <Field label="Items" htmlFor="cw-items" hint="One per line. Existing ticks are kept for items you do not rename."><TextArea id="cw-items" rows={6} value={itemsText} onChange={(e: { target: { value: string } }) => setItemsText(e.target.value)} /></Field>}
        {(w.type === 'counter' || w.type === 'progress') && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current value" htmlFor="cw-val"><TextInput id="cw-val" type="number" inputMode="decimal" value={w.value ?? 0} onChange={(e: { target: { value: string } }) => set({ value: num(e.target.value) ?? 0 })} /></Field>
            <Field label="Change per tap" htmlFor="cw-step"><TextInput id="cw-step" type="number" inputMode="decimal" min="0.1" value={w.step ?? 1} onChange={(e: { target: { value: string } }) => set({ step: Math.abs(num(e.target.value) ?? 1) || 1 })} /></Field>
            {w.type === 'progress' && <Field label="Goal" htmlFor="cw-target"><TextInput id="cw-target" type="number" inputMode="decimal" value={w.target ?? 0} onChange={(e: { target: { value: string } }) => set({ target: num(e.target.value) ?? 0 })} /></Field>}
            <Field label="Unit (optional)" htmlFor="cw-unit"><TextInput id="cw-unit" maxLength={12} placeholder="e.g. hours" value={w.unit ?? ''} onChange={(e: { target: { value: string } }) => set({ unit: e.target.value })} /></Field>
          </div>
        )}
        {w.type === 'countdown' && <Field label="Date" htmlFor="cw-date"><TextInput id="cw-date" type="date" value={w.date ?? ''} onChange={(e: { target: { value: string } }) => set({ date: e.target.value })} /></Field>}
        {w.type === 'links' && (
          <fieldset className="space-y-1"><legend className="text-sm font-medium mb-1">Shortcuts to show</legend>
            {LINK_TARGETS.map(([label, route]) => <label key={route} className="flex items-center gap-2 min-h-9 text-sm"><input type="checkbox" className="size-5" checked={(w.links ?? []).includes(route)} onChange={(e: { target: { checked: boolean } }) => set({ links: e.target.checked ? [...(w.links ?? []), route] : (w.links ?? []).filter((r) => r !== route) })} />{label}</label>)}
          </fieldset>
        )}
        <ColourField label="Card colour" value={w.color} onChange={(c) => set({ color: c })} defaultLabel="App accent" />
        <SensitivePanel guard={guard} fieldLabels={{ title: 'Title', text: 'Text', items: 'Items', unit: 'Unit' }} onRedactAll={() => { const r = guard.redactAll(fields); set({ title: r.title, text: r.text }); setItemsText(r.items); guard.setConfirmed(false); }} onRedactKind={(k) => { const r = guard.redactOneKind(fields, k); set({ title: r.title, text: r.text }); setItemsText(r.items); guard.setConfirmed(false); }} />
        <PrivacyNote />
      </div>
    </Modal>
  );
}
