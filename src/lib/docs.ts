/**
 * Read text out of documents on the device (no upload anywhere) and turn it into a guide.
 * Supported: .txt .md .csv .log .html .htm .docx. PDFs and photos are not read directly.
 * The caller should run the text through scrubText() before anything is shown or saved.
 */
import { analyseTopic, kbCategoryFor } from './agent';
import type { AgentContext, Guide, GuideSection } from './agent';
import { extractCommands, buildWalkthrough, walkthroughToGuide } from './walkthrough';
import { extractReadable } from './web';

export class DocError extends Error {}

export const MAX_DOC_BYTES = 15 * 1024 * 1024;
const MAX_UNZIPPED = 25 * 1024 * 1024;

// ---------- minimal ZIP reader (enough for .docx) ----------

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(data: Uint8Array, limit: number): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) { await reader.cancel(); throw new DocError('That document expands to an unreasonable size and was not opened.'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

export async function unzipEntry(buf: Uint8Array, name: string): Promise<Uint8Array | null> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (u32(buf, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new DocError('That file is not a valid .docx (zip) file.');
  let off = u32(buf, eocd + 16);
  const count = u16(buf, eocd + 10);
  for (let n = 0; n < count && off + 46 <= buf.length; n++) {
    if (u32(buf, off) !== 0x02014b50) break;
    const method = u16(buf, off + 10); const csize = u32(buf, off + 20); const usize = u32(buf, off + 24);
    const nlen = u16(buf, off + 28); const elen = u16(buf, off + 30); const clen = u16(buf, off + 32); const lho = u32(buf, off + 42);
    const entryName = new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nlen));
    if (entryName === name) {
      if (usize > MAX_UNZIPPED) throw new DocError('That document is too large to open.');
      const dataStart = lho + 30 + u16(buf, lho + 26) + u16(buf, lho + 28);
      const raw = buf.subarray(dataStart, dataStart + csize);
      if (method === 0) return raw.slice();
      if (method === 8) return inflateRaw(raw, MAX_UNZIPPED);
      throw new DocError('That document uses a compression method that is not supported.');
    }
    off += 46 + nlen + elen + clen;
  }
  return null;
}

// ---------- docx ----------

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});

function paraText(p: string): string {
  let out = '';
  for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)) out += m[0].startsWith('<w:tab') ? ' ' : m[0].startsWith('<w:br') ? '\n' : decodeXml(m[1]);
  return out.replace(/[ \t]+/g, ' ').trim();
}

function numberingFormats(xml: string | null): Map<string, string> {
  const fmt = new Map<string, string>();
  if (!xml) return fmt;
  const abs = new Map<string, string>();
  for (const m of xml.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) abs.set(m[1], m[2].match(/<w:lvl\b[^>]*w:ilvl="0"[\s\S]*?<w:numFmt\s+w:val="([^"]+)"/)?.[1] ?? 'bullet');
  for (const m of xml.matchAll(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>[\s\S]*?<w:abstractNumId\s+w:val="(\d+)"/g)) fmt.set(m[1], abs.get(m[2]) ?? 'bullet');
  return fmt;
}

export async function docxToText(buf: Uint8Array): Promise<string> {
  const doc = await unzipEntry(buf, 'word/document.xml');
  if (!doc) throw new DocError('No document text was found in that .docx file.');
  const xml = new TextDecoder().decode(doc);
  const numXml = await unzipEntry(buf, 'word/numbering.xml').then((b) => (b ? new TextDecoder().decode(b) : null)).catch(() => null);
  const formats = numberingFormats(numXml);
  const counters = new Map<string, number>();
  const lines: string[] = [];
  const body = xml.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? xml;
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[\s>][\s\S]*?<\/w:p>/g;
  for (const m of body.matchAll(re)) {
    const block = m[0];
    if (block.startsWith('<w:tbl>')) {
      for (const tr of block.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)) {
        const cells = [...tr[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((tc) => [...tc[0].matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((p) => paraText(p[0])).filter(Boolean).join(' '));
        if (cells.some(Boolean)) lines.push(cells.join(' | '));
      }
      continue;
    }
    const text = paraText(block);
    if (!text) continue;
    const style = block.match(/<w:pStyle\s+w:val="([^"]+)"/)?.[1] ?? '';
    const numId = block.match(/<w:numPr>[\s\S]*?<w:numId\s+w:val="(\d+)"/)?.[1];
    if (/^(?:Title|Heading\s?\d)/i.test(style)) lines.push(`# ${text}`);
    else if (numId && numId !== '0') {
      if ((formats.get(numId) ?? 'bullet') === 'bullet') lines.push(`- ${text}`);
      else { const n = (counters.get(numId) ?? 0) + 1; counters.set(numId, n); lines.push(`${n}. ${text}`); }
    } else lines.push(text);
  }
  const out = lines.join('\n').trim();
  if (!out) throw new DocError('That document has no readable text.');
  return out;
}

// ---------- entry point ----------

export const DOC_EXT = /\.(?:txt|md|markdown|csv|log|html?|docx)$/i;
export const isDocFile = (f: { name: string }) => DOC_EXT.test(f.name);

export async function extractText(file: { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }): Promise<string> {
  if (file.size > MAX_DOC_BYTES) throw new DocError('That file is over 15 MB. Use a smaller document.');
  const name = file.name.toLowerCase();
  if (/\.pdf$/.test(name)) throw new DocError('PDFs are not read directly yet. Open the PDF on your phone, select and copy the text, then paste it in the box below. Or export it as a Word or text file.');
  if (/\.(?:png|jpe?g|webp|heic|gif)$/.test(name)) throw new DocError('Pictures are not read directly yet. Use your phone’s “copy text from image” feature, then paste the text in the box below.');
  if (!DOC_EXT.test(name)) throw new DocError('That file type is not supported. Use .docx, .txt, .md, .html or .csv, or paste the text.');
  const buf = new Uint8Array(await file.arrayBuffer());
  if (name.endsWith('.docx')) return docxToText(buf);
  const raw = new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '').replace(/\r/g, '');
  if (/\.html?$/.test(name)) {
    const page = extractReadable(raw, 'https://document.invalid/');
    return page.blocks.map((b) => (b.kind === 'h' ? `# ${b.text}` : b.kind === 'li' ? `- ${b.text}` : b.kind === 'code' ? '```\n' + b.text + '\n```' : b.text)).join('\n');
  }
  return raw.trim();
}

