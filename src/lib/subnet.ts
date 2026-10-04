/** IPv4 subnet maths. Pure functions, no network access. */

export interface Subnet {
  address: string; prefix: number; mask: string; wildcard: string;
  network: string; broadcast: string | null; first: string | null; last: string | null;
  hosts: number; kind: string; binaryAddress: string; binaryMask: string; cidr: string;
}

export const toInt = (ip: string): number | null => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
};
export const fromInt = (n: number): string => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
export const prefixToMaskInt = (p: number): number => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);

/** Accepts a prefix ("24", "/24") or a dotted mask ("255.255.255.0"). Returns null if invalid (including non-contiguous masks). */
export function parsePrefix(s: string): number | null {
  const t = s.trim().replace(/^\//, '');
  if (/^\d{1,2}$/.test(t)) { const n = Number(t); return n >= 0 && n <= 32 ? n : null; }
  const m = toInt(t);
  if (m === null) return null;
  for (let p = 0; p <= 32; p++) if (prefixToMaskInt(p) === m) return p;
  return null;
}

const bin = (n: number): string => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, '0')).join('.');

export function classify(ip: number): string {
  const a = ip >>> 24, b = (ip >>> 16) & 255;
  if (a === 127) return 'Loopback (this PC)';
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'Private';
  if (a === 169 && b === 254) return 'Link-local (APIPA): DHCP did not answer';
  if (a >= 224 && a <= 239) return 'Multicast';
  if (a >= 240) return 'Reserved';
  if (a === 0) return 'This network / unspecified';
  return 'Public';
}

/** Accepts "192.168.1.10/24" or an address plus a separate mask/prefix. */
export function calcSubnet(addressInput: string, prefixInput?: string): Subnet | { error: string } {
  let addr = addressInput.trim(); let pre = prefixInput ?? '';
  if (addr.includes('/')) { const [a, p] = addr.split('/'); addr = a; pre = p; }
  const ip = toInt(addr);
  if (ip === null) return { error: 'Enter an IPv4 address as four numbers from 0 to 255, for example 192.168.1.10.' };
  const prefix = parsePrefix(pre);
  if (prefix === null) return { error: 'Enter a prefix from 0 to 32 (such as 24) or a valid mask (such as 255.255.255.0).' };
  const mask = prefixToMaskInt(prefix);
  const net = (ip & mask) >>> 0;
  const bcast = (net | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  let first: number | null, last: number | null, broadcast: number | null, hosts: number;
  if (prefix === 32) { first = last = net; broadcast = null; hosts = 1; }
  else if (prefix === 31) { first = net; last = bcast; broadcast = null; hosts = 2; }
  else { first = net + 1; last = bcast - 1; broadcast = bcast; hosts = total - 2; }
  return {
    address: fromInt(ip), prefix, mask: fromInt(mask), wildcard: fromInt(~mask >>> 0), network: fromInt(net),
    broadcast: broadcast === null ? null : fromInt(broadcast), first: fromInt(first), last: fromInt(last), hosts,
    kind: classify(ip), binaryAddress: bin(ip), binaryMask: bin(mask), cidr: `${fromInt(net)}/${prefix}`,
  };
}

/** Are two addresses on the same subnet for a given prefix? */
export function sameSubnet(a: string, b: string, prefix: number): boolean | null {
  const x = toInt(a), y = toInt(b);
  if (x === null || y === null) return null;
  const m = prefixToMaskInt(prefix);
  return ((x & m) >>> 0) === ((y & m) >>> 0);
}

/** Smallest prefix that holds at least `hosts` usable hosts. */
export function prefixForHosts(hosts: number): number | null {
  if (!Number.isFinite(hosts) || hosts < 1) return null;
  for (let p = 30; p >= 0; p--) if (2 ** (32 - p) - 2 >= hosts) return p;
  return null;
}

// ---------- converter ----------
export function convertNumber(input: string): { dec: string; hex: string; bin: string } | { error: string } {
  const t = input.trim().toLowerCase();
  let n: number;
  if (/^0x[0-9a-f]+$/.test(t)) n = parseInt(t.slice(2), 16);
  else if (/^0b[01]+$/.test(t)) n = parseInt(t.slice(2), 2);
  else if (/^\d+$/.test(t)) n = parseInt(t, 10);
  else return { error: 'Enter a decimal number, or one starting 0x (hex) or 0b (binary).' };
  if (!Number.isSafeInteger(n) || n > 0xffffffff) return { error: 'Keep it within 32 bits (up to 4294967295).' };
  return { dec: String(n), hex: '0x' + n.toString(16).toUpperCase(), bin: '0b' + n.toString(2) };
}

// ---------- transfer time and print cost ----------
const UNIT: Record<string, number> = { KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 };
const RATE: Record<string, number> = { kbps: 1e3, Mbps: 1e6, Gbps: 1e9 };
export function transferSeconds(size: number, sizeUnit: string, speed: number, speedUnit: string): number | null {
  if (!(size > 0) || !(speed > 0) || !UNIT[sizeUnit] || !RATE[speedUnit]) return null;
  return (size * UNIT[sizeUnit] * 8) / (speed * RATE[speedUnit]);
}
export function humanDuration(sec: number): string {
  if (sec < 1) return 'under a second';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return [d && `${d} d`, h && `${h} h`, m && `${m} min`, !d && !h && s && `${s} s`].filter(Boolean).join(' ') || '0 s';
}
export function costPerPage(price: number, yieldPages: number): number | null {
  return price > 0 && yieldPages > 0 ? price / yieldPages : null;
}
export const SIZE_UNITS = Object.keys(UNIT);
export const SPEED_UNITS = Object.keys(RATE);
