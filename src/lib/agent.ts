/**
 * Guide agent: a local, grounded assistant for on-the-fly questions and guides.
 *
 * Describe a problem or ask how to do something ("how do I clear a stuck print queue", "what does sfc /scannow do",
 * "Ricoh tray 2 keeps jamming") and it builds a step-by-step guide from the built-in troubleshooting library,
 * the command reference, your knowledge base and your past work logs. Follow-up questions are answered from
 * the same material. It does NOT reason freely like a language model and it never states facts about your
 * situation that you did not give it. Every answer carries its sources, and when nothing in the library
 * matches it says so.
 *
 * `AgentProvider` is the swap point for a model-backed version later. Run the save guard (lib/sensitive)
 * over anything before sending it off-device.
 */
import { COMMANDS } from '../content/commands';
import { CONCEPTS } from '../content/concepts';
import { ALL_GUIDES } from '../content/library';
import type { Block, LibGuide } from '../content/library';
import { WORKFLOWS } from '../content/workflows';
import type { CommandEntry, Workflow } from '../content/types';
import type { KbCategory, KbEntry, LogCategory, WorkLog } from '../data/types';
import { detectCategory, guessDevice } from './notes';

export interface AgentContext {
  logs: WorkLog[];
  kb: KbEntry[];
}

export interface WorkflowMatch {
  workflow: Workflow;
  score: number;
}

export type TopicKind = 'command' | 'problem' | 'howto';

export interface TopicAnalysis {
  text: string;
  kind: TopicKind;
  category: LogCategory;
  device?: string;
  /** Set when the request is really about one command. */
  command?: CommandEntry;
  /** Things worth finding out first. Only for problem descriptions, and only what the text doesn't already say. */
  missing: string[];
  matches: WorkflowMatch[];
  commands: CommandEntry[];
  similarLogs: WorkLog[];
  kb: KbEntry[];
  /** True for suspected compromise or incident-style wording. */
  securityIncident: boolean;
  /** A built-in procedure or study guide that covers the request. */
  libMatch?: LibGuide;
  /** 'good' when something in the library really covers the request; 'none' when only loose or no matches exist. */
  confidence: 'good' | 'none';
  /** Loosely related items, shown honestly as related rather than as the answer. */
  related: Source[];
  /** Words from the request that nothing in the library covered. */
  unmatched: string[];
}

export interface Source {
  label: string;
  route: string;
  /** True for web addresses, opened in a new tab. */
  external?: boolean;
}
export interface AnswerBlock {
  heading?: string;
  lines: string[];
  ordered?: boolean;
}
export interface Answer {
  blocks: AnswerBlock[];
  sources: Source[];
  /** False when the library had nothing relevant. */
  grounded: boolean;
}

export interface GuideSection {
  title: string;
  note?: string;
  items: string[];
  ordered?: boolean;
  /** Rendered as code blocks with a copy button. */
  code?: string[];
}
export interface Guide {
  title: string;
  kind: TopicKind;
  workflowId?: string;
  summary: string;
  sections: GuideSection[];
  sources: Source[];
  tags: string[];
  kbCategory: KbCategory;
}

export interface AgentProvider {
  analyse(text: string, ctx: AgentContext): TopicAnalysis | Promise<TopicAnalysis>;
  guide(a: TopicAnalysis): Guide | Promise<Guide>;
  answer(question: string, a: TopicAnalysis, ctx: AgentContext): Answer | Promise<Answer>;
}

// ---------- text helpers ----------

const GENERIC = new Set('how guide step process procedure new create make setup set use using need want help know way something thing do doing'.split(' '));
/** Words so broad that matching only on them does not mean a guide covers the request. */
const BROAD = new Set('outlook window windows printer email mail microsoft 365 network internet computer pc laptop device office system software account'.split(' '));
const STOP = new Set(('a an and are as at be but by can for from has have he her his i if in into is it its me my no not of on or our she so ' +
  'that the their them then there they this to too up us was we were what when which who will with you your user users ticket please hi hello thanks ' +
  'thank regards cannot cant couldnt wont dont doesnt didnt isnt wasnt just still also very been being does did do get got').split(' '));

