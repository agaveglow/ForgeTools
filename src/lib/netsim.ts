/**
 * Network lab engine. A SIMULATION: a small virtual network and a Windows-style
 * command prompt that answers from that model. Nothing here touches a real
 * network, runs a real command or stores anything.
 */
export type Kind = 'pc' | 'printer' | 'switch' | 'router' | 'server' | 'cloud';
export interface Iface { ip: string; mask: string; vlan?: number }
export interface Dev {
  id: string; name: string; kind: Kind; up: boolean;
  ifaces: Iface[];
  gateway?: string; dns?: string; dhcp?: boolean;
  blocked?: number[]; noPing?: boolean; listen?: number[];
  records?: Record<string, string>; forwards?: boolean;
  lease?: { mask: string; gateway: string; dns: string; next: string };
  publicIps?: string[];
}
export interface Link { id: string; a: string; b: string; aIf?: number; bIf?: number; up: boolean }
export interface Net { devices: Dev[]; links: Link[] }
export interface Session { net: Net; at: string; arp: string[] }

export const SUFFIX = 'lab.test';

/* ---------- addresses ---------- */
export function ipToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec((ip || '').trim());
  if (!m) return null;
  const p = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (p.some(n => n > 255)) return null;
  return (((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3]) >>> 0;
}
export function isIp(ip: string): boolean { return ipToInt(ip) !== null; }
export function maskValid(mask: string): boolean {
  const n = ipToInt(mask);
  if (n === null || n === 0) return false;
  const inv = (~n) >>> 0;
  return (inv & (inv + 1)) === 0;
}
export function usable(f: Iface): boolean {
  return isIp(f.ip) && f.ip !== '0.0.0.0' && maskValid(f.mask);
}
export function inSubnet(f: Iface, ip: string): boolean {
  const a = ipToInt(f.ip), b = ipToInt(ip), m = ipToInt(f.mask);
  if (a === null || b === null || m === null) return false;
  return ((a & m) >>> 0) === ((b & m) >>> 0);
}
export function prefixOf(mask: string): number {
  const n = ipToInt(mask);
  if (n === null) return 0;
  let c = 0; for (let i = 31; i >= 0; i--) { if ((n >>> i) & 1) c++; else break; }
  return c;
}
export function macOf(ip: string): string {
  const n = ipToInt(ip) ?? 0;
  const h = (v: number) => (v & 255).toString(16).padStart(2, '0');
  return `02-00-${h(n >>> 24)}-${h(n >>> 16)}-${h(n >>> 8)}-${h(n)}`;
}

/* ---------- model helpers ---------- */
export function dev(net: Net, id: string): Dev | undefined { return net.devices.find(d => d.id === id); }
function vlanOf(d: Dev, i: number): number { return d.ifaces[i]?.vlan ?? 1; }
const endIdx = (l: Link, side: 'a' | 'b') => (side === 'a' ? l.aIf : l.bIf) ?? 0;

/** Is there a working cable from this interface to a powered-on device? */
export function cableUp(net: Net, d: Dev, idx: number): boolean {
  return net.links.some(l => {
    if (!l.up) return false;
    let other: string | null = null;
    if (l.a === d.id && endIdx(l, 'a') === idx) other = l.b;
    else if (l.b === d.id && endIdx(l, 'b') === idx) other = l.a;
    if (!other) return false;
    const o = dev(net, other);
    return !!o && o.up;
  });
}

interface Member { dev: Dev; ifIdx: number }
/** Everything on the same wire (through powered switches, same VLAN). */
export function l2Domain(net: Net, devId: string, ifIdx: number): Member[] {
  const start = dev(net, devId);
  if (!start || !start.up) return [];
  const startVlan = vlanOf(start, ifIdx);
  const out: Member[] = [];
  const seenSw = new Set<string>();
  const visit = (id: string, idx: number, isSwitch: boolean) => {
    for (const l of net.links) {
      if (!l.up) continue;
      let oid: string, oidx: number;
      if (l.a === id && (isSwitch || endIdx(l, 'a') === idx)) { oid = l.b; oidx = endIdx(l, 'b'); }
      else if (l.b === id && (isSwitch || endIdx(l, 'b') === idx)) { oid = l.a; oidx = endIdx(l, 'a'); }
      else continue;
      const od = dev(net, oid);
      if (!od || !od.up) continue;
      if (od.kind === 'switch') {
        if (!seenSw.has(od.id)) { seenSw.add(od.id); visit(od.id, 0, true); }
      } else {
        if (od.id === devId && oidx === ifIdx) continue;
        if (vlanOf(od, oidx) !== startVlan) continue;
        if (!out.some(m => m.dev.id === od.id && m.ifIdx === oidx)) out.push({ dev: od, ifIdx: oidx });
      }
    }
  };
  visit(devId, ifIdx, false);
  return out;
}

