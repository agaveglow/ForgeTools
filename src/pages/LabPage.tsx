import { useEffect, useMemo, useRef, useState } from 'react';
import { baseNet, SCENARIOS } from '../content/lab';
import { banner, cableUp, dev, goalMet, isIp, maskValid, runCommand } from '../lib/netsim';
import type { Dev, Kind, Net, Session } from '../lib/netsim';
import { Badge, Button, Card, Checkbox, Chip, Collapsible, Field, PageHeader, SectionTitle, Select, TextInput } from '../ui/primitives';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

type Chg = { target: { value: string } };
const QUICK = ['ipconfig', 'ipconfig /all', 'ping 192.168.10.1', 'ping prn-01.lab.test', 'tracert 203.0.113.10', 'nslookup files.lab.test', 'arp -a', 'netstat -an', 'Test-NetConnection prn-01.lab.test -Port 9100', 'help'];
const SHORT: Record<Kind, string> = { pc: 'PC', printer: 'PRN', switch: 'SW', router: 'RTR', server: 'SRV', cloud: 'NET' };
const TIER: Record<Kind, number> = { cloud: 0, router: 1, switch: 2, pc: 3, printer: 3, server: 3 };
const W = 640, H = 330, NW = 92, NH = 46;

function layout(net: Net): Record<string, { x: number; y: number }> {
  const tiers: Dev[][] = [[], [], [], []];
  net.devices.forEach(d => tiers[TIER[d.kind]].push(d));
  const pos: Record<string, { x: number; y: number }> = {};
  tiers.forEach((row, t) => row.forEach((d, i) => { pos[d.id] = { x: ((i + 1) * W) / (row.length + 1), y: 40 + t * 90 }; }));
  return pos;
}