// ---------- text -> guide ----------

const CAUTION_LEAD = /^(?:note|warning|caution|important|danger|do not|don't|never)\b[:\s-]*/i;
const NUM = /^\s*(\d{1,2})[.)]\s+(\S.*)$/;
const BUL = /^\s*[-*•▪‣]\s+(\S.*)$/;
const isHeading = (l: string, next?: string) => /^#{1,4}\s+\S/.test(l) || (/^[A-Z][A-Z0-9 ,&/'’-]{3,60}$/.test(l.trim()) && !!next) || (l.trim().length <= 60 && /:$/.test(l.trim()) && !!next && (NUM.test(next) || BUL.test(next)));
const headingText = (l: string) => l.replace(/^#{1,4}\s+/, '').replace(/:$/, '').trim();

export function docToGuide(text: string, ctx: AgentContext, titleOverride?: string): Guide {
  const lines = text.replace(/\r/g, '').split('\n');
  const sections: GuideSection[] = [];
  const cautions: string[] = [];
  const codeAll: string[] = [];
  let cur: GuideSection | null = null;
  let title = '';
  let summary = '';
  let inCode = false; let code: string[] = [];
  const open = (t: string) => { cur = { title: t, items: [] }; sections.push(cur); };
  let orderedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]; const line = raw.trim();
    if (line.startsWith('```')) { if (inCode) { const c = code.join('\n').trim(); if (c) { codeAll.push(c); (cur ??= (open('Steps'), cur!)).code = [...(cur!.code ?? []), c]; } code = []; } inCode = !inCode; continue; }
    if (inCode) { code.push(raw); continue; }
    if (!line) continue;
    if (isHeading(line, lines.slice(i + 1).find((l) => l.trim()))) {
      const h = headingText(line);
      if (!title && /^#{1,2}\s/.test(line)) { title = h; continue; }
      open(h); continue;
    }
    const n = line.match(NUM); const b = line.match(BUL);
    const itemText = n ? n[2] : b ? b[1] : '';
    if (itemText) {
      if (CAUTION_LEAD.test(itemText) && !n) { cautions.push(itemText.replace(CAUTION_LEAD, '').trim() || itemText); continue; }
      if (!cur) open('Steps');
      if (n) { orderedCount++; cur!.ordered = true; }
      cur!.items.push(itemText);
      continue;
    }
    if (CAUTION_LEAD.test(line)) { cautions.push(line.replace(CAUTION_LEAD, '').trim() || line); continue; }
    if (/^(?:PS [A-Z]:\\[^>]*>|[A-Z]:\\[^>]*>|\$ |> )/.test(line)) { const c = line.replace(/^(?:PS [A-Z]:\\[^>]*>|[A-Z]:\\[^>]*>|\$ |> )\s*/, ''); codeAll.push(c); (cur ??= (open('Steps'), cur!)).code = [...(cur!.code ?? []), c]; continue; }
    if (!title && lines.slice(0, i).every((l) => !l.trim()) && line.length <= 90) { title = line; continue; }
    if (!summary && line.length >= 20 && !/\[removed|^\w[\w ]{0,20}:\s*\[/.test(line)) { summary = line.length > 260 ? line.slice(0, 257).replace(/\s+\S*$/, '') + '…' : line; continue; }
    if (!cur) open('Notes');
    cur!.items.push(line);
  }

  if (orderedCount < 2) {
    // Prose rather than a procedure: organise it as a spoken-style walkthrough.
    const g = walkthroughToGuide(buildWalkthrough(text), ctx, titleOverride || title || undefined);
    return { ...g, tags: ['imported', 'document', ...g.tags.filter((t) => t !== 'voice-note' && t !== 'generated')].slice(0, 6), sources: [{ label: 'Imported document', route: '/import' }] };
  }

  const clean = sections.filter((s) => s.items.length || s.code?.length);
  const stepText = clean.flatMap((s) => (s.ordered ? s.items : []));
  const stepsSection = clean.find((s) => s.ordered);
  for (const c of extractCommands(stepText.join('\n'))) if (!codeAll.includes(c) && stepsSection) { codeAll.push(c); stepsSection.code = [...(stepsSection.code ?? []), c]; }
  if (cautions.length) clean.push({ title: 'Watch out for', items: [...new Set(cautions)] });
  const a = analyseTopic(text.slice(0, 2000), ctx);
  return {
    title: (titleOverride || title || 'Imported guide').slice(0, 120),
    kind: 'howto',
    summary: summary || 'Made from an imported document. Check it against the original before relying on it.',
    sections: clean,
    sources: [{ label: 'Imported document', route: '/import' }],
    tags: ['imported', 'document', a.category.toLowerCase().replace(/\s+/g, '-')].slice(0, 6),
    kbCategory: kbCategoryFor('howto', a.category),
  };
}