/* ---------- routing ---------- */
export interface Hop { ip: string; name: string }
export interface Route {
  ok: boolean; hops: Hop[]; at?: Dev; target?: Dev; pub?: boolean;
  reason?: 'unreach' | 'nogw' | 'gwdown' | 'timeout' | 'noreply' | 'off' | 'nocable';
  firstHop?: string; srcIp?: string; routerHops: number; viaCloud: boolean;
}

export function route(net: Net, srcId: string, dest: string, checkReply = true): Route {
  const src = dev(net, srcId);
  const res: Route = { ok: false, hops: [], routerHops: 0, viaCloud: false };
  if (!src || !src.up) { res.reason = 'off'; return res; }
  const own = src.ifaces.find(usable);
  res.srcIp = own?.ip;
  if (src.ifaces.some(f => f.ip === dest)) { res.ok = true; res.target = src; res.firstHop = dest; return res; }
  let cur = src;
  for (let guard = 0; guard < 10; guard++) {
    for (let i = 0; i < cur.ifaces.length; i++) {
      const f = cur.ifaces[i];
      if (!usable(f) || !inSubnet(f, dest)) continue;
      if (!cableUp(net, cur, i)) { res.reason = 'nocable'; res.at = cur; return res; }
      const m = l2Domain(net, cur.id, i).find(x => x.dev.ifaces[x.ifIdx].ip === dest);
      if (!m) { res.reason = 'unreach'; res.at = cur; return res; }
      res.hops.push({ ip: dest, name: m.dev.name });
      res.target = m.dev;
      if (!res.firstHop) res.firstHop = dest;
      if (checkReply && m.dev.kind !== 'cloud' && res.srcIp) {
        const back = route(net, m.dev.id, res.srcIp, false);
        if (!back.ok) { res.reason = 'noreply'; return res; }
      }
      res.ok = true;
      return res;
    }
    if (cur.kind === 'cloud') {
      if (cur.publicIps?.includes(dest)) {
        res.hops.push({ ip: dest, name: dest }); res.ok = true; res.pub = true; res.viaCloud = true; return res;
      }
      res.reason = 'timeout'; res.at = cur; return res;
    }
    if (cur !== src && cur.kind !== 'router') { res.reason = 'timeout'; res.at = cur; return res; }
    const gw = cur.gateway;
    if (!gw || !isIp(gw)) { res.reason = 'nogw'; res.at = cur; return res; }
    const gi = cur.ifaces.findIndex(f => usable(f) && inSubnet(f, gw));
    if (gi < 0) { res.reason = 'nogw'; res.at = cur; return res; }
    if (!cableUp(net, cur, gi)) { res.reason = 'nocable'; res.at = cur; return res; }
    const next = l2Domain(net, cur.id, gi).find(x => x.dev.ifaces[x.ifIdx].ip === gw);
    if (!next || (next.dev.kind !== 'router' && next.dev.kind !== 'cloud')) { res.reason = 'gwdown'; res.at = cur; return res; }
    if (!res.firstHop) res.firstHop = gw;
    res.hops.push({ ip: gw, name: next.dev.kind === 'cloud' ? 'Internet' : next.dev.name });
    if (next.dev.kind === 'router') res.routerHops++; else res.viaCloud = true;
    cur = next.dev;
  }
  res.reason = 'timeout';
  return res;
}

