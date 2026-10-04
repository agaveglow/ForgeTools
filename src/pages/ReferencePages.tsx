import { useState } from 'react';
import { DMARC_TAGS, DNS_COMMANDS, RECORD_TYPES, SPF_TERMS, TTL_NOTES } from '../content/dns';
import { OPS_CHECKS } from '../content/checks';
import { ENG_GROUPS, ENG_TOOLS } from '../content/engtools';
import { PRINT_CHECKS, PRINT_FIRST, PRINT_PROTOCOLS } from '../content/print';
import { PORTS, PORT_COMMANDS, PORT_RANGES } from '../content/ports';
import { checkDmarc, checkSpf } from '../lib/dnsRecords';
import type { Finding } from '../lib/dnsRecords';
import { DEFAULT_GEN, estimateBits, generate } from '../lib/passgen';
import type { GenOptions } from '../lib/passgen';
import { fromBase64, fromHexText, macFormats, parseTime, toBase64, toHexText, urlDecode, urlEncode, viewTime } from '../lib/convert';
import { Badge, Button, Card, Checkbox, CodeBlock, CopyButton, Field, PageHeader, SectionTitle, Select, TextArea, TextInput } from '../ui/primitives';
import { ChecklistCard } from './SecurityPages';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

const Back = () => <Link to="/tools"><Button>Toolbox</Button></Link>;
type Chg = { target: { value: string } };
const tone = { bad: 'bad', warn: 'warn', ok: 'ok' } as const;
const Findings = ({ items }: { items: Finding[] }) => <ul className="space-y-1">{items.map((f) => <li key={f.text} className="flex gap-2 items-start text-sm"><Badge tone={tone[f.level]}>{f.level === 'ok' ? 'OK' : f.level === 'bad' ? 'Problem' : 'Check'}</Badge><span>{f.text}</span></li>)}</ul>;

export function PortsPage() {
  useTitle('Ports and services');
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const rows = PORTS.filter((p) => !ql || `${p.port} ${p.name} ${p.note} ${p.proto}`.toLowerCase().includes(ql));
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Ports and services" sub="What common ports are for, and which ones need care." actions={<Back />} />
      <Card className="p-4"><Field label="Search by number or name" htmlFor="pt-q"><TextInput id="pt-q" value={q} placeholder="445, printing, mail" onChange={(e: Chg) => setQ(e.target.value)} /></Field></Card>
      <p className="text-xs text-muted" aria-live="polite" data-testid="pt-count">{rows.length} port{rows.length === 1 ? '' : 's'}</p>
      <ul className="space-y-2" data-testid="port-list">
        {rows.map((p) => <li key={p.port + p.name}><Card className="p-3 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="accent">{p.port}</Badge><Badge>{p.proto}</Badge><span className="font-medium">{p.name}</span></div>
          <p className="text-sm">{p.note}</p>
          {p.care && <p className="text-sm text-warn">{p.care}</p>}
        </Card></li>)}
      </ul>
      {!rows.length && <p className="text-sm text-muted">Nothing matches.</p>}
      <Card className="p-4 space-y-1"><SectionTitle>Port number ranges</SectionTitle>
        <dl className="text-sm grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">{PORT_RANGES.map(([a, b]) => <div key={a} className="contents"><dt className="font-mono">{a}</dt><dd>{b}</dd></div>)}</dl></Card>
      <Card className="p-4 space-y-2"><SectionTitle>Check ports from Windows</SectionTitle>{PORT_COMMANDS.map(([t, c]) => <div key={t} className="space-y-1"><p className="text-sm font-medium">{t}</p><CodeBlock code={c} /></div>)}</Card>
    </div>
  );
}

