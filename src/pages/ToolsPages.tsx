import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, FAULTS, HOLD, LIMITS, OTHER_CONNECTORS, PAIRS, PINOUT, POE, STEPS, ends } from '../content/cabling';
import type { Standard, Stripe } from '../content/cabling';
import { KIT_LISTS } from '../content/kit';
import { calcSubnet, convertNumber, costPerPage, humanDuration, prefixForHosts, sameSubnet, SIZE_UNITS, SPEED_UNITS, transferSeconds, parsePrefix } from '../lib/subnet';
import { EMPTY_NOTE, closureNote, customerUpdate, isEmptyNote } from '../lib/ticketNote';
import type { NoteFields } from '../lib/ticketNote';
import { scanText } from '../lib/sensitive';
import { Badge, Button, Card, Checkbox, Chip, CopyButton, Field, PageHeader, SectionTitle, Select, TextArea, TextInput } from '../ui/primitives';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

const onVal = (set: (v: string) => void) => (e: { target: { value: string } }) => set(e.target.value);

// ---------- hub ----------
const TOOLS = [
  { to: '/tools/cable', title: 'Cable guide', blurb: 'RJ45 wiring diagram, straight and crossover, faults, limits, PoE' },
  { to: '/tools/calc', title: 'Calculators', blurb: 'Subnets, number converter, transfer time, cost per page' },
  { to: '/tools/redact', title: 'Screenshot redactor', blurb: 'Black out names and numbers before you keep an image' },
  { to: '/tools/notes', title: 'Ticket note builder', blurb: 'A closure note and a customer update from a few boxes' },
  { to: '/tools/kit', title: 'Kit checklists', blurb: 'Tools, spares and before-you-leave checks' },
];
export function ToolsHub() {
  useTitle('Toolbox');
  return (
    <div className="max-w-3xl pb-10">
      <PageHeader title="Toolbox" sub="Small tools for the job. Everything runs on this device and nothing is sent anywhere." />
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="tool-list">
        {TOOLS.map((t) => (
          <li key={t.to}><Link to={t.to} className="block h-full rounded-md border border-line bg-surface p-3 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent"><p className="font-medium">{t.title}</p><p className="text-sm text-muted">{t.blurb}</p></Link></li>
        ))}
      </ul>
    </div>
  );
}

// ---------- cable guide ----------
const hexOk = (c: string) => c.replace('#', '');
function Pinout({ standard, label }: { standard: Standard; label: string }) {
  const wires = PINOUT[standard];
  const w = 52, gap = 6, W = wires.length * (w + gap) + gap;
  const pid = (s: Stripe) => `st-${standard}-${hexOk(s.base)}`;
  const bases = [...new Set(wires.filter((s) => s.striped).map((s) => s.base))];
  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} 190`} role="img" aria-label={`${label}: ${standard}. ${wires.map((s, i) => `Pin ${i + 1} ${s.name}`).join(', ')}.`} className="w-full max-w-md">
        <defs>{bases.map((c) => (
          <pattern key={c} id={`st-${standard}-${hexOk(c)}`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#ffffff" /><rect width="6" height="12" fill={c} /></pattern>
        ))}</defs>
        <rect x="0" y="0" width={W} height="190" rx="8" fill="none" stroke="currentColor" strokeOpacity=".25" />
        {wires.map((s, i) => {
          const x = gap + i * (w + gap) + 0;
          return (
            <g key={i}>
              <rect x={x} y="14" width={w} height="110" rx="6" fill={s.striped ? `url(#${pid(s)})` : s.base} stroke="currentColor" strokeOpacity=".5" />
              <text x={x + w / 2} y="150" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">{i + 1}</text>
              <text x={x + w / 2} y="172" textAnchor="middle" fontSize="9.5" fill="currentColor">{s.striped ? 'white/' + s.name.slice(6).toLowerCase() : s.name.toLowerCase()}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-muted">{label}: {standard}, pin 1 on the left</figcaption>
    </figure>
  );
}

