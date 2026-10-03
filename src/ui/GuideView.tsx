import type { Guide, Source } from '../lib/agent';
import { CodeBlock } from './primitives';
import { Link } from './router';

export function Sources({ items }: { items: Source[] }) {
  if (!items.length) return null;
  const cls = 'inline-flex items-center min-h-9 px-2.5 text-xs border border-line rounded-sm bg-surface2 hover:border-accent wrap-any';
  return (
    <div className="pt-1 border-t border-line">
      <p className="text-xs text-muted mb-1">Sources</p>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 10).map((s) => s.external
          ? <a key={s.route} href={s.route} target="_blank" rel="noopener noreferrer" className={cls}>{s.label} ↗</a>
          : <Link key={s.route + s.label} to={s.route} className={cls}>{s.label}</Link>)}
      </div>
    </div>
  );
}

export function GuideView({ guide }: { guide: Guide }) {
  return (
    <div className="space-y-3" data-testid="guide">
      <p className="text-sm text-muted">{guide.summary}</p>
      {guide.sections.map((s) => (
        <div key={s.title}>
          <h3 className="font-semibold text-sm">{s.title}</h3>
          {s.note && <p className="text-xs text-muted wrap-any">{s.note}</p>}
          {s.items.length > 0 && (s.ordered ? <ol className="list-decimal pl-5 mt-1 space-y-1 text-sm">{s.items.map((it, i) => <li key={i} className="wrap-any">{it}</li>)}</ol>
            : guide.kind === 'command' && s.items.length === 1 ? <p className="text-sm mt-1 wrap-any whitespace-pre-wrap">{s.items[0]}</p>
            : <ul className="list-disc pl-5 mt-1 space-y-1 text-sm">{s.items.map((it, i) => <li key={i} className="wrap-any">{it}</li>)}</ul>)}
          {s.code?.map((c) => <div key={c} className="mt-1"><CodeBlock code={c} /></div>)}
        </div>
      ))}
    </div>
  );
}
