import { useMemo, useState } from 'react';
import { LIBRARY, PROCEDURES, guideById, guideText } from '../content/library';
import type { Block, LibGuide } from '../content/library';
import { useCollection } from '../data/hooks';
import { copyOf } from '../lib/guideLibrary';
import { Button } from '../ui/primitives';
import { navigate } from '../ui/router';
import { Badge, Card, CopyButton, Empty, PageHeader, SectionTitle, TextInput } from '../ui/primitives';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

type Set = 'procedures' | 'library';
const META: Record<Set, { title: string; sub: string; base: string; list: LibGuide[] }> = {
  procedures: { title: 'Procedures', sub: 'Step-by-step jobs you do again and again, with checklists and note templates.', base: '/procedures', list: PROCEDURES },
  library: { title: 'Study library', sub: 'Plain-English references for networking, copiers, Windows and more.', base: '/library', list: LIBRARY },
};

const matches = (g: LibGuide, q: string) => {
  const t = q.trim().toLowerCase();
  return !t || `${g.title} ${g.summary} ${g.tags.join(' ')}`.toLowerCase().includes(t);
};

export function GuideList({ set }: { set: Set }) {
  const m = META[set];
  useTitle(m.title);
  const [q, setQ] = useState('');
  const list = useMemo(() => m.list.filter((g) => matches(g, q)), [m, q]);
  return (
    <div className="max-w-3xl pb-10">
      <PageHeader title={m.title} sub={m.sub} actions={<Link to="/guides"><Button>Guide library</Button></Link>} />
      <TextInput aria-label={`Search ${m.title.toLowerCase()}`} placeholder="Search" value={q} onChange={(e: { target: { value: string } }) => setQ(e.target.value)} className="mb-3" />
      {list.length === 0 ? <Empty title="Nothing matches">Try a different word.</Empty> : (
        <ul className="space-y-2" data-testid="guide-list">
          {list.map((g) => (
            <li key={g.id}>
              <Link to={`${m.base}/${g.id}`} className="block rounded-md border border-line bg-surface p-3 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent">
                <p className="font-medium wrap-any">{g.title}</p>
                <p className="text-sm text-muted">{g.summary}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">{g.tags.slice(0, 4).map((t) => <Badge key={t}>{t}</Badge>)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {set === 'procedures' && <MyGuides q={q} />}
    </div>
  );
}

/** Guides the person built with the guide agent, kept in the Knowledge base. */
function MyGuides({ q }: { q: string }) {
  const kb = useCollection('kbEntries');
  const t = q.trim().toLowerCase();
  const mine = kb.filter((k) => k.tags.includes('my-guide') && (!t || `${k.title} ${k.tags.join(' ')}`.toLowerCase().includes(t))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <section className="mt-6" aria-label="Your own guides" data-testid="my-guides">
      <SectionTitle action={<Link to="/agent" className="text-sm underline inline-flex items-center min-h-9 px-1">Build one</Link>}>Your own guides</SectionTitle>
      {mine.length === 0 ? <p className="text-sm text-muted">Guides you build with the guide agent appear here.</p> : (
        <ul className="space-y-2">{mine.map((k) => <li key={k.id}><Link to={`/kb/${k.id}`} className="block rounded-md border border-line bg-surface p-3 hover:bg-surface2"><span className="font-medium wrap-any">{k.title}</span><span className="block text-xs text-muted">{k.category}</span></Link></li>)}</ul>
      )}
    </section>
  );
}

function Steps({ b, gid, idx }: { b: Extract<Block, { kind: 'steps' }>; gid: string; idx: number }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const n = Object.values(done).filter(Boolean).length;
  return (
    <section aria-label={b.title}>
      <SectionTitle action={<span className="text-xs text-muted" aria-live="polite">{n} of {b.items.length}</span>}>{b.title}</SectionTitle>
      <ol className="space-y-1.5">
        {b.items.map((s, i) => {
          const id = `${gid}-${idx}-${i}`;
          return (
            <li key={id} className="flex gap-2 items-start">
              <input id={id} type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--accent)]" checked={!!done[i]} onChange={(e: { target: { checked: boolean } }) => setDone({ ...done, [i]: e.target.checked })} />
              <label htmlFor={id} className={`text-sm wrap-any min-h-6 ${done[i] ? 'line-through text-muted' : ''}`}><span className="text-muted mr-1">{i + 1}.</span>{s}</label>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted mt-1">Ticks are for this visit only and are not saved.</p>
    </section>
  );
}

function BlockView({ b, gid, idx }: { b: Block; gid: string; idx: number }) {
  if (b.kind === 'steps') return <Steps b={b} gid={gid} idx={idx} />;
  if (b.kind === 'points') return <section aria-label={b.title}><SectionTitle>{b.title}</SectionTitle><ul className="list-disc pl-5 space-y-1 text-sm">{b.items.map((s) => <li key={s} className="wrap-any">{s}</li>)}</ul></section>;
  if (b.kind === 'caution') return (
    <section aria-label={b.title} className="rounded-md border border-warn bg-surface2 p-3"><p className="font-medium text-sm text-warn">{b.title}</p><ul className="list-disc pl-5 space-y-1 text-sm mt-1">{b.items.map((s) => <li key={s} className="wrap-any">{s}</li>)}</ul></section>
  );
  if (b.kind === 'table') return (
    <section aria-label={b.title}><SectionTitle>{b.title}</SectionTitle>
      <div className="overflow-x-auto"><table className="w-full text-sm border border-line rounded-md"><thead className="bg-surface2 text-left"><tr><th className="p-2">{b.head[0]}</th><th className="p-2">{b.head[1]}</th></tr></thead>
        <tbody>{b.rows.map(([a, c]) => <tr key={a} className="border-t border-line align-top"><th scope="row" className="p-2 text-left font-medium wrap-any">{a}</th><td className="p-2 wrap-any">{c}</td></tr>)}</tbody></table></div>
    </section>
  );
  return <section aria-label={b.title}><SectionTitle action={<CopyButton text={b.text} label="Copy" />}>{b.title}</SectionTitle><p className="text-sm rounded-md border border-line bg-surface2 p-3 wrap-any">{b.text}</p></section>;
}

export function GuideView({ id }: { id: string }) {
  const g = guideById(id);
  useTitle(g?.title ?? 'Guide');
  if (!g) return <Empty title="Guide not found"><Link to="/procedures" className="underline">Back to procedures</Link></Empty>;
  return <BuiltinGuide g={g} />;
}

function BuiltinGuide({ g }: { g: LibGuide }) {
  const kb = useCollection('kbEntries');
  const m = META[g.set];
  const mine = copyOf(kb, g.id);
  // The copy is only made when it is saved in the editor, so opening it and cancelling changes nothing.
  const edit = () => navigate(mine ? `/kb/${mine.id}/edit` : `/kb/from/${g.id}`);
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title={g.title} sub={g.summary} actions={<><CopyButton text={guideText(g)} label="Copy guide" size="md" /><Button onClick={edit} data-testid="edit-copy">{mine ? 'Edit your copy' : 'Edit or add photos'}</Button></>} />
      {mine && <Card className="p-3 text-sm" data-testid="has-copy">You have your own edited copy of this guide. <Link to={`/kb/${mine.id}`} className="underline">Open it</Link>. This is the original.</Card>}
      <div className="flex flex-wrap gap-1.5"><Badge tone="accent">{g.set === 'procedures' ? 'Procedure' : 'Study'}</Badge>{g.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
      {g.blocks.map((b, i) => <BlockView key={b.title + i} b={b} gid={g.id} idx={i} />)}
      <Card className="p-3 text-sm text-muted">General practice written for this app. Follow your own company's procedures and the manufacturer's documents where they differ. <Link to={m.base} className="underline">Back to {m.title.toLowerCase()}</Link>. <Link to="/guides" className="underline">Guide library</Link></Card>
    </div>
  );
}


