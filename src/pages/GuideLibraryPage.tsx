import { useMemo, useState } from 'react';
import { Block, Blocks } from '../ui/PageCustomizer';
import { useCollection } from '../data/hooks';
import { SOURCE_LABEL, buildItems, filterItems } from '../lib/guideLibrary';
import type { GuideSource } from '../lib/guideLibrary';
import { Badge, Button, Chip, Empty, PageHeader, TextInput } from '../ui/primitives';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

type Filter = GuideSource | 'all' | 'edited';
const FILTERS: Array<[Filter, string]> = [['all', 'All'], ['procedure', 'Procedures'], ['study', 'Study'], ['flow', 'Troubleshooting'], ['mine', 'Mine'], ['edited', 'Edited']];
const TONE: Record<GuideSource, 'accent' | 'info' | 'warn' | 'ok'> = { procedure: 'accent', study: 'info', flow: 'warn', mine: 'ok' };

export function GuideLibraryPage() {
  useTitle('Guide library');
  const kb = useCollection('kbEntries');
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');
  const items = useMemo(() => buildItems(kb), [kb]);
  const rows = useMemo(() => filterItems(items, f, q), [items, f, q]);
  const count = (k: Filter) => filterItems(items, k, '').length;
  return (
    <div className="max-w-3xl pb-10 space-y-3" data-testid="guide-library">
      <PageHeader title="Guide library" sub="Procedures, study guides, troubleshooting and your own guides in one place. Edit any guide to make your own copy, and attach photos." actions={<Link to="/kb/new"><Button variant="primary">New guide</Button></Link>} />
      <Blocks pageKey="GuideLibraryPage" group="GuideLibraryPage" className="space-y-3">
        <Block title="Search the guide library">
      <TextInput type="search" aria-label="Search the guide library" placeholder="Search guides" value={q} onChange={(e: { target: { value: string } }) => setQ(e.target.value)} />
        </Block>
        <Block title="Show">
      <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Show">
        {FILTERS.map(([k, label]) => <Chip key={k} active={f === k} onClick={() => setF(k)}>{label} ({count(k)})</Chip>)}
      </div>
        </Block>
        <Block title="Note">
      <p className="text-xs text-muted" aria-live="polite" data-testid="gl-count">{rows.length} guide{rows.length === 1 ? '' : 's'}</p>
        </Block>
      </Blocks>
      {rows.length === 0 ? <Empty title="Nothing matches">Try a different word or filter.</Empty> : (
        <ul className="space-y-2" data-testid="gl-list">
          {rows.map((g) => (
            <li key={g.key}>
              <Link to={g.to} className="block rounded-md border border-line bg-surface p-3 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent">
                <p className="font-medium wrap-any">{g.title}</p>
                {g.summary && <p className="text-sm text-muted wrap-any">{g.summary}</p>}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <Badge tone={TONE[g.source]}>{SOURCE_LABEL[g.source].replace('Procedures', 'Procedure').replace('Troubleshooting', 'Troubleshooting flow')}</Badge>
                  {g.edited && <Badge tone="ok">Edited by you</Badge>}
                  {g.hasPhotos && <Badge>Photos</Badge>}
                  {g.tags.slice(0, 3).map((t) => <Badge key={t}>{t}</Badge>)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Blocks pageKey="GuideLibraryPage-2" group="GuideLibraryPage" toolbar={false} className="space-y-3">
        <Block title="Note">
      <p className="text-xs text-muted">Troubleshooting flows are interactive and open as they are; they cannot be edited. Built-in guides are never changed. Editing one saves your own copy, and you can restore the original at any time.</p>
        </Block>
      </Blocks>
    </div>
  );
}