/* ---------- names ---------- */
export interface Resolved { ip?: string; server?: Dev; error?: 'nodns' | 'timeout' | 'nxdomain' }
export function resolve(net: Net, srcId: string, name: string): Resolved {
  if (isIp(name)) return { ip: name };
  const src = dev(net, srcId);
  if (!src || !src.dns) return { error: 'nodns' };
  const r = route(net, srcId, src.dns);
  const s = r.target;
  if (!r.ok || !s || !s.records || !s.listen?.includes(53) || s.blocked?.includes(53)) return { error: 'timeout' };
  const n = name.toLowerCase().replace(/\.$/, '');
  const cands = n.includes('.') ? [n] : [n + '.' + SUFFIX, n];
  for (const c of cands) if (s.records[c]) return { ip: s.records[c], server: s };
  if (s.forwards) {
    const cloud = net.devices.find(d => d.kind === 'cloud');
    const up = cloud?.ifaces[0] ? route(net, s.id, cloud.ifaces[0].ip, false) : null;
    if (cloud?.records && up?.ok) for (const c of cands) if (cloud.records[c]) return { ip: cloud.records[c], server: s };
  }
  return { error: 'nxdomain', server: s };
}

/* ---------- goals (used by scenarios) ---------- */
export interface Goal { from: string; target: string; port?: number }
export function goalMet(net: Net, g: Goal): boolean {
  const r = resolve(net, g.from, g.target);
  if (!r.ip) return false;
  const rt = route(net, g.from, r.ip);
  if (!rt.ok) return false;
  const t = rt.target;
  if (g.port !== undefined) {
    if (!t) return false;
    return !!t.listen?.includes(g.port) && !t.blocked?.includes(g.port);
  }
  return !(t && t.noPing);
}

/* ---------- command prompt ---------- */
export interface RunResult { session: Session; out: string[]; clear?: boolean }

const BANNER = ['Lab Command Prompt (simulation)', 'This is a practice network. Nothing here touches a real network or computer.', 'Type help for the commands it understands.', ''];
export function banner(): string[] { return BANNER.slice(); }

function pad(s: string, n: number): string { return (s + ' '.repeat(n)).slice(0, Math.max(n, s.length)); }
function dots(label: string, w = 34): string { return '   ' + label + ' ' + '. '.repeat(Math.max(0, Math.floor((w - label.length - 1) / 2))).trimEnd() + ' : '; }

const TTL_BASE: Record<Kind, number> = { pc: 128, server: 128, printer: 64, router: 64, switch: 64, cloud: 56 };

function srcLine(_net: Net, d: Dev): string { return d.ifaces.find(usable)?.ip ?? '0.0.0.0'; }

function pingCmd(s: Session, args: string[]): RunResult {
  const net = s.net;
  let count = 4; let target = '';
  for (let i = 0; i < args.length; i++) {
    const a = args[i].toLowerCase();
    if (a === '-n' || a === '/n') { const n = Number(args[++i]); if (n >= 1 && n <= 10) count = Math.floor(n); }
    else if (a === '-t' || a === '/t') { count = 4; }
    else if (a === '-4' || a === '-6' || a === '-a') { /* ignored */ }
    else if (!a.startsWith('-')) target = args[i];
  }
  if (!target) return { session: s, out: ['Usage: ping [-n count] target_name', '(-t is not supported in the lab; it always sends a few packets.)'] };
  const at = dev(net, s.at)!;
  const rs = resolve(net, s.at, target);
  if (!rs.ip) return { session: s, out: [`Ping request could not find host ${target}. Please check the name and try again.`] };
  const ip = rs.ip;
  const r = route(net, s.at, ip);
  const out = [`Pinging ${isIp(target) ? ip : target + ' [' + ip + ']'} with 32 bytes of data:`];
  let received = 0; let okCount = 0; let ms = 0; let arp = s.arp;
  const t = r.target;
  const replies = r.ok && !(t && t.noPing && t.id !== at.id);
  if (replies) ms = r.viaCloud ? 14 : r.routerHops;
  const ttl = Math.max(1, (r.pub ? TTL_BASE.cloud : TTL_BASE[t?.kind ?? 'pc']) - r.routerHops);
  for (let i = 0; i < count; i++) {
    if (replies) {
      out.push(`Reply from ${ip}: bytes=32 time${ms === 0 ? '<1' : '=' + ms}ms TTL=${ttl}`); received++; okCount++;
    } else if (r.reason === 'unreach' || r.reason === 'gwdown' || r.reason === 'nocable') {
      out.push(`Reply from ${srcLine(net, at)}: Destination host unreachable.`); received++;
    } else if (r.reason === 'nogw' && r.at && r.at !== at) {
      out.push(`Reply from ${srcLine(net, r.at)}: Destination host unreachable.`); received++;
    } else if (r.reason === 'nogw' || r.reason === 'off') {
      out.push('PING: transmit failed. General failure.');
    } else {
      out.push('Request timed out.');
    }
  }
  out.push('', `Ping statistics for ${ip}:`, `    Packets: Sent = ${count}, Received = ${received}, Lost = ${count - received} (${Math.round(((count - received) / count) * 100)}% loss),`);
  if (okCount > 0) out.push('Approximate round trip times in milli-seconds:', `    Minimum = ${ms}ms, Maximum = ${ms}ms, Average = ${ms}ms`);
  if (replies && r.firstHop && !arp.includes(r.firstHop)) arp = [...arp, r.firstHop];
  return { session: { ...s, arp }, out };
}