function Diagram({ net, sel, onSel }: { net: Net; sel: string; onSel: (id: string) => void }) {
  const pos = layout(net);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="group" aria-label="Network diagram. Each device is a button; select one to edit it.">
      {net.links.map(l => {
        const a = pos[l.a], b = pos[l.b]; if (!a || !b) return null;
        return <line key={l.id} data-testid={`cable-${l.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.up ? 'currentColor' : '#e5484d'} strokeWidth={l.up ? 2 : 2.5} strokeDasharray={l.up ? undefined : '6 4'} opacity={l.up ? 0.45 : 1} />;
      })}
      {net.devices.map(d => {
        const p = pos[d.id]; if (!p) return null;
        const ip = d.ifaces.map(f => f.ip).filter(Boolean)[0] ?? '';
        const active = d.id === sel;
        return (
          <g key={d.id} data-testid={`dev-${d.id}`} role="button" tabIndex={0} aria-pressed={active}
            aria-label={`${d.name}, ${d.up ? 'on' : 'switched off'}${ip ? ', ' + ip : ''}`}
            onClick={() => onSel(d.id)} onKeyDown={(e: { key: string; preventDefault(): void }) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSel(d.id); } }}
            className="cursor-pointer outline-none" opacity={d.up ? 1 : 0.5}>
            <rect x={p.x - NW / 2} y={p.y - NH / 2} width={NW} height={NH} rx={6} fill="var(--c-surface, #111)" stroke={active ? 'var(--c-accent, #4ade80)' : 'currentColor'} strokeWidth={active ? 3 : 1.5} strokeDasharray={d.up ? undefined : '4 3'} />
            <text x={p.x} y={p.y - 3} textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor">{SHORT[d.kind]} {d.name.length > 9 ? d.name.slice(0, 9) : d.name}</text>
            <text x={p.x} y={p.y + 13} textAnchor="middle" fontSize="9.5" fill="currentColor" opacity={0.75}>{d.up ? ip : 'off'}</text>
          </g>
        );
      })}
    </svg>
  );
}

function IpField({ id, label, value, onChange, mask }: { id: string; label: string; value: string; onChange: (v: string) => void; mask?: boolean }) {
  const bad = value.trim() !== '' && (mask ? !maskValid(value) : !isIp(value));
  return (
    <Field label={label} htmlFor={id} hint={bad ? (mask ? 'Not a valid mask (for example 255.255.255.0)' : 'Not a valid address') : undefined}>
      <TextInput id={id} value={value} aria-invalid={bad} inputMode="decimal" autoComplete="off" onChange={(e: Chg) => onChange(e.target.value)} />
    </Field>
  );
}

function Editor({ net, d, setNet, remove }: { net: Net; d: Dev; setNet: (n: Net) => void; remove: () => void }) {
  const patch = (f: (x: Dev) => Dev) => setNet({ ...net, devices: net.devices.map(x => (x.id === d.id ? f(x) : x)) });
  const isHost = d.kind !== 'switch' && d.kind !== 'cloud';
  const links = net.links.filter(l => l.a === d.id || l.b === d.id);
  return (
    <Card className="p-4 space-y-3" data-testid="editor">
      <SectionTitle>{d.name} <span className="text-muted font-normal text-sm">({d.kind})</span></SectionTitle>
      <Checkbox id="ed-power" checked={d.up} onChange={(v: boolean) => patch(x => ({ ...x, up: v }))} label="Powered on" />
      {d.kind !== 'switch' && d.ifaces.map((f, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <IpField id={`ed-ip-${i}`} label={d.ifaces.length > 1 ? `Address ${i + 1}` : 'IP address'} value={f.ip} onChange={v => patch(x => ({ ...x, ifaces: x.ifaces.map((y, j) => (j === i ? { ...y, ip: v } : y)) }))} />
          <IpField id={`ed-mask-${i}`} mask label="Subnet mask" value={f.mask} onChange={v => patch(x => ({ ...x, ifaces: x.ifaces.map((y, j) => (j === i ? { ...y, mask: v } : y)) }))} />
        </div>
      ))}
      {isHost && <div className="grid grid-cols-2 gap-2">
        <IpField id="ed-gw" label="Default gateway" value={d.gateway ?? ''} onChange={v => patch(x => ({ ...x, gateway: v }))} />
        {d.kind !== 'router' && <IpField id="ed-dns" label="DNS server" value={d.dns ?? ''} onChange={v => patch(x => ({ ...x, dns: v }))} />}
      </div>}
      {isHost && d.kind !== 'router' && <div className="grid grid-cols-2 gap-2">
        <Field label="Blocked ports" hint="Numbers separated by commas" htmlFor="ed-blocked">
          <TextInput id="ed-blocked" value={(d.blocked ?? []).join(', ')} placeholder="9100, 445" onChange={(e: Chg) => patch(x => ({ ...x, blocked: e.target.value.split(/[^0-9]+/).filter(Boolean).map(Number).filter(n => n > 0 && n < 65536) }))} />
        </Field>
        <Field label="VLAN" hint="Same number to talk on a switch" htmlFor="ed-vlan">
          <TextInput id="ed-vlan" value={String(d.ifaces[0]?.vlan ?? 1)} inputMode="numeric" onChange={(e: Chg) => { const n = Number(e.target.value.replace(/\D/g, '')) || 1; patch(x => ({ ...x, ifaces: x.ifaces.map((y, j) => (j === 0 ? { ...y, vlan: n } : y)) })); }} />
        </Field>
      </div>}
      {isHost && <Checkbox id="ed-noping" checked={!!d.noPing} onChange={(v: boolean) => patch(x => ({ ...x, noPing: v }))} label="Ignore ping (a firewall rule)" />}
      {links.length > 0 && <div className="space-y-1">
        <p className="text-sm font-medium">Cables</p>
        {links.map(l => {
          const other = dev(net, l.a === d.id ? l.b : l.a);
          return <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
            <span>To {other?.name}: {l.up ? 'connected' : 'unplugged'}</span>
            <Button size="sm" data-testid={`cable-btn-${l.id}`} onClick={() => setNet({ ...net, links: net.links.map(x => (x.id === l.id ? { ...x, up: !x.up } : x)) })}>{l.up ? 'Unplug' : 'Plug in'}</Button>
          </div>;
        })}
      </div>}
      {d.kind !== 'cloud' && <Button variant="danger" size="sm" onClick={remove}>Remove this device</Button>}
    </Card>
  );
}

const INTRO: Array<[string, string]> = [
  ['Reply from <the address you pinged>', 'It is alive and the path works both ways.'],
  ['Destination host unreachable, from your own address', 'Nothing on your own network answers. Check the cable, power, switch, the target\'s address, VLAN.'],
  ['Destination host unreachable, from the router\'s address', 'You reached the router but it has no route onward.'],
  ['Request timed out', 'Sent, nothing came back. Blocked, off, or a path or return-route problem further along. Use tracert to see where it stops.'],
  ['Ping request could not find host', 'A name problem, not a path problem. Try the address, then check DNS with nslookup.'],
  ['An address starting 169.254', 'The PC could not get an address from DHCP. Look at the DHCP server and the cable.'],
  ['Pings by address, fails by name', 'DNS: wrong server, server down, or missing record.'],
  ['Pings, but the service fails', 'Test the exact port (Test-NetConnection name -Port n). A firewall or the service itself.'],
];

export function LabPage() {
  useTitle('Network lab');
  const [sid, setSid] = useState('wrong-ip');
  const scenario = SCENARIOS.find(s => s.id === sid)!;
  const [net, setNet] = useState<Net>(() => scenario.setup(baseNet()));
  const [at, setAt] = useState(scenario.at);
  const [arp, setArp] = useState<string[]>([]);
  const [lines, setLines] = useState<string[]>(banner());
  const [input, setInput] = useState('');
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const [sel, setSel] = useState('prn');
  const logRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [lines]);

  const load = (id: string) => {
    const sc = SCENARIOS.find(s => s.id === id)!;
    setSid(id); setNet(sc.setup(baseNet())); setAt(sc.at); setArp([]); setLines(banner()); setHist([]); setHi(-1); setSel(id === 'dhcp' ? 'srv' : 'prn');
  };
  const sessionNow: Session = { net, at, arp };
  const seatDev = dev(net, at);
  const prompt = `C:\\Users\\student>`;
  const exec = (cmd: string) => {
    const text = cmd.trim(); if (!text) return;
    const r = runCommand(sessionNow, text);
    setNet(r.session.net); setArp(r.session.arp);
    setLines(r.clear ? [] : [...lines, `${seatDev?.name ?? ''} ${prompt}${text}`, ...r.out, '']);
    setHist([text, ...hist].slice(0, 50)); setHi(-1); setInput('');
  };
  const onKey = (e: { key: string; preventDefault(): void }) => {
    if (e.key === 'Enter') { e.preventDefault(); exec(input); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const n = Math.min(hi + 1, hist.length - 1); if (n >= 0 && hist[n] !== undefined) { setHi(n); setInput(hist[n]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const n = hi - 1; if (n < 0) { setHi(-1); setInput(''); } else { setHi(n); setInput(hist[n]); } }
  };
  const solved = useMemo(() => (scenario.goal ? goalMet(net, scenario.goal) : false), [net, scenario]);
  const seats = net.devices.filter(d => d.kind === 'pc' || d.kind === 'server');
  const selected = dev(net, sel);

  const add = (kind: Kind) => {
    const n = net.devices.filter(d => d.kind === kind).length + 1;
    const lan = net.devices.find(d => d.kind === 'router')?.ifaces[0];
    const prefix = lan && isIp(lan.ip) ? lan.ip.split('.').slice(0, 3).join('.') : '192.168.1';
    const used = net.devices.flatMap(d => d.ifaces.map(f => Number(f.ip.split('.')[3]))).filter(Number.isFinite);
    let host = 100; while (used.includes(host) && host < 250) host++;
    const id = `${kind}-${Date.now() % 100000}-${n}`;
    const name = `${SHORT[kind]}-${String(n + (kind === 'pc' ? 2 : kind === 'printer' ? 1 : kind === 'server' ? 1 : 0)).padStart(2, '0')}`;
    const attach = net.devices.find(d => d.kind === 'switch') ?? net.devices.find(d => d.kind === 'router');
    const d: Dev = kind === 'switch' ? { id, name, kind, up: true, ifaces: [] }
      : { id, name, kind, up: true, ifaces: [{ ip: `${prefix}.${host}`, mask: '255.255.255.0' }], gateway: lan?.ip, dns: kind === 'printer' ? undefined : net.devices.find(x => x.dns)?.dns, listen: kind === 'printer' ? [80, 443, 631, 9100] : [135, 445] };
    setNet({ devices: [...net.devices, d], links: attach ? [...net.links, { id: `l-${id}`, a: attach.id, b: id, aIf: attach.kind === 'router' ? 0 : undefined, up: true }] : net.links });
    setSel(id);
  };
  const remove = (id: string) => {
    setNet({ devices: net.devices.filter(d => d.id !== id), links: net.links.filter(l => l.a !== id && l.b !== id) });
    if (at === id) setAt(seats.find(s => s.id !== id)?.id ?? at);
    setSel('r1');
  };
  const cableNote = seatDev && seatDev.ifaces.length > 0 && !cableUp(net, seatDev, 0) ? 'No working cable on this computer.' : '';

  return (
    <div className="max-w-5xl pb-10 space-y-4" data-testid="lab">
      <PageHeader title="Network lab" sub="A practice network and command prompt. Break it, read the output, fix it." actions={<Link to="/tools"><Button>Toolbox</Button></Link>} />
      <Card className="p-4 text-sm space-y-1">
        <p><strong>This is a simulation.</strong> The command prompt answers from a made-up network, not from a real one. It cannot run real commands or reach any real device, and real output will differ in detail.</p>
        <p className="text-muted">Use made-up addresses only. Do not type customer addresses or names. Nothing is saved or sent, and the lab resets when you leave this page.</p>
      </Card>

      <Card className="p-4 space-y-3">
        <SectionTitle>Pick a problem</SectionTitle>
        <Field label="Scenario" htmlFor="lab-scenario">
          <Select id="lab-scenario" value={sid} onChange={(e: Chg) => load(e.target.value)}>{SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</Select>
        </Field>
        <p className="text-sm" data-testid="lab-symptom"><span className="font-medium">What you are told:</span> {scenario.symptom}</p>
        {scenario.goal && <p className="text-sm flex items-center gap-2 flex-wrap" aria-live="polite" data-testid="lab-goal">
          <Badge tone={solved ? 'ok' : 'warn'}>{solved ? 'Fixed' : 'Not fixed yet'}</Badge>
          <span className="text-muted">Goal: {dev(net, scenario.goal.from)?.name} can reach {scenario.goal.target}{scenario.goal.port ? ` on port ${scenario.goal.port}` : ''}.</span></p>}
        <Collapsible title="Hints"><ol className="list-decimal pl-5 text-sm space-y-1">{scenario.hints.map(h => <li key={h}>{h}</li>)}</ol></Collapsible>
        <Collapsible title="Show the answer"><p className="text-sm" data-testid="lab-solution">{scenario.solution}</p></Collapsible>
        <Button size="sm" onClick={() => load(sid)} data-testid="lab-reset">Reset this scenario</Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-3 space-y-2">
          <SectionTitle>Network diagram</SectionTitle>
          <Diagram net={net} sel={sel} onSel={setSel} />
          <p className="text-xs text-muted">Select a device to see and change its settings. A red dashed cable is unplugged. A dashed outline is switched off.</p>
          <div className="flex gap-2 items-end flex-wrap">
            <span className="text-sm font-medium w-full">Add a device</span>
            {(['pc', 'printer', 'server', 'switch'] as Kind[]).map(k => <Button key={k} size="sm" data-testid={`add-${k}`} onClick={() => add(k)}>{k === 'pc' ? 'PC' : k === 'printer' ? 'Printer' : k === 'server' ? 'Server' : 'Switch'}</Button>)}
          </div>
        </Card>
        {selected && <Editor net={net} d={selected} setNet={setNet} remove={() => remove(selected.id)} />}
      </div>

      <Card className="p-3 space-y-2">
        <SectionTitle>Command prompt</SectionTitle>
        <Field label="You are sitting at" htmlFor="lab-seat">
          <Select id="lab-seat" value={at} onChange={(e: Chg) => { setAt(e.target.value); setLines([...lines, `--- now at ${dev(net, e.target.value)?.name} ---`, '']); }}>
            {seats.map(s => <option key={s.id} value={s.id}>{s.name}{s.up ? '' : ' (off)'}</option>)}
          </Select>
        </Field>
        {cableNote && <p className="text-xs text-bad">{cableNote}</p>}
        <div ref={logRef} role="log" aria-label="Command prompt output" aria-live="polite" tabIndex={0} data-testid="lab-out"
          className="bg-black text-neutral-200 font-mono text-xs sm:text-sm rounded-md p-3 h-72 overflow-auto whitespace-pre-wrap break-words">
          {lines.join('\n')}
        </div>
        <div className="flex gap-2 items-center">
          <label htmlFor="lab-cmd" className="font-mono text-xs shrink-0 max-w-[40%] truncate">{prompt}</label>
          <TextInput id="lab-cmd" value={input} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} className="font-mono" aria-label="Command" placeholder="ping 192.168.10.1"
            onChange={(e: Chg) => setInput(e.target.value)} onKeyDown={onKey} />
          <Button variant="primary" onClick={() => exec(input)} data-testid="lab-run">Run</Button>
        </div>
        <div className="flex gap-1.5 flex-wrap" aria-label="Quick commands" role="group">{QUICK.map(q => <Chip key={q} onClick={() => exec(q)}>{q}</Chip>)}</div>
      </Card>

      <Card className="p-4 space-y-2">
        <SectionTitle>Reading the output</SectionTitle>
        <ul className="space-y-2 text-sm">{INTRO.map(([a, b]) => <li key={a}><span className="font-medium">{a}.</span> <span className="text-muted">{b}</span></li>)}</ul>
      </Card>
    </div>
  );
}
