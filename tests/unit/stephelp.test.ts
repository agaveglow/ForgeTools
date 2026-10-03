import { describe, expect, test } from 'bun:test';
import { answerAboutStep, stepIntent } from '../../src/lib/stepHelp';
import type { VisualModel } from '../../src/lib/visual';

const model: VisualModel = {
  title: 't',
  cautions: ['Back up first'],
  steps: [
    { n: 1, text: 'Run sfc /scannow from an elevated prompt.', commands: ['sfc /scannow'], caution: false },
    { n: 2, text: 'Zorblax the frobnicator quietly.', commands: [], caution: false },
  ],
};

describe('step help', () => {
  test('intents', () => {
    expect(stepIntent('What could go wrong?')).toBe('risk');
    expect(stepIntent('what does the command do')).toBe('command');
    expect(stepIntent('Why do I do this step?')).toBe('why');
  });
  test('command step is grounded', () => {
    const a = answerAboutStep(model, 0, 'What does the command do?');
    expect(a.grounded).toBe(true);
    expect(JSON.stringify(a.blocks)).toContain('sfc');
    expect(a.sources.length).toBeGreaterThan(0);
  });
  test('unknown step does not guess', () => {
    const a = answerAboutStep(model, 1, 'Why do I do this step?');
    expect(a.grounded).toBe(false);
    expect(JSON.stringify(a.blocks)).toContain('won’t guess');
  });
  test('out of range', () => {
    expect(answerAboutStep(model, 9, 'why').grounded).toBe(false);
  });
});