function tracertCmd(s: Session, args: string[]): RunResult {
  const target = args.filter(a => !a.startsWith('-'))[0];
  if (!target) return { session: s, out: ['Usage: tracert target_name'] };
  const at = dev(s.net, s.at)!;
  const rs = resolve(s.net, s.at, target);
  if (!rs.ip) return { session: s, out: [`Unable to resolve target system name ${target}.`] };
  const ip = rs.ip; const r = route(s.net, s.at, ip);
  const out = [isIp(target) ? `Tracing route to ${ip}` : `Tracing route to ${target} [${ip}]`, 'over a maximum of 30 hops:', ''];
  let n = 0; let farSide = false;
  const row = (hop: Hop, last: boolean) => {
    n++;
    const t = farSide || r.pub && last ? '14 ms' : '<1 ms';
    const lab = last && !isIp(target) ? `${target} [${hop.ip}]` : hop.ip;
    out.push(`${String(n).padStart(3)}    ${pad(t, 6)}  ${pad(t, 6)}  ${pad(t, 6)}  ${lab}`);
    if (hop.name === 'Internet') farSide = true;
  };
  r.hops.forEach((h, i) => row(h, i === r.hops.length - 1 && r.ok));
  if (!r.ok) {
    if (r.reason === 'unreach' || r.reason === 'gwdown' || r.reason === 'nocable') {
      n++; out.push(`${String(n).padStart(3)}  ${srcLine(s.net, r.at ?? at)}  reports: Destination host unreachable.`);
    } else if (r.reason === 'nogw' || r.reason === 'off') {
      out.push('Unable to contact the first hop. General failure.');
    } else {
      for (let i = 0; i < 3; i++) { n++; out.push(`${String(n).padStart(3)}     *        *        *     Request timed out.`); }
      out.push('(Lab note: a real tracert keeps trying up to 30 hops. This shows the first three timeouts.)');
    }
  }
  out.push('', 'Trace complete.');
  return { session: s, out };
}

