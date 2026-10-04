import { useState } from 'react';
import { ACCENT_PRESETS, normalizeHex } from '../lib/look';
import { Button, TextInput } from './primitives';

/** Pick a colour from swatches or type a hex code. `value` undefined means "use the default". */
export function ColourField({ label, value, onChange, defaultLabel = 'Default' }: { label: string; value: string | undefined; onChange: (hex: string | undefined) => void; defaultLabel?: string }) {
  const [text, setText] = useState(value ?? '');
  const [bad, setBad] = useState(false);
  const apply = (hex: string | undefined) => { onChange(hex); setText(hex ?? ''); setBad(false); };
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${label} swatches`}>
        <button type="button" aria-pressed={!value} onClick={() => apply(undefined)} className={'min-h-9 px-2.5 rounded-full border text-xs ' + (!value ? 'border-accent bg-accent/10 font-semibold' : 'border-line')}>{defaultLabel}</button>
        {ACCENT_PRESETS.map((c) => (
          <button key={c.id} type="button" aria-label={`${label}: ${c.label}`} aria-pressed={value === c.hex} onClick={() => apply(c.hex)} className="size-9 rounded-full border-2 grid place-items-center" style={{ background: c.hex, borderColor: value === c.hex ? 'var(--c-ink)' : 'transparent' }}>
            {value === c.hex && <span aria-hidden className="text-white text-sm leading-none">✓</span>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <TextInput aria-label={`${label}: hex code`} placeholder="#2563eb" value={text} maxLength={7} className="max-w-32" onChange={(e: { target: { value: string } }) => { setText(e.target.value); setBad(false); }} />
        <Button size="sm" onClick={() => { const h = normalizeHex(text); if (h) apply(h); else setBad(true); }}>Use code</Button>
      </div>
      {bad && <p role="alert" className="text-xs text-bad">Use a colour such as #2563eb.</p>}
    </fieldset>
  );
}
