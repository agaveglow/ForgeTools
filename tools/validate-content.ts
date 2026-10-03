import { SKILL_BY_ID } from '../src/content/skills';
import type { Workflow } from '../src/content/types';
const files: [string, string][] = [
  ['../src/content/workflows/windows-hardware', 'WINDOWS_HARDWARE_WORKFLOWS'],
  ['../src/content/workflows/network-printers', 'NETWORK_PRINTER_WORKFLOWS'],
  ['../src/content/workflows/m365-security', 'M365_SECURITY_WORKFLOWS'],
  ['../src/content/workflows/identity-security', 'IDENTITY_SECURITY_WORKFLOWS'],
];
let cmdIds = new Set<string>();
try { cmdIds = new Set((await import('../src/content/commands')).COMMANDS.map((c: any) => c.id)); console.log('commands:', cmdIds.size); } catch { console.log('commands.ts missing'); }
const all: Workflow[] = [];
for (const [f, n] of files) {
  try { const m = await import(f); all.push(...m[n]); console.log(n, m[n].length); } catch (e: any) { console.log('MISSING', n, e.message?.slice(0, 80)); }
}
const ids = new Set<string>(); let problems = 0;
const bad = (m: string) => { problems++; console.log('PROBLEM:', m); };
for (const w of all) {
  if (ids.has(w.id)) bad('dup ' + w.id); ids.add(w.id);
  for (const k of ['symptoms','initialChecks','steps','causes','remediation','verification','documentation','skills'] as const) if (!(w as any)[k]?.length) bad(`${w.id} empty ${k}`);
  const sid = new Set<string>();
  for (const s of w.steps) { if (sid.has(s.id)) bad(`${w.id} dup step ${s.id}`); sid.add(s.id); if (!s.lookFor || !s.meaning) bad(`${w.id}/${s.id} missing lookFor/meaning`); for (const c of s.commandIds ?? []) if (cmdIds.size && !cmdIds.has(c)) bad(`${w.id}/${s.id} unknown command ${c}`); }
  for (const s of w.skills) if (!SKILL_BY_ID[s]) bad(`${w.id} unknown skill ${s}`);
  if (w.tree) {
    const nodes = new Map(w.tree.nodes.map((n) => [n.id, n]));
    if (!nodes.has(w.tree.start)) bad(`${w.id} tree start missing`);
    for (const n of w.tree.nodes) for (const o of n.options) { if (!!o.next === !!o.conclusion) bad(`${w.id} node ${n.id} option needs exactly one of next/conclusion`); if (o.next && !nodes.has(o.next)) bad(`${w.id} node ${n.id} -> missing ${o.next}`); }
    const seen = new Set<string>(); const q = [w.tree.start];
    while (q.length) { const id = q.pop()!; if (seen.has(id)) continue; seen.add(id); nodes.get(id)?.options.forEach((o) => o.next && q.push(o.next)); }
    if (seen.size !== nodes.size) bad(`${w.id} unreachable tree nodes: ${[...nodes.keys()].filter((k) => !seen.has(k)).join(',')}`);
  }
}
console.log('workflows', all.length, 'problems', problems);
console.log(all.map((w) => w.id).join(' '));

// commands: validate related ids + required ids
const cmds = (await import('../src/content/commands')).COMMANDS as any[];
const cid = new Set(cmds.map((c) => c.id));
if (cid.size !== cmds.length) console.log('PROBLEM: duplicate command ids');
for (const c of cmds) {
  for (const r of c.related ?? []) if (!cid.has(r)) console.log('PROBLEM: command', c.id, 'related missing', r);
  for (const k of ['syntax','purpose','example','explanation','expectedOutput','whenToUse','risks']) if (!c[k]) console.log('PROBLEM: command', c.id, 'empty', k);
}
console.log('commands', cmds.length);