export function CablePage() {
  useTitle('Cable guide');
  const [std, setStd] = useState<Standard>('T568B');
  const [kind, setKind] = useState<'straight' | 'crossover'>('straight');
  const [a, b] = ends(kind, std);
  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Cable guide" sub="Wire and test an Ethernet cable, and read the faults." actions={<Link to="/tools"><Button>Toolbox</Button></Link>} />
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cable type">
          <Chip active={kind === 'straight'} onClick={() => setKind('straight')}>Straight-through</Chip>
          <Chip active={kind === 'crossover'} onClick={() => setKind('crossover')}>Crossover</Chip>
        </div>
        {kind === 'straight' && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Standard">
            <Chip active={std === 'T568B'} onClick={() => setStd('T568B')}>T568B</Chip>
            <Chip active={std === 'T568A'} onClick={() => setStd('T568A')}>T568A</Chip>
          </div>
        )}
        <p className="text-sm" data-testid="cable-summary">{kind === 'straight' ? `Both ends ${std}. This is the normal patch lead and the right choice for almost everything.` : 'One end T568A and the other T568B. Rarely needed now because modern ports sort this out themselves (auto-MDI/MDI-X).'}</p>
        <div className="grid gap-3 sm:grid-cols-2" data-testid="pinouts"><Pinout standard={a} label="End 1" /><Pinout standard={b} label="End 2" /></div>
        <p className="text-sm rounded-md border border-line bg-surface2 p-2" role="note">{HOLD}</p>
        {kind === 'crossover' && <p className="text-sm text-muted">What changes: pins 1 and 2 swap with pins 3 and 6, so transmit meets receive. Pins 4, 5, 7 and 8 stay the same.</p>}
      </Card>

      <section aria-label="How to terminate"><SectionTitle>Terminate and test</SectionTitle>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm">{STEPS.map((s) => <li key={s} className="wrap-any">{s}</li>)}</ol>
      </section>

      <section aria-label="Pairs"><SectionTitle>The four pairs</SectionTitle>
        <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">{PAIRS.map(([p, t]) => <li key={p} className="rounded-md border border-line p-2"><span className="font-medium">{p}</span>: {t}</li>)}</ul>
        <p className="text-xs text-muted mt-1">Pair 2 is pins 1 and 2. In both standards pins 4 and 5 are the blue pair and 7 and 8 are the brown pair. Pins 3 and 6 split from the pair they belong to, which is why wire order matters.</p>
      </section>

      <Table title="Faults and what they mean" head={['Fault', 'Likely cause and fix']} rows={FAULTS} />
      <Table title="Cable categories" head={['Category', 'Typical use']} rows={CATEGORIES} />
      <Table title="Power over Ethernet" head={['Standard', 'Power']} rows={POE} />
      <Table title="Other connectors" head={['Connector', 'Notes']} rows={OTHER_CONNECTORS} />
      <section aria-label="Limits and good practice"><SectionTitle>Limits and good practice</SectionTitle><ul className="list-disc pl-5 space-y-1 text-sm">{LIMITS.map((s) => <li key={s} className="wrap-any">{s}</li>)}</ul></section>
    </div>
  );
}

function Table({ title, head, rows }: { title: string; head: [string, string] | string[]; rows: Array<[string, string]> }) {
  return (
    <section aria-label={title}><SectionTitle>{title}</SectionTitle>
      <div className="overflow-x-auto"><table className="w-full text-sm border border-line rounded-md"><thead className="bg-surface2 text-left"><tr><th className="p-2">{head[0]}</th><th className="p-2">{head[1]}</th></tr></thead>
        <tbody>{rows.map(([x, y]) => <tr key={x} className="border-t border-line align-top"><th scope="row" className="p-2 text-left font-medium wrap-any">{x}</th><td className="p-2 wrap-any">{y}</td></tr>)}</tbody></table></div>
    </section>
  );
}

// ---------- calculators ----------
function Row({ k, v }: { k: string; v: string }) { return <div className="flex justify-between gap-3 border-t border-line py-1.5 first:border-t-0"><dt className="text-muted">{k}</dt><dd className="font-mono wrap-any text-right">{v}</dd></div>; }

