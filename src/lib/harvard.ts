/**
 * Harvard-style reference for a web page or video, following the "Websites" pattern in the learner's referencing guide:
 *   Author/Organisation. (Year). Title of page. Available at: URL (Accessed: date).
 * Plain text cannot show italics, so the title is left plain. Check the finished reference against your own course guide.
 */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const accessedText = (d: Date): string => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export interface WebSource { author?: string; year?: string; title: string; url: string; accessed: Date }

/** A four digit year, or "n.d." (no date) when it is not known. Never guesses. */
export const yearOrND = (y: string | undefined): string => (/^(19|20)\d{2}$/.test((y ?? '').trim()) ? (y ?? '').trim() : 'n.d.');

export function harvardWeb(s: WebSource): string {
  const title = s.title.replace(/\s+/g, ' ').trim().replace(/[.]+$/, '');
  const author = (s.author ?? '').replace(/\s+/g, ' ').trim().replace(/[.]+$/, '') || title;
  return `${author}. (${yearOrND(s.year)}). ${title}. Available at: ${s.url.trim()} (Accessed: ${accessedText(s.accessed)}).`;
}

/** The short in-text form, for example (Net Channel, 2021). */
export const harvardInText = (s: Pick<WebSource, 'author' | 'year' | 'title'>): string => `(${(s.author ?? '').trim() || s.title.trim()}, ${yearOrND(s.year)})`;