export function DnsPage() {
  useTitle('DNS and mail records');
  const [spf, setSpf] = useState(''); const [dm, setDm] = useState('');
  const s = spf.trim() ? checkSpf(spf) : null; const d = dm.trim() ? checkDmarc(dm) : null;
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="DNS and mail records" sub="Record types, mail records explained, and a checker for SPF and DMARC. Nothing is saved." actions={<Back />} />
      <Card className="p-4 space-y-3">
        <SectionTitle>Check an SPF record</SectionTitle>
        <Field label="SPF record text" htmlFor="dn-spf" hint="Read it with nslookup -type=TXT yourdomain"><TextInput id="dn-spf" value={spf} onChange={(e: Chg) => setSpf(e.target.value)} placeholder="v=spf1 include:mail.example.net -all" /></Field>
        <div aria-live="polite" data-testid="spf-result">{s && ('error' in s ? <p className="text-sm text-warn" role="alert">{s.error}</p> : <Findings items={s.findings} />)}</div>
      </Card>
      <Card className="p-4 space-y-3">
        <SectionTitle>Check a DMARC record</SectionTitle>
        <Field label="DMARC record text" htmlFor="dn-dm" hint="It lives at _dmarc.yourdomain"><TextInput id="dn-dm" value={dm} onChange={(e: Chg) => setDm(e.target.value)} placeholder="v=DMARC1; p=quarantine; rua=mailto:reports@example.com" /></Field>
        <div aria-live="polite" data-testid="dmarc-result">{d && ('error' in d ? <p className="text-sm text-warn" role="alert">{d.error}</p> : <Findings items={d.findings} />)}</div>
      </Card>
      <Card className="p-4 space-y-2"><SectionTitle>Record types</SectionTitle>
        <ul className="space-y-3">{RECORD_TYPES.map((r) => <li key={r.type} className="text-sm space-y-0.5"><div className="flex gap-2 items-center"><Badge tone="accent">{r.type}</Badge><span className="font-medium">{r.use}</span></div><p className="font-mono text-xs wrap-any text-muted">{r.example}</p><p>{r.tip}</p></li>)}</ul></Card>
      <Card className="p-4 space-y-2"><SectionTitle>Reading SPF</SectionTitle><dl className="text-sm space-y-1">{SPF_TERMS.map(([a, b]) => <div key={a}><dt className="font-mono inline">{a}</dt> <dd className="inline">{b}</dd></div>)}</dl></Card>
      <Card className="p-4 space-y-2"><SectionTitle>Reading DMARC</SectionTitle><dl className="text-sm space-y-1">{DMARC_TAGS.map(([a, b]) => <div key={a}><dt className="font-mono inline">{a}</dt> <dd className="inline">{b}</dd></div>)}</dl></Card>
      <Card className="p-4 space-y-2"><SectionTitle>Time to live</SectionTitle><dl className="text-sm space-y-1">{TTL_NOTES.map(([a, b]) => <div key={a}><dt className="font-medium inline">{a}.</dt> <dd className="inline">{b}</dd></div>)}</dl></Card>
      <Card className="p-4 space-y-2"><SectionTitle>Commands</SectionTitle>{DNS_COMMANDS.map(([t, c]) => <div key={t} className="space-y-1"><p className="text-sm font-medium">{t}</p><CodeBlock code={c} /></div>)}</Card>
    </div>
  );
}

export function PasswordPage() {
  useTitle('Password tools');
  const [o, setO] = useState<GenOptions>(DEFAULT_GEN);
  const [pw, setPw] = useState(() => generate(DEFAULT_GEN));
  const [test, setTest] = useState('');
  const set = (patch: Partial<GenOptions>) => { const n = { ...o, ...patch }; setO(n); setPw(generate(n)); };
  const est = estimateBits(pw); const t = estimateBits(test);
  const none = !o.lower && !o.upper && !o.digits && !o.symbols;
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Password tools" sub="Make a random password or test how guessable one is. Nothing is stored or sent." actions={<Back />} />
      <Card className="p-4 space-y-3">
        <SectionTitle>Generate</SectionTitle>
        <Field label={`Length: ${o.length}`} htmlFor="pg-len"><input id="pg-len" type="range" min={8} max={64} value={o.length} onChange={(e: Chg) => set({ length: Number(e.target.value) })} className="w-full" /></Field>
        <div className="grid sm:grid-cols-2 gap-1">
          <Checkbox checked={o.lower} onChange={(v) => set({ lower: v })} label="Lower case" />
          <Checkbox checked={o.upper} onChange={(v) => set({ upper: v })} label="Upper case" />
          <Checkbox checked={o.digits} onChange={(v) => set({ digits: v })} label="Numbers" />
          <Checkbox checked={o.symbols} onChange={(v) => set({ symbols: v })} label="Symbols" />
          <Checkbox checked={o.avoidLookalikes} onChange={(v) => set({ avoidLookalikes: v })} label="Avoid look-alike characters" />
        </div>
        {none ? <p role="alert" className="text-sm text-warn">Pick at least one set of characters.</p> : <div data-testid="pg-output"><CodeBlock code={pw} /></div>}
        <div className="flex flex-wrap gap-2 items-center"><Button onClick={() => set({})} disabled={none}>Generate another</Button>{!none && <Badge tone={est.bits >= 60 ? 'ok' : 'warn'}>{est.label}, about {est.bits} bits</Badge>}</div>
        <p className="text-xs text-muted">Passwords here are made with your browser&apos;s secure random numbers. Put them straight into the approved password manager. Do not type them into tickets or notes.</p>
      </Card>
      <Card className="p-4 space-y-3">
        <SectionTitle>Test a password</SectionTitle>
        <Field label="Password to test" htmlFor="pg-test" hint="Held only on this page. Better to test a similar one than a real one."><TextInput id="pg-test" type="password" autoComplete="off" value={test} onChange={(e: Chg) => setTest(e.target.value)} /></Field>
        <div aria-live="polite" data-testid="pg-test-result">{test && <><Badge tone={t.bits >= 60 ? 'ok' : t.bits >= 45 ? 'warn' : 'bad'}>{t.label}, about {t.bits} bits</Badge>{t.notes.length > 0 && <ul className="list-disc pl-5 text-sm mt-2">{t.notes.map((n) => <li key={n}>{n}</li>)}</ul>}</>}</div>
        <p className="text-xs text-muted">This is a rough guide. Length and randomness matter most. A long random password from a manager beats anything a person can remember. Use multi-factor sign-in as well.</p>
      </Card>
    </div>
  );
}

