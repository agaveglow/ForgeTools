/** Password generator and a rough strength estimate. Uses the browser's secure random numbers; nothing is stored. */
export interface GenOptions { length: number; lower: boolean; upper: boolean; digits: boolean; symbols: boolean; avoidLookalikes: boolean }
export const DEFAULT_GEN: GenOptions = { length: 16, lower: true, upper: true, digits: true, symbols: true, avoidLookalikes: true };
const SETS = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.?' };
const LOOK = /[Il1O0o|]/g;

export function pool(o: GenOptions): string[] {
  return (['lower', 'upper', 'digits', 'symbols'] as const).filter((k) => o[k]).map((k) => (o.avoidLookalikes ? SETS[k].replace(LOOK, '') : SETS[k]));
}

/** Uniform random integer below max with no modulo bias. */
export function randomBelow(max: number, rng: (a: Uint32Array) => unknown = (a) => crypto.getRandomValues(a as never)): number {
  const limit = Math.floor(0x100000000 / max) * max; const a = new Uint32Array(1);
  for (;;) { rng(a); if (a[0] < limit) return a[0] % max; }
}

export function generate(o: GenOptions, rng?: (a: Uint32Array) => unknown): string {
  const sets = pool(o); const len = Math.min(64, Math.max(8, Math.floor(o.length)));
  if (!sets.length) return '';
  const all = sets.join('');
  const out: string[] = sets.map((s) => s[randomBelow(s.length, rng)]);
  while (out.length < len) out.push(all[randomBelow(all.length, rng)]);
  for (let i = out.length - 1; i > 0; i--) { const j = randomBelow(i + 1, rng); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}

const COMMON = ['password', 'passw0rd', 'qwerty', 'letmein', 'welcome', 'admin', 'login', 'iloveyou', 'abc123', 'monkey', 'dragon', 'summer', 'winter', 'spring', 'autumn', 'football'];

/** Rough guess in bits; real strength depends on how it was made. Random generation is the safe route. */
export function estimateBits(pw: string): { bits: number; label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong'; notes: string[] } {
  const notes: string[] = [];
  if (!pw) return { bits: 0, label: 'Very weak', notes: [] };
  let size = 0;
  if (/[a-z]/.test(pw)) size += 26; if (/[A-Z]/.test(pw)) size += 26; if (/[0-9]/.test(pw)) size += 10; if (/[^A-Za-z0-9]/.test(pw)) size += 20;
  let bits = pw.length * Math.log2(Math.max(size, 2));
  const low = pw.toLowerCase();
  if (COMMON.some((c) => low.includes(c))) { bits = Math.min(bits, 28); notes.push('Contains a very common word'); }
  if (/(.)\1{2,}/.test(pw)) { bits *= 0.8; notes.push('Repeated characters'); }
  if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf)/i.test(pw)) { bits *= 0.7; notes.push('Keyboard or number run'); }
  if (/^[A-Za-z]+[0-9!@#$%^&*]{1,3}$/.test(pw)) { bits *= 0.75; notes.push('A word with a few characters on the end is easy to guess'); }
  if (pw.length < 12) notes.push('Under 12 characters');
  bits = Math.round(bits);
  const label = bits < 28 ? 'Very weak' : bits < 45 ? 'Weak' : bits < 60 ? 'Fair' : bits < 80 ? 'Strong' : 'Very strong';
  return { bits, label, notes };
}
