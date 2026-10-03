/**
 * Rules-based note structurer ("local assistant").
 *
 * It re-organises rough notes into work-log sections using the user's OWN words.
 * It never adds actions, findings or outcomes that were not written, and anything it cannot
 * place goes to `other`. Suggestions (skills, possible areas, category) are returned separately and
 * are never applied automatically: the user decides what is true and what to save.
 *
 * It runs entirely in the browser. To use a real language model later, implement `Assistant`
 * (below) against an API and swap it in; the UI only depends on `StructuredNote`.
 */
import type { LogCategory } from '../data/types';

export interface StructuredNote {
  /** Clauses in the user's words, tidied (capitalised, full stop). */
  problem: string[];
  investigation: string[];
  actions: string[];
  result: string[];
  followUp: string[];
  other: string[];
  category: LogCategory;
  /** Suggested skill ids. Suggestions only. */
  skills: string[];
  deviceGuess?: string;
  /** Things that might be worth mentioning IF the user actually did them. Never claimed as done. */
  possibleAreas: PossibleArea[];
  /** Sections the notes did not cover. */
  missing: Array<'problem' | 'actions' | 'result'>;
}

export interface PossibleArea {
  label: string;
}

export interface Assistant {
  structure(raw: string): Promise<StructuredNote> | StructuredNote;
}

// ---------- vocabulary ----------

