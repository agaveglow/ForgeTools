import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch();
const out = process.argv[2] || '/tmp/shots';
fs.mkdirSync(out, { recursive: true });
for (const [name, vp] of [['desktop', { width: 1280, height: 850 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  for (const r of (process.argv[3] || '/').split(',')) {
    await p.goto('http://localhost:4173/#' + r);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/${name}-${r.replace(/\W+/g, '_') || 'home'}.png` });
  }
  console.log(name, 'errors:', JSON.stringify(errs));
  await ctx.close();
}
await b.close();