function nslookupCmd(s: Session, args: string[]): RunResult {
  const name = args[0];
  const at = dev(s.net, s.at)!;
  let net = s.net;
  if (args[1]) {
    if (!isIp(args[1])) return { session: s, out: [`*** Can't find address for server ${args[1]}`] };
    net = { ...net, devices: net.devices.map(d => (d.id === at.id ? { ...d, dns: args[1] } : d)) };
  }
  const dns = dev(net, at.id)!.dns;
  if (!name) return { session: s, out: dns ? [`Default Server:  UnKnown`, `Address:  ${dns}`, '', '(Interactive mode is not available in the lab. Use: nslookup name)'] : ['*** Default servers are not available', 'Default Server:  UnKnown', 'Address:  127.0.0.1'] };
  if (!dns) return { session: s, out: ['*** Default servers are not available', 'Server:  UnKnown', 'Address:  127.0.0.1', '', `*** UnKnown can't find ${name}: No response from server`] };
  const srvName = (id: string) => { const d = dev(net, id); return d ? `${d.name.toLowerCase()}.${SUFFIX}` : 'UnKnown'; };
  if (isIp(name)) {
    const r = route(net, at.id, dns); const sv = r.target;
    if (!r.ok || !sv?.records) return { session: s, out: ['DNS request timed out.', '    timeout was 2 seconds.', 'Server:  UnKnown', `Address:  ${dns}`, '', `*** Request to UnKnown timed out`] };
    const found = Object.keys(sv.records).find(k => sv.records![k] === name);
    const hdr = [`Server:  ${srvName(sv.id)}`, `Address:  ${dns}`, ''];
    return { session: s, out: found ? [...hdr, `Name:    ${found}`, `Address:  ${name}`] : [...hdr, `*** ${srvName(sv.id)} can't find ${name}: Non-existent domain`] };
  }
  const r = resolve(net, at.id, name);
  if (r.error === 'timeout' || r.error === 'nodns') return { session: s, out: ['DNS request timed out.', '    timeout was 2 seconds.', 'Server:  UnKnown', `Address:  ${dns}`, '', 'DNS request timed out.', '    timeout was 2 seconds.', '*** Request to UnKnown timed out'] };
  const sv = r.server!;
  const hdr = [`Server:  ${srvName(sv.id)}`, `Address:  ${dns}`, ''];
  if (r.error === 'nxdomain') return { session: s, out: [...hdr, `*** ${srvName(sv.id)} can't find ${name}: Non-existent domain`] };
  const full = name.includes('.') ? name : `${name}.${SUFFIX}`;
  const recorded = sv.records?.[full.toLowerCase()] === r.ip || sv.records?.[name.toLowerCase()] === r.ip;
  return { session: s, out: [...hdr, ...(recorded ? [] : ['Non-authoritative answer:']), `Name:    ${recorded ? full : name}`, `Address:  ${r.ip}`] };
}

