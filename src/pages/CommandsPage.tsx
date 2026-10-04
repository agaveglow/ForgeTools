import { useEffect, useMemo, useState } from 'react';
import { Block, Blocks } from '../ui/PageCustomizer';
import { COMMANDS } from '../content/commands';
import type { CommandEntry, CommandGroup, Risk } from '../content/types';
import { store } from '../data/hooks';
import { Badge, Card, Chip, CodeBlock, Empty, PageHeader, TextInput } from '../ui/primitives';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

const GROUPS: CommandGroup[] = ['Networking', 'Windows', 'Users & Access', 'Disk & Storage', 'Security', 'Printing', 'Microsoft 365'];
const BY_ID = Object.fromEntries(COMMANDS.map((c) => [c.id, c]));
const riskTone = (r: Risk) => (r === 'safe' ? 'ok' : r === 'caution' ? 'warn' : 'bad') as 'ok' | 'warn' | 'bad';
const riskLabel: Record<Risk, string> = { safe: 'Read-only / safe', caution: 'Changes state', destructive: 'Can disrupt or lose data' };
const shellLabel = { cmd: 'CMD', powershell: 'PowerShell', both: 'CMD + PowerShell' } as const;

export function CommandBody({ c }: { c: CommandEntry }) {
  const rel = (c.related ?? []).map((id) => BY_ID[id]).filter(Boolean);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={riskTone(c.risk)}>{riskLabel[c.risk]}</Badge>
        <Badge>{shellLabel[c.shell]}</Badge>
        {c.needsAdmin && <Badge tone="warn">Needs Administrator</Badge>}
      </div>
      <div><h4 className="font-semibold mb-1">Syntax</h4><CodeBlock code={c.syntax} /></div>
      <div><h4 className="font-semibold mb-1">Example</h4><CodeBlock code={c.example} /></div>
      <div><h4 className="font-semibold">What it does</h4><p className="wrap-any">{c.explanation}</p></div>
      <div><h4 className="font-semibold">Expected output</h4><p className="wrap-any whitespace-pre-wrap">{c.expectedOutput}</p></div>
      <div><h4 className="font-semibold">When to use it</h4><p className="wrap-any">{c.whenToUse}</p></div>
      <div className={c.risk === 'safe' ? '' : 'rounded-sm border border-warn/50 bg-warn/5 p-2'}><h4 className="font-semibold">Risks</h4><p className="wrap-any">{c.risks}</p></div>
      {rel.length > 0 && (
        <div><h4 className="font-semibold mb-1">Related</h4><div className="flex flex-wrap gap-1.5">{rel.map((r) => <Link key={r.id} to={`/commands/${r.id}`} className="inline-flex items-center min-h-9 font-mono text-xs border border-line rounded-sm px-2.5 hover:bg-surface2">{r.name}</Link>)}</div></div>
      )}
    </div>
  );
}

/** Compact links to commands, used inside workflows and the checklist. */
export function CommandLinks({ ids }: { ids?: string[] }) {
  const list = (ids ?? []).map((i) => BY_ID[i]).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {list.map((c) => <Link key={c.id} to={`/commands/${c.id}`} className="inline-flex items-center min-h-9 font-mono text-xs border border-line bg-surface2 rounded-sm px-2.5 hover:border-accent wrap-any">{c.name}</Link>)}
    </div>
  );
}

export function CommandsPage({ id }: { id?: string }) {
  useTitle('Command reference');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<'All' | CommandGroup>('All');
  const [open, setOpen] = useState<string | undefined>(id);
  useEffect(() => {
    setOpen(id);
    if (id && BY_ID[id]) {
      store.trackUsage('command', id, BY_ID[id].name, `/commands/${id}`);
      setTimeout(() => document.getElementById('cmd-' + id)?.scrollIntoView({ block: 'start' }), 50);
    }
  }, [id]);
  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return COMMANDS.filter((c) => group === 'All' || c.group === group).filter((c) => {
      if (!words.length) return true;
      const hay = [c.name, c.purpose, c.syntax, c.group, ...(c.keywords ?? [])].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [q, group]);

  return (
    <div className="max-w-4xl">
      <PageHeader title="CMD and PowerShell reference" sub={`${COMMANDS.length} commands. Examples use fictional hosts and names.`} />
      <Blocks pageKey="CommandsPage" group="CommandsPage" className="space-y-4">
        <Block title="Search commands">
      <TextInput type="search" aria-label="Search commands" placeholder="Search commands, e.g. dns, spooler, bitlocker…" value={q} onChange={(e: { target: { value: string } }) => setQ(e.target.value)} />
        </Block>
        <Block title="Filter by group">
      <div className="flex gap-1.5 overflow-x-auto py-2 -mx-1 px-1" role="group" aria-label="Filter by group">
        <Chip active={group === 'All'} onClick={() => setGroup('All')}>All</Chip>
        {GROUPS.map((g) => <Chip key={g} active={group === g} onClick={() => setGroup(g)}>{g}</Chip>)}
      </div>
        </Block>
      </Blocks>
      {rows.length === 0 ? <Empty title="No commands match." /> : (
        <ul className="space-y-2 mt-1">
          {rows.map((c) => {
            const isOpen = open === c.id;
            return (
              <li key={c.id} id={'cmd-' + c.id}>
                <Card>
                  <button type="button" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? undefined : c.id); if (!isOpen) store.trackUsage('command', c.id, c.name, `/commands/${c.id}`); }} className="w-full text-left p-3 min-h-14 flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2"><code className="font-mono font-semibold wrap-any">{c.name}</code><Badge tone={riskTone(c.risk)}>{c.risk}</Badge><Badge>{c.group}</Badge></span>
                    <span className="text-sm text-muted">{c.purpose}</span>
                  </button>
                  {isOpen && <div className="border-t border-line p-3"><CommandBody c={c} /></div>}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Blocks pageKey="CommandsPage-2" group="CommandsPage" toolbar={false} className="space-y-4">
        <Block title="Note">
      <p className="text-xs text-muted mt-4">Run commands only on devices you are authorised to administer. ForgeTools does not execute anything.</p>
        </Block>
      </Blocks>
    </div>
  );
}
