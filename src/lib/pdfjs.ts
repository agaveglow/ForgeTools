/**
 * Loads the bundled PDF.js (public/vendor/pdfjs) on first use. It is served from this app, never from
 * the internet, and only draws pages: the document is opened with scripting and eval switched off.
 */
export interface PdfPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: unknown; viewport: unknown }): { promise: Promise<void>; cancel(): void };
  getTextContent(): Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>;
  cleanup(): void;
}
export interface PdfDoc { numPages: number; getPage(n: number): Promise<PdfPage>; destroy(): Promise<void> }

let loading: Promise<any> | null = null;

export function loadPdfJs(): Promise<any> {
  const w = window as any;
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './vendor/pdfjs/pdf.min.js';
    s.onload = () => {
      const lib = w.pdfjsLib;
      if (!lib) { loading = null; reject(new Error('The PDF reader did not start.')); return; }
      lib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.js';
      resolve(lib);
    };
    s.onerror = () => { loading = null; reject(new Error('The PDF reader could not be loaded.')); };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Opens a PDF from a Blob without reading it all into memory: PDF.js asks for byte ranges and each one
 * is sliced from the Blob. This keeps a 200 MB service manual usable on a phone.
 */
export async function openPdf(blob: Blob): Promise<PdfDoc> {
  const lib = await loadPdfJs();
  const first = new Uint8Array(await blob.slice(0, Math.min(blob.size, 65536)).arrayBuffer());
  const transport = new lib.PDFDataRangeTransport(blob.size, first);
  transport.requestDataRange = (begin: number, end: number) => {
    blob.slice(begin, end).arrayBuffer().then((buf) => transport.onDataRange(begin, new Uint8Array(buf)));
  };
  const task = lib.getDocument({
    range: transport,
    length: blob.size,
    isEvalSupported: false,
    enableScripting: false,
    disableAutoFetch: true,
    disableStream: true,
    standardFontDataUrl: './vendor/pdfjs/standard_fonts/',
  });
  return task.promise as Promise<PdfDoc>;
}

export async function pageText(page: PdfPage): Promise<string> {
  const c = await page.getTextContent();
  return c.items.map((i) => (i.str ?? '') + (i.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim();
}