const INVESTIGATE = [
  'checked', 'compared', 'reviewed', 'looked', 'inspected', 'identified', 'found', 'noticed', 'observed', 'confirmed', 'verified',
  'investigated', 'diagnosed', 'traced', 'pinged', 'monitored', 'examined', 'ruled out', 'reproduced', 'discovered', 'searched', 'read',
  'tested', 'queried', 'analysed', 'analyzed', 'spoke to', 'asked', 'saw', 'ran a scan', 'scanned', 'opened',
];
const ACT = [
  'fixed', 'corrected', 'replaced', 'reset', 'reinstalled', 'installed', 'updated', 'removed', 'cleaned', 'cleared', 'restarted', 'rebooted',
  'recreated', 're-created', 'rebuilt', 'repaired', 'reseated', 're-seated', 'enabled', 'disabled', 'changed', 'reconfigured', 'configured',
  'added', 're-added', 'flushed', 'renewed', 'uninstalled', 'upgraded', 'rolled back', 'ran', 'applied', 'granted', 'revoked', 'deleted',
  'moved', 'adjusted', 'swapped', 'rejoined', 're-joined', 'unlinked', 'relinked', 'escalated', 'raised', 'logged', 'contacted', 'advised',
  'completed', 'created', 'set', 'mapped', 'disconnected', 'reconnected', 'connected', 'rebooted', 'powered', 'switched', 'reloaded',
];
const VERBS = [...new Set([...INVESTIGATE, ...ACT])].sort((a, b) => b.length - a.length);
const VERB_ALT = VERBS.map((v) => v.replace(/[-]/g, '[- ]?').replace(/ /g, '\\s+')).join('|');
const VERB_START = new RegExp(`^(?:${VERB_ALT})\\b`, 'i');
const INVEST_START = new RegExp(`^(?:${INVESTIGATE.map((v) => v.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');

// A clause boundary is a comma / "and" / "then" / "but" that is followed by something that starts a new clause.
const RESULT_WORDS = '(?:it|they|this|that|everything|printer|pc|laptop|computer|user|mailbox|email|outlook|the (?:printer|issue|problem|user|pc|laptop))\\s+(?:now\\s+)?(?:works|worked|working|prints|printed|connects|connected|opens|opened|loads|loaded|syncs|synced|is working|are working)';
const GENERIC_RESULT = '(?:[a-z]+\\s+){0,2}(?:now\\s+)?(?:works|worked|working|is working)\\b';
const BOUNDARY = new RegExp(`(?:\\s*,\\s*(?:and\\s+|then\\s+)?|\\s+and\\s+|\\s+then\\s+|\\s*;\\s*)(?=(?:${VERB_ALT})\\b|${RESULT_WORDS}|${GENERIC_RESULT})`, 'i');

const FOLLOWUP = /\b(?:follow[- ]?up|monitor(?:ing)?|will (?:need|be|check|retest|review)|needs? to|to be (?:done|checked|confirmed|reviewed)|awaiting|waiting (?:for|on)|pending|recommend(?:ed|s)?|suggest(?:ed|s)?|should|next (?:step|visit)|still to|retest|check again|revisit|remains? to)\b/i;
const STRONG_RESULT = /\b(?:works|worked|working|resolved|successful(?:ly)?|passed|now (?:works|working|prints|connects|opens|loads|syncs)|back to normal|no longer|still (?:fails|failing|not|happening|slow|broken|an issue)|unresolved|not resolved|did not (?:fix|help|work|resolve)|didn'?t (?:fix|help|work|resolve)|confirmed (?:working|fixed|resolved)|user (?:confirmed|is happy|happy|satisfied)|all good|ok now|fixed now)\b/i;
const FIXED_HEADLINE = /^(?:fixed|resolved|sorted)\b/i;
const PROBLEM = /\b(?:couldn'?t|could not|can'?t|cannot|unable|won'?t|not working|doesn'?t|does not|didn'?t|did not|isn'?t|is not|wasn'?t|failed|failing|fails|error|crash(?:es|ed|ing)?|slow|stuck|missing|no (?:internet|network|access|sound|display|signal|power)|keeps?|kept|reported|complain(?:ed|ing|t)?|issue|problem|misfeed(?:ing|s)?|jam(?:s|med|ming)?|offline|freez(?:e|es|ing)|frozen|hang(?:s|ing)?|blocked|locked out|not (?:loading|opening|connecting|printing|syncing|showing))\b/i;
// "Tested" on its own says a test happened, not what it showed.
const BARE_TEST = /^(?:and\s+)?(?:re-?)?tested(?:\s+(?:it|the (?:fix|change|printer|device)))?\.?$/i;

// ---------- helpers ----------

export function tidy(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim().replace(/^[-*•]\s*/, '').replace(/^(?:and|then|but|so)\s+/i, '');
  if (!t) return '';
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += '.';
  return t;
}

function splitSentences(raw: string): string[] {
  return raw
    .split(/\r?\n+|(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitClauses(sentence: string): string[] {
  const parts = sentence.replace(/[.!?]+$/, '').split(BOUNDARY).map((p) => p.trim()).filter(Boolean);
  // Re-join fragments that cannot stand alone (list items like "profile" or "account configuration").
  const out: string[] = [];
  for (const p of parts) {
    const standalone = VERB_START.test(p) || new RegExp(`^(?:${RESULT_WORDS}|${GENERIC_RESULT})`, 'i').test(p) || PROBLEM.test(p) || FOLLOWUP.test(p) || out.length === 0;
    if (!standalone && out.length) out[out.length - 1] += ', ' + p;
    else out.push(p);
  }
  return out;
}

type Bucket = 'problem' | 'investigation' | 'actions' | 'result' | 'followUp' | 'other';

function classify(clause: string, isFirst: boolean): Bucket {
  const c = clause.trim();
  if (BARE_TEST.test(c)) return 'actions';
  if (FOLLOWUP.test(c) && !STRONG_RESULT.test(c)) return 'followUp';
  if (FIXED_HEADLINE.test(c)) return 'result';
  if (STRONG_RESULT.test(c) && !PROBLEM.test(c.replace(/\b(?:worked|works|working)\b/gi, ''))) {
    // "Replaced toner and it worked" is split earlier; a leftover verb-led clause with a result word is an outcome.
    return 'result';
  }
  if (VERB_START.test(c)) return INVEST_START.test(c) ? 'investigation' : 'actions';
  if (PROBLEM.test(c)) return 'problem';
  if (STRONG_RESULT.test(c)) return 'result';
  return isFirst ? 'problem' : 'other';
}

// ---------- category / skills / areas ----------

const CATEGORY_KEYWORDS: Array<[LogCategory, RegExp]> = [
  ['Printers', /\b(?:printer|printing|print|toner|fuser|ricoh|canon|xerox|konica|kyocera|brother|epson|lexmark|mfp|copier|scanner|scan to|paper|tray|roller|spooler|misfeed|jam)\b/gi],
  ['Networking', /\b(?:network|wi-?fi|wireless|dns|dhcp|vpn|gateway|router|switch|ethernet|ping|ip address|subnet|internet|firewall rule|latency|packet|lan|wan)\b/gi],
  ['Microsoft 365', /\b(?:outlook|mailbox|exchange|teams|sharepoint|onedrive|office 365|m365|microsoft 365|entra|azure ad|mfa|conditional access|shared mailbox|calendar)\b/gi],
  ['Cybersecurity', /\b(?:defender|antivirus|malware|virus|phishing|ransomware|suspicious|compromise[d]?|bitlocker|secure boot|encryption|firewall|local admin|administrator rights|breach|incident|vulnerab\w*)\b/gi],
  ['Hardware', /\b(?:ram|memory stick|ssd|hard drive|hdd|battery|charger|monitor|screen|display|keyboard|mouse|docking|dock|motherboard|psu|power supply|fan|hardware|usb|webcam)\b/gi],
  ['Windows', /\b(?:windows|bsod|blue screen|startup|boot|profile|driver|sfc|dism|update|slow|registry|task manager|event viewer|reboot|login)\b/gi],
];

export function detectCategory(raw: string): LogCategory {
  let best: LogCategory = 'Other';
  let bestScore = 0;
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    const score = (raw.match(re) ?? []).length;
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}

export function suggestSkills(raw: string, category: LogCategory, hasWork: boolean): string[] {
  const s: string[] = [];
  const add = (id: string) => s.includes(id) || s.push(id);
  const has = (re: RegExp) => re.test(raw);
  if (hasWork) add('troubleshooting');
  if (category === 'Printers') {
    add('printer-engineering');
    if (has(/\b(?:roller|fuser|feed|motor|gear|sensor|jam|misfeed|mechanical)\b/i)) add('hardware');
  }
  if (category === 'Networking') add('networking');
  if (category === 'Windows') add('windows');
  if (category === 'Hardware') add('hardware');
  if (category === 'Microsoft 365') add('m365');
  if (category === 'Cybersecurity') add('endpoint-security');
  if (has(/\b(?:permission|access|mfa|password|account|sign-?in|login|admin(?:istrator)? rights|full access|send as)\b/i)) add('identity-access');
  if (has(/\b(?:vpn|dns|dhcp|wi-?fi|gateway|ping)\b/i)) add('networking');
  if (has(/\b(?:defender|antivirus|malware|bitlocker|secure boot)\b/i)) add('endpoint-security');
  if (has(/\b(?:phish\w*|compromise[d]?|breach|incident|suspicious)\b/i)) add('incident-response');
  if (has(/\b(?:script|powershell|automat\w*)\b/i)) add('automation');
  return s.slice(0, 5);
}

interface AreaDef {
  when: RegExp;
  areas: Array<{ label: string; mentioned: RegExp }>;
}
const AREAS: AreaDef[] = [
  {
    when: /\b(?:outlook|mailbox|exchange)\b/i,
    areas: [
      { label: 'Mailbox permissions (Full Access / Send As / Send on Behalf)', mentioned: /permission|full access|send as/i },
      { label: 'Outlook profile', mentioned: /profile/i },
      { label: 'Account configuration', mentioned: /account config|account setting/i },
      { label: 'Cached mode / local data file state', mentioned: /cache|ost/i },
      { label: 'Auto-mapping and permission propagation delay', mentioned: /auto-?map|propagat/i },
      { label: 'Comparison with Outlook on the web', mentioned: /web|browser|owa/i },
    ],
  },
  {
    when: /\b(?:printer|print|toner|fuser|mfp|copier|paper|jam|misfeed)\b/i,
    areas: [
      { label: 'Paper path, rollers and debris', mentioned: /feed path|roller|debris/i },
      { label: 'Tray, media type and tray settings', mentioned: /tray|media|paper type/i },
      { label: 'Fuser area (when cooled and isolated)', mentioned: /fuser/i },
      { label: 'Error code shown on the device', mentioned: /error code|code/i },
      { label: 'Network connection / IP of the device', mentioned: /network|ip\b|cable/i },
      { label: 'Driver and print queue', mentioned: /driver|queue|spooler/i },
      { label: 'Consumables (toner, drum, waste)', mentioned: /toner|drum|consumable/i },
    ],
  },
  {
    when: /\b(?:network|wi-?fi|dns|dhcp|vpn|internet|gateway|ping)\b/i,
    areas: [
      { label: 'Link state / Wi-Fi association', mentioned: /link|wi-?fi|cable/i },
      { label: 'IP configuration (ipconfig /all)', mentioned: /ipconfig|ip config|ip address/i },
      { label: 'Gateway reachability', mentioned: /gateway/i },
      { label: 'DNS resolution', mentioned: /dns|nslookup/i },
      { label: 'VPN client / profile', mentioned: /vpn/i },
      { label: 'Compared with another device or network', mentioned: /another device|other device|different network/i },
    ],
  },
  {
    when: /\b(?:slow|windows|startup|boot|update|crash)\b/i,
    areas: [
      { label: 'Task Manager (CPU, memory, disk)', mentioned: /task manager/i },
      { label: 'Startup items', mentioned: /startup/i },
      { label: 'Free disk space and disk health', mentioned: /disk|storage|space/i },
      { label: 'Pending or failed updates', mentioned: /update/i },
      { label: 'Event Viewer / Reliability Monitor', mentioned: /event viewer|reliability/i },
    ],
  },
  {
    when: /\b(?:defender|antivirus|malware|security|bitlocker|suspicious|phish\w*)\b/i,
    areas: [
      { label: 'Defender / endpoint protection status', mentioned: /defender|antivirus/i },
      { label: 'Local administrators', mentioned: /local admin|administrators/i },
      { label: 'Disk encryption status', mentioned: /bitlocker|encrypt/i },
      { label: 'Recent sign-in activity', mentioned: /sign-?in|login/i },
    ],
  },
];

export function suggestAreas(raw: string): PossibleArea[] {
  const out: PossibleArea[] = [];
  for (const def of AREAS) {
    if (!def.when.test(raw)) continue;
    for (const a of def.areas) if (!a.mentioned.test(raw) && !out.some((o) => o.label === a.label)) out.push({ label: a.label });
  }
  return out.slice(0, 8);
}

const DEVICE_RE = /\b((?:ricoh|canon|xerox|konica(?:\s+minolta)?|kyocera|brother|epson|lexmark|sharp|hp|dell|lenovo|asus|acer|surface|microsoft surface|apple|macbook|cisco|ubiquiti|netgear|draytek|sonicwall|fortigate)\s+(?:[a-z]{1,3}\s+)?(?:[a-z]*\d[\w-]*|printer|mfp|copier|laptop|desktop|router|switch|firewall|access point|pc))\b/i;

export function guessDevice(raw: string): string | undefined {
  const m = raw.match(DEVICE_RE);
  return m ? m[1].replace(/\s+/g, ' ') : undefined;
}

// ---------- main ----------

export function structureNotes(raw: string): StructuredNote {
  const note: StructuredNote = {
    problem: [], investigation: [], actions: [], result: [], followUp: [], other: [],
    category: 'Other', skills: [], possibleAreas: [], missing: [],
  };
  const text = (raw ?? '').trim();
  if (!text) {
    note.missing = ['problem', 'actions', 'result'];
    return note;
  }

  let firstClause = true;
  for (const sentence of splitSentences(text)) {
    for (const clause of splitClauses(sentence)) {
      const t = tidy(clause);
      if (!t) continue;
      const bucket = classify(clause, firstClause);
      firstClause = false;
      (note[bucket] as string[]).push(t);
    }
  }

  note.category = detectCategory(text);
  note.skills = suggestSkills(text, note.category, note.investigation.length + note.actions.length > 0);
  note.deviceGuess = guessDevice(text);
  note.possibleAreas = suggestAreas(text);
  if (!note.problem.length) note.missing.push('problem');
  if (!note.actions.length && !note.investigation.length) note.missing.push('actions');
  if (!note.result.length) note.missing.push('result');
  return note;
}

/** Join clauses for a single text field. */
export function joinClauses(parts: string[]): string {
  return parts.join(' ');
}

export const localAssistant: Assistant = { structure: structureNotes };