const Out = ({ label, value }: { label: string; value: string }) => <div className="space-y-1"><p className="text-sm font-medium">{label}</p><CodeBlock code={value} /></div>;

export function ConvertPage() {
  useTitle('Converters');
  const [text, setText] = useState(''); const [mode, setMode] = useState('b64');
  const [time, setTime] = useState(''); const [mac, setMac] = useState('');
  const dec = mode === 'b64' ? fromBase64(text) : mode === 'hex' ? fromHexText(text) : urlDecode(text);
  const enc = mode === 'b64' ? toBase64(text) : mode === 'hex' ? toHexText(text) : urlEncode(text);
  const ms = parseTime(time); const tv = ms === null ? null : viewTime(ms);
  const macs = mac.trim() ? macFormats(mac) : null;
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Converters" sub="Decode text, read timestamps and reformat MAC addresses. Runs on this page only." actions={<Back />} />
      <Card className="p-4 space-y-3">
        <SectionTitle>Text encoding</SectionTitle>
        <Field label="Format" htmlFor="cv-mode"><Select id="cv-mode" value={mode} onChange={(e: Chg) => setMode(e.target.value)}><option value="b64">Base64</option><option value="hex">Hex</option><option value="url">URL encoding</option></Select></Field>
        <Field label="Text" htmlFor="cv-text" hint="Useful for reading an encoded link or script. Decoding does not make it safe to run."><TextArea id="cv-text" rows={3} value={text} onChange={(e: Chg) => setText(e.target.value)} spellCheck={false} /></Field>
        {text && <div className="space-y-2" data-testid="cv-out"><Out label="Encoded" value={enc} />{dec === null ? <p className="text-sm text-muted">That text is not valid {mode === 'b64' ? 'Base64' : mode === 'hex' ? 'hex' : 'URL encoding'}, so it cannot be decoded.</p> : <Out label="Decoded" value={dec} />}</div>}
      </Card>
      <Card className="p-4 space-y-3">
        <SectionTitle>Timestamps</SectionTitle>
        <Field label="Time" htmlFor="cv-time" hint="Unix seconds or milliseconds, a Windows FILETIME, or a date like 2026-09-01T10:00:00Z"><TextInput id="cv-time" value={time} onChange={(e: Chg) => setTime(e.target.value)} /></Field>
        <Button variant="ghost" onClick={() => setTime(String(Date.now()))}>Use the time now</Button>
        {time && !tv && <p className="text-sm text-warn" role="alert">Not a time I can read.</p>}
        {tv && <div className="space-y-2" data-testid="cv-time-out"><Out label="UTC (ISO)" value={tv.iso} /><Out label="On this device" value={tv.local} /><Out label="Unix seconds" value={String(tv.unixSeconds)} /><Out label="Unix milliseconds" value={String(tv.unixMillis)} /><Out label="Windows FILETIME" value={tv.filetime} /></div>}
      </Card>
      <Card className="p-4 space-y-3">
        <SectionTitle>MAC address formats</SectionTitle>
        <Field label="MAC address" htmlFor="cv-mac"><TextInput id="cv-mac" value={mac} onChange={(e: Chg) => setMac(e.target.value)} placeholder="00-1A-2B-3C-4D-5E" /></Field>
        {mac.trim() && !macs && <p className="text-sm text-warn" role="alert">A MAC address has 12 hex digits.</p>}
        {macs && <div className="space-y-1" data-testid="cv-mac-out">{macs.map((m) => <div key={m} className="flex items-center gap-2"><code className="font-mono text-sm flex-1 wrap-any">{m}</code><CopyButton text={m} /></div>)}</div>}
      </Card>
    </div>
  );
}

