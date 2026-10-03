import { useMemo, useState } from 'react';
import { hasBlockers, redactKind, redactText, scanFields, NEVER_ENTER } from '../lib/sensitive';
import type { FieldFinding } from '../lib/sensitive';
import { Badge, Button, Checkbox } from './primitives';

export interface Guard {
  findings: FieldFinding[];
  blocked: boolean;
  /** True if saving is allowed right now. */
  canSave: boolean;
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;
  /** Returns new field values with every finding redacted. */
  redactAll: (fields: Record<string, string>) => Record<string, string>;
  redactOneKind: (fields: Record<string, string>, kind: string) => Record<string, string>;
}

/**
 * Scans the given fields. Passwords/keys/tokens/card numbers ("block") can never be saved.
 * Other personal details ("warn") need explicit confirmation or redaction.
 */
export function useSaveGuard(fields: Record<string, string>): Guard {
  const [confirmed, setConfirmed] = useState(false);
  const key = JSON.stringify(fields);
  const findings = useMemo(() => scanFields(fields), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const blocked = hasBlockers(findings);
  const warnCount = findings.filter((f) => f.severity === 'warn').length;
  return {
    findings,
    blocked,
    confirmed,
    setConfirmed,
    canSave: !blocked && (warnCount === 0 || confirmed),
    redactAll: (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, redactText(v)])),
    redactOneKind: (f, kind) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, redactKind(v, kind)])),
  };
}

export function SensitivePanel({
  guard,
  fieldLabels,
  onRedactAll,
  onRedactKind,
}: {
  guard: Guard;
  fieldLabels?: Record<string, string>;
  onRedactAll: () => void;
  onRedactKind: (kind: string) => void;
}) {
  if (!guard.findings.length) return null;
  const kinds = [...new Set(guard.findings.map((f) => f.kind))];
  return (
    <div role="alert" className={'rounded-md border p-3 text-sm ' + (guard.blocked ? 'border-bad bg-bad/5' : 'border-warn bg-warn/5')}>
      <p className="font-semibold">
        {guard.blocked ? 'Cannot save: this contains a secret' : 'Check for sensitive details before saving'}
      </p>
      <p className="text-muted mt-0.5">
        {guard.blocked
          ? 'Passwords, keys, tokens, recovery keys and card numbers are never stored. Remove or redact them to continue.'
          : 'ForgeTools stores data only on this device, but exports and copied text can travel. Redact anything the record does not need.'}
      </p>
      <ul className="mt-2 space-y-1.5">
        {guard.findings.map((f, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <Badge tone={f.severity === 'block' ? 'bad' : 'warn'}>{f.label}</Badge>
            <code className="font-mono text-xs bg-surface2 rounded-xs px-1 wrap-any">{f.severity === 'block' ? '••••••' : f.text}</code>
            <span className="text-xs text-muted">in {fieldLabels?.[f.field] ?? f.field}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={onRedactAll}>Redact all</Button>
        {kinds.length > 1 && kinds.map((k) => (
          <Button key={k} size="sm" variant="ghost" onClick={() => onRedactKind(k)}>
            Redact {guard.findings.find((f) => f.kind === k)!.label.toLowerCase()}
          </Button>
        ))}
      </div>
      {!guard.blocked && (
        <div className="mt-2 border-t border-line pt-2">
          <Checkbox checked={guard.confirmed} onChange={guard.setConfirmed} label="I have checked these details and they are needed in this record." />
        </div>
      )}
    </div>
  );
}

export function PrivacyNote() {
  return (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer min-h-8 flex items-center">What should not go in here?</summary>
      <ul className="list-disc pl-5 mt-1 space-y-0.5">
        {NEVER_ENTER.map((x) => <li key={x}>{x}</li>)}
      </ul>
    </details>
  );
}
