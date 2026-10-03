/**
 * Static server for the offline build. Usage: bun scripts/serve.ts [--watch] [--port 4173]
 * With --watch it rebuilds dist/ whenever something under src/ changes (reload the page manually).
 */
import { watch } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from './build';

const root = resolve(import.meta.dir, '..');
const dist = join(root, 'dist');
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx >= 0 ? Number(args[portIdx + 1]) : 4173;

await build();

if (args.includes('--watch')) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(join(root, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((e) => console.error(e)), 150);
  });
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = Bun.file(join(dist, path));
    if (!path.includes('..') && (await file.exists())) return new Response(file);
    return new Response(Bun.file(join(dist, 'index.html')));
  },
});
console.log(`ForgeTools on http://localhost:${server.port}`);