const SYNONYMS: Array<[RegExp, string]> = [
  [/\bwi-?fi\b|\bwireless\b/g, 'wifi'],
  [/\bcan'?t print\b|\bwon'?t print\b|\bnot printing\b/g, 'printing print'],
  [/\bblue screen\b|\bbsod\b|\bstop code\b/g, 'bluescreen crash'],
  [/\bpaper jam\b|\bjam(?:s|med|ming)?\b|\bmis-?feed\w*/g, 'jam misfeed paper'],
  [/\bsigned? ?in\b|\blog ?in\b|\blogon\b|\blog on\b/g, 'signin login'],
  [/\bslow\w*\b|\blagg?\w*\b|\bfreez\w*\b|\bhang\w*\b/g, 'slow performance'],
  [/\bshared mailbox\b/g, 'sharedmailbox mailbox'],
  [/\bno internet\b|\boffline\b|\bnot connect\w*\b/g, 'internet offline connectivity'],
  [/\bphish\w*\b/g, 'phishing suspicious'],
  [/\bvirus\b|\bmalware\b|\bransom\w*\b/g, 'malware suspicious'],
  [/\bwhite ?-?list\w*|\ballow ?-?list\w*|\bsafe senders?\b|\bsafelist\w*/g, 'allowlist'],
  [/\bout ?look\b/g, 'outlook'],
  [/\bone ?drive\b/g, 'onedrive'],
];

export function tokens(text: string): string[] {
  let t = text.toLowerCase();
  for (const [re, rep] of SYNONYMS) t = t.replace(re, ' ' + rep + ' ');
  return t
    .split(/[^a-z0-9.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, '').replace(/(?:ing|ed|es|s)$/, (m, _o: number, str: string) => (str.length - m.length >= 3 ? '' : m)))
    .filter((w) => w.length > 1 && !STOP.has(w));
}

function scoreAgainst(q: Set<string>, text: string, weight: number): number {
  let s = 0;
  const seen = new Set<string>();
  for (const w of tokens(text)) if (q.has(w) && !seen.has(w)) { seen.add(w); s += weight; }
  return s;
}

// ---------- analysis ----------

