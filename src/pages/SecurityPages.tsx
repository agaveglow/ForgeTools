import { useState } from 'react';
import { Block, Blocks } from '../ui/PageCustomizer';
import { ALERT_TYPES, HARDENING, PHISHING } from '../content/hardening';
import type { CheckList } from '../content/hardening';
import { EVENTS, EVENT_COMMANDS, EVENT_GROUPS, FAIL_CODES, LOGON_TYPES } from '../content/events';
import { HASH_ALGS, HASH_MAX_BYTES, algFromLength, compareHashes, hashBuffer } from '../lib/hash';
import type { HashAlg } from '../lib/hash';
import { parseHeader, safeSummary } from '../lib/emailHeader';
import { Badge, Button, Card, Checkbox, Chip, CodeBlock, CopyButton, Field, PageHeader, SectionTitle, Select, TextArea, TextInput } from '../ui/primitives';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

const Back = () => <Link to="/tools"><Button>Toolbox</Button></Link>;

export function EventsPage() {
  useTitle('Security events');
  const [q, setQ] = useState(''); const [g, setG] = useState('');
  const ql = q.trim().toLowerCase();
  const rows = EVENTS.filter((e) => (!g || e.group === g) && (!ql || `${e.id} ${e.title} ${e.meaning} ${e.log}`.toLowerCase().includes(ql)));
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Security events" sub="What common Windows event IDs mean and what to look at next." actions={<Back />} />
      <Blocks pageKey="EventsPage" group="EventsPage" className="space-y-4">
        <Block title="Event group">
      <Card className="p-4 space-y-3">
        <Field label="Search by ID or words" htmlFor="ev-q"><TextInput id="ev-q" value={q} placeholder="4625, locked, service" onChange={(e: { target: { value: string } }) => setQ(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Event group">
          <Chip active={!g} onClick={() => setG('')}>All</Chip>
          {EVENT_GROUPS.map((x) => <Chip key={x} active={g === x} onClick={() => setG(g === x ? '' : x)}>{x}</Chip>)}
        </div>
      </Card>
        </Block>
        <Block title="Note">
      <p className="text-xs text-muted" aria-live="polite" data-testid="ev-count">{rows.length} event{rows.length === 1 ? '' : 's'}</p>
        </Block>
        <Block title="Section 3">
      <ul className="space-y-2" data-testid="event-list">
        {rows.map((e) => (
          <li key={e.log + e.id}><Card className="p-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2"><Badge tone="accent">{e.id}</Badge><span className="font-medium">{e.title}</span></div>
            <p className="text-sm">{e.meaning}</p>
            <p className="text-sm text-muted"><span className="font-medium">Look at: </span>{e.look}</p>
            <p className="text-xs text-muted">Log: {e.log}</p>
          </Card></li>
        ))}
      </ul>
        </Block>
      </Blocks>
      {!rows.length && <p className="text-sm text-muted">Nothing matches. Try a number or a shorter word.</p>}
      <Blocks pageKey="EventsPage-2" group="EventsPage" toolbar={false} className="space-y-4">
        <Block title="Logon types in event 4624">
      <Card className="p-4 space-y-2"><SectionTitle>Logon types in event 4624</SectionTitle>
        <dl className="text-sm grid grid-cols-[3rem_1fr] gap-x-3 gap-y-1">{LOGON_TYPES.map(([k, v]) => <div key={k} className="contents"><dt className="font-mono">{k}</dt><dd>{v}</dd></div>)}</dl></Card>
        </Block>
        <Block title="Failed logon codes in event 4625">
      <Card className="p-4 space-y-2"><SectionTitle>Failed logon codes in event 4625</SectionTitle>
        <dl className="text-sm grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">{FAIL_CODES.map(([k, v]) => <div key={k} className="contents"><dt className="font-mono">{k}</dt><dd>{v}</dd></div>)}</dl></Card>
        </Block>
        <Block title="Common alert types">
      <Card className="p-4 space-y-2"><SectionTitle>Common alert types</SectionTitle>
        <ul className="space-y-2 text-sm">{ALERT_TYPES.map(([a, b, c]) => <li key={a}><span className="font-medium">{a}.</span> {b}. <span className="text-muted">{c}.</span></li>)}</ul></Card>
        </Block>
        <Block title="Read the logs in PowerShell">
      <Card className="p-4 space-y-2"><SectionTitle>Read the logs in PowerShell</SectionTitle>
        {EVENT_COMMANDS.map(([t, c]) => <div key={t} className="space-y-1"><p className="text-sm font-medium">{t}</p><CodeBlock code={c} /></div>)}
        <p className="text-xs text-muted">Reading the Security log needs an administrator window.</p></Card>
        </Block>
      </Blocks>
    </div>
  );
}

export function HashPage() {
  useTitle('File hash checker');
  const [alg, setAlg] = useState<HashAlg>('SHA-256');
  const [name, setName] = useState(''); const [size, setSize] = useState(0);
  const [hash, setHash] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [expected, setExpected] = useState('');
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const run = async (b: ArrayBuffer, a: HashAlg) => { setBusy(true); setErr(''); try { setHash(await hashBuffer(b, a)); } catch { setErr('This browser could not calculate that hash.'); setHash(''); } setBusy(false); };
  const pick = async (e: { target: { files?: ArrayLike<{ name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }> | null; value: string } }) => {
    const f = e.target.files?.[0]; if (!f) return;
    setName(f.name); setSize(f.size); setHash(''); setBuf(null);
    if (f.size > HASH_MAX_BYTES) { setErr('That file is too large to check in the browser (limit 500 MB).'); return; }
    const b = await f.arrayBuffer(); setBuf(b); await run(b, alg);
  };
  const guess = algFromLength(expected);
  const res = hash ? compareHashes(hash, expected) : 'empty';
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="File hash checker" sub="Check a download against the hash the publisher gives. The file stays on this device." actions={<Back />} />
      <Blocks pageKey="HashPage" group="HashPage" className="space-y-4">
        <Block title="Choose a file to hash">
      <Card className="p-4 space-y-3">
        <Field label="Choose a file" htmlFor="hs-file"><input id="hs-file" type="file" aria-label="Choose a file to hash" onChange={pick as never} className="block w-full text-sm" /></Field>
        <Field label="Algorithm" htmlFor="hs-alg"><Select id="hs-alg" value={alg} onChange={(e: { target: { value: string } }) => { const a = e.target.value as HashAlg; setAlg(a); if (buf) void run(buf, a); }}>{HASH_ALGS.map((a) => <option key={a}>{a}</option>)}</Select></Field>
        {busy && <p className="text-sm" role="status">Calculating…</p>}
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        {hash && <div className="space-y-1"><p className="text-sm font-medium">{name} <span className="text-muted font-normal">({size.toLocaleString()} bytes)</span></p><CodeBlock code={hash} /></div>}
      </Card>
        </Block>
        <Block title="Section 2">
      <Card className="p-4 space-y-3">
        <Field label="Published hash to compare" htmlFor="hs-exp" hint="Spaces, colons and capitals are ignored."><TextInput id="hs-exp" value={expected} onChange={(e: { target: { value: string } }) => setExpected(e.target.value)} /></Field>
        {guess && guess !== alg && guess !== 'MD5' && <p className="text-sm text-warn" role="status">That hash looks like {guess}. Switch the algorithm above.</p>}
        {guess === 'MD5' && <p className="text-sm text-warn" role="status">That looks like an MD5 hash, which this tool cannot calculate and which is weak. Ask for a SHA-256 value.</p>}
        <div aria-live="polite" data-testid="hash-result">
          {res === 'match' && <Badge tone="ok">Match: the file is the one published</Badge>}
          {res === 'mismatch' && <Badge tone="bad">Does not match: do not run this file</Badge>}
          {res === 'invalid' && <Badge tone="warn">That is not a hash: it should be letters a-f and numbers only</Badge>}
        </div>
        <p className="text-xs text-muted">A match proves the file is the same as the one the hash came from. Get the hash from the publisher&apos;s own site, not the page that hosts the download.</p>
      </Card>
        </Block>
      </Blocks>
    </div>
  );
}

