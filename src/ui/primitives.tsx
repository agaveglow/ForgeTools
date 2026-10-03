import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { clsx, copyText } from '../lib/util';
import { useState } from 'react';

type BtnProps = {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  className?: string;
  [k: string]: unknown;
};

export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none';
  const sz = size === 'sm' ? 'min-h-9 px-2.5 text-sm' : 'min-h-11 px-3.5 text-sm';
  const v = {
    primary: 'bg-accent text-accent-ink border-accent hover:opacity-90',
    secondary: 'bg-surface text-ink border-line hover:bg-surface2',
    ghost: 'bg-transparent text-ink border-transparent hover:bg-surface2',
    danger: 'bg-surface text-bad border-bad hover:bg-bad/10',
  }[variant];
  return (
    <button type="button" className={clsx(base, sz, v, className)} {...rest}>
      {children}
    </button>
  );
}

export function Card({ children, className, ...rest }: { children?: ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <section className={clsx('bg-surface border border-line rounded-md', className)} {...rest}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }: { children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight wrap-any">{title}</h1>
        {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Badge({ children, tone = 'neutral', className, title }: { children?: ReactNode; tone?: 'neutral' | 'ok' | 'bad' | 'warn' | 'info' | 'accent'; className?: string; title?: string }) {
  const t = {
    neutral: 'bg-surface2 text-muted border-line',
    ok: 'bg-ok/10 text-ok border-ok/40',
    bad: 'bg-bad/10 text-bad border-bad/40',
    warn: 'bg-warn/10 text-warn border-warn/40',
    info: 'bg-info/10 text-info border-info/40',
    accent: 'bg-accent/10 text-accent border-accent/40',
  }[tone];
  return <span title={title} className={clsx('inline-flex items-center rounded-xs border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', t, className)}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-line rounded-md p-6 text-center text-sm text-muted">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

const fieldBase = 'w-full bg-surface text-ink border border-line rounded-sm px-3 py-2 text-[16px] md:text-sm placeholder:text-muted/70 focus:border-accent';

export function Field({ label, hint, children, htmlFor, className }: { label: string; hint?: ReactNode; children?: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function TextInput({ className, ...rest }: { className?: string; [k: string]: unknown }) {
  return <input className={clsx(fieldBase, 'min-h-11', className)} {...rest} />;
}
export function TextArea({ className, rows = 3, ...rest }: { className?: string; rows?: number; [k: string]: unknown }) {
  return <textarea rows={rows} className={clsx(fieldBase, 'leading-relaxed', className)} {...rest} />;
}
export function Select({ className, children, ...rest }: { className?: string; children?: ReactNode; [k: string]: unknown }) {
  return <select className={clsx(fieldBase, 'min-h-11', className)} {...rest}>{children}</select>;
}

export function Checkbox({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id?: string }) {
  const gen = useId();
  const i = id ?? gen;
  return (
    <label htmlFor={i} className="flex items-start gap-2.5 min-h-9 py-1 cursor-pointer text-sm">
      <input id={i} type="checkbox" checked={checked} onChange={(e: { target: { checked: boolean } }) => onChange(e.target.checked)} className="mt-0.5 size-5 accent-[var(--c-accent)] shrink-0" />
      <span>{label}</span>
    </label>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      className={clsx('min-h-9 px-3 rounded-sm border text-sm whitespace-nowrap', active ? 'bg-accent text-accent-ink border-accent' : 'bg-surface border-line hover:bg-surface2')}
    >
      {children}
    </button>
  );
}

export function CopyButton({ text, label = 'Copy', size = 'sm' }: { text: string; label?: string; size?: 'md' | 'sm' }) {
  const [done, setDone] = useState<null | boolean>(null);
  useEffect(() => {
    if (done === null) return;
    const t = setTimeout(() => setDone(null), 1800);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <Button size={size} onClick={async () => setDone(await copyText(text))} aria-live="polite">
      {done === null ? label : done ? 'Copied' : 'Copy failed'}
    </Button>
  );
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="font-mono text-[13px] bg-surface2 border border-line rounded-sm p-3 pr-16 overflow-x-auto whitespace-pre-wrap wrap-any">{code}</pre>
      <div className="absolute top-1.5 right-1.5"><CopyButton text={code} /></div>
    </div>
  );
}

/** Modal dialog with focus trap and Escape-to-close. */
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children?: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const tid = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute('disabled'));
    (focusables()[0] ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e: { target: unknown; currentTarget: unknown }) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={tid} tabIndex={-1} className="bg-surface border border-line w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-md sm:rounded-md shadow-xl pb-safe">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line sticky top-0 bg-surface">
          <h2 id={tid} className="font-semibold">{title}</h2>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">✕</Button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-line flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Collapsible({ title, defaultOpen = false, children, badge }: { title: ReactNode; defaultOpen?: boolean; children?: ReactNode; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border border-line rounded-md bg-surface">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="w-full min-h-11 px-3 py-2 flex items-center justify-between gap-2 text-left font-medium text-sm">
        <span className="flex items-center gap-2 min-w-0">{title}{badge}</span>
        <span aria-hidden className="text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && <div id={id} className="px-3 pb-3 pt-1 border-t border-line">{children}</div>}
    </div>
  );
}