const SECURITY = /\b(?:phish\w*|malware|virus|ransom\w*|compromis\w*|breach\w*|hacked|suspicious (?:email|login|sign-?in|activity|link|attachment)|clicked (?:a |the )?link|unknown login|stolen|data leak)\b/i;
const PROBLEM_WORDS = /\b(?:not working|won'?t|can'?t|cannot|couldn'?t|unable|fail\w*|error|issue|problem|slow|stuck|crash\w*|jam\w*|keeps?|kept|broken|missing|offline|no (?:internet|access|sound|display)|doesn'?t|isn'?t|wrong|bsod|blue screen|locked out|freez\w*)\b/i;
const HOWTO = /^\s*(?:how (?:do|to|can|should|would)|guide|steps? (?:to|for)|set ?up|configure|install|create|reset|add|enable|disable|process for|procedure for|walk me through|show me how)\b/i;
const COMMAND_Q = /\b(?:what (?:does|is)|explain|syntax|meaning of|how (?:do i|to) (?:use|run)|what'?s)\b/i;

export function findCommand(text: string): CommandEntry | undefined {
  const t = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
  const full = COMMANDS.filter((c) => t.includes(c.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length);
  if (full[0]) return full[0];
  const word = (c: CommandEntry) => c.name.toLowerCase().split(' ')[0];
  const partial = COMMANDS.filter((c) => word(c).length >= 3 && new RegExp('(?:^|[^a-z0-9-])' + word(c).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z0-9-])').test(t))
    .sort((a, b) => a.name.length - b.name.length);
  return partial[0];
}

function missingQuestions(text: string, category: LogCategory, security: boolean): string[] {
  const q: string[] = [];
  const has = (re: RegExp) => re.test(text);
  if (!has(/\b(?:since|started|began|yesterday|today|this morning|last (?:week|night)|after|ago)\b/i)) q.push('When did it start, and did anything change just before (update, move, new device, password change)?');
  if (!has(/\b(?:all users|everyone|only|just (?:me|one|him|her)|several|multiple|other (?:users|people|devices))\b/i)) q.push('Is it one user or device, or several?');
  if (!has(/\b(?:error|code|message|says|shows|displays)\b/i)) q.push('What exact error message or code appears?');
  if (!has(/\b(?:restart|reboot|tried|already|power cycled)\b/i)) q.push('What has already been tried, for example a restart?');
  if (category === 'Printers') {
    if (!has(/\b(?:model|ricoh|canon|xerox|konica|kyocera|brother|epson|hp|lexmark|sharp)\b/i)) q.push('What is the printer make and model?');
    if (!has(/\b(?:tray|toner|usb|network|wireless|wifi|ip)\b/i)) q.push('How is it connected (network, USB, Wi-Fi) and which tray or function is affected?');
  }
  if (category === 'Networking' && !has(/\b(?:wifi|wired|cable|ethernet|vpn|remote|office|home)\b/i)) q.push('Is the device wired, on Wi-Fi or on VPN, and where is it?');
  if (category === 'Microsoft 365' && !has(/\b(?:web|browser|owa|desktop|app|mobile|phone)\b/i)) q.push('Does it also fail in the web version, or only in the desktop app?');
  if (security) q.push('Has anything been clicked, opened or entered? Has the device been disconnected? Do not delete anything yet.');
  return q.slice(0, 6);
}

export function analyseTopic(text: string, ctx: AgentContext): TopicAnalysis {
  const category = detectCategory(text);
  const q = new Set(tokens(text));
  const securityIncident = SECURITY.test(text);
  const problem = PROBLEM_WORDS.test(text) || securityIncident;
  const cmd = findCommand(text);
  const shortText = tokens(text).length <= 4;
  const kind: TopicKind = cmd && (COMMAND_Q.test(text) || (shortText && !problem)) ? 'command' : problem && !HOWTO.test(text) ? 'problem' : HOWTO.test(text) || !problem ? 'howto' : 'problem';

  const qList = [...q].filter((w) => !GENERIC.has(w));
  const cover = (text: string): { hit: string[]; coverage: number } => {
    const have = new Set(tokens(text));
    const hit = qList.filter((w) => have.has(w));
    return { hit, coverage: qList.length ? hit.length / qList.length : 0 };
  };
  const enough = (coverage: number, score: number, hit: string[]) => score >= 5 && (coverage >= 0.5 || qList.length <= 1 || hit.filter((w) => !BROAD.has(w)).length >= 2);
  const scoredAll: Array<WorkflowMatch & { coverage: number; hit: string[] }> = WORKFLOWS.map((w) => {
    let s = scoreAgainst(q, w.title, 3) + scoreAgainst(q, w.tags.join(' '), 3) + scoreAgainst(q, w.symptoms.join(' '), 2) + scoreAgainst(q, w.summary, 1);
    // Require real overlap with your own words; the category bonus alone is not a match.
    if (s < 4) return { workflow: w, score: 0, coverage: 0, hit: [] };
    if (w.category === category) s += 2;
    const c = cover([w.title, w.tags.join(' '), w.symptoms.join(' '), w.summary].join(' '));
    return { workflow: w, score: s, ...c };
  }).filter((m) => m.score >= 5).sort((a, b) => b.score - a.score);
  const matches = scoredAll.filter((m) => enough(m.coverage, m.score, m.hit)).slice(0, 3);

  const libScored = ALL_GUIDES.map((g) => {
    const txt = [g.title, g.tags.join(' '), g.summary].join(' ');
    const s = scoreAgainst(q, g.title, 3) + scoreAgainst(q, g.tags.join(' '), 3) + scoreAgainst(q, g.summary, 1);
    const c = cover(txt + ' ' + g.blocks.map((b) => b.title).join(' '));
    return { g, score: s, ...c };
  }).filter((x) => x.score >= 5).sort((a, b) => b.score - a.score);
  const libGood = libScored.filter((x) => enough(x.coverage, x.score, x.hit));
  const libMatch = libGood[0]?.g;
  const confidence: 'good' | 'none' = matches.length || libMatch || (cmd && kind === 'command') ? 'good' : 'none';
  const shownIds = new Set([...matches.map((m) => m.workflow.id), libMatch?.id]);
  const related: Source[] = [
    ...scoredAll.filter((m) => !shownIds.has(m.workflow.id)).slice(0, 3).map((m) => ({ label: m.workflow.title, route: `/troubleshoot/${m.workflow.id}` })),
    ...libScored.filter((x) => !shownIds.has(x.g.id)).slice(0, 3).map((x) => ({ label: x.g.title, route: `/${x.g.set}/${x.g.id}` })),
  ].slice(0, 5);
  const best = [...scoredAll.map((m) => m.hit), ...libScored.map((x) => x.hit)].sort((a, b) => b.length - a.length)[0] ?? [];
  const unmatched = confidence === 'good' ? [] : qList.filter((w) => !best.includes(w));

  const cmdIds = new Set<string>();
  if (cmd) cmdIds.add(cmd.id);
  for (const m of matches) for (const st of m.workflow.steps) for (const id of st.commandIds ?? []) cmdIds.add(id);
  const commands = [...cmdIds].map((id) => COMMANDS.find((c) => c.id === id)).filter((c): c is CommandEntry => !!c).slice(0, 8);

  const similarLogs = ctx.logs
    .map((l) => ({ l, s: scoreAgainst(q, [l.problem, l.investigation, l.actions, l.device].join(' '), 2) + (l.category === category ? 1 : 0) }))
    .filter((x) => x.s >= 5).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.l);
  const kb = ctx.kb
    .map((k) => ({ k, s: scoreAgainst(q, k.title + ' ' + k.tags.join(' '), 3) + scoreAgainst(q, k.body, 1) }))
    .filter((x) => x.s >= 4).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.k);

  return {
    text, kind, category, device: guessDevice(text), command: kind === 'command' ? cmd : undefined,
    missing: kind === 'problem' ? missingQuestions(text, category, securityIncident) : [], matches: matches.map((m) => ({ workflow: m.workflow, score: m.score })), commands, similarLogs, kb, securityIncident,
    libMatch, confidence, related, unmatched,
  };
}

// ---------- guide ----------

const wfSource = (w: Workflow): Source => ({ label: w.title, route: `/troubleshoot/${w.id}` });
const cmdLine = (c: CommandEntry) => `${c.name}: ${c.purpose}`;
const cmdSource = (c: CommandEntry): Source => ({ label: c.name, route: `/commands/${c.id}` });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function kbCategoryFor(kind: TopicKind, category: LogCategory): KbCategory {
  if (kind === 'command') return 'Commands';
  if (category === 'Printers') return 'Printers';
  if (category === 'Networking') return 'Networking';
  if (category === 'Cybersecurity') return 'Cybersecurity';
  if (category === 'Microsoft 365') return 'Microsoft';
  return kind === 'problem' ? 'Troubleshooting' : 'Procedures';
}

function tagsFor(a: TopicAnalysis, top?: Workflow): string[] {
  return [...new Set(['generated', a.category.toLowerCase().replace(/\s+/g, '-'), ...(top?.tags.slice(0, 3).map((t) => t.toLowerCase().replace(/\s+/g, '-')) ?? []), ...(a.command ? [a.command.name.split(' ')[0].toLowerCase()] : [])])];
}

function commandGuide(a: TopicAnalysis, c: CommandEntry): Guide {
  const rel = (c.related ?? []).map((id) => COMMANDS.find((x) => x.id === id)).filter((x): x is CommandEntry => !!x);
  return {
    title: c.name, kind: 'command', summary: `${c.purpose} ${c.risk === 'safe' ? 'Read-only.' : c.risk === 'caution' ? 'Changes state, so read the risks.' : 'Can disrupt or lose data, so read the risks.'}`,
    sections: [
      { title: 'What it does', items: [c.explanation] },
      { title: 'Syntax', items: [], code: [c.syntax] },
      { title: 'Example', items: [], code: [c.example] },
      { title: 'Expected output', items: [c.expectedOutput] },
      { title: 'When to use it', items: [c.whenToUse] },
      { title: 'Risks', note: c.needsAdmin ? 'Needs an Administrator prompt.' : undefined, items: [c.risks] },
      ...(rel.length ? [{ title: 'Related commands', items: rel.map(cmdLine) }] : []),
    ],
    sources: [cmdSource(c), ...rel.map(cmdSource)], tags: tagsFor(a), kbCategory: 'Commands',
  };
}

function blockSection(b: Block): GuideSection {
  if (b.kind === 'steps') return { title: b.title, ordered: true, items: b.items };
  if (b.kind === 'points') return { title: b.title, items: b.items };
  if (b.kind === 'caution') return { title: b.title, note: 'Read before you start.', items: b.items };
  if (b.kind === 'table') return { title: b.title, items: b.rows.map(([x, y]) => `${x}: ${y}`) };
  return { title: b.title, items: [b.text] };
}

function libraryGuide(a: TopicAnalysis, g: LibGuide): Guide {
  return {
    title: g.title, kind: 'howto', summary: `From the built-in ${g.set === 'procedures' ? 'procedures' : 'study library'}. ${g.summary}`,
    sections: [...g.blocks.map(blockSection), { title: 'Escalate if', items: ['The steps are done and it is still not working.', 'The change needs approval or access you do not have.', 'You see signs of a security problem.'] }],
    sources: [{ label: g.title, route: `/${g.set}/${g.id}` }, ...a.kb.map((k) => ({ label: k.title, route: `/kb/${k.id}` }))],
    tags: [...new Set(['generated', ...g.tags.slice(0, 4).map((t) => t.toLowerCase().replace(/\s+/g, '-'))])], kbCategory: kbCategoryFor('howto', a.category),
  };
}

export interface CustomGuideInput {
  goal: string; area: LogCategory; needsAdmin: boolean; steps: string[]; verify: string; watch: string;
}
/** A guide built from what the person typed. Steps are theirs; nothing is invented. */
export function buildCustomGuide(i: CustomGuideInput): Guide {
  const goal = i.goal.trim().replace(/\s+/g, ' ').replace(/[?.!]+$/, '');
  const area = i.area;
  const steps = i.steps.map((x) => x.trim().replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '')).filter(Boolean);
  const sections: GuideSection[] = [
    { title: 'Before you start', items: [
      'Make sure you are authorised to make this change and that the customer knows.',
      ...(i.needsAdmin ? ['This needs administrator rights. Use the account you are meant to use for this, not a shared one.'] : []),
      'Note how things look now, so you can put them back.',
    ] },
    steps.length
      ? { title: 'Steps', note: 'Written from your own notes. Check them against the screens you see.', ordered: true, items: steps }
      : { title: 'Steps', note: 'Not filled in yet. Add them from the vendor\'s own documentation or your own notes, then save again.', items: ['Steps still to be added.'] },
    { title: 'Check it worked', items: i.verify.trim() ? [i.verify.trim()] : ['Do the task the user originally wanted and confirm it works.', 'Check nothing nearby stopped working.'] },
  ];
  if (i.watch.trim()) sections.push({ title: 'Watch out for', items: [i.watch.trim()] });
  sections.push({ title: 'Undo it', items: ['If it does not work or something else breaks, put back the settings you noted at the start.'] });
  sections.push({ title: 'Escalate if', items: ['You are not sure what the change will affect.', 'It needs access or approval you do not have.', 'You see signs of a security problem.'] });
  return {
    title: cap(goal.slice(0, 80)) || 'My guide', kind: 'howto',
    summary: steps.length ? 'A guide built from your own steps.' : 'A guide outline. The steps still need to be added.',
    sections, sources: [], tags: ['generated', 'my-guide', area.toLowerCase().replace(/\s+/g, '-')], kbCategory: kbCategoryFor('howto', area),
  };
}