const WORST = { bad: 'bad', warn: 'warn', ok: 'ok' } as const;
export function HeaderPage() {
  useTitle('Email header reader');
  const [raw, setRaw] = useState('');
  const r = raw.trim() ? parseHeader(raw) : null;
  const rep = r && !('error' in r) ? r : null;
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Email header reader" sub="Paste a full header to see the route and the sender checks. Nothing is saved or sent." actions={<Back />} />
      <Blocks pageKey="HeaderPage" group="HeaderPage" className="space-y-4">
        <Block title="Section 1">
      <Card className="p-4 space-y-3">
        <Field label="Email header" htmlFor="hd-text" hint="In Outlook: open the message, then File, Properties. The text is only held on this page and is cleared when you leave."><TextArea id="hd-text" rows={8} value={raw} onChange={(e: { target: { value: string } }) => setRaw(e.target.value)} spellCheck={false} /></Field>
        <Button variant="ghost" disabled={!raw} onClick={() => setRaw('')}>Clear</Button>
        {r && 'error' in r && <p role="alert" className="text-sm text-warn">{r.error}</p>}
      </Card>
        </Block>
      </Blocks>
      {rep && <div className="space-y-4" data-testid="header-report">
        <Card className="p-4 space-y-2"><SectionTitle action={<CopyButton text={safeSummary(rep)} label="Copy summary" />}>Checks</SectionTitle>
          <ul className="space-y-1">{rep.flags.map((f) => <li key={f.text} className="flex gap-2 items-start text-sm"><Badge tone={WORST[f.level]}>{f.level === 'ok' ? 'OK' : f.level === 'bad' ? 'Problem' : 'Check'}</Badge><span>{f.text}</span></li>)}</ul>
          <p className="text-xs text-muted">The copied summary has no addresses or names, so it is safe in a ticket.</p></Card>
        <Card className="p-4 space-y-1 text-sm"><SectionTitle>Sender</SectionTitle>
          <p><span className="text-muted">From domain:</span> {rep.fromDomain ?? 'not found'}</p>
          <p><span className="text-muted">Return-Path domain:</span> {rep.returnDomain ?? 'not found'}</p>
          <p><span className="text-muted">Reply-To domain:</span> {rep.replyDomain ?? 'not set'}</p>
          <p><span className="text-muted">DKIM signed by:</span> {rep.dkimDomains.join(', ') || 'no signature'}</p></Card>
        <Card className="p-4 space-y-2"><SectionTitle>Route taken, first hop first</SectionTitle>
          {rep.hops.length ? <ol className="list-decimal pl-5 space-y-1 text-sm wrap-any">{rep.hops.map((h, i) => <li key={i}>{h.from || 'unknown'} <span className="text-muted">to</span> {h.by || 'unknown'} <span className="text-muted">{h.date}</span></li>)}</ol> : <p className="text-sm text-muted">No Received lines found.</p>}</Card>
      </div>}
      <Blocks pageKey="HeaderPage-2" group="HeaderPage" toolbar={false} className="space-y-4">
        <Block title="Section 2">
      <ChecklistCard list={PHISHING} />
        </Block>
      </Blocks>
    </div>
  );
}

export function ChecklistCard({ list }: { list: CheckList }) {
  const [ticks, setTicks] = useState<number[]>([]);
  return (
    <Card className="p-4 space-y-2" aria-label={list.title}>
      <SectionTitle action={<><span className="text-xs text-muted mr-2" aria-live="polite" data-testid={`ck-${list.id}`}>{ticks.length} of {list.items.length}</span><Button size="sm" variant="ghost" disabled={!ticks.length} onClick={() => setTicks([])}>Clear</Button></>}>{list.title}</SectionTitle>
      <p className="text-xs text-muted">{list.intro}</p>
      <ul className="space-y-1">{list.items.map((it, i) => <li key={it}><Checkbox checked={ticks.includes(i)} onChange={(v) => setTicks(v ? [...ticks, i] : ticks.filter((x) => x !== i))} label={it} /></li>)}</ul>
    </Card>
  );
}

export function HardenPage() {
  useTitle('Hardening checklists');
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Hardening checklists" sub="Tick through settings with the customer. Ticks last only for this visit and nothing is stored." actions={<Back />} />
      {HARDENING.map((l) => <ChecklistCard key={l.id} list={l} />)}
    </div>
  );
}
