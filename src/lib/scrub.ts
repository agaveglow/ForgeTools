/**
 * Automatic scrubbing of imported text (documents, transcripts) before a guide is made from it.
 *
 * Removes what looks like names, numbers and identifying details for managed print, IT services and
 * telecoms work: emails, IPs, phone numbers, serials, account/contract/ticket numbers, host names,
 * company names, links to private sites, labelled customer/contact fields, plus everything the
 * secret scanner finds. It runs on the device and returns a report so the person can check it.
 *
 * It is a safety net, not a guarantee: free-text names in ordinary sentences cannot be found reliably
 * by rules. The text must still be read before saving, and extra words can be removed per document.
 */
import { scanText, redactText } from './sensitive';

export interface ScrubItem { label: string; original: string; replacement: string }
export interface ScrubResult { text: string; items: ScrubItem[]; counts: Record<string, number> }

const IT_WORDS = new Set(['windows', 'microsoft', 'office', 'outlook', 'teams', 'active', 'directory', 'group', 'policy', 'device', 'manager', 'control', 'panel', 'print', 'spooler', 'task', 'control', 'command', 'prompt', 'power', 'shell', 'system', 'service', 'services', 'network', 'settings', 'update', 'server', 'client', 'admin', 'administrator', 'the', 'this', 'that', 'then', 'there', 'please', 'all', 'team', 'support', 'desk', 'helpdesk', 'engineer', 'user', 'customer', 'site', 'office']);
const KNOWN_HOSTS = /(?:^|\.)(?:microsoft\.com|windows\.com|office\.com|support\.apple\.com|support\.google\.com|hp\.com|ricoh[a-z.-]*|canon[a-z.-]*|xerox\.com|konicaminolta[a-z.-]*|sharpusa\.com|kyocera[a-z.-]*|brother[a-z.-]*|epson[a-z.-]*|lexmark\.com|toshiba[a-z.-]*|cisco\.com|3cx\.com|mitel\.com|avaya\.com|yealink\.com|poly\.com|ubiquiti\.com|fortinet\.com|sophos\.com|wikipedia\.org)$/i;

interface Extra { label: string; re: RegExp; group?: number; replacement: string; accept?: (m: string) => boolean }

const LABELS = 'customer(?: name)?|client(?: name)?|company(?: name)?|account(?: name)?|organi[sz]ation|site(?: name)?|contact(?: name)?|caller|name|engineer|technician|attn|attention|address|location|branch';
const IDLABELS = 'account|acct|contract|agreement|ticket|case|incident|job|work order|wo|reference|ref|order|po|invoice|quote|serial(?: number| no)?|s\\/n|sn|asset(?: tag| id| number)?|imei|meter(?: reading)?|extension|ext|ddi|did|pin|id|customer id|client id|site id|device id';

const EXTRA: Extra[] = [
  { label: 'Labelled name/field', re: new RegExp(`\\b(?:${LABELS})\\s*[:=-]\\s*([^\\n,;|]{2,60})`, 'gi'), group: 1, replacement: '[removed: name]', accept: (m) => !/^\[/.test(m.trim()) },
  { label: 'Labelled number/ID', re: new RegExp(`\\b(?:${IDLABELS})\\s*(?:no\\.?|number|#)?\\s*[:=#-]?\\s*([A-Za-z0-9][A-Za-z0-9/._-]{3,})`, 'gi'), group: 1, replacement: '[removed: number]', accept: (m) => /\d/.test(m) && !/^\[/.test(m) },
  { label: 'Company name', re: /\b((?:[A-Z][\w&'’-]+\s+){1,3})(?:Ltd|Limited|LLP|PLC|Plc|Inc|LLC|GmbH|Group|Holdings|Solicitors|Surgery|Dental|Practice|Council|School|Academy)\b\.?/g, replacement: '[company]', accept: (m) => !m.trim().split(/\s+/).every((w) => IT_WORDS.has(w.toLowerCase())) },
  { label: 'Greeting name', re: /\b(?:Dear|Hi|Hello|Hey)\s+([A-Z][a-z]{2,})\b/g, group: 1, replacement: '[person]', accept: (m) => !IT_WORDS.has(m.toLowerCase()) },
  { label: 'Person name', re: /\b(?:called|named|spoke to|speaking to|spoke with|asked for|handed over to|escalated to|assigned to|contact(?:ed)?)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g, group: 1, replacement: '[person]', accept: (m) => !m.split(/\s+/).some((w) => IT_WORDS.has(w.toLowerCase())) },
  { label: 'Host name', re: /\b(?=[A-Z0-9-]*\d)[A-Z]{2,6}(?:-[A-Z0-9]{2,12}){1,4}\b/g, replacement: '[hostname]', accept: (m) => !/^(?:KB|CVE|ISO|IEEE|TCP|UDP)-?\d/.test(m) },
  { label: 'Serial or ID', re: /\b(?=[A-Z0-9]*\d{3})(?=[A-Z0-9]*[A-Z]{2})[A-Z0-9]{9,}\b/g, replacement: '[serial-or-id]', accept: (m) => !/^(?:KB\d+|CVE)/.test(m) },
  { label: 'Long number', re: /(?<![\w.])\d(?:[ -]?\d){7,}(?!\w|\.\d)/g, replacement: '[number]' },
  { label: 'Link to a private site', re: /\bhttps?:\/\/([^\s/"'<>)]+)[^\s"'<>)]*/gi, replacement: '[link]', accept: (m) => { const host = (m.match(/^https?:\/\/([^\s/"'<>)]+)/i)?.[1] ?? '').toLowerCase(); return !KNOWN_HOSTS.test(host); } },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function scrubText(input: string, extraTerms: string[] = []): ScrubResult {
  const items: ScrubItem[] = [];
  const note = (label: string, original: string, replacement: string) => items.push({ label, original, replacement });

  // 1. Everything the secret/personal-data scanner finds.
  let text = input;
  const found = scanText(text);
  for (const f of found) note(f.label, f.text, f.replacement);
  text = redactText(text, found);

  // 2. Work-specific rules.
  for (const rule of EXTRA) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
    text = text.replace(re, (...args: unknown[]) => {
      const m = args[0] as string;
      const grp = rule.group ? (args[rule.group] as string | undefined) : undefined;
      const target = grp ?? m;
      if (!target || (rule.accept && !rule.accept(target))) return m;
      note(rule.label, target.trim(), rule.replacement);
      return grp !== undefined ? m.replace(grp, rule.replacement) : rule.replacement;
    });
  }

  // 3. Words the person asked to remove for this document.
  for (const raw of extraTerms) {
    const t = raw.trim();
    if (t.length < 2) continue;
    const re = new RegExp(esc(t), 'gi');
    text = text.replace(re, (m) => { note('Word you chose', m, '[removed]'); return '[removed]'; });
  }

  const counts: Record<string, number> = {};
  for (const i of items) counts[i.label] = (counts[i.label] ?? 0) + 1;
  return { text, items, counts };
}

export const scrubSummary = (r: ScrubResult): string => {
  const n = r.items.length;
  return n === 0 ? 'Nothing matched the automatic rules. Read the text carefully before saving.' : `Removed ${n} item${n === 1 ? '' : 's'}: ${Object.entries(r.counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ')}.`;
};
