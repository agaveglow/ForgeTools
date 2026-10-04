import { describe, expect, test } from 'bun:test';
import { deflateRawSync } from 'node:zlib';
import { docToGuide, docxToText, extractText, DocError, unzipEntry } from '../../src/lib/docs';
import { scrubText } from '../../src/lib/scrub';
import { modelFromGuide } from '../../src/lib/visual';

const ctx = { logs: [], kb: [] };

function zip(files: Record<string, string>, store = false): Uint8Array {
  const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let off = 0;
  const w16 = (n: number) => [n & 255, (n >> 8) & 255]; const w32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const [name, text] of Object.entries(files)) {
    const data = new TextEncoder().encode(text); const comp = store ? data : deflateRawSync(data); const nm = new TextEncoder().encode(name);
    const method = store ? 0 : 8;
    const local = Uint8Array.from([0x50, 0x4b, 3, 4, ...w16(20), ...w16(0), ...w16(method), ...w16(0), ...w16(0), ...w32(0), ...w32(comp.length), ...w32(data.length), ...w16(nm.length), ...w16(0), ...nm, ...comp]);
    central.push(Uint8Array.from([0x50, 0x4b, 1, 2, ...w16(20), ...w16(20), ...w16(0), ...w16(method), ...w16(0), ...w16(0), ...w32(0), ...w32(comp.length), ...w32(data.length), ...w16(nm.length), ...w16(0), ...w16(0), ...w16(0), ...w16(0), ...w32(0), ...w32(off), ...nm]));
    parts.push(local); off += local.length;
  }
  const cd = central.reduce((n, c) => n + c.length, 0);
  const eocd = Uint8Array.from([0x50, 0x4b, 5, 6, ...w16(0), ...w16(0), ...w16(central.length), ...w16(central.length), ...w32(cd), ...w32(off), ...w16(0)]);
  const all = [...parts, ...central, eocd]; const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0)); let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}
const para = (t: string, extra = '') => `<w:p><w:pPr>${extra}</w:pPr><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const numbered = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
const bullet = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>';
const numbering = '<w:numbering><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>';

describe('zip and docx', () => {
  test('reads stored and deflated entries', async () => {
    expect(new TextDecoder().decode((await unzipEntry(zip({ 'a.txt': 'hello' }), 'a.txt'))!)).toBe('hello');
    expect(new TextDecoder().decode((await unzipEntry(zip({ 'a.txt': 'hello', 'b.txt': 'world' }, true), 'b.txt'))!)).toBe('world');
    expect(await unzipEntry(zip({ 'a.txt': 'x' }), 'missing')).toBeNull();
    await expect(unzipEntry(new Uint8Array(40), 'a')).rejects.toBeInstanceOf(DocError);
  });
  test('docx: headings, numbered steps, bullets, tables, entities', async () => {
    const body = para('Reset the print spooler', '<w:pStyle w:val="Heading1"/>') + para('Use this when the queue is stuck.') + para('Open an admin command prompt.', numbered) + para('Run net stop spooler &amp; wait.', numbered) + para('Warning: do not delete the folder.', bullet) + `<w:tbl><w:tr><w:tc>${para('Model')}</w:tc><w:tc>${para('IM C3000')}</w:tc></w:tr></w:tbl>`;
    const file = zip({ 'word/document.xml': `<w:document><w:body>${body}</w:body></w:document>`, 'word/numbering.xml': numbering });
    const t = await docxToText(file);
    expect(t).toContain('# Reset the print spooler');
    expect(t).toContain('1. Open an admin command prompt.');
    expect(t).toContain('2. Run net stop spooler & wait.');
    expect(t).toContain('- Warning: do not delete the folder.');
    expect(t).toContain('Model | IM C3000');
  });
  test('extractText rejects images with a helpful message', async () => {
    const f = (name: string) => ({ name, size: 10, arrayBuffer: async () => new ArrayBuffer(10) });
    await expect(extractText(f('a.png'))).rejects.toThrow(/paste/);
    await expect(extractText(f('a.exe'))).rejects.toBeInstanceOf(DocError);
  });
});

describe('document to guide', () => {
  const doc = `# Reset the print spooler
Use this when the print queue is stuck and nothing prints.

Steps:
1. Open an admin command prompt.
2. Run net stop spooler.
3. Delete the files in the spool folder.
4. Run net start spooler.

Warning: do not delete the PRINTERS folder itself.`;
  test('procedure becomes ordered steps with commands and cautions', () => {
    const g = docToGuide(doc, ctx);
    expect(g.title).toBe('Reset the print spooler');
    const steps = g.sections.find((s) => s.ordered)!;
    expect(steps.items).toHaveLength(4);
    expect(g.sections.some((s) => /watch out/i.test(s.title) && s.items.join(' ').includes('PRINTERS'))).toBe(true);
    const m = modelFromGuide(g);
    expect(m.steps).toHaveLength(4);
    expect(m.steps.find((s) => /net stop spooler/.test(s.text))?.commands.join(' ')).toContain('net stop spooler');
    expect(g.tags).toContain('imported');
  });
  test('prose falls back to a walkthrough and invents nothing', () => {
    const g = docToGuide('First open the router page. Then restart the router. Finally check the lights are green.', ctx);
    expect(g.tags).toContain('imported');
    expect(JSON.stringify(g).toLowerCase()).not.toContain('reboot the switch');
  });
  test('scrub then guide: private details never reach the guide', () => {
    const raw = `# Fix scanner for Acme Dental Ltd
Customer: Brightwater Solicitors
1. Log in to 192.168.4.20 as admin.
2. Email scans go to jo.bloggs@acmedental.co.uk
3. Serial W8Z1234567 needs a firmware update.`;
    const g = docToGuide(scrubText(raw).text, ctx);
    const all = JSON.stringify(g);
    expect(all).not.toMatch(/Acme|Brightwater|192\.168|bloggs|W8Z1234567/);
  });
});