export function CalcPage() {
  useTitle('Calculators');
  const [addr, setAddr] = useState('192.168.10.25');
  const [pre, setPre] = useState('24');
  const sn = useMemo(() => calcSubnet(addr, pre), [addr, pre]);
  const [other, setOther] = useState('');
  const [need, setNeed] = useState('');
  const needPre = need ? prefixForHosts(Number(need)) : null;
  const [num, setNum] = useState('255');
  const conv = useMemo(() => convertNumber(num), [num]);
  const [size, setSize] = useState('1'); const [su, setSu] = useState('GB'); const [spd, setSpd] = useState('100'); const [spu, setSpu] = useState('Mbps');
  const secs = transferSeconds(Number(size), su, Number(spd), spu);
  const [price, setPrice] = useState(''); const [yld, setYld] = useState('');
  const cpp = costPerPage(Number(price), Number(yld));
  const p = parsePrefix(addr.includes('/') ? addr.split('/')[1] : pre);
  const same = other && p !== null ? sameSubnet(addr.split('/')[0], other, p) : null;
  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Calculators" sub="Quick sums for site work. Nothing is saved." actions={<Link to="/tools"><Button>Toolbox</Button></Link>} />
      <Card className="p-4 space-y-3" aria-label="Subnet calculator">
        <SectionTitle>Subnet calculator</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="IPv4 address" htmlFor="sn-addr" hint="You can also type 192.168.1.10/24"><TextInput id="sn-addr" inputMode="decimal" value={addr} onChange={onVal(setAddr)} /></Field>
          <Field label="Prefix or mask" htmlFor="sn-pre" hint="24, /24 or 255.255.255.0"><TextInput id="sn-pre" value={pre} onChange={onVal(setPre)} /></Field>
        </div>
        {'error' in sn ? <p role="alert" className="text-sm text-bad" data-testid="sn-error">{sn.error}</p> : (
          <dl className="text-sm" data-testid="sn-result">
            <Row k="Network" v={sn.cidr} /><Row k="Mask" v={`${sn.mask}  (/${sn.prefix})`} /><Row k="Wildcard" v={sn.wildcard} />
            <Row k="First usable" v={sn.first ?? ''} /><Row k="Last usable" v={sn.last ?? ''} /><Row k="Broadcast" v={sn.broadcast ?? 'none for this size'} />
            <Row k="Usable hosts" v={sn.hosts.toLocaleString('en-GB')} /><Row k="Type" v={sn.kind} />
            <Row k="Address in binary" v={sn.binaryAddress} /><Row k="Mask in binary" v={sn.binaryMask} />
          </dl>
        )}
        <div className="grid gap-3 sm:grid-cols-2 border-t border-line pt-3">
          <Field label="Is another address on the same subnet?" htmlFor="sn-other" hint="Uses the prefix above"><TextInput id="sn-other" inputMode="decimal" value={other} onChange={onVal(setOther)} placeholder="192.168.10.200" /></Field>
          <div className="text-sm self-end min-h-11 flex items-center" role="status" data-testid="sn-same">{same === null ? (other ? 'Check both addresses.' : '') : same ? <Badge tone="ok">Same subnet</Badge> : <Badge tone="warn">Different subnet: needs the gateway</Badge>}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 border-t border-line pt-3">
          <Field label="How many hosts do you need?" htmlFor="sn-need"><TextInput id="sn-need" inputMode="numeric" value={need} onChange={onVal(setNeed)} /></Field>
          <p className="text-sm self-end min-h-11 flex items-center" role="status" data-testid="sn-need-out">{need ? (needPre === null ? 'Enter a number from 1 to 4,294,967,294.' : `Use /${needPre}: ${(2 ** (32 - needPre) - 2).toLocaleString('en-GB')} usable hosts.`) : ''}</p>
        </div>
      </Card>

      <Card className="p-4 space-y-3" aria-label="Number converter">
        <SectionTitle>Number converter</SectionTitle>
        <Field label="Number" htmlFor="cv-num" hint="Decimal, 0x for hex or 0b for binary"><TextInput id="cv-num" value={num} onChange={onVal(setNum)} /></Field>
        {'error' in conv ? <p role="alert" className="text-sm text-bad">{conv.error}</p> : <dl className="text-sm" data-testid="cv-result"><Row k="Decimal" v={conv.dec} /><Row k="Hex" v={conv.hex} /><Row k="Binary" v={conv.bin} /></dl>}
      </Card>

      <Card className="p-4 space-y-3" aria-label="Transfer time">
        <SectionTitle>Transfer time</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Size" htmlFor="tt-size"><TextInput id="tt-size" inputMode="decimal" value={size} onChange={onVal(setSize)} /></Field>
          <Field label="Unit" htmlFor="tt-su"><Select id="tt-su" value={su} onChange={onVal(setSu)}>{SIZE_UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
          <Field label="Speed" htmlFor="tt-spd"><TextInput id="tt-spd" inputMode="decimal" value={spd} onChange={onVal(setSpd)} /></Field>
          <Field label="Unit" htmlFor="tt-spu"><Select id="tt-spu" value={spu} onChange={onVal(setSpu)}>{SPEED_UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
        </div>
        <p className="text-sm" role="status" data-testid="tt-out">{secs === null ? 'Enter a size and a speed.' : `About ${humanDuration(secs)} at full speed.`}</p>
        <p className="text-xs text-muted">Real transfers are slower than the line speed because of overheads and other traffic.</p>
      </Card>

      <Card className="p-4 space-y-3" aria-label="Cost per page">
        <SectionTitle>Cost per page</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cartridge price" htmlFor="cp-price"><TextInput id="cp-price" inputMode="decimal" value={price} onChange={onVal(setPrice)} /></Field>
          <Field label="Page yield" htmlFor="cp-yield" hint="Pages per cartridge at stated coverage"><TextInput id="cp-yield" inputMode="numeric" value={yld} onChange={onVal(setYld)} /></Field>
        </div>
        <p className="text-sm" role="status" data-testid="cp-out">{cpp === null ? 'Enter a price and a yield.' : `${cpp.toFixed(4)} per page, or ${(cpp * 1000).toFixed(2)} per 1,000 pages.`}</p>
      </Card>
    </div>
  );
}

// ---------- ticket note builder ----------
export function NotePage() {
  useTitle('Ticket note builder');
  const [f, setF] = useState<NoteFields>(EMPTY_NOTE);
  const text: Record<keyof Omit<NoteFields, 'escalated'>, string> = { reported: f.reported, scope: f.scope, checks: f.checks, cause: f.cause, action: f.action, test: f.test, followUp: f.followUp };
  const guard = useSaveGuard(text);
  const set = (k: keyof NoteFields) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const apply = (r: Record<string, string>) => { setF({ ...f, ...(r as Partial<NoteFields>) }); guard.setConfirmed(false); };
  const empty = isEmptyNote(f);
  const note = closureNote(f), update = customerUpdate(f);
  const ok = !empty && guard.canSave;
  return (
    <div className="max-w-3xl pb-10 space-y-4">
      <PageHeader title="Ticket note builder" sub="Fill in what you know. Leave blanks out. Copy the result into your ticketing system." actions={<Link to="/tools"><Button>Toolbox</Button></Link>} />
      <Card className="p-4 space-y-3">
        <Field label="What was reported" htmlFor="nb-rep"><TextInput id="nb-rep" value={f.reported} onChange={set('reported')} placeholder="Scan to folder stopped working" /></Field>
        <Field label="Scope" htmlFor="nb-scope" hint="One user, several, one device, whole site"><TextInput id="nb-scope" value={f.scope} onChange={set('scope')} /></Field>
        <Field label="Key checks" htmlFor="nb-chk"><TextArea id="nb-chk" rows={2} value={f.checks} onChange={set('checks')} /></Field>
        <Field label="Cause" htmlFor="nb-cause" hint="Leave blank if not identified"><TextInput id="nb-cause" value={f.cause} onChange={set('cause')} /></Field>
        <Field label="What you changed" htmlFor="nb-act"><TextArea id="nb-act" rows={2} value={f.action} onChange={set('action')} /></Field>
        <Field label="How you tested it" htmlFor="nb-test"><TextInput id="nb-test" value={f.test} onChange={set('test')} /></Field>
        <Field label="Follow-up" htmlFor="nb-fu" hint="Anything outstanding, and who has it"><TextInput id="nb-fu" value={f.followUp} onChange={set('followUp')} /></Field>
        <Checkbox checked={f.escalated} onChange={(v) => setF({ ...f, escalated: v })} label="This has been escalated" />
        <SensitivePanel guard={guard} fieldLabels={{ reported: 'Reported', scope: 'Scope', checks: 'Checks', cause: 'Cause', action: 'Action', test: 'Test', followUp: 'Follow-up' }} onRedactAll={() => apply(guard.redactAll(text))} onRedactKind={(k) => apply(guard.redactOneKind(text, k))} />
        <div className="flex justify-between items-center"><PrivacyNote /><Button variant="ghost" onClick={() => { setF(EMPTY_NOTE); guard.setConfirmed(false); }}>Clear</Button></div>
      </Card>
      <Card className="p-4 space-y-2" aria-label="Closure note">
        <SectionTitle action={ok ? <CopyButton text={note} label="Copy note" /> : undefined}>Closure note</SectionTitle>
        <pre className="text-sm whitespace-pre-wrap wrap-any" data-testid="nb-note">{empty ? 'Fill in a box above and the note appears here.' : note}</pre>
      </Card>
      <Card className="p-4 space-y-2" aria-label="Customer update">
        <SectionTitle action={ok ? <CopyButton text={update} label="Copy update" /> : undefined}>Customer update</SectionTitle>
        <pre className="text-sm whitespace-pre-wrap wrap-any" data-testid="nb-update">{empty ? 'Fill in a box above and the update appears here.' : update}</pre>
      </Card>
      {!empty && !guard.canSave && <p role="status" className="text-sm text-warn">Copying is off until the details flagged above are removed or confirmed.</p>}
    </div>
  );
}

// ---------- kit checklists ----------
const KIT_KEY = 'forgetools:kit';
interface KitState { ticks: string[]; custom: Record<string, string[]> }
const readKit = (): KitState => {
  try { const v = JSON.parse(localStorage.getItem(KIT_KEY) ?? 'null'); if (v && Array.isArray(v.ticks) && v.custom && typeof v.custom === 'object') return { ticks: v.ticks.filter((x: unknown) => typeof x === 'string'), custom: Object.fromEntries(Object.entries(v.custom).map(([k, a]) => [k, Array.isArray(a) ? (a as unknown[]).filter((x) => typeof x === 'string') as string[] : []])) }; } catch { /* none */ }
  return { ticks: [], custom: {} };
};

export function KitPage() {
  useTitle('Kit checklists');
  const [st, setSt] = useState<KitState>(readKit);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  useEffect(() => { try { localStorage.setItem(KIT_KEY, JSON.stringify(st)); } catch { /* storage unavailable */ } }, [st]);
  const tick = (id: string, on: boolean) => setSt((s) => ({ ...s, ticks: on ? [...new Set([...s.ticks, id])] : s.ticks.filter((x) => x !== id) }));
  const addCustom = (lid: string) => {
    const t = (draft[lid] ?? '').trim();
    if (!t) return;
    if (scanText(t).length) { setMsg('That looks like it contains a secret or a personal detail, so it was not added. Keep checklist items generic.'); return; }
    setMsg('');
    setSt((s) => ({ ...s, custom: { ...s.custom, [lid]: [...(s.custom[lid] ?? []), t.slice(0, 120)] } }));
    setDraft({ ...draft, [lid]: '' });
  };
  const removeCustom = (lid: string, i: number) => setSt((s) => ({ ...s, custom: { ...s.custom, [lid]: (s.custom[lid] ?? []).filter((_, j) => j !== i) }, ticks: s.ticks.filter((x) => x !== `${lid}:c${i}`) }));
  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Kit checklists" sub="Tick things off as you pack. Ticks stay until you clear them. Add your own items." actions={<Link to="/tools"><Button>Toolbox</Button></Link>} />
      {msg && <p role="alert" className="text-sm text-warn">{msg}</p>}
      {KIT_LISTS.map((l) => {
        const custom = st.custom[l.id] ?? [];
        const ids = [...l.items.map((_, i) => `${l.id}:${i}`), ...custom.map((_, i) => `${l.id}:c${i}`)];
        const done = ids.filter((i) => st.ticks.includes(i)).length;
        return (
          <Card key={l.id} className="p-4 space-y-2" aria-label={l.title}>
            <SectionTitle action={<><span className="text-xs text-muted mr-2" aria-live="polite" data-testid={`kit-count-${l.id}`}>{done} of {ids.length}</span><Button size="sm" variant="ghost" disabled={!done} onClick={() => setSt((s) => ({ ...s, ticks: s.ticks.filter((t) => !ids.includes(t)) }))}>Clear ticks</Button></>}>{l.title}</SectionTitle>
            <p className="text-xs text-muted">{l.intro}</p>
            <ul className="space-y-1">
              {l.items.map((it, i) => <li key={it}><Checkbox checked={st.ticks.includes(`${l.id}:${i}`)} onChange={(v) => tick(`${l.id}:${i}`, v)} label={it} /></li>)}
              {custom.map((it, i) => <li key={it + i} className="flex items-center gap-2"><div className="flex-1 min-w-0"><Checkbox checked={st.ticks.includes(`${l.id}:c${i}`)} onChange={(v) => tick(`${l.id}:c${i}`, v)} label={it} /></div><Button size="sm" variant="ghost" aria-label={`Remove ${it}`} onClick={() => removeCustom(l.id, i)}>Remove</Button></li>)}
            </ul>
            <form className="flex gap-2 pt-1" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); addCustom(l.id); }}>
              <TextInput aria-label={`Add an item to ${l.title}`} placeholder="Add your own item" value={draft[l.id] ?? ''} onChange={(e: { target: { value: string } }) => setDraft({ ...draft, [l.id]: e.target.value })} />
              <Button type="submit" disabled={!(draft[l.id] ?? '').trim()}>Add</Button>
            </form>
          </Card>
        );
      })}
      <p className="text-xs text-muted">Saved only on this device.</p>
    </div>
  );
}