export function buildGuide(a: TopicAnalysis): Guide {
  if (a.kind === 'command' && a.command) return commandGuide(a, a.command);
  const top = a.matches[0]?.workflow;
  if (!top && a.libMatch) return libraryGuide(a, a.libMatch);
  const sections: GuideSection[] = [];

  sections.push({
    title: 'Before you start',
    items: [
      'Make sure you are authorised to work on this device or account.',
      'Tell the user what you are going to do and roughly how long it will take.',
      ...(a.securityIncident ? ['This reads like a possible incident: follow your escalation procedure first. Do not delete, wipe or reboot until it says so.'] : ['Note the current state (screenshot or a line in your notes) so you can show what changed.']),
    ],
  });
  if (a.missing.length) sections.push({ title: 'Find out first', note: 'Your description does not say:', items: a.missing });

  if (top) {
    sections.push({ title: 'Quick checks', items: top.initialChecks });
    sections.push({
      title: a.kind === 'problem' ? 'Diagnose' : 'Steps',
      note: 'Work through in order and record what you see at each step.',
      ordered: true,
      items: top.steps.map((st) => `${st.title}. ${st.detail}${st.commandIds?.length ? ' (' + st.commandIds.map((id) => COMMANDS.find((c) => c.id === id)?.name).filter(Boolean).join(', ') + ')' : ''}`),
    });
    sections.push({ title: 'Likely causes', note: 'Possibilities from the library, not a diagnosis. Your findings decide.', items: top.causes.slice(0, 4).map((c) => `${c.cause}: ${c.indicators}`) });
    sections.push({ title: 'Fix options', note: 'Only once the diagnosis points to one of these.', items: top.remediation.map((r) => `${r.title}. ${r.detail}${r.caution ? ' CAUTION: ' + r.caution : ''}`) });
    sections.push({ title: 'Verify', items: top.verification });
    sections.push({ title: 'Record', items: top.documentation });
  } else {
    sections.push({
      title: 'General approach',
      note: 'Nothing in the library matches this closely, so this is a general method, not specific instructions.',
      ordered: true,
      items: [
        'Reproduce or observe the problem yourself and note the exact symptom.',
        'Establish scope: one user or several, one device or all.',
        'Find what changed recently.',
        'Change one thing at a time and record the result of each.',
        'Search your notes and previous logs, then escalate if nothing explains it.',
      ],
    });
    if (a.commands.length) sections.push({ title: 'Related commands', items: a.commands.map(cmdLine) });
    sections.push({ title: 'Verify', items: ['Repeat what failed and confirm it works.', 'Check nothing else was affected by your change.'] });
    sections.push({ title: 'Record', items: ['What was reported, what you checked, what you changed, the result, and any follow-up.'] });
  }
  sections.push({
    title: 'Escalate if',
    items: ['The steps are done and the cause is still unknown.', 'The fix needs access or a change you are not authorised to make.', 'You see signs of a security incident, data loss or a wider outage.'],
  });

  const title = top ? (a.kind === 'howto' ? `Guide: ${top.title}` : top.title) : cap(a.text.trim().replace(/\s+/g, ' ').slice(0, 70)).replace(/[?.!]+$/, '') || 'General guide';
  return {
    title, kind: a.kind, workflowId: top?.id,
    summary: top ? `Closest match in your library: ${top.title}. This guide follows that workflow. Check it fits before you start.` : 'No close match in your library. This is a general guide.',
    sections,
    sources: [...a.matches.map((m) => wfSource(m.workflow)), ...a.kb.map((k) => ({ label: k.title, route: `/kb/${k.id}` })), ...a.similarLogs.map((l) => ({ label: `${l.ref}: ${l.problem.slice(0, 50)}`, route: `/logs/${l.id}` }))],
    tags: tagsFor(a, top), kbCategory: kbCategoryFor(a.kind, a.category),
  };
}

