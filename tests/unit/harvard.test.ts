import { describe, expect, test } from 'bun:test';
import { accessedText, harvardInText, harvardWeb, yearOrND } from '../../src/lib/harvard';

describe('Harvard web reference', () => {
  const d = new Date(2026, 9, 4);
  test('follows the guide: Author. (Year). Title. Available at: URL (Accessed: date).', () => {
    expect(harvardWeb({ author: 'Net Channel', year: '2021', title: 'Subnetting made simple', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', accessed: d }))
      .toBe('Net Channel. (2021). Subnetting made simple. Available at: https://www.youtube.com/watch?v=dQw4w9WgXcQ (Accessed: 4 October 2026).');
  });
  test('an unknown year is n.d., never guessed', () => {
    expect(yearOrND('')).toBe('n.d.'); expect(yearOrND('last year')).toBe('n.d.'); expect(yearOrND(' 2019 ')).toBe('2019'); expect(yearOrND('1899')).toBe('n.d.');
  });
  test('with no author the title leads', () => {
    expect(harvardWeb({ title: 'How DNS works.', url: 'https://x.test', accessed: d })).toBe('How DNS works. (n.d.). How DNS works. Available at: https://x.test (Accessed: 4 October 2026).');
  });
  test('access date reads like 10 August 2023', () => { expect(accessedText(new Date(2023, 7, 10))).toBe('10 August 2023'); });
  test('in-text form', () => { expect(harvardInText({ author: 'Net Channel', year: '2021', title: 't' })).toBe('(Net Channel, 2021)'); expect(harvardInText({ title: 'A title' })).toBe('(A title, n.d.)'); });
});
