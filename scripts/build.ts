/**
 * Offline build (Bun + Tailwind v4 compiler API).
 *
 * This exists because the original build sandbox could not reach the npm
 * registry, so Vite and @tailwindcss/vite could not be installed. The source
 * tree is a standard Vite layout; on a normal machine use `npm run dev` /
 * `npm run build` instead. Both paths consume the same src/ directory.
 *
 *   bun scripts/build.ts          -> dist/
 */
import { compile } from 'tailwindcss';
import { dirname, join, resolve } from 'node:path';
import { cp, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';

const root = resolve(import.meta.dir, '..');
const dist = join(root, 'dist');
const assets = join(dist, 'assets');

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (/\.(tsx?|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

async function buildCss(): Promise<string> {
  const entry = join(root, 'src/index.css');
  const css = await readFile(entry, 'utf8');
  const compiler = await compile(css, {
    base: dirname(entry),
    async loadStylesheet(id: string, base: string) {
      let p: string;
      if (id === 'tailwindcss') p = join(root, 'node_modules/tailwindcss/index.css');
      else if (id.startsWith('tailwindcss/')) {
        p = join(root, 'node_modules', id.endsWith('.css') ? id : `${id}.css`);
      } else p = resolve(base, id);
      return { path: p, base: dirname(p), content: await readFile(p, 'utf8') };
    },
  });

  // Simple candidate scan: every class-like token in source. Over-collecting is
  // harmless — Tailwind discards tokens that are not valid utilities.
  const files = [...(await walk(join(root, 'src'))), join(root, 'index.html')];
  const candidates = new Set<string>();
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    for (const m of text.matchAll(/[A-Za-z0-9_\-:/\[\]\.%#!@()=,&*>+~]+/g)) candidates.add(m[0]);
  }
  return compiler.build([...candidates]);
}

export async function build() {
  const t0 = performance.now();
  await rm(dist, { recursive: true, force: true });
  await mkdir(assets, { recursive: true });

  // 1. JS bundle
  const js = await Bun.build({
    entrypoints: [join(root, 'src/main.tsx')],
    outdir: assets,
    naming: 'app.js',
    target: 'browser',
    format: 'esm',
    minify: true,
    sourcemap: 'linked',
    define: { 'process.env.NODE_ENV': '"production"' },
    // CSS is compiled separately by Tailwind below, so stub the import here.
    plugins: [
      {
        name: 'css-stub',
        setup(b) {
          b.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
        },
      },
    ],
  });
  if (!js.success) {
    for (const l of js.logs) console.error(l);
    throw new Error('JS bundle failed');
  }

  // 2. CSS
  const rawCss = await buildCss();
  const rawPath = join(assets, 'app.raw.css');
  await writeFile(rawPath, rawCss);
  const cssOut = await Bun.build({ entrypoints: [rawPath], outdir: assets, naming: 'app.css', minify: true });
  if (!cssOut.success) {
    console.warn('CSS minify failed, shipping unminified CSS');
    await writeFile(join(assets, 'app.css'), rawCss);
  }
  await rm(rawPath, { force: true });

  // 3. Static files + HTML
  await cp(join(root, 'public'), dist, { recursive: true });
  let html = await readFile(join(root, 'index.html'), 'utf8');
  html = html
    .replace('</head>', '    <link rel="stylesheet" href="./assets/app.css" />\n  </head>')
    .replace('<script type="module" src="/src/main.tsx"></script>', '<script type="module" src="./assets/app.js"></script>');
  await writeFile(join(dist, 'index.html'), html);

  console.log(`built dist/ in ${Math.round(performance.now() - t0)}ms`);
}

if (import.meta.main) await build();