/** Plain-text form, used for copying and for the knowledge-base body (code blocks use ``` fences). */
export function guideToText(g: Guide): string {
  const out: string[] = [g.title, '', g.summary];
  for (const s of g.sections) {
    out.push('', s.title.toUpperCase());
    if (s.note) out.push(s.note);
    s.items.forEach((it, i) => out.push(s.ordered ? `${i + 1}. ${it}` : s.items.length === 1 && !s.note && g.kind === 'command' ? it : `- ${it}`));
    for (const c of s.code ?? []) out.push('```', c, '```');
  }
  return out.join('\n');
}

// ---------- questions ----------

type Intent = 'plan' | 'first' | 'commands' | 'causes' | 'fix' | 'verify' | 'record' | 'risk' | 'similar' | 'ask' | 'learn' | 'summary';
const INTENTS: Array<[RegExp, Intent]> = [
  [/find out|what (?:do i|should i) ask|ask (?:the )?user|missing|clarif/i, 'ask'],
  [/similar|before|previous|history|seen (?:this|it|anything)|past|last time|again/i, 'similar'],
  [/risk|danger|safe|caution|careful|backup|data loss|break|harm|warn/i, 'risk'],
  [/command|powershell|cmd|run |terminal|script/i, 'commands'],
  [/cause|why|reason|root|what(?:'s| is) wrong|could (?:it|be)/i, 'causes'],
  [/verify|confirm|prove|check it works|done|finished|sign off|test (?:it|the fix)/i, 'verify'],
  [/document|write ?up|notes|record|log\b|what to (?:write|record)/i, 'record'],
  [/learn|skill|study|concept|research|practice/i, 'learn'],
  [/fix|resolve|remed|solution|solve|repair|sort/i, 'fix'],
  [/first|start|begin|initial|quick check|where do i/i, 'first'],
  [/plan|steps|approach|how (?:do|should|can) i|walk me|process|procedure|what should i do/i, 'plan'],
  [/summar|what is this|overview|tell me about/i, 'summary'],
];
const intentOf = (q: string): Intent | null => { for (const [re, i] of INTENTS) if (re.test(q)) return i; return null; };

const NONE = 'Nothing in the library matches that closely enough to answer reliably.';

export function answerQuestion(question: string, a: TopicAnalysis, ctx: AgentContext): Answer {
  const top = a.matches[0]?.workflow;
  const wfSources = a.matches.map((m) => wfSource(m.workflow));
  const none = (): Answer => ({ blocks: [{ lines: [NONE, 'Try rephrasing with the device, error message or command name, or search your knowledge base.'] }], sources: [], grounded: false });

  // A direct question about one command always gets that command's details.
  const asked = COMMAND_Q.test(question) ? findCommand(question) : undefined;
  if (asked) {
    const g = commandGuide(a, asked);
    return { blocks: [{ heading: asked.name, lines: [g.summary] }, { heading: 'Syntax', lines: [asked.syntax] }, { heading: 'Example', lines: [asked.example] }, { heading: 'Expected output', lines: [asked.expectedOutput] }, { heading: 'Risks', lines: [asked.risks] }], sources: g.sources, grounded: true };
  }

  const intent = intentOf(question);
  const needWf = (blocks: AnswerBlock[]): Answer => ({ blocks, sources: wfSources, grounded: true });
  switch (intent) {
    case 'ask':
      return { blocks: [{ heading: 'Worth finding out first', lines: a.missing.length ? a.missing : ['Your description already covers the usual questions. Confirm the symptom before you start.'] }], sources: [], grounded: true };
    case 'similar': {
      if (!a.similarLogs.length && !a.kb.length) return { blocks: [{ lines: ['No similar work logs or knowledge-base notes found. This may be a first for you, so a good one to log.'] }], sources: [], grounded: true };
      const blocks: AnswerBlock[] = [];
      if (a.similarLogs.length) blocks.push({ heading: 'Similar work logs', lines: a.similarLogs.map((l) => `${l.ref}: ${l.problem}${l.actions ? ' Done: ' + l.actions : ''}${l.result ? ' Result: ' + l.result : ''}${l.demo ? ' (demo record)' : ''}`) });
      if (a.kb.length) blocks.push({ heading: 'Your notes', lines: a.kb.map((k) => k.title) });
      return { blocks, sources: [...a.similarLogs.map((l) => ({ label: l.ref, route: `/logs/${l.id}` })), ...a.kb.map((k) => ({ label: k.title, route: `/kb/${k.id}` }))], grounded: true };
    }
    case 'learn': {
      const c = CONCEPTS[a.category];
      return { blocks: [{ heading: 'Concepts to understand', lines: c.concepts }, { heading: 'Worth researching', lines: c.research }, { heading: 'Practice afterwards', lines: [c.nextActivity] }], sources: [], grounded: true };
    }
    case 'summary':
      return { blocks: [{ heading: 'What I picked up', lines: [`Category looks like ${a.category}.`, a.device ? `Device mentioned: ${a.device}.` : 'No specific device named.', top ? `Closest library match: ${top.title}.` : 'No close library match.'] }], sources: wfSources, grounded: true };
    default:
      break;
  }

  if (top) {
    switch (intent) {
      case 'plan': {
        const g = buildGuide(a);
        return needWf([{ heading: g.title, lines: [g.summary] }, ...g.sections.filter((s) => ['Quick checks', 'Diagnose', 'Steps', 'Fix options', 'Verify'].includes(s.title)).map((s) => ({ heading: s.title, lines: s.items, ordered: s.ordered }))]);
      }
      case 'first':
        return needWf([{ heading: 'Quick checks', lines: top.initialChecks }, { heading: 'Then start with', lines: top.steps.slice(0, 3).map((st) => `${st.title}. ${st.detail}`), ordered: true }]);
      case 'commands':
        if (!a.commands.length) break;
        return { blocks: [{ heading: 'Commands that fit', lines: a.commands.map(cmdLine) }, { lines: ['Open the command reference for syntax, expected output and risks. Run commands only on devices you are authorised to administer.'] }], sources: a.commands.map(cmdSource), grounded: true };
      case 'causes':
        return needWf([{ heading: 'Possible causes (not a diagnosis)', lines: top.causes.map((c) => `${c.cause}: ${c.indicators}`) }, { lines: ['What you find in the diagnostic steps decides which applies.'] }]);
      case 'fix':
        return needWf([{ heading: 'Fix options, once diagnosis points to one', lines: top.remediation.map((r) => `${r.title}. ${r.detail}${r.caution ? ' CAUTION: ' + r.caution : ''}`) }]);
      case 'verify':
        return needWf([{ heading: 'Verify the fix', lines: top.verification }]);
      case 'record':
        return needWf([{ heading: 'What to record', lines: top.documentation }]);
      case 'risk': {
        const lines = [...top.remediation.filter((r) => r.caution).map((r) => `${r.title}: ${r.caution}`), ...a.commands.filter((c) => c.risk !== 'safe').map((c) => `${c.name} (${c.risk}): ${c.risks}`)];
        if (a.securityIncident) lines.unshift('Possible incident: escalate before remediating and avoid destroying evidence.');
        if (lines.length) return { blocks: [{ heading: 'Risks to watch', lines }], sources: wfSources, grounded: true };
        break;
      }
      default:
        break;
    }
  }

  // Fallback: retrieve from the whole library using the question's own words.
  const qt = new Set(tokens(question));
  const cmds = COMMANDS.map((c) => ({ c, s: scoreAgainst(qt, c.name + ' ' + (c.keywords ?? []).join(' '), 3) + scoreAgainst(qt, c.purpose + ' ' + c.whenToUse, 1) })).filter((x) => x.s >= 4).sort((x, y) => y.s - x.s).slice(0, 3);
  const wfs = WORKFLOWS.map((w) => ({ w, s: scoreAgainst(qt, w.title + ' ' + w.tags.join(' '), 3) + scoreAgainst(qt, w.summary + ' ' + w.symptoms.join(' '), 1) })).filter((x) => x.s >= 5).sort((x, y) => y.s - x.s).slice(0, 2);
  const kbs = ctx.kb.map((k) => ({ k, s: scoreAgainst(qt, k.title + ' ' + k.tags.join(' '), 3) + scoreAgainst(qt, k.body, 1) })).filter((x) => x.s >= 4).sort((x, y) => y.s - x.s).slice(0, 2);
  const blocks: AnswerBlock[] = [];
  const sources: Source[] = [];
  if (wfs.length) { blocks.push({ heading: 'Related guides', lines: wfs.map((x) => `${x.w.title}: ${x.w.summary}`) }); sources.push(...wfs.map((x) => wfSource(x.w))); }
  if (cmds.length) { blocks.push({ heading: 'Related commands', lines: cmds.map((x) => cmdLine(x.c)) }); sources.push(...cmds.map((x) => cmdSource(x.c))); }
  if (kbs.length) { blocks.push({ heading: 'From your notes', lines: kbs.map((x) => x.k.title) }); sources.push(...kbs.map((x) => ({ label: x.k.title, route: `/kb/${x.k.id}` }))); }
  if (!blocks.length) return none();
  return { blocks: [{ lines: ['I can’t answer that directly, but these parts of your library look related:' ] }, ...blocks], sources, grounded: true };
}

export const localAgent: AgentProvider = { analyse: analyseTopic, guide: buildGuide, answer: answerQuestion };