function ipconfigCmd(s: Session, args: string[]): RunResult {
  const at = dev(s.net, s.at)!;
  const flag = (args[0] || '').toLowerCase().replace(/^\//, '-');
  if (flag === '-flushdns') return { session: s, out: ['Windows IP Configuration', '', 'Successfully flushed the DNS Resolver Cache.'] };
  if (flag === '-displaydns') return { session: s, out: ['Windows IP Configuration', '', '(Lab note: the resolver cache is not modelled.)'] };
  if (flag === '-release') {
    if (!at.dhcp) return { session: s, out: ['The operation failed as no adapter is in the state permissible for this operation.'] };
    const net = { ...s.net, devices: s.net.devices.map(d => d.id === at.id ? { ...d, gateway: undefined, dns: undefined, ifaces: d.ifaces.map((f, i) => i === 0 ? { ...f, ip: '0.0.0.0', mask: '0.0.0.0' } : f) } : d) };
    return { session: { ...s, net }, out: ['Windows IP Configuration', '', 'Ethernet adapter Ethernet:', '', dots('Connection-specific DNS Suffix') + SUFFIX, dots('Default Gateway')] };
  }
  if (flag === '-renew') {
    if (!at.dhcp) return { session: s, out: ['The operation failed as no adapter is in the state permissible for this operation.'] };
    const dom = cableUp(s.net, at, 0) ? l2Domain(s.net, at.id, 0) : [];
    const srv = dom.find(m => m.dev.lease && m.dev.up && !m.dev.blocked?.includes(67));
    if (!srv) {
      const o = ipToInt(at.ifaces[0].ip) ?? 1;
      const apipa = `169.254.${(o >>> 8) & 255 || 33}.${o & 255 || 14}`;
      const net = { ...s.net, devices: s.net.devices.map(d => d.id === at.id ? { ...d, gateway: undefined, ifaces: d.ifaces.map((f, i) => i === 0 ? { ...f, ip: apipa, mask: '255.255.0.0' } : f) } : d) };
      return { session: { ...s, net }, out: ['Windows IP Configuration', '', 'An error occurred while renewing interface Ethernet : unable to contact your DHCP server. Request has timed out.'] };
    }
    const L = srv.dev.lease!;
    const net = { ...s.net, devices: s.net.devices.map(d => d.id === at.id ? { ...d, gateway: L.gateway, dns: L.dns, ifaces: d.ifaces.map((f, i) => i === 0 ? { ...f, ip: L.next, mask: L.mask } : f) } : d) };
    return { session: { ...s, net }, out: ['Windows IP Configuration', '', `Ethernet adapter Ethernet now has address ${L.next}.`] };
  }
  const all = flag === '-all';
  const out = ['Windows IP Configuration', ''];
  if (all) out.push(dots('Host Name') + at.name, '');
  at.ifaces.forEach((f, i) => {
    out.push(`Ethernet adapter Ethernet${at.ifaces.length > 1 ? ' ' + (i + 1) : ''}:`, '');
    if (!cableUp(s.net, at, i)) { out.push(dots('Media State') + 'Media disconnected', dots('Connection-specific DNS Suffix') + (SUFFIX), ''); return; }
    out.push(dots('Connection-specific DNS Suffix') + SUFFIX);
    if (all) { out.push(dots('Physical Address') + macOf(f.ip), dots('DHCP Enabled') + (at.dhcp ? 'Yes' : 'No')); }
    const apipa = f.ip.startsWith('169.254.');
    out.push(dots(apipa ? 'Autoconfiguration IPv4 Address' : 'IPv4 Address') + f.ip + (apipa ? '(Preferred)' : ''));
    out.push(dots('Subnet Mask') + f.mask);
    out.push(dots('Default Gateway') + (i === 0 || at.gateway && usable(f) && inSubnet(f, at.gateway) ? (at.gateway ?? '') : ''));
    if (all) out.push(dots('DNS Servers') + (at.dns ?? ''));
    out.push('');
  });
  return { session: s, out };
}

function arpCmd(s: Session, args: string[]): RunResult {
  if ((args[0] || '').toLowerCase() !== '-a') return { session: s, out: ['Usage: arp -a   (shows the neighbours this computer has talked to)'] };
  const at = dev(s.net, s.at)!; const f = at.ifaces.find(usable);
  if (!f) return { session: s, out: ['No ARP Entries Found.'] };
  const rows = s.arp.filter(ip => inSubnet(f, ip));
  if (!rows.length) return { session: s, out: ['No ARP Entries Found.', '', '(Try pinging something on your own network first.)'] };
  return { session: s, out: ['', `Interface: ${f.ip} --- 0x4`, '  Internet Address      Physical Address      Type', ...rows.map(ip => `  ${pad(ip, 22)}${pad(macOf(ip), 22)}dynamic`)] };
}

function netstatCmd(s: Session): RunResult {
  const at = dev(s.net, s.at)!; const ip = at.ifaces.find(usable)?.ip ?? '0.0.0.0';
  const ports = (at.listen && at.listen.length ? at.listen : [135, 445]);
  return { session: s, out: ['', 'Active Connections', '', '  Proto  Local Address          Foreign Address        State', ...ports.map(p => `  TCP    ${pad('0.0.0.0:' + p, 22)} ${pad('0.0.0.0:0', 22)} LISTENING`), `  TCP    ${pad(ip + ':49670', 22)} ${pad('0.0.0.0:0', 22)} (lab sample)`] };
}

function routeCmd(s: Session): RunResult {
  const at = dev(s.net, s.at)!; const f = at.ifaces.find(usable);
  const out = ['===========================================================================', 'IPv4 Route Table', '===========================================================================', 'Active Routes:', 'Network Destination        Netmask          Gateway       Interface  Metric'];
  if (f) {
    if (at.gateway) out.push(`          0.0.0.0          0.0.0.0  ${pad(at.gateway, 14)}${pad(f.ip, 15)}  25`);
    const a = ipToInt(f.ip)!, m = ipToInt(f.mask)!;
    const nw = (((a & m) >>> 0));
    const dotted = [nw >>> 24, (nw >>> 16) & 255, (nw >>> 8) & 255, nw & 255].join('.');
    out.push(`${pad(dotted, 18)} ${pad(f.mask, 16)} ${pad('On-link', 14)}${pad(f.ip, 15)}  281`);
  }
  out.push('===========================================================================');
  return { session: s, out };
}

function tncCmd(s: Session, args: string[]): RunResult {
  let target = ''; let port: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i].toLowerCase();
    if (a === '-port') port = Number(args[++i]);
    else if (a === '-computername') target = args[++i] || '';
    else if (!a.startsWith('-') && !target) target = args[i];
  }
  if (!target) return { session: s, out: ['Usage: Test-NetConnection <name or address> [-Port <number>]'] };
  const at = dev(s.net, s.at)!;
  const rs = resolve(s.net, s.at, target);
  if (!rs.ip) return { session: s, out: [`WARNING: Name resolution of ${target} failed`, '', `ComputerName           : ${target}`, 'RemoteAddress          :', 'NameResolutionResults :', `PingSucceeded          : False`] };
  const r = route(s.net, s.at, rs.ip); const t = r.target;
  const head = [`ComputerName     : ${target}`, `RemoteAddress    : ${rs.ip}`];
  if (port !== undefined && Number.isFinite(port)) {
    const ok = r.ok && !!t && !!t.listen?.includes(port) && !t.blocked?.includes(port);
    const out = [...(ok ? [] : [`WARNING: TCP connect to (${rs.ip} : ${port}) failed`]), '', ...head, `RemotePort       : ${port}`, 'InterfaceAlias   : Ethernet', `SourceAddress    : ${srcLine(s.net, at)}`, `TcpTestSucceeded : ${ok ? 'True' : 'False'}`];
    return { session: s, out };
  }
  const ok = r.ok && !(t && t.noPing);
  return { session: s, out: [...(ok ? [] : ['WARNING: Ping to ' + rs.ip + ' failed']), '', ...head, 'InterfaceAlias   : Ethernet', `SourceAddress    : ${srcLine(s.net, at)}`, `PingSucceeded    : ${ok ? 'True' : 'False'}`, ...(ok ? [`PingReplyDetails (RTT) : ${r.viaCloud ? 14 : r.routerHops} ms`] : [])] };
}