export function OpsChecksPage() {
  useTitle('Procedure checklists');
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Procedure checklists" sub="Incident first response, backup restore test, starters, leavers and leaving a site. Ticks last for the visit only." actions={<Back />} />
      {OPS_CHECKS.map((l) => <ChecklistCard key={l.id} list={l} />)}
    </div>
  );
}

export function PrintPage() {
  useTitle('Print and scan reference');
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Print and scan reference" sub="Where to look first, what the ports and protocols do, and tick-through checks for scan and queue problems." actions={<Back />} />
      <Card className="p-4 space-y-2"><SectionTitle>What you see and where to look</SectionTitle>
        <ul className="space-y-2 text-sm" data-testid="print-first">{PRINT_FIRST.map(([a, b]) => <li key={a}><span className="font-medium">{a}.</span> <span className="text-muted">{b}</span></li>)}</ul></Card>
      <Card className="p-4 space-y-2"><SectionTitle>Protocols and ports</SectionTitle>
        <ul className="space-y-2 text-sm">{PRINT_PROTOCOLS.map(([a, b, c]) => <li key={a}><span className="font-medium">{a}.</span> {b} <span className="text-muted">Often fails because: {c}.</span></li>)}</ul>
        <p className="text-xs text-muted">Printing and scanning are separate functions. A printer can print perfectly while scan-to-email is broken. Diagnose the exact function reported.</p></Card>
      {PRINT_CHECKS.map((l) => <ChecklistCard key={l.id} list={l} />)}
      <Card className="p-4 text-sm space-y-1"><SectionTitle>Do not change without approval</SectionTitle>
        <ul className="list-disc pl-5"><li>The printer administrator password</li><li>Addresses, subnet, gateway or name servers</li><li>Firmware</li><li>Mail sign-in or security settings</li><li>File-sharing security level</li><li>Factory defaults</li><li>Queues and drivers on a shared print server</li></ul></Card>
    </div>
  );
}

export function EngToolsPage() {
  useTitle('Engineer tool guide');
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const match = (t: (typeof ENG_TOOLS)[number]) => !ql || `${t.name} ${t.what} ${t.use} ${t.group}`.toLowerCase().includes(ql);
  const shown = ENG_TOOLS.filter(match);
  return (
    <div className="max-w-3xl pb-10 space-y-4" data-testid="eng-tools">
      <PageHeader title="Engineer tool guide" sub="What well-known tools are for, when to reach for them, and starter commands." actions={<Back />} />
      <Card className="p-4 text-sm space-y-1">
        <p>Short orientation notes from your own research list, not manuals. Examples use made-up documentation addresses (192.0.2.x).</p>
        <p className="text-muted">Check each tool's licence and your employer's software policy before installing anything on a work device. Use scanning and capture tools only where you are authorised.</p>
      </Card>
      <Card className="p-4"><Field label="Search the guide" htmlFor="eng-q"><TextInput id="eng-q" value={q} placeholder="tunnel, scan, backup" onChange={(e: Chg) => setQ(e.target.value)} /></Field></Card>
      <p className="text-xs text-muted" aria-live="polite" data-testid="eng-count">{shown.length} tool{shown.length === 1 ? '' : 's'}</p>
      {ENG_GROUPS.map((g) => {
        const items = shown.filter((t) => t.group === g);
        if (!items.length) return null;
        return (
          <section key={g} className="space-y-2" aria-label={g}>
            <h2 className="text-sm font-semibold text-muted px-1">{g}</h2>
            {items.map((t) => (
              <Card key={t.id} className="p-3" data-testid={`eng-${t.id}`}>
                <details>
                  <summary className="cursor-pointer font-medium min-h-9 flex items-center">{t.name}</summary>
                  <div className="mt-2 space-y-2 text-sm">
                    <p>{t.what}</p>
                    <p><span className="font-medium">Reach for it when:</span> {t.use}</p>
                    {t.job && <p><span className="font-medium">In your work:</span> {t.job}</p>}
                    {t.cmds.length > 0 && <CodeBlock code={t.cmds.join('\n')} />}
                    {t.care && <p className="text-muted"><span className="font-medium text-ink">Take care:</span> {t.care}</p>}
                    {t.lab && <p><Badge tone="info">Practice</Badge> {t.lab} <Link to="/tools/lab" className="underline">Open the Network lab</Link></p>}
                  </div>
                </details>
              </Card>
            ))}
          </section>
        );
      })}
    </div>
  );
}
