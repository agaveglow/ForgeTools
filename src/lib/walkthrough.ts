/**
 * Transcript -> walkthrough.
 *
 * Takes what someone said (a voice memo transcript, dictation, pasted notes) and organises it into a
 * step-by-step guide: what you need, ordered steps, commands, things to watch out for, and the expected
 * result. It re-organises the speaker's own words. It does not add steps, commands or results that were
 * not said, and anything it cannot place is kept rather than dropped.
 *
 * It is rule-based (sequence words such as "first", "then", "finally", plus caution and requirement
 * phrases), so unusual speech may be sorted wrongly. That is why the output is meant to be edited and
 * checked against the recording. The raw transcript is always kept with the saved guide.
 */
import { COMMANDS } from '../content/commands';
import type { CommandEntry } from '../content/types';
import type { Guide, GuideSection, Source } from './agent';
import { analyseTopic } from './agent';
import type { AgentContext } from './agent';
import type { KbCategory } from '../data/types';

export interface Walkthrough {
  title: string;
  intro: string[];
  needs: string[];
  steps: Array<{ text: string; commands: string[] }>;
  cautions: string[];
  result: string[];
  /** Spoken lines that fit nowhere else. Kept so nothing is lost. */
  other: string[];
  commands: string[];
  /** Library commands that were mentioned, for linking. */
  libraryCommands: CommandEntry[];
  /** Plain-language notes about what could not be found. */
  warnings: string[];
  transcript: string;
}

// ---------- cleaning ----------

const FILLER = /\b(?:um+|uh+|er+m?|ah+|hmm+|you know|i mean|sort of|kind of)\b[,]?\s*/gi;
const SPOKEN_SYMBOLS: Array<[RegExp, string]> = [
  [/\b(ipconfig|sfc|dism|chkdsk|netsh|gpupdate|nslookup|ping|tracert|net|wmic|powershell|get-[a-z]+)\s+slash\s+/gi, '$1 /'],
  [/\s+slash\s+(?=[a-z]+\b)/gi, ' /'],
  [/\bflush\s*dns\b/gi, 'flushdns'],
  [/\bdisplay\s*dns\b/gi, 'displaydns'],
  [/\bregister\s*dns\b/gi, 'registerdns'],
  [/\bscan\s*now\b/gi, 'scannow'],
  [/\bcheck\s*health\b/gi, 'checkhealth'],
  [/\brestore\s*health\b/gi, 'restorehealth'],
  [/\bscan\s*health\b/gi, 'scanhealth'],
  [/\s+dash\s+(?=[a-z]+\b)/gi, ' -'],
];

export function cleanTranscript(raw: string): string {
  let t = (raw ?? '').replace(/\r/g, '').replace(FILLER, ' ');
  for (const [re, rep] of SPOKEN_SYMBOLS) t = t.replace(re, rep);
  return t.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
}

// ---------- splitting ----------

const MARKER = '(?:first(?:ly)?|second(?:ly)?|third(?:ly)?|fourth|fifth|next|then|after that|afterwards|once (?:that(?:\'s| is)|you(?:\'ve| have)|it(?:\'s| is)) (?:done|finished|complete|open)|now|finally|lastly|last of all|step (?:one|two|three|four|five|six|seven|eight|nine|ten|\\d+)|the first thing|to (?:start|begin)(?: with)?|so then|and then)';
const MARKER_START = new RegExp(`^(?:(?:okay|ok|right|so|and|alright|well)[, ]+)*${MARKER}\\b[,:]?\\s*`, 'i');
const SPLIT_AT_MARKER = new RegExp(`(?:[,;]\\s*|\\s+)(?=(?:and\\s+)?(?:then|next|after that|afterwards|finally|lastly|step (?:one|two|three|four|five|six|seven|eight|nine|ten|\\d+))\\b)`, 'i');

