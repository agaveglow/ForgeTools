import { describe, expect, test } from 'bun:test';
import { modelFromGuide, modelFromText, layoutDiagram, wrapText, hasVisuals, stepDuration } from '../../src/lib/visual';
import { analyseTopic, buildGuide, guideToText } from '../../src/lib/agent';
import { buildWalkthrough, walkthroughBody, walkthroughToGuide } from '../../src/lib/walkthrough';

const ctx = { logs: [], kb: [] };

describe('visual model', () => {
  const g = buildGuide(analyseTopic('Printer jams when printing from tray 2', ctx));
  test('built from an agent guide', () => {
    const m = modelFromGuide(g);
    expect(m.steps.length).toBeGreaterThanOrEqual(2);
    expect(m.steps.map((s) => s.n)).toEqual(m.steps.map((_, i) => i + 1));
  });
  test('text round trip keeps the same steps', () => {
    const a = modelFromGuide(g);
    const b = modelFromText(g.title, guideToText(g));
    expect(b.steps.map((s) => s.text)).toEqual(a.steps.map((s) => s.text));
  });
  test('voice walkthrough: commands attach to the step that says them, transcript ignored', () => {
    const t = 'First open an admin command prompt. Then run net stop spooler. Next delete the files in the spool folder. Finally run net start spooler. Be careful not to delete the folder itself.';
    const w = buildWalkthrough(t);
    const gd = walkthroughToGuide(w, ctx);
    const m = modelFromGuide(gd);
    expect(m.steps.find((s) => /net stop spooler/.test(s.text))?.commands.join(' ')).toContain('net stop spooler');
    expect(m.cautions.join(' ')).toMatch(/careful/i);
    const saved = modelFromText('x', walkthroughBody(guideToText(gd), 'First 1. fake step in transcript'));
    expect(saved.steps.some((s) => /fake step/.test(s.text))).toBe(false);
  });
  test('layout and helpers', () => {
    expect(wrapText('aaa bbb ccc ddd', 7)).toEqual(['aaa bbb', 'ccc ddd']);
    expect(wrapText('x'.repeat(20), 8).length).toBe(3);
    const m = modelFromGuide(g);
    const { nodes, height } = layoutDiagram(m);
    expect(nodes[0].kind).toBe('start');
    expect(nodes.at(-1)?.kind).toBe('end');
    expect(height).toBeGreaterThan(nodes.length * 20);
    expect(hasVisuals({ title: '', steps: [], cautions: [] })).toBe(false);
    expect(stepDuration({ n: 1, text: 'a b c', commands: ['net stop spooler'], caution: false })).toBeGreaterThan(2500);
  });
});