export const HELP = [
  'Commands this practice prompt understands:',
  '  ipconfig [/all | /release | /renew | /flushdns]   address, gateway, DNS',
  '  ping [-n count] name-or-address                    is it reachable',
  '  tracert name-or-address                            the path, hop by hop',
  '  nslookup name [server]                             ask DNS',
  '  arp -a                                             neighbours you have talked to',
  '  netstat -an                                        ports this computer listens on',
  '  route print                                        the routing table',
  '  getmac    hostname    whoami    cls    echo',
  '  Test-NetConnection name [-Port n]                  can you reach a port',
  '',
  'It is a simulation of a made-up network. Real output on a real PC will differ.',
];

export function runCommand(s: Session, line: string): RunResult {
  const raw = line.trim();
  if (!raw) return { session: s, out: [] };
  const at = dev(s.net, s.at);
  const parts = raw.split(/\s+/);
  const cmd = parts[0].toLowerCase(); const args = parts.slice(1);
  if (cmd === 'cls' || cmd === 'clear') return { session: s, out: [], clear: true };
  if (cmd === 'help' || cmd === '?') return { session: s, out: HELP };
  if (cmd === 'echo') return { session: s, out: [args.join(' ')] };
  if (cmd === 'exit') return { session: s, out: ['This is a simulation, so there is nothing to close.'] };
  if (cmd === 'ver') return { session: s, out: ['Lab Command Prompt [simulation]'] };
  if (!at || !at.up) return { session: s, out: ['This computer is switched off. Pick another one, or power it on in the diagram.'] };
  switch (cmd) {
    case 'hostname': return { session: s, out: [at.name] };
    case 'whoami': return { session: s, out: [`lab\\student`] };
    case 'getmac': return { session: s, out: ['', 'Physical Address    Transport Name', '=================== ==========================================================', ...at.ifaces.filter(usable).map(f => `${pad(macOf(f.ip).toUpperCase(), 19)} \\Device\\Tcpip_{lab}`)] };
    case 'ipconfig': return ipconfigCmd(s, args);
    case 'ping': return pingCmd(s, args);
    case 'tracert': return tracertCmd(s, args);
    case 'nslookup': return nslookupCmd(s, args);
    case 'arp': return arpCmd(s, args);
    case 'netstat': return netstatCmd(s);
    case 'route': return routeCmd(s);
    case 'test-netconnection': case 'tnc': return tncCmd(s, args);
    default: return { session: s, out: [`'${parts[0]}' is not recognized as an internal or external command,`, 'operable program or batch file. (Type help to see what the lab supports.)'] };
  }
}