const NEED = /\b(?:you(?:'ll| will)? need|you(?:'ll| will) want|make sure you have|requires?|before you (?:start|begin)|prerequisites?|you have to have|have (?:a|an|the) .{0,30} ready)\b/i;
const CAUTION = /\b(?:careful|warning|be sure not|don'?t|do not|never|avoid|watch out|dangerous|risky|risk|back ?up|take a backup|important|remember (?:to|not)|make sure (?:you )?(?:don'?t|not|to)|otherwise|or (?:you|it) (?:will|might|could)|can (?:break|lose|delete|wipe)|will (?:delete|wipe|lose))\b/i;
const CAUTION_LEAD = /^(?:(?:okay|ok|right|so|and|but)[, ]+)*(?:be careful|careful|warning|don'?t|do not|never|avoid|watch out|important|remember|just (?:be )?careful|make sure you don'?t)\b/i;
const RESULT = /\b(?:that'?s it|you'?re (?:done|all set|good)|should (?:now )?(?:work|see|show|be (?:working|fixed|back))|(?:it|that) (?:should|will) (?:now )?(?:work|be)|it (?:now )?works|it worked|that fixed|working again|back to normal|all (?:good|sorted)|(?:is|are) fixed)\b/i;
const INTRO = /\b(?:this is (?:how|a guide|a walkthrough)|in this (?:video|recording|note|guide)|i'?m going to (?:show|walk|explain)|let me (?:show|walk|explain)|how to|today i)\b/i;

const sentence = (s: string): string => {
  const t = s.replace(/\s+/g, ' ').replace(/^[-*•]\s*/, '').trim().replace(/[,;:]+$/, '');
  if (!t) return '';
  const c = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(c) ? c : c + '.';
};

function chunks(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    for (const sent of line.split(/(?<=[.!?])\s+(?=[A-Za-z0-9"'(`])/)) {
      let s = sent.trim();
      if (!s) continue;
      // Spoken transcripts often lack punctuation: break long runs at sequence words.
      for (const part of s.split(SPLIT_AT_MARKER)) if (part.trim()) out.push(part.trim());
    }
  }
  return out;
}

// ---------- commands ----------

const PS_CMD = /\b(?:Get|Set|New|Remove|Restart|Start|Stop|Test|Add|Enable|Disable|Install|Uninstall|Invoke|Clear|Repair|Update|Connect|Disconnect|Import|Export|Reset|Resolve)-[A-Z][A-Za-z]+(?:\s+-[A-Za-z]+(?:\s+(?!-)[^\s,;.]+)?)*/g;
const CLASSIC_CMD = /\b(?:ipconfig(?:\s+\/[a-z]+)?|sfc\s+\/[a-z]+|dism\s+\/[^\n.]*?(?=[.,;]|\s+and\b|\s+then\b|$)|chkdsk(?:\s+[a-z]:)?(?:\s+\/[a-z]+)*|gpupdate(?:\s+\/[a-z]+)*|nslookup(?:\s+[\w.-]+)?|tracert\s+[\w.-]+|ping\s+(?:-[a-z]\s+)?[\w.-]+|net\s+(?:start|stop|use|user|localgroup)\s+[\w$.\\-]+|netsh\s+[a-z]+(?:\s+[a-z]+){0,3}|shutdown\s+\/[a-z](?:\s+\/[a-z]\s+\d+)?|msinfo32|winver|services\.msc|devmgmt\.msc|eventvwr(?:\.msc)?|taskmgr)\b/gi;

export function extractCommands(text: string): string[] {
  const found: string[] = [];
  const add = (c: string) => { const t = c.trim().replace(/[.,;]+$/, ''); if (t && !found.some((f) => f.toLowerCase() === t.toLowerCase())) found.push(t); };
  for (const m of text.match(PS_CMD) ?? []) add(m);
  for (const m of text.match(CLASSIC_CMD) ?? []) add(m);
  // Library command names spoken exactly.
  const lower = text.toLowerCase();
  for (const c of COMMANDS) if (c.name.length > 5 && lower.includes(c.name.toLowerCase())) add(c.name);
  // Drop shorter commands that are a prefix of a longer one already found (e.g. "ipconfig" vs "ipconfig /flushdns").
  return found.filter((c) => !found.some((o) => o !== c && o.toLowerCase().startsWith(c.toLowerCase() + ' ')));
}

// ---------- main ----------

export function buildWalkthrough(raw: string): Walkthrough {
  const transcript = (raw ?? '').trim();
  const text = cleanTranscript(transcript);
  const w: Walkthrough = { title: '', intro: [], needs: [], steps: [], cautions: [], result: [], other: [], commands: [], libraryCommands: [], warnings: [], transcript };
  if (!text) { w.warnings.push('There is no transcript yet.'); return w; }

  const parts = chunks(text);
  let seenStep = false;
  parts.forEach((part, i) => {
    const body = part.replace(MARKER_START, '').trim();
    const clause = sentence(body);
    if (!clause) return;
    const hasMarker = MARKER_START.test(part);
    const cmds = extractCommands(body);

    if (CAUTION_LEAD.test(part) || (CAUTION.test(body) && !hasMarker && !cmds.length && !/^(?:open|click|go|select|type|run|press|restart|check)\b/i.test(body))) { w.cautions.push(clause); return; }
    if (NEED.test(body) && !seenStep) { w.needs.push(clause); return; }
    if (RESULT.test(body) && (seenStep || i > 0) && !hasMarker) { w.result.push(clause); return; }
    if (!seenStep && !hasMarker && !cmds.length && (INTRO.test(body) || i === 0)) { w.intro.push(clause); return; }
    // A step. Keep a caution that rides inside the same sentence as well.
    seenStep = true;
    w.steps.push({ text: clause, commands: cmds });
    if (CAUTION.test(body) && !CAUTION_LEAD.test(part)) w.cautions.push(clause);
    if (RESULT.test(body) && hasMarker) w.result.push(clause);
  });

  // If the speaker never used a step word, treat the non-intro lines as the steps in order.
  w.commands = [...new Set(w.steps.flatMap((s) => s.commands))];
  w.libraryCommands = w.commands.map((c) => COMMANDS.find((x) => x.name.toLowerCase() === c.toLowerCase())).filter((c): c is CommandEntry => !!c);

  const first = w.intro[0] ?? w.steps[0]?.text ?? '';
  w.title = first.replace(/^(?:this is how (?:to|you)|how to|in this (?:video|note|recording|guide),? (?:i'?m going to|we'?ll|i will) (?:show you |explain |walk through )?)/i, '').replace(/[.!?]+$/, '').trim();
  w.title = w.title ? w.title.charAt(0).toUpperCase() + w.title.slice(1, 80) : 'Voice note walkthrough';

  if (w.steps.length === 0) w.warnings.push('No clear steps were found. Say or type the steps in order, using words like “first”, “then” and “finally”, or edit the transcript and try again.');
  else if (w.steps.length === 1) w.warnings.push('Only one step was found. Check the transcript is complete.');
  if (w.steps.length > 0 && !w.result.length) w.warnings.push('The recording does not say what the end result should look like. Add it if you know it.');
  if (text.length > 400 && !/[.!?]/.test(text)) w.warnings.push('The transcript has no punctuation, so steps may be joined together. Check the order against the recording.');
  return w;
}

// ---------- guide / log output ----------

function kbCategoryFor(cat: string, hasCommands: boolean): KbCategory {
  if (cat === 'Printers') return 'Printers';
  if (cat === 'Networking') return 'Networking';
  if (cat === 'Cybersecurity') return 'Cybersecurity';
  if (cat === 'Microsoft 365') return 'Microsoft';
  return hasCommands ? 'Commands' : 'Procedures';
}

export function walkthroughToGuide(w: Walkthrough, ctx: AgentContext, titleOverride?: string): Guide {
  const a = analyseTopic(w.transcript, ctx);
  const sections: GuideSection[] = [];
  if (w.intro.length) sections.push({ title: 'Overview', items: w.intro });
  if (w.needs.length) sections.push({ title: 'What you need', items: w.needs });
  sections.push({
    title: 'Steps',
    note: 'In the order they were described.',
    ordered: true,
    items: w.steps.map((s) => (s.commands.length ? `${s.text} (${s.commands.map((c) => '`' + c + '`').join(', ')})` : s.text)),
  });
  if (w.cautions.length) sections.push({ title: 'Watch out for', items: [...new Set(w.cautions)] });
  if (w.result.length) sections.push({ title: 'Expected result', items: w.result });
  if (w.commands.length) sections.push({ title: 'Commands mentioned', note: 'As said in the recording. Check them against the command reference before running.', items: [], code: w.commands });
  const sources: Source[] = [
    ...w.libraryCommands.map((c) => ({ label: c.name, route: `/commands/${c.id}` })),
    ...a.matches.map((m) => ({ label: m.workflow.title, route: `/troubleshoot/${m.workflow.id}` })),
  ];
  const top = a.matches[0]?.workflow;
  return {
    title: (titleOverride ?? w.title) || 'Voice note walkthrough',
    kind: 'howto',
    workflowId: top?.id,
    summary: 'Made from a voice note or transcript. These are the speaker’s own steps, not checked against anything. Review before relying on it.',
    sections,
    sources,
    tags: [...new Set(['generated', 'voice-note', a.category.toLowerCase().replace(/\s+/g, '-')])],
    kbCategory: kbCategoryFor(a.category, w.commands.length > 0),
  };
}

/** Body saved to the knowledge base: the guide text plus the original transcript, so nothing is lost. */
export function walkthroughBody(guideText: string, transcript: string): string {
  return `${guideText}\n\nTRANSCRIPT\n\`\`\`\n${transcript.trim()}\n\`\`\``;
}
