/**
 * Sensitive-data scanner and redactor.
 *
 *  - severity "block": secrets (passwords, tokens, private keys, recovery keys, card numbers).
 *    ForgeTools refuses to save text containing these until they are removed. There is no override.
 *  - severity "warn": personal / identifying details (emails, IPs, phone numbers, names...).
 *    The user must explicitly confirm before saving, or can redact with one click.
 *
 * Detection is pattern-based and best effort. It cannot find everything (names in particular),
 * so the UI always shows plain-language guidance as well.
 */

export type Severity = 'block' | 'warn';

export interface Finding {
  kind: string;
  label: string;
  severity: Severity;
  /** The matched text (the sensitive part only). */
  text: string;
  start: number;
  end: number;
  replacement: string;
  advice: string;
}

interface Rule {
  kind: string;
  label: string;
  severity: Severity;
  re: RegExp; // must have the "g" flag; the "d" flag is added automatically
  group?: number; // capture group holding the sensitive part (default: whole match)
  replacement: string | ((m: string) => string);
  advice: string;
  accept?: (m: string, full: string) => boolean;
}

const SAFE_PUBLIC_IPS = new Set(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4', '9.9.9.9', '208.67.222.222', '208.67.220.220']);
const BENIGN_VALUES = new Set([
  'incorrect', 'wrong', 'correct', 'expired', 'reset', 'required', 'changed', 'valid', 'invalid', 'blank', 'empty', 'set', 'fine', 'ok',
  'working', 'missing', 'locked', 'unknown', 'same', 'different', 'saved', 'accepted', 'rejected', 'disabled', 'enabled', 'not', 'being',
  'was', 'the', 'an', 'to', 'for', 'and', 'or', 'but', 'in', 'on', 'it', 'is', 'are', 'has', 'had', 'have', 'no', 'yes', 'none', 'null',
  'prompt', 'prompted', 'requested', 'rotated', 'managed', 'failed', 'fails', 'failing', 'stored', 'shared', 'policy', 'complexity',
  'length', 'history', 'age', 'change', 'prompts', 'issue', 'problem', 'error', 'sent', 'given', 'provided', 'supplied', 'entered',
  'needed', 'needs', 'applied', 'cleared', 'removed', 'redacted', 'hidden',
]);

function luhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function ipClass(ip: string): 'doc' | 'loop' | 'apipa' | 'mask' | 'private' | 'public' | 'zero' {
  const [a, b, c] = ip.split('.').map(Number);
  if (ip === '0.0.0.0') return 'zero';
  if (a === 127) return 'loop';
  if (a === 169 && b === 254) return 'apipa';
  if (a === 255) return 'mask';
  if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return 'doc';
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'private';
  return 'public';
}

const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;

const RULES: Rule[] = [
  {
    kind: 'private-key', label: 'Private key', severity: 'block',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
    replacement: '[private-key-removed]',
    advice: 'Never store private keys. Describe the key (type, location) instead.',
  },
  {
    kind: 'recovery-key', label: 'BitLocker recovery key', severity: 'block',
    re: /\b\d{6}(?:-\d{6}){7}\b/g,
    replacement: '[recovery-key-removed]',
    advice: 'Never store recovery keys. Record where the key is escrowed (for example "stored in Entra ID").',
  },
  {
    kind: 'jwt', label: 'Access token', severity: 'block',
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{5,}/g,
    replacement: '[token-removed]',
    advice: 'Tokens grant access. Remove it and say what kind of token it was.',
  },
  {
    kind: 'bearer', label: 'Bearer token', severity: 'block',
    re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/gi,
    replacement: 'Bearer [token-removed]',
    advice: 'Tokens grant access. Remove it.',
  },
  {
    kind: 'cloud-key', label: 'API / access key', severity: 'block',
    re: /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{20,})\b/g,
    replacement: '[api-key-removed]',
    advice: 'API keys are secrets. Remove it and rotate it if it has been exposed.',
  },
  {
    kind: 'credential', label: 'Password or secret', severity: 'block',
    re: /\b(?:password|passwd|pwd|passcode|pass\s?phrase|secret|api[_ -]?key|access[_ -]?key|client[_ -]?secret|token|pin)\s*(?:is|=|:)\s*["']?([^\s"',;]{3,})/gi,
    group: 1,
    replacement: '[REDACTED]',
    advice: 'Never write passwords, PINs or secrets in notes. Say "password reset" or "credential updated" instead.',
    accept: (m, full) => {
      if (BENIGN_VALUES.has(m.toLowerCase())) return false;
      // Our own redaction markers (and any [bracketed] placeholder) are not secrets.
      if (/^\[[^\]]*\]?$/.test(m) || /^\[(?:redacted|removed)/i.test(m)) return false;
      // "password is X": any non-trivial X is treated as a password. For other keywords (pin, token, secret...)
      // require the value to look like a secret, so "the pin is bent" is not blocked.
      if (/^(?:password|passwd|pwd|passcode|pass\s?phrase)/i.test(full)) return m.length > 3 || /\d/.test(m);
      const looksComplex = /\d/.test(m) || /[^A-Za-z]/.test(m) || (/[a-z]/.test(m) && /[A-Z]/.test(m) && !/^[A-Z][a-z]+$/.test(m));
      return looksComplex;
    },
  },
  {
    kind: 'card', label: 'Payment card number', severity: 'block',
    re: /\b(?:\d[ -]?){13,19}\b/g,
    replacement: '[card-number-removed]',
    advice: 'Never store card numbers.',
    accept: (m) => {
      const d = m.replace(/\D/g, '');
      return d.length >= 13 && d.length <= 19 && luhn(d);
    },
  },
  {
    kind: 'email', label: 'Email address', severity: 'warn',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g,
    replacement: '[email]',
    advice: 'Use a role instead, for example "the user" or "shared mailbox". Keep the address only if the ticket genuinely needs it.',
    accept: (m) => !/@(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net|co\.uk)|contoso\.com|test|invalid|localhost)$/i.test(m),
  },
  {
    kind: 'ip', label: 'IP address', severity: 'warn',
    re: IPV4,
    replacement: (m) => (ipClass(m) === 'private' ? '[internal-ip]' : '[ip-address]'),
    advice: 'Prefer "workstation on the internal network" unless the exact address is needed for the fix.',
    accept: (m) => {
      if (SAFE_PUBLIC_IPS.has(m)) return false;
      const c = ipClass(m);
      return c === 'private' || c === 'public';
    },
  },
  {
    kind: 'mac', label: 'MAC address', severity: 'warn',
    re: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
    replacement: '[mac-address]',
    advice: 'MAC addresses identify a specific device. Record it only where required (for example a DHCP reservation).',
  },
  {
    kind: 'phone', label: 'Phone number', severity: 'warn',
    re: /(?<![\d.])(?:\+44[\s-]?\d{3,4}|\(?0\d{3,4}\)?)[\s-]?\d{3}[\s-]?\d{3,4}(?![\d.])/g,
    replacement: '[phone]',
    advice: 'Do not store personal phone numbers. Say "contact number on the ticket".',
  },
  {
    kind: 'postcode', label: 'UK postcode', severity: 'warn',
    re: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g,
    replacement: '[postcode]',
    advice: 'Addresses identify people and sites. Use "customer site" instead.',
  },
  {
    kind: 'ni', label: 'National Insurance number', severity: 'warn',
    re: /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g,
    replacement: '[ni-number]',
    advice: 'Never store national identifiers.',
  },
  {
    kind: 'user-path', label: 'Windows user name in path', severity: 'warn',
    re: /\b[A-Za-z]:\\Users\\([^\\\s"']+)/g,
    group: 1,
    replacement: '[user]',
    advice: 'User profile folders contain the person\u2019s name. Use C:\\Users\\[user].',
    accept: (m) => !/^(?:public|default|default user|all users|\[user\])$/i.test(m),
  },
  {
    kind: 'unc', label: 'Server share path', severity: 'warn',
    re: /\\\\[A-Za-z0-9._-]+\\[^\s"']+/g,
    replacement: '[server-share]',
    advice: 'Server and share names can reveal confidential structure. Describe it generically ("departmental file share").',
  },
  {
    kind: 'person-title', label: 'Person name', severity: 'warn',
    re: /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g,
    replacement: '[person]',
    advice: 'Use roles (the user, the practice manager) rather than names.',
  },
  {
    kind: 'person-role', label: 'Person name', severity: 'warn',
    re: /\b(?:[Cc]ustomer|[Cc]lient|[Uu]ser|[Ss]taff member|[Ee]mployee|[Cc]ontact)\s+(?:called\s+|named\s+)?([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/g,
    group: 1,
    replacement: '[person]',
    advice: 'Use roles (the user, the practice manager) rather than names.',
  },
  {
    kind: 'long-token', label: 'Long token-like string', severity: 'warn',
    re: /\b(?=[A-Za-z0-9+/_-]*[A-Za-z])(?=[A-Za-z0-9+/_-]*\d)[A-Za-z0-9+/_-]{40,}={0,2}/g,
    replacement: '[long-string-removed]',
    advice: 'This could be a secret or a file hash. File hashes are fine to keep; secrets are not.',
  },
];

interface Raw extends Finding {}

/** Scan text and return non-overlapping findings in document order. */
export function scanText(text: string): Finding[] {
  if (!text) return [];
  const raws: Raw[] = [];
  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.replace('d', '') + 'd');
    for (const m of text.matchAll(re)) {
      const idx = (m as RegExpMatchArray & { indices?: Array<[number, number] | undefined> }).indices;
      const span = idx?.[rule.group ?? 0] ?? ([m.index ?? 0, (m.index ?? 0) + m[0].length] as [number, number]);
      const matched = text.slice(span[0], span[1]);
      if (rule.accept && !rule.accept(matched, m[0])) continue;
      raws.push({
        kind: rule.kind,
        label: rule.label,
        severity: rule.severity,
        text: matched,
        start: span[0],
        end: span[1],
        replacement: typeof rule.replacement === 'function' ? rule.replacement(matched) : rule.replacement,
        advice: rule.advice,
      });
    }
  }
  // Resolve overlaps: earliest start wins; for equal starts prefer block, then longer.
  raws.sort((a, b) => a.start - b.start || (a.severity === b.severity ? 0 : a.severity === 'block' ? -1 : 1) || b.end - a.end);
  const out: Finding[] = [];
  let lastEnd = -1;
  for (const f of raws) {
    if (f.start < lastEnd) continue;
    out.push(f);
    lastEnd = f.end;
  }
  return out;
}

/** Replace every finding (or only the given ones) with its placeholder. */
export function redactText(text: string, only?: Finding[]): string {
  const findings = (only ?? scanText(text)).slice().sort((a, b) => b.start - a.start);
  let out = text;
  for (const f of findings) out = out.slice(0, f.start) + f.replacement + out.slice(f.end);
  return out;
}

/** Redact all occurrences of one kind, e.g. every IP address. */
export function redactKind(text: string, kind: string): string {
  return redactText(text, scanText(text).filter((f) => f.kind === kind));
}

export interface FieldFinding extends Finding {
  field: string;
}

/** Scan several named fields at once. */
export function scanFields(fields: Record<string, string>): FieldFinding[] {
  const out: FieldFinding[] = [];
  for (const [field, value] of Object.entries(fields)) {
    for (const f of scanText(value ?? '')) out.push({ ...f, field });
  }
  return out;
}

export function hasBlockers(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === 'block');
}

/** Plain-language redaction examples shown in the UI. */
export const REDACTION_EXAMPLES: Array<{ instead: string; use: string }> = [
  { instead: 'Customer John Smith at 192.168.1.47', use: 'Customer workstation on the internal network' },
  { instead: 'Password is Summer2024!', use: 'Password reset by the user via self-service' },
  { instead: 'Mailbox j.smith@clientco.co.uk', use: 'Shared mailbox for the accounts team' },
  { instead: 'Server FILESRV01 share \\\\FILESRV01\\Finance', use: 'Departmental file share' },
  { instead: 'BitLocker key 123456-...-123456', use: 'Recovery key escrowed in Entra ID (not recorded here)' },
];

export const NEVER_ENTER = [
  'Passwords, PINs or passphrases',
  'Authentication tokens, API keys or session cookies',
  'Private keys or BitLocker recovery keys',
  'Customer personal information (names, addresses, phone numbers, emails) unless truly required',
  'Confidential business information or exact internal network details where a general description will do',
];
