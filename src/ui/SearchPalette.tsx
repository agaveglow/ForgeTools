import { useEffect, useMemo, useRef, useState } from 'react';
import { useCollection } from '../data/hooks';
import { searchAll } from '../lib/search';
import { Badge } from './primitives';
import { navigate } from './router';

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const logs = useCollection('workLogs');
  const kb = useCollection('kbEntries');
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const hits = useMemo(() => searchAll(q, logs, kb, 12), [q, logs, kb]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => setIdx(0), [q]);
  const go = (route: string) => { onClose(); navigate(route); };
  const onKey = (e: { key: string; preventDefault(): void }) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && hits[idx]) go(hits[idx].route);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-3 pt-[8dvh]" onMouseDown={(e: { target: unknown; currentTarget: unknown }) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="w-full max-w-xl bg-surface border border-line rounded-md shadow-xl overflow-hidden" onKeyDown={onKey}>
        <input ref={input} type="search" aria-label="Search everything" placeholder="Search logs, workflows, commands, notes…" value={q} onChange={(e: { target: { value: string } }) => setQ(e.target.value)} className="w-full px-4 py-3 text-[16px] bg-surface text-ink border-b border-line outline-none" />
        <ul role="listbox" aria-label="Results" className="max-h-[60dvh] overflow-y-auto">
          {q && hits.length === 0 && <li className="p-4 text-sm text-muted">No matches.</li>}
          {!q && <li className="p-4 text-sm text-muted">Type to search across everything. Use ↑ ↓ and Enter.</li>}
          {hits.map((h, i) => (
            <li key={h.kind + h.id} role="option" aria-selected={i === idx}>
              <button type="button" onClick={() => go(h.route)} onMouseEnter={() => setIdx(i)} className={'w-full text-left px-4 py-2.5 min-h-12 flex items-center gap-3 ' + (i === idx ? 'bg-surface2' : '')}>
                <Badge>{h.kind}</Badge>
                <span className="min-w-0"><span className="block text-sm font-medium truncate">{h.title}</span><span className="block text-xs text-muted truncate">{h.sub}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
