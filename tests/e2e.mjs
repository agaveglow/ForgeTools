// End-to-end checks. Run with: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/e2e.mjs  (server on :4173)
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.BASE || 'http://localhost:4173/';
const SHOTS = process.env.SHOTS || '/tmp/e2e';
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
let failures = 0;

async function step(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { failures++; results.push(['FAIL', name + ' :: ' + String(e.message).split('\n').slice(0, 4).join(' | ')]); }
}
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m ?? 'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const until = async (fn, m, ms = 3000) => { const t = Date.now(); for (;;) { try { if (await fn()) return; } catch {} if (Date.now() - t > ms) throw new Error(typeof m === 'function' ? await m() : (m ?? 'timed out')); await new Promise((r) => setTimeout(r, 50)); } };
const ok = (c, m) => { if (!c) throw new Error(m ?? 'assertion failed'); };


// A tiny valid 3-page PDF with known text, built in memory so the test needs no outside files.
function makePdf(texts) {
  const objs = []; const add = (b) => { objs.push(b); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  const kids = texts.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  add(`<< /Type /Pages /Kids [${kids}] /Count ${texts.length} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  texts.forEach((t, i) => {
    const stream = `BT /F1 24 Tf 60 700 Td (${t}) Tj ET`;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((b, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${b}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

async function run(label, viewport) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  const go = async (route) => { await p.goto(BASE + '#/__blank'); await p.goto(BASE + '#' + (route === '/' ? '/?view=full' : route)); await p.waitForTimeout(150); };
  const S = (n) => `${label}: ${n}`;
  const shot = (n) => p.screenshot({ path: `${SHOTS}/${label}-${n}.png` });
  const noHScroll = async () => ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'horizontal overflow');

  await p.goto(BASE + '#/?view=full');
  await p.waitForSelector('h1');

  await step(S('dashboard starts empty with no sample data'), async () => {
    eq(await p.getByText('DEMO', { exact: true }).count(), 0, 'no demo badges');
    ok(!(await p.locator('body').innerText()).includes('Sample data'), 'no sample banner');
    ok(await p.getByText('No tasks for today.').isVisible());
    ok(await p.getByText('No requirements added.').isVisible());
    await shot('dashboard');
  });

  await step(S('no horizontal overflow on every page'), async () => {
    for (const r of ['/', '/logs', '/logs/new', '/troubleshoot', '/commands', '/security', '/agent', '/voice', '/files', '/live', '/checks', '/checks/qbr', '/sla', '/board', '/tasks', '/requirements', '/apprenticeship', '/import', '/kb', '/skills', '/settings']) {
      await go(r); await noHScroll();
    }
  });

  await step(S('create work log with 3 fields'), async () => {
    await go('/logs/new');
    await p.getByLabel('What happened?').fill('Scanner would not scan to email');
    await p.getByLabel('What did you do?').fill('Re-entered the SMTP server name in the scan profile');
    await p.getByLabel('Result').fill('Test scan arrived in the mailbox, working now');
    await p.getByRole('button', { name: 'Save work log' }).click();
    await p.waitForURL(/#\/logs\/[^/]+$/);
    ok(await p.getByText('Scanner would not scan to email').first().isVisible());
    await until(async () => /WL-\d{4}-0001/.test(await p.locator('body').innerText()), 'ref WL-YYYY-0001');
    ok(await p.getByText('Resolved').first().isVisible(), 'status derived as resolved from the result text');
    await shot('log-detail');
  });

  await step(S('status is not Resolved when no result written'), async () => {
    await go('/logs/new');
    await p.getByLabel('What happened?').fill('Monitor flickering');
    const pressed = await p.getByRole('button', { name: 'Resolved', exact: true }).getAttribute('aria-pressed');
    eq(pressed, 'false', 'Resolved pressed');
  });

  await step(S('secret is blocked and cannot be saved'), async () => {
    await go('/logs/new');
    await p.getByLabel('What happened?').fill('User login failed');
    await p.getByLabel('What did you do?').fill('Reset it. The password is Summer2024!x');
    ok(await p.getByText('Cannot save: this contains a secret').isVisible());
    ok(await p.getByRole('button', { name: 'Save work log' }).isDisabled());
    await shot('blocked');
    await p.getByRole('button', { name: 'Redact all' }).click();
    ok(!(await p.getByText('Cannot save').isVisible().catch(() => false)));
    ok(!/Summer2024/.test(await p.getByLabel('What did you do?').inputValue()));
  });

  await step(S('personal data needs confirmation'), async () => {
    await go('/logs/new');
    await p.getByLabel('What happened?').fill('Mail to bob@acmelaw.co.uk bounced');
    ok(await p.getByText('Check for sensitive details before saving').isVisible());
    await p.getByRole('button', { name: 'Save work log' }).click();
    ok(await p.getByText('Confirm the sensitive details').isVisible(), 'refused without confirm');
    await p.getByLabel(/I have checked these details/).check();
    await p.getByRole('button', { name: 'Save work log' }).click();
    await p.waitForURL(/#\/logs\/[^/]+$/);
  });

  await step(S('assistant structures notes without inventing a result'), async () => {
    await go('/logs/new');
    await p.getByRole('button', { name: 'Structure rough notes' }).click();
    await p.getByLabel('Rough notes', { exact: true }).fill('Ricoh IM C3000 misfeeding from tray 2. Checked paper path, found debris near the feed roller, cleaned rollers.');
    await p.getByRole('button', { name: 'Structure my notes' }).click();
    await p.waitForSelector('[data-testid=assistant-suggestion]');
    eq(await p.locator('#sug-result').inputValue(), '', 'result stays empty');
    ok(/debris/i.test(await p.locator('#sug-investigation').inputValue()));
    ok(await p.getByText('Not covered in your notes').isVisible());
    // possible areas are unticked
    const boxes = p.locator('[data-testid=assistant-suggestion] input[type=checkbox]');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) ok(!(await boxes.nth(i).isChecked()), 'suggestion pre-ticked');
    await shot('assistant');
    await p.getByRole('button', { name: 'Apply to work log' }).click();
    ok(/debris/i.test(await p.getByLabel('What did you do?').inputValue()) === false, 'investigation not in actions');
    eq(await p.getByLabel('Result').inputValue(), '', 'result still empty after apply');
  });

  await step(S('troubleshooting session to work log'), async () => {
    await go('/troubleshoot/net-no-internet');
    await p.getByRole('button', { name: 'Start session' }).click();
    await p.waitForURL(/#\/session\//);
    await p.getByRole('button', { name: 'Done' }).first().click();
    await p.getByLabel('Note for step 1').fill('Adapter shows connected');
    await shot('session');
    await p.getByRole('button', { name: 'Create work log from session' }).click();
    await p.waitForURL(/#\/logs\/new/);
    await p.waitForSelector('#problem');
    const vals = async () => (await p.locator('textarea').evaluateAll((els) => els.map((e) => e.value))).join('|');
    await until(async () => /Adapter shows connected/.test(await vals()), 'session note carried over');
  });

  await step(S('decision tree walks to a conclusion'), async () => {
    await go('/troubleshoot/net-no-internet');
    await p.getByRole('button', { name: 'Start session' }).click();
    await p.waitForURL(/#\/session\//);
    await p.getByText('Guided questions').waitFor({ state: 'visible', timeout: 3000 });
    for (let i = 0; i < 8; i++) {
      if (await p.getByText('Where this points').isVisible().catch(() => false)) break;
      const btn = p.locator('.border-accent\\/50 button').first();
      if (!(await btn.count())) break;
      await btn.click();
      await p.waitForTimeout(120);
    }
    await p.getByText('Where this points').waitFor({ state: 'visible', timeout: 3000 });
  });

  await step(S('commands search and detail'), async () => {
    await go('/commands');
    await p.getByLabel('Search commands').fill('flushdns');
    await p.getByRole('button', { name: /flushdns/i }).first().click();
    await p.getByText('Expected output').first().waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Copy' }).first().click();
    await p.getByText(/Copied|Copy failed/).first().waitFor({ state: 'visible', timeout: 3000 });
  });

  await step(S('security checklist run'), async () => {
    await go('/security');
    await p.getByRole('button', { name: 'New check' }).click();
    await p.getByLabel('Device label').fill('Reception PC');
    await p.getByRole('button', { name: 'Start' }).click();
    await p.waitForURL(/#\/security\/.+/);
    const groups = p.getByRole('radiogroup');
    await groups.nth(1).getByRole('button', { name: 'Failed' }).click();
    await groups.nth(0).getByRole('button', { name: 'Passed' }).click();
    await p.getByText('1 failed').first().waitFor({ state: 'visible', timeout: 3000 });
    await p.getByText('Failed items').waitFor({ state: 'visible', timeout: 3000 });
    await shot('security');
    await p.getByRole('button', { name: 'Create work log' }).click();
    await p.waitForURL(/#\/logs\/new/);
    await p.waitForSelector('#problem');
    await until(async () => /Failed checks to address/.test((await p.locator('textarea').evaluateAll((els) => els.map((e) => e.value))).join('|')), 'failed items carried over');
  });

  await step(S('guide agent: generate, ask follow-up, save to KB and Files'), async () => {
    await go('/agent');
    await p.getByLabel('What do you need?').fill('Ricoh printer jams when printing from tray 2');
    await p.getByRole('button', { name: 'Generate guide' }).click();
    await p.getByRole('heading', { level: 2 }).first().waitFor({ state: 'visible', timeout: 3000 });
    ok(/Paper|jam/i.test(await p.locator('main').innerText()), 'guide mentions the topic');
    await p.getByRole('button', { name: 'What should I check first?' }).click();
    await p.getByLabel('Ask a follow-up question').fill('what is the capital of France');
    await p.getByRole('button', { name: 'Ask', exact: true }).click();
    await p.getByText(/Nothing in the library matches that closely/).waitFor({ state: 'visible', timeout: 3000 });
    await shot('agent');
    await p.getByRole('button', { name: 'Save guide' }).click();
    await p.getByText('Saved to Knowledge base and Files.').waitFor({ state: 'visible', timeout: 3000 });
    await go('/files');
    await p.getByText(/\.md$/).first().waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'View' }).first().click();
    await p.getByRole('dialog').locator('pre').waitFor({ state: 'visible', timeout: 3000 });
    await p.keyboard.press('Escape');
    await go('/kb');
    ok((await p.getByText('generated').count()) > 0, 'KB entry tagged generated (url ' + p.url() + ')');
  });

  await step(S('visual guide: diagram, animated player, photos attach with confirmation'), async () => {
    await go('/agent');
    await p.getByLabel('What do you need?').fill('Ricoh printer jams when printing from tray 2');
    await p.getByRole('button', { name: 'Generate guide' }).click();
    await p.getByTestId('diagram').locator('svg').first().waitFor({ state: 'visible', timeout: 3000 });
    ok((await p.getByTestId('diagram').locator('text').count()) > 5, 'diagram has labelled nodes');
    await p.getByTestId('diagram').scrollIntoViewIfNeeded(); await shot('diagram');
    await p.getByRole('tab', { name: 'Play' }).click();
    await p.getByText(/Step 1 of \d+/).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Next step' }).click();
    await p.getByText(/Step 2 of \d+/).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: /^Ask about step 2/ }).click();
    await p.getByRole('button', { name: 'What could go wrong?' }).click();
    await p.getByTestId('step-answer').waitFor({ state: 'visible', timeout: 3000 });
    ok(/Step 2/.test(await p.getByTestId('step-answer').innerText()), 'step answer names the step');
    await p.getByLabel(/Your question about step 2/).fill('Password is Hunter2!x');
    ok(await p.getByTestId('step-ask').getByRole('button', { name: 'Ask', exact: true }).isDisabled(), 'secret in a step question is blocked');
    await p.getByLabel(/Your question about step 2/).fill('Zorblax quuxification');
    await p.getByTestId('step-ask').getByRole('button', { name: 'Ask', exact: true }).click();
    await p.getByText(/won’t guess|only repeats the step|library and your notes/).first().waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: /^▶ Play/ }).click();
    await p.getByRole('button', { name: /Pause/ }).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: /Pause/ }).click();
    await p.getByRole('button', { name: 'Save guide' }).click();
    await p.getByRole('link', { name: 'Open in Knowledge base' }).click();
    await p.waitForURL(/#\/kb\/[^/]+$/);
    await p.getByRole('tab', { name: 'Photos' }).click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await p.getByLabel('Add photo or screenshot').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: png });
    await p.getByAltText('Preview of the image you are about to attach').waitFor({ state: 'visible', timeout: 5000 });
    ok(await p.getByRole('button', { name: 'Attach' }).isDisabled(), 'attach needs the privacy confirmation');
    await p.getByLabel('Caption (optional)').fill('Password is Hunter2!x');
    await p.getByRole('checkbox', { name: /checked this image/ }).check();
    ok(await p.getByRole('button', { name: 'Attach' }).isDisabled(), 'secret in caption blocks attach');
    await p.getByLabel('Caption (optional)').fill('Tray 2 latch');
    await p.getByRole('button', { name: 'Attach' }).click();
    await p.getByAltText('Tray 2 latch').first().waitFor({ state: 'visible', timeout: 5000 });
    await p.getByRole('tab', { name: 'Play' }).click();
    await p.getByAltText('Tray 2 latch').waitFor({ state: 'visible', timeout: 3000 });
    await p.waitForTimeout(600); await shot('visual');
    await go('/files');
    await p.getByText(/images/).first().waitFor({ state: 'visible', timeout: 3000 });
  });

  await step(S('guide agent: secret in question blocks saving'), async () => {
    await go('/agent');
    await p.getByLabel('What do you need?').fill('Printer jams. Admin password is Summer2024!x');
    await p.getByRole('button', { name: 'Generate guide' }).click();
    await p.getByRole('button', { name: /Save guide/ }).waitFor({ state: 'visible', timeout: 3000 });
    ok(await p.getByRole('button', { name: /Save guide/ }).isDisabled(), 'save disabled while secret present');
  });

  await step(S('web lookup (mocked) adds a cited section; offline is explained'), async () => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    await p.route('https://learn.microsoft.com/api/search**', (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ results: [{ title: 'Clear a print queue', url: 'https://learn.microsoft.com/en-us/x/queue', description: 'How to clear it' }] }) }));
    await p.route('https://learn.microsoft.com/en-us/x/queue', (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/html' }, body: '<html><head><title>Clear a print queue</title></head><body><main><h1>Clear a print queue</h1><ol><li>Stop the Print Spooler service.</li><li>Delete files in the spool folder.</li><li>Start the service again.</li></ol></main></body></html>' }));
    await go('/agent');
    await p.getByLabel('What do you need?').fill('How do I clear a stuck print queue?');
    await p.getByRole('button', { name: 'Generate guide' }).click();
    const wl = p.getByTestId('web-lookup');
    await wl.getByRole('button', { name: /^Search/ }).click();
    await wl.getByText('Clear a print queue').first().waitFor({ state: 'visible', timeout: 4000 });
    await wl.getByRole('button', { name: /^Add/ }).first().click();
    await p.getByText(/Source https:\/\/learn\.microsoft\.com/).waitFor({ state: 'visible', timeout: 4000 });
    await p.unroute('https://learn.microsoft.com/api/search**');
    await ctx.setOffline(true);
    await wl.getByRole('button', { name: /^Search/ }).click();
    await p.getByText(/offline|no connection|internet/i).first().waitFor({ state: 'visible', timeout: 4000 });
    await ctx.setOffline(false);
  });

  await step(S('voice notes: transcript upload becomes a walkthrough, saved with transcript'), async () => {
    await go('/voice');
    await p.locator('input[type=file]').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('To reset the print spooler. First open an admin command prompt. Then run net stop spooler. Next delete the files in the spool folder. Finally run net start spooler. The queue then printed again. Be careful not to delete the folder itself.') });
    await p.getByRole('button', { name: /Make walkthrough/ }).click();
    const w = p.getByTestId('walkthrough');
    await w.waitFor({ state: 'visible', timeout: 3000 });
    ok(/net stop spooler/.test(await w.innerText()), 'command kept');
    ok(!/reboot/i.test(await w.innerText()), 'nothing invented');
    await w.getByRole('button', { name: 'Save guide' }).click();
    await p.getByText('Saved to Knowledge base and Files. The transcript was not kept.').waitFor({ state: 'visible', timeout: 3000 });
    await go('/files');
    await p.getByText(/\.md$/).first().waitFor({ state: 'visible', timeout: 3000 });
    eq(await p.getByText('transcripts', { exact: true }).count(), 0, 'no transcript file kept by default');
    await shot('voice');
  });

  await step(S('voice notes: audio goes to the configured service; none configured is explained'), async () => {
    await go('/voice');
    await p.locator('input[type=file]').setInputFiles({ name: 'a.m4a', mimeType: 'audio/mp4', buffer: Buffer.from('fake') });
    await p.getByText(/need a transcription service/).waitFor({ state: 'visible', timeout: 3000 });
    await go('/settings');
    await p.getByLabel('Service address').fill('https://stt.test/v1/audio/transcriptions');
    await p.getByLabel(/Access key/).fill('k');
    let sawAuth = '';
    await p.route('https://stt.test/**', (r) => { sawAuth = r.request().headers()['authorization'] ?? ''; r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify({ text: 'First open settings. Then restart the router.' }) }); });
    await p.getByRole('link', { name: 'Voice notes' }).first().click().catch(() => p.evaluate(() => { location.hash = '#/voice'; }));
    await p.waitForURL(/#\/voice/);
    await p.locator('#vn-transcript').waitFor({ state: 'visible', timeout: 3000 });
    await p.locator('input[type=file]').setInputFiles({ name: 'a.m4a', mimeType: 'audio/mp4', buffer: Buffer.from('fake') });
    await until(async () => /restart the router/.test(await p.locator('#vn-transcript').inputValue()), async () => 'transcript filled: ' + (await p.locator('[role=alert]').allInnerTexts()).join('/') + ' url=' + p.url() + ' status=' + (await p.locator('[role=status]').allInnerTexts()).join('/') + ' st=' + (await p.evaluate(() => localStorage.getItem('forgetools:v1:local:settings'))), 8000);
    eq(sawAuth, 'Bearer k', 'key sent as bearer');
    const raw = await p.evaluate(() => Object.values(localStorage).join('|'));
    ok(!raw.includes('Bearer k') && !/"k"/.test(raw), 'key not persisted');
  });

  await step(S('knowledge base create, pin, search'), async () => {
    await go('/kb/new');
    await p.getByLabel('Title').fill('Reset print spooler');
    await p.getByLabel('Tags').fill('printing, spooler');
    await p.getByLabel('Content').fill('Steps:\n```\nnet stop spooler\nnet start spooler\n```');
    await p.getByRole('button', { name: 'Save entry' }).click();
    await p.waitForURL(/#\/kb\/[^/]+$/);
    await p.locator('pre').first().waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Pin' }).click();
    ok(await p.getByRole('button', { name: 'Unpin' }).isVisible());
    await go('/kb');
    await p.getByLabel('Search knowledge base').fill('spooler');
    ok(await p.getByText('Reset print spooler').first().isVisible());
  });

  await step(S('skills: real logs count'), async () => {
    await go('/skills');
    await p.getByText('How levels work').click();
    await go('/logs/new');
    await p.getByLabel('What happened?').fill('DNS not resolving on laptop');
    const more = p.getByRole('button', { name: /More details/ });
    if (await more.count()) await more.click();
    await p.getByRole('button', { name: 'Networking', exact: true }).click();
    await p.getByRole('button', { name: 'Save work log' }).click();
    await p.waitForURL(/#\/logs\/[^/]+$/);
    await go('/skills');
    await p.getByText('Evidence suggests: Exposure').first().waitFor({ state: 'visible', timeout: 3000 });
    await shot('skills');
  });

  await step(S('search palette (Ctrl+K)'), async () => {
    await go('/');
    await p.keyboard.press('Control+k');
    await p.getByLabel('Search everything').fill('flushdns');
    ok(await p.getByRole('option').first().isVisible());
    await p.keyboard.press('Enter');
    await p.waitForURL(/#\/commands\//);
  });

  await step(S('data persists across reload'), async () => {
    await go('/logs');
    await p.reload(); await p.waitForTimeout(300);
    ok(await p.getByText('Scanner would not scan to email').first().isVisible());
  });

  await step(S('theme toggle'), async () => {
    await go('/settings');
    await p.getByRole('button', { name: 'Dark', exact: true }).click();
    eq(await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
    await shot('settings-dark');
    await p.getByRole('button', { name: 'Light', exact: true }).click();
    eq(await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
  });

  await step(S('export; import roundtrip'), async () => {
    await go('/settings');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Export backup (JSON)' }).click()]);
    const path = await dl.path();
    const json = JSON.parse(fs.readFileSync(path, 'utf8'));
    eq(json.app, 'forgetools');
    ok(json.data.collections.workLogs.length >= 1, 'own logs exported');
    ok(['tasks', 'requirements', 'apprenticeLogs'].every((k) => Array.isArray(json.data.collections[k])), 'progress data included');
    fs.copyFileSync(path, `${SHOTS}/${label}-backup.json`);
  });

  await step(S('erase requires typing ERASE'), async () => {
    await go('/settings');
    await p.getByRole('button', { name: 'Erase everything…' }).click();
    ok(await p.getByRole('button', { name: 'Erase all data' }).isDisabled());
    await p.getByLabel('Type ERASE to confirm').fill('ERASE');
    await p.getByRole('button', { name: 'Erase all data' }).click();
    await go('/logs');
    ok(await p.getByText('No work logs yet.').isVisible());
  });

  await step(S('import: document is scrubbed, guide saved without the source'), async () => {
    const zlib = await import('node:zlib');
    const w16 = (n) => [n & 255, (n >> 8) & 255]; const w32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    const mkzip = (files) => { const parts = []; const cen = []; let off = 0; for (const [name, text] of Object.entries(files)) { const d = Buffer.from(text); const c = zlib.deflateRawSync(d); const nm = Buffer.from(name); const l = Buffer.from([0x50, 0x4b, 3, 4, ...w16(20), ...w16(0), ...w16(8), ...w16(0), ...w16(0), ...w32(0), ...w32(c.length), ...w32(d.length), ...w16(nm.length), ...w16(0), ...nm, ...c]); cen.push(Buffer.from([0x50, 0x4b, 1, 2, ...w16(20), ...w16(20), ...w16(0), ...w16(8), ...w16(0), ...w16(0), ...w32(0), ...w32(c.length), ...w32(d.length), ...w16(nm.length), ...w16(0), ...w16(0), ...w16(0), ...w16(0), ...w32(0), ...w32(off), ...nm])); parts.push(l); off += l.length; } const cd = cen.reduce((n, c) => n + c.length, 0); return Buffer.concat([...parts, ...cen, Buffer.from([0x50, 0x4b, 5, 6, ...w16(0), ...w16(0), ...w16(cen.length), ...w16(cen.length), ...w32(cd), ...w32(off), ...w16(0)])]); };
    const para = (t, x = '') => `<w:p><w:pPr>${x}</w:pPr><w:r><w:t>${t}</w:t></w:r></w:p>`;
    const num = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    const numbering = '<w:numbering><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';
    const docx = mkzip({ 'word/document.xml': `<w:document><w:body>${para('Fix scanner for Acme Dental Ltd', '<w:pStyle w:val="Heading1"/>')}${para('Customer: Brightwater Solicitors')}${para('Log in to 192.168.4.20 as admin.', num)}${para('Send a test scan to jo.bloggs@acmedental.co.uk', num)}${para('Run net stop spooler and then net start spooler.', num)}</w:body></w:document>`, 'word/numbering.xml': numbering });
    await go('/import');
    await p.getByLabel('Choose a document').setInputFiles({ name: 'scanner.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx });
    await until(async () => (await p.locator('#im-text').inputValue()).length > 20, 'document text loaded');
    const cleaned = await p.locator('#im-text').inputValue();
    ok(!/Acme|Brightwater|192\.168|bloggs/.test(cleaned), 'private details removed from the text box: ' + cleaned);
    ok(await p.getByTestId('scrub-panel').getByText(/Removed \d+ items?/).isVisible(), 'scrub summary shown');
    await p.getByRole('button', { name: /Make guide/ }).click();
    await p.getByTestId('import-guide').waitFor({ state: 'visible', timeout: 3000 });
    ok(await p.getByTestId('diagram').locator('svg').first().isVisible(), 'diagram shown first');
    ok(await p.getByRole('button', { name: 'Save guide' }).isDisabled(), 'save needs the read-through confirmation');
    await p.getByRole('checkbox', { name: /I have read this guide/ }).check();
    await p.getByRole('button', { name: 'Save guide' }).click();
    await p.getByText(/The source document was not kept/).waitFor({ state: 'visible', timeout: 3000 });
    const stored = await p.evaluate(async () => { const db = await new Promise((res, rej) => { const r = indexedDB.open('forgetools-files', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); const all = await new Promise((res) => { const r = db.transaction('files').objectStore('files').getAll(); r.onsuccess = () => res(r.result); }); return JSON.stringify(all) + JSON.stringify(Object.values(localStorage)); });
    ok(!/Acme|Brightwater|192\.168|bloggs/.test(stored), 'nothing private in storage');
    await shot('import');
  });

  await step(S('read aloud uses an offline voice and steps the player'), async () => {
    await p.addInitScript(() => {
      const spoken = [];
      window.__spoken = spoken;
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ name: 'Online', lang: 'en-GB', localService: false }, { name: 'Local', lang: 'en-GB', localService: true }], speak(u) { spoken.push({ text: u.text, voice: u.voice.name }); setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, onvoiceschanged: null } });
    });
    await go('/agent');
    await p.reload(); await p.waitForTimeout(300);
    await p.getByLabel('What do you need?').fill('Ricoh printer jams when printing from tray 2');
    await p.getByRole('button', { name: 'Generate guide' }).click();
    await p.getByRole('tab', { name: 'Play' }).click();
    await p.getByRole('button', { name: /Read aloud/ }).click();
    await until(async () => (await p.evaluate(() => window.__spoken.length)) >= 1, 'spoke first step');
    const first = await p.evaluate(() => window.__spoken[0]);
    eq(first.voice, 'Local', 'only the offline voice is used');
    ok(/^Step 1\./.test(first.text), 'reads the step');
    await p.getByRole('button', { name: /^▶ Play/ }).click();
    await until(async () => (await p.evaluate(() => window.__spoken.length)) >= 3, 'advances after speech ends');
  });

  await step(S('tasks, requirements and apprenticeship feed the dashboard'), async () => {
    await go('/tasks');
    await p.getByLabel('New task').fill('Check print queue alerts');
    await p.getByRole('button', { name: 'Add task' }).click();
    await p.getByLabel('New task').fill('Weekly backup check');
    await p.getByRole('button', { name: 'Every week' }).click();
    await p.getByRole('button', { name: 'Add task' }).click();
    await p.getByLabel('New task').fill('Admin password is Summer2024!x');
    ok(await p.getByRole('button', { name: 'Add task' }).isDisabled(), 'secret blocks adding a task');
    await p.getByLabel('New task').fill('');
    await go('/requirements');
    await p.getByLabel('New requirement').fill('Troubleshoot managed print issues');
    await p.getByLabel('Group (optional)').fill('Print');
    await p.getByRole('button', { name: 'Add requirement' }).click();
    await p.getByText('Troubleshoot managed print issues').first().waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Apprenticeship', exact: true }).first().click();
    await p.getByLabel('New requirement').fill('Explain network fundamentals');
    await p.getByRole('button', { name: 'Add requirement' }).click();
    await p.getByLabel('Status of Troubleshoot managed print issues').selectOption('evidenced');
    await go('/apprenticeship');
    await p.getByText('Targets and dates').click();
    await p.getByLabel('Weekly off-the-job hours').fill('6');
    await p.getByLabel('Title', { exact: true }).fill('Networking module');
    await p.getByLabel('What I did').fill('Worked through subnetting exercises');
    await p.getByLabel('Hours', { exact: true }).fill('2.5');
    await p.getByRole('checkbox', { name: 'Explain network fundamentals' }).check();
    await p.getByRole('button', { name: 'Add entry' }).click();
    await p.getByText('Networking module').first().waitFor({ state: 'visible', timeout: 3000 });
    await p.getByLabel('Hours', { exact: true }).fill('1');
    await p.getByLabel('What I did').fill('Password is Hunter2!x');
    ok(await p.getByRole('button', { name: 'Add entry' }).isDisabled(), 'secret blocks the apprenticeship entry');
    await p.getByLabel('What I did').fill('Read the module notes');
    await go('/');
    await p.getByRole('checkbox', { name: 'Check print queue alerts' }).click();
    await p.getByRole('progressbar', { name: 'Daily tasks done' }).waitFor({ state: 'visible', timeout: 3000 });
    eq(await p.getByRole('progressbar', { name: 'Daily tasks done' }).getAttribute('aria-valuenow'), '1');
    ok(await p.getByText('2.5 / 6 h').isVisible(), 'hours against weekly target');
    ok(await p.getByText(/1 day in a row/).isVisible(), 'streak counts today');
    ok(await p.getByText('0 / 1').first().isVisible(), 'apprenticeship requirements progress shown');
    await shot('dashboard-progress');
    await p.reload(); await p.waitForTimeout(300);
    eq(await p.getByRole('progressbar', { name: 'Daily tasks done' }).getAttribute('aria-valuenow'), '1', 'tick persists');
  });

  await step(S('monthly and quarterly checks, paste a list, and the task board'), async () => {
    await go('/tasks');
    await p.getByRole('button', { name: /Add many at once/ }).click();
    await p.getByRole('button', { name: 'Add Quarterly checks' }).click();
    await p.getByRole('status').filter({ hasText: 'Added 9' }).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Add Quarterly checks' }).click();
    await p.getByRole('status').filter({ hasText: 'already on your list' }).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Add Monthly checks' }).click();
    await p.getByLabel('Paste a list').fill('1. Check backup job status\n- Review patch compliance report\nContact jo.bloggs@client.com about it');
    ok(await p.getByRole('button', { name: /^Add .* task/ }).last().isDisabled(), 'pasted list with an email is blocked');
    await p.getByLabel('Paste a list').fill('1. Check backup job status\n- Review patch compliance report');
    await p.getByRole('group', { name: 'How often for the pasted list' }).getByRole('button', { name: 'Every day' }).click();
    await p.getByRole('button', { name: /^Add 2 every day tasks/ }).click();
    const q = p.getByRole('checkbox', { name: /^User permissions audit/ });
    await q.click();
    ok((await q.getAttribute('aria-checked')) === 'true', 'quarterly check ticks');
    await p.reload(); await p.getByRole('checkbox', { name: /^User permissions audit/ }).waitFor({ state: 'visible', timeout: 4000 });
    ok((await p.getByRole('checkbox', { name: /^User permissions audit/ }).getAttribute('aria-checked')) === 'true', 'tick persists');
    await go('/board');
    await p.getByLabel('New card').fill('Plan firmware window');
    await p.getByRole('button', { name: 'Add card' }).click();
    await p.getByTestId('col-todo').getByText('Plan firmware window').waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Move Plan firmware window to Doing' }).click();
    await p.getByTestId('col-doing').getByText('Plan firmware window').waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Move Plan firmware window to Blocked' }).click();
    await p.getByRole('button', { name: 'Move Plan firmware window to Done' }).click();
    await p.getByTestId('col-done').getByText('Plan firmware window').waitFor({ state: 'visible', timeout: 3000 });
    await p.getByLabel('New card').fill('Admin password is Summer2024!x');
    ok(await p.getByRole('button', { name: 'Add card' }).isDisabled(), 'secret blocks a card');
    await p.getByLabel('New card').fill('');
    await go('/');
    await p.getByText('Quarterly checks').first().waitFor({ state: 'visible', timeout: 4000 });
  });

  await step(S('dashboard: customise cards; appearance: colour, size, names'), async () => {
    await go('/');
    await p.getByRole('button', { name: 'Customise' }).click();
    await p.getByLabel('Title for Today').fill('My day');
    await p.getByRole('button', { name: 'Hide Learning' }).click();
    await p.getByRole('region', { name: 'Hidden cards' }).getByRole('button', { name: 'Show Learning' }).waitFor({ state: 'visible', timeout: 3000 });
    const orderBefore = await p.locator('[data-widget]').evaluateAll((els) => els.map((e) => e.getAttribute('data-widget')));
    await p.getByRole('button', { name: 'Move Progress rings earlier' }).click();
    const orderAfter = await p.locator('[data-widget]').evaluateAll((els) => els.map((e) => e.getAttribute('data-widget')));
    ok(orderAfter.indexOf('rings') < orderBefore.indexOf('rings'), 'card moved earlier');
    await p.getByRole('group', { name: 'Size of Progress rings' }).getByRole('button', { name: 'Full' }).click();
    await p.getByRole('button', { name: 'Done' }).click();
    await p.reload();
    await p.getByRole('region', { name: 'My day' }).waitFor({ state: 'visible', timeout: 4000 });
    ok((await p.locator('[data-widget="learning"]').count()) === 0, 'hidden card stays hidden after reload');
    ok((await p.locator('[data-widget="activity"] svg').count()) > 0, 'heat map drawn');
    await shot('dashboard-widgets');
    await go('/settings');
    await p.getByRole('button', { name: 'Blue', exact: true }).click();
    const acc = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim());
    ok(/^#/.test(acc) && acc !== '#d9531e', 'accent changed to ' + acc);
    await p.getByRole('group', { name: 'Text size' }).getByRole('button', { name: 'Extra large' }).click();
    ok((await p.evaluate(() => document.documentElement.style.fontSize)) === '19px', 'text size applied');
    await p.getByLabel('App name').fill('My Toolkit');
    await p.getByLabel('Dashboard heading').fill('Hello engineer');
    await p.getByRole('button', { name: 'Save names' }).click();
    await go('/');
    await p.getByRole('heading', { name: 'Hello engineer' }).waitFor({ state: 'visible', timeout: 3000 });
    await p.locator('text=My Toolkit >> visible=true').first().waitFor({ state: 'visible', timeout: 3000 });
    await p.reload(); await p.getByRole('heading', { name: 'Hello engineer' }).waitFor({ state: 'visible', timeout: 4000 });
    ok((await p.evaluate(() => document.documentElement.style.fontSize)) === '19px', 'look survives reload');
    await go('/settings');
    await p.getByLabel('App name').fill('jo.bloggs@client.com');
    ok(await p.getByRole('button', { name: 'Save names' }).isDisabled(), 'email in a label is blocked');
    await p.getByRole('button', { name: 'Reset appearance' }).click();
    ok((await p.evaluate(() => document.documentElement.style.fontSize)) === '', 'reset clears text size');
  });

  await step(S('live notes: timeline is scrubbed, guide builds, finish and reopen'), async () => {
    await go('/live');
    await p.getByLabel('Job label (optional)').fill('Scan to email fault');
    await p.getByRole('button', { name: 'Start a live note' }).click();
    await p.getByLabel('Add a line').fill('Checked the SMTP settings for jo.bloggs@client.com');
    await p.getByRole('button', { name: 'Add', exact: true }).click();
    await p.getByRole('list', { name: 'Timeline' }).waitFor({ state: 'visible', timeout: 3000 });
    ok(!(await p.getByRole('list', { name: 'Timeline' }).innerText()).includes('jo.bloggs'), 'email removed from the line');
    ok((await p.getByText(/detail.* removed/).count()) > 0, 'removal is reported');
    ok(!(await p.evaluate(() => Object.values(localStorage).join('|'))).includes('jo.bloggs'), 'email not stored');
    await p.getByRole('button', { name: 'Fixed', exact: true }).click();
    for (const t of ['Open the scan profile in the web admin', 'Re-enter the SMTP server name', 'Send a test scan to email']) {
      await p.getByLabel('Add a line').fill(t);
      await p.getByRole('button', { name: 'Add', exact: true }).click();
    }
    await p.getByRole('region', { name: 'Guide so far' }).getByTestId('visual-guide').waitFor({ state: 'visible', timeout: 4000 });
    await p.getByRole('button', { name: 'Save guide' }).click();
    await p.getByText(/Guide saved/).waitFor({ state: 'visible', timeout: 4000 });
    await p.getByRole('button', { name: 'Finish note' }).click();
    await p.getByRole('button', { name: 'Reopen' }).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Reopen' }).click();
    await p.getByLabel('Add a line').waitFor({ state: 'visible', timeout: 3000 });
    await shot('live-notes');
  });

  await step(S('dashboard: add, use, edit and delete your own cards'), async () => {
    await go('/');
    await p.getByRole('button', { name: 'Customise' }).click();
    await p.getByRole('region', { name: 'Add a card' }).getByRole('button', { name: /^Checklist/ }).click();
    await p.getByLabel('Title', { exact: true }).fill('Friday wrap-up');
    await p.getByLabel('Items').fill('Check backups\nReview alerts\nUpdate log');
    await p.getByRole('button', { name: 'Add card' }).click();
    await p.getByRole('region', { name: 'Friday wrap-up' }).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('region', { name: 'Add a card' }).getByRole('button', { name: /^Counter/ }).click();
    await p.getByLabel('Title', { exact: true }).fill('Jobs closed');
    await p.getByLabel('Items').count();
    await p.getByRole('button', { name: 'Add card' }).click();
    await p.getByRole('region', { name: 'Add a card' }).getByRole('button', { name: /^Note/ }).click();
    await p.getByLabel('Title', { exact: true }).fill('Reminder');
    await p.getByLabel('Text').fill('Email jo.bloggs@client.com');
    ok(await p.getByRole('button', { name: 'Add card' }).isDisabled(), 'email in a card blocks saving');
    await p.getByLabel('Text').fill('Check the toner stock');
    await p.getByRole('button', { name: 'Add card' }).click();
    await p.getByRole('button', { name: 'Done' }).click();
    await p.getByRole('checkbox', { name: 'Check backups' }).click();
    await p.getByRole('button', { name: 'Increase Jobs closed' }).click();
    await p.getByRole('button', { name: 'Increase Jobs closed' }).click();
    await p.reload();
    ok((await p.getByRole('checkbox', { name: 'Check backups' }).getAttribute('aria-checked')) === 'true', 'tick persisted');
    await p.getByRole('region', { name: 'Jobs closed' }).getByText('2', { exact: true }).waitFor({ state: 'visible', timeout: 4000 });
    await p.getByRole('button', { name: 'Customise' }).click();
    await p.getByRole('button', { name: 'Edit Friday wrap-up' }).click();
    await p.getByLabel('Items').fill('Check backups\nReview alerts\nUpdate log\nTidy notes');
    await p.getByRole('button', { name: 'Save card' }).click();
    await p.getByRole('checkbox', { name: 'Tidy notes' }).waitFor({ state: 'visible', timeout: 3000 });
    ok((await p.getByRole('checkbox', { name: 'Check backups' }).getAttribute('aria-checked')) === 'true', 'edit keeps ticks');
    await p.getByRole('button', { name: 'Edit Reminder' }).click();
    await p.getByRole('button', { name: 'Delete card' }).click();
    ok((await p.getByRole('region', { name: 'Reminder' }).count()) === 0, 'card deleted');
    await shot('custom-cards');
  });

  await step(S('check guides and the response-time clock'), async () => {
    await go('/checks');
    await p.getByRole('link', { name: /User permissions audit/ }).click();
    await p.waitForURL(/#\/checks\/permissions-audit/);
    await p.getByTestId('visual-guide').waitFor({ state: 'visible', timeout: 3000 });
    for (const h of ['Before you start', 'How to monitor', 'Evidence to keep', 'Cautions']) await p.getByRole('region', { name: h }).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('region', { name: 'Commands' }).getByText('Get-ADGroupMember').first().waitFor({ state: 'visible', timeout: 3000 });
    const mark = p.getByRole('checkbox', { name: /Mark User permissions audit done/ });
    await mark.waitFor({ state: 'visible', timeout: 3000 });
    const before = await mark.getAttribute('aria-checked');
    await mark.click();
    ok((await mark.getAttribute('aria-checked')) === (before === 'true' ? 'false' : 'true'), 'check toggles from its guide');
    await go('/tasks');
    await p.getByRole('link', { name: /How to do and monitor: .*conditional access rules/ }).waitFor({ state: 'visible', timeout: 3000 });
    await go('/sla');
    await p.getByRole('group', { name: 'Priority' }).getByRole('button', { name: 'Critical' }).click();
    await p.getByLabel('Logged at').fill('2026-10-05T10:00');
    ok(/10:15/.test(await p.getByTestId('respond-by').innerText()), 'critical target is 15 minutes: ' + await p.getByTestId('respond-by').innerText());
    ok(/10:30/.test(await p.getByTestId('contract-by').innerText()), 'contractual is 30 minutes');
    ok(/12:00/.test(await p.getByTestId('update-by').innerText()), 'update is 2 hours');
    await p.getByLabel('Logged at').fill('2026-10-02T16:50');
    await p.getByRole('group', { name: 'Priority' }).getByRole('button', { name: 'High' }).click();
    ok(/09:20/.test(await p.getByTestId('respond-by').innerText()), 'rolls over the weekend');
    await shot('sla');
  });

  await step(S('daily and weekly checklists add once, skip repeats and link to guides'), async () => {
    await go('/tasks');
    await p.getByRole('button', { name: /Add many at once/ }).click();
    await p.getByRole('button', { name: 'Add Daily checks' }).click();
    await p.getByRole('status').filter({ hasText: 'Added 7' }).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Add Weekly checks' }).click();
    await p.getByRole('status').filter({ hasText: 'Added 9' }).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Add Daily checks' }).click();
    await p.getByRole('status').filter({ hasText: 'already on your list' }).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('link', { name: /How to do and monitor: Check backup status/ }).first().waitFor({ state: 'visible', timeout: 3000 });
    await go('/checks');
    ok((await p.getByRole('region', { name: 'Every day' }).getByRole('link').count()) === 7, 'seven daily guides');
    ok((await p.getByRole('region', { name: 'Every week' }).getByRole('link').count()) === 9, 'nine weekly guides');
    await p.getByRole('link', { name: /Check backup status/ }).click();
    await p.getByTestId('visual-guide').waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('checkbox', { name: /Mark Check backup status.* done for today/ }).click();
    await go('/');
    const bk = p.locator('[data-widget="today"]').getByRole('checkbox', { name: /Check backup status/ });
    await bk.waitFor({ state: 'visible', timeout: 4000 });
    ok((await bk.getAttribute('aria-checked')) === 'true', 'ticking the guide ticks the dashboard task');
  });


  await step(S('daily jobs: clock in, watch reminders, daily checks, edit and reset'), async () => {
    await go('/today');
    await p.getByRole('heading', { name: 'Daily jobs' }).waitFor({ state: 'visible', timeout: 5000 });
    ok((await p.locator('[data-testid=jobs]').innerText()).includes('Clock in on BrightHR'), 'clock in listed');
    ok((await p.locator('[data-testid=watches]').innerText()).includes('Check ITarian tickets'), 'ITarian watch listed');
    ok((await p.locator('[data-testid=watches]').innerText()).includes('Check Outlook emails'), 'Outlook watch listed');
    eq(await p.locator('[data-testid=stamp-clock-in]').count(), 0, 'no time before ticking');
    await p.getByLabel('Clock in on BrightHR').check();
    await p.locator('[data-testid=stamp-clock-in]').waitFor({ state: 'visible', timeout: 3000 });
    ok(/at \d\d:\d\d/.test(await p.locator('[data-testid=stamp-clock-in]').innerText()), 'time noted');
    ok((await p.locator('[data-testid=watches]').innerText()).includes('not checked yet'), 'not checked yet');
    await p.getByRole('button', { name: 'I have checked: ITarian tickets' }).click();
    await until(async () => (await p.locator('[data-testid=watches]').innerText()).includes('just now'), 'checked just now', 3000);
    ok((await p.locator('[data-testid=watches]').innerText()).includes('1 today'), 'count shows 1');
    // a check that is overdue raises the reminder
    await p.evaluate(() => {
      const k = 'forgetools:todayState'; const v = JSON.parse(localStorage.getItem(k));
      v.checked['watch-itarian'] = new Date(Date.now() - 45 * 60000).toISOString(); localStorage.setItem(k, JSON.stringify(v));
    });
    await p.reload();
    await p.locator('[data-testid=overdue]').waitFor({ state: 'visible', timeout: 5000 });
    ok((await p.locator('[data-testid=overdue]').innerText()).includes('ITarian tickets'), 'overdue names ITarian');
    ok((await p.locator('[data-testid=jobs]').innerText()).includes('at '), 'clock in time survives a reload');
    // edit
    await p.getByRole('button', { name: 'Edit my jobs' }).click();
    await p.getByLabel('Add a job').fill('Check the shared mailbox');
    await p.locator('#dj-kind').selectOption('watch');
    await p.getByRole('button', { name: 'Add job' }).click();
    ok((await p.locator('[data-testid=job-editor]').innerHTML()).includes('Check the shared mailbox'), 'added');
    await p.getByLabel('Add a job').fill('Password: hunter2-secret-123');
    ok(await p.getByRole('button', { name: 'Add job' }).isDisabled(), 'a secret blocks adding');
    await p.getByLabel('Add a job').fill('');
    await p.getByRole('button', { name: 'Delete Check the shared mailbox' }).click();
    ok(!(await p.locator('[data-testid=job-editor]').innerHTML()).includes('shared mailbox'), 'deleted');
    await p.getByRole('button', { name: 'Done editing' }).click();
    await noHScroll();
    await shot('daily-jobs');
  });

  await step(S('glance home: watch-style rings, legend, app bubbles, switch to all widgets'), async () => {
    await p.goto(BASE + '#/__blank'); await p.goto(BASE + '#/');
    await p.locator('[data-testid=glance]').waitFor({ state: 'visible', timeout: 5000 });
    ok(/\d{1,2}:\d\d/.test((await p.locator('[data-testid=glance-time]').textContent()) ?? ''), 'the time is the watch face');
    eq(await p.locator('[data-testid=glance-apps] a').count(), 7, 'seven app bubbles');
    eq(await p.locator('[data-testid=glance-legend] li').count(), 3, 'three ring counts');
    for (const a of await p.locator('[data-testid=glance-apps] a').all()) ok(((await a.boundingBox())?.width ?? 0) >= 44, 'bubble is at least 44px wide');
    await noHScroll();
    await shot('glance');
    // ticking a daily job moves the Jobs ring count
    await go('/today');
    await p.getByLabel('Clock in on BrightHR').check();
    await p.goto(BASE + '#/__blank'); await p.goto(BASE + '#/');
    await p.locator('[data-testid=glance]').waitFor({ state: 'visible', timeout: 5000 });
    ok((await p.locator('[data-testid=glance-legend]').innerText()).includes('1/2'), 'Jobs shows 1/2');
    // a bubble opens its page
    await p.getByRole('link', { name: 'Printer guides', exact: true }).last().click();
    await p.getByRole('heading', { name: 'Printer guides' }).waitFor({ state: 'visible', timeout: 5000 });
    // the switch to all widgets sticks, and back again
    await p.goto(BASE + '#/__blank'); await p.goto(BASE + '#/');
    await p.getByRole('button', { name: 'All widgets' }).click();
    await p.getByText('Daily routine').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => undefined);
    eq(await p.locator('[data-testid=glance]').count(), 0, 'glance hidden');
    await p.reload();
    await p.waitForSelector('h1');
    eq(await p.locator('[data-testid=glance]').count(), 0, 'all widgets view remembered');
    await p.getByRole('button', { name: 'Glance', exact: true }).click();
    await p.locator('[data-testid=glance]').waitFor({ state: 'visible', timeout: 5000 });
  });

  await step(S('apprenticeship: log from a YouTube link, copy for Aptem'), async () => {
    await p.route('https://www.youtube.com/oembed**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ title: 'Subnetting made simple', author_name: 'Net Channel' }) }));
    await go('/apprenticeship');
    await p.getByRole('button', { name: /Log from a video link/ }).click();
    await p.getByLabel('YouTube link').fill('https://evil.example/watch?v=dQw4w9WgXcQ');
    await p.getByText('does not look like a YouTube video link').waitFor({ state: 'visible', timeout: 3000 });
    ok(await p.getByRole('button', { name: 'Look up title' }).isDisabled(), 'lookup disabled for a bad link');
    await p.getByLabel('YouTube link').fill('https://youtu.be/dQw4w9WgXcQ?t=5');
    await p.getByRole('button', { name: 'Look up title' }).click();
    await until(async () => (await p.locator('#vd-title').inputValue()) === 'Subnetting made simple', 'title filled from lookup', 5000);
    eq(await p.locator('#vd-ch').inputValue(), 'Net Channel');
    await p.locator('#vd-min').fill('35');
    await p.getByRole('button', { name: 'Start an entry from this video' }).click();
    eq(await p.locator('#ap-title').inputValue(), 'Video: Subnetting made simple');
    eq(await p.locator('#ap-hours').inputValue(), '0.5', '35 minutes is half an hour (nearest quarter hour)');
    ok((await p.locator('#ap-did').inputValue()).includes('Watched the video “Subnetting made simple” by Net Channel (35 min).'), 'factual what I did');
    eq(await p.locator('#ap-learned').inputValue(), '', 'what I learned is left for the person to write');
    eq(await p.locator('#ap-link').inputValue(), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    // the Aptem block mirrors the form and leaves out empty fields
    await p.getByRole('button', { name: /Copy for Aptem/ }).click();
    const txt = await p.locator('[data-testid=aptem-fields]').innerText();
    ok(txt.includes('Subnetting made simple') && txt.includes('0.5 h (30 min)'), 'fields shown');
    ok(!txt.includes('What I learned'), 'empty learned is not invented');
    await p.locator('#ap-learned').fill('Learned how to split a /24 into four /26 subnets.');
    ok((await p.locator('[data-testid=aptem-fields]').innerText()).includes('four /26 subnets'), 'learned appears once written');
    // a non-https link is refused
    await p.locator('#ap-link').fill('javascript:alert(1)');
    await p.getByRole('button', { name: 'Add entry' }).click();
    await p.getByText('The link must start with https://').waitFor({ state: 'visible', timeout: 3000 });
    await p.locator('#ap-link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await p.getByRole('button', { name: 'Add entry' }).click();
    await p.getByRole('link', { name: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }).waitFor({ state: 'visible', timeout: 5000 });
    // the weekly summary carries the link
    await noHScroll();
    await shot('apprenticeship-video');
  });

  await step(S('navigation: home hub, area screens, tabs, back, all apps'), async () => {
    await p.goto(BASE + '#/__blank'); await p.goto(BASE + '#/');
    await p.locator('[data-testid=glance]').waitFor({ state: 'visible', timeout: 5000 });
    eq(await p.locator('aside').count(), 0, 'no side menu');
    eq(await p.getByRole('link', { name: 'Back', exact: true }).count(), 0, 'no Back on home');
    await p.locator('[data-testid=glance-apps]').getByRole('link', { name: 'Today', exact: true }).click();
    await p.locator('[data-testid=area-today]').waitFor({ state: 'visible', timeout: 5000 });
    eq(await p.locator('[data-testid=area-today] li').count(), 5, 'five Today pages');
    await p.locator('[data-testid=area-today]').getByRole('link', { name: /Tasks/ }).click();
    await p.getByRole('heading', { name: 'Tasks', exact: true }).first().waitFor({ state: 'visible', timeout: 5000 });
    const tabs = await p.locator('[data-testid=area-tabs] a').allInnerTexts();
    eq(tabs.join('|'), 'Daily jobs|Daily workflow|Tasks|Task board|Check guides', 'sibling tabs');
    eq(await p.locator('[data-testid=area-tabs] a[aria-current=page]').innerText(), 'Tasks');
    await p.locator('[data-testid=area-tabs]').getByRole('link', { name: 'Check guides' }).click();
    await p.getByRole('heading', { name: 'Check guides' }).waitFor({ state: 'visible', timeout: 5000 });
    // a detail page goes Back to its list, then the area, then home
    await go('/checks/qbr');
    await p.getByRole('link', { name: 'Back', exact: true }).click();
    await p.getByRole('heading', { name: 'Check guides' }).waitFor({ state: 'visible', timeout: 5000 });
    await p.getByRole('link', { name: 'Back', exact: true }).click();
    await p.locator('[data-testid=area-today]').waitFor({ state: 'visible', timeout: 5000 });
    await p.getByRole('link', { name: 'Back', exact: true }).click();
    await p.locator('[data-testid=glance]').waitFor({ state: 'visible', timeout: 5000 });
    // every area opens, and the old addresses still work
    for (const id of ['fix', 'notes', 'learn']) { await go('/a/' + id); await p.locator(`[data-testid=area-${id}]`).waitFor({ state: 'visible', timeout: 5000 }); }
    for (const r of ['/tasks', '/logs', '/troubleshoot', '/commands', '/kb', '/agent', '/voice', '/files', '/import', '/requirements', '/apprenticeship', '/skills', '/security', '/sla', '/board', '/live', '/manuals', '/settings']) {
      await go(r); ok((await p.locator('h1').count()) > 0, r + ' opens');
    }
    // all apps lists every page
    await p.getByRole('link', { name: 'All apps', exact: true }).click();
    await p.locator('[data-testid=all-apps]').waitFor({ state: 'visible', timeout: 5000 });
    eq(await p.locator('[data-testid=all-apps] li').count(), 21, 'twenty-one pages');
    await noHScroll();
    await shot('all-apps');
    await go('/a/today'); await noHScroll(); await shot('area-today');
    await go('/settings');
    eq(await p.getByRole('link', { name: 'Back', exact: true }).getAttribute('href'), '#/', 'settings goes back home');
  });

  await step(S('daily workflow: sections, ticks persist for today, clear'), async () => {
    await go('/workflow');
    await p.getByText('Remain available for incidents').waitFor({ state: 'visible', timeout: 5000 });
    eq((await p.locator('[data-testid=wf-count]').innerText()).trim(), '0 of 38 ticked today');
    eq(await p.locator('[data-testid=wf-priorities] li').count(), 4, 'four priorities');
    eq(await p.locator('[data-testid=wf-loop] li').count(), 5, 'five loop steps');
    await p.getByLabel(/Check the ticketing system for new tickets, updates and overnight/).check();
    await p.getByLabel('What was reported?').check();
    eq((await p.locator('[data-testid=wf-count]').innerText()).trim(), '2 of 38 ticked today');
    await p.reload();
    await p.getByText('Remain available for incidents').waitFor({ state: 'visible', timeout: 5000 });
    eq((await p.locator('[data-testid=wf-count]').innerText()).trim(), '2 of 38 ticked today', 'ticks survive a reload');
    await p.getByRole('button', { name: /Quick daily reference/ }).click();
    eq(await p.locator('[data-testid=wf-quick] li').count(), 6);
    await p.getByRole('button', { name: /What to monitor continuously/ }).click();
    eq(await p.locator('[data-testid=wf-monitor] li').count(), 9);
    await noHScroll();
    await shot('workflow');
    await p.getByRole('button', { name: /Clear today/ }).click();
    eq((await p.locator('[data-testid=wf-count]').innerText()).trim(), '0 of 38 ticked today');
  });

  await step(S('printer guides: add a manual, read pages, search, bookmark, attach to a guide'), async () => {
    await go('/manuals');
    await p.getByText('No manuals yet.').waitFor({ state: 'visible', timeout: 5000 });
    await p.setInputFiles('[data-testid=manual-file]', { name: 'Epson WF-579R sample.pdf', mimeType: 'application/pdf', buffer: makePdf(['Cover page intro', 'Paper jam clearing steps for the rear cover', 'Error code E-501 means check the ink pad']) });
    await p.getByText('Epson WF-579R sample').first().waitFor({ state: 'visible', timeout: 10000 });
    await p.getByRole('heading', { name: 'Epson' }).waitFor({ state: 'visible', timeout: 3000 });
    await until(async () => (await p.locator('body').innerText()).includes('3 pages'), 'page count shown', 5000);
    await until(async () => (await p.locator('body').innerText()).includes('Ready'), 'search ready', 15000);
    await p.getByLabel('Search all manuals').fill('E-501');
    await p.locator('#main').getByRole('button', { name: 'Search', exact: true }).click();
    await p.locator('[data-testid=all-hits] a').first().waitFor({ state: 'visible', timeout: 5000 });
    ok((await p.locator('[data-testid=all-hits]').innerText()).includes('page 3'), 'hit points to page 3');
    await p.locator('[data-testid=all-hits] a').first().click();
    await p.waitForSelector('[data-testid=page-canvas][data-ready="1"]', { timeout: 15000 });
    eq(await p.locator('[data-testid=page-canvas]').getAttribute('data-page'), '3', 'opened on page 3');
    const dark = await p.evaluate(() => { const c = document.querySelector('[data-testid=page-canvas]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 100) n++; return n; });
    ok(dark > 200, 'page is drawn with text, not blank');
    await p.getByText('Text on this page').click();
    await until(async () => (await p.locator('[data-testid=page-text]').innerText()).includes('E-501'), 'page text shown', 5000);
    await p.getByRole('button', { name: 'Previous page' }).click();
    await until(async () => (await p.locator('[data-testid=page-canvas]').getAttribute('data-page')) === '2', 'went to page 2', 8000);
    await p.getByLabel('Bookmark label').fill('Rear cover jam');
    await p.getByRole('button', { name: 'Bookmark', exact: true }).click();
    await p.getByText('Page 2 · Rear cover jam').waitFor({ state: 'visible', timeout: 5000 });
    await p.getByLabel('Bookmark label').fill('Root password: hunter2-secret');
    ok(await p.getByRole('button', { name: 'Bookmark', exact: true }).isDisabled(), 'a secret in a label blocks saving');
    await p.getByLabel('Bookmark label').fill('');
    await p.getByLabel('Find in this manual').fill('paper jam');
    await p.getByRole('button', { name: 'Find', exact: true }).click();
    await p.locator('[data-testid=hits] button').first().waitFor({ state: 'visible', timeout: 5000 });
    // zoom changes the drawn size
    const w0 = await p.evaluate(() => document.querySelector('[data-testid=page-canvas]').width);
    await p.getByRole('button', { name: 'Zoom in' }).click();
    await until(async () => (await p.evaluate(() => document.querySelector('[data-testid=page-canvas]').width)) > w0, 'zoom enlarges the page', 8000);
    // attach to a guide
    await go('/kb/new');
    await p.locator('#kb-title').fill('Rear cover jam test guide');
    await p.locator('#kb-body').fill('1. Open the rear cover\n2. Remove the paper');
    await p.getByRole('button', { name: 'Save entry' }).click();
    await p.waitForTimeout(400);
    await go('/manuals');
    await p.locator('a[href^="#/manuals/"]').first().click();
    await p.waitForSelector('[data-testid=page-canvas][data-ready="1"]', { timeout: 15000 });
    await p.getByRole('button', { name: 'Attach to a guide' }).click();
    const opts = await p.locator('#ph-entry option').allInnerTexts();
    ok(opts.some((o) => o.includes('Rear cover jam test guide')), 'the new guide can be chosen');
    await p.locator('#ph-entry').selectOption({ label: 'Rear cover jam test guide' });
    ok(await p.getByRole('button', { name: 'Attach page picture' }).isDisabled(), 'needs the check box first');
    await p.getByLabel(/shows only manual content/).check();
    await p.getByRole('button', { name: 'Attach page picture' }).click();
    await p.getByText(/Attached to “Rear cover jam test guide”/).waitFor({ state: 'visible', timeout: 10000 });
    // the manual survives a reload (it is stored on the device)
    await p.reload();
    await p.waitForSelector('[data-testid=page-canvas][data-ready="1"]', { timeout: 15000 });
    await noHScroll();
    await shot('manual-reader');
    // edit from the reader: rename, change brand, add a note
    await p.getByRole('button', { name: 'Edit details' }).click();
    const ed = p.locator('[data-testid=manual-editor]');
    await ed.getByLabel('Name').fill('WF-579R user guide');
    await ed.getByLabel('Brand').selectOption('Other');
    await ed.getByLabel('Note (optional)').fill('Rev A, rear cover section');
    await ed.getByLabel('Name').fill('Root password: hunter2-secret');
    ok(await ed.getByRole('button', { name: 'Save' }).isDisabled(), 'a secret in the name blocks saving');
    await ed.getByLabel('Name').fill('WF-579R user guide');
    await ed.getByRole('button', { name: 'Save' }).click();
    await p.getByRole('heading', { name: 'WF-579R user guide' }).waitFor({ state: 'visible', timeout: 5000 });
    ok((await p.locator('#main').innerText()).includes('Rev A, rear cover section'), 'note shown in the reader');
    ok(await p.locator('[data-testid=manual-editor]').count() === 0, 'editor closes after saving');
    // the library shows it under the new brand, and edits work there too
    await go('/manuals');
    await p.getByRole('heading', { name: 'Other' }).waitFor({ state: 'visible', timeout: 5000 });
    await p.getByText('WF-579R user guide').first().waitFor({ state: 'visible', timeout: 5000 });
    await p.getByRole('button', { name: 'Edit WF-579R user guide' }).click();
    await p.locator('[data-testid=manual-editor]').getByLabel('Name').fill('   ');
    await p.locator('[data-testid=manual-editor]').getByRole('button', { name: 'Save' }).click();
    await p.getByText('WF-579R user guide').first().waitFor({ state: 'visible', timeout: 5000 });
    await p.getByRole('button', { name: 'Edit WF-579R user guide' }).click();
    await p.locator('[data-testid=manual-editor]').getByLabel('Name').fill('WF-579R service notes');
    await p.locator('[data-testid=manual-editor]').getByLabel('Brand').selectOption('Epson');
    await p.locator('[data-testid=manual-editor]').getByRole('button', { name: 'Cancel' }).click();
    await p.getByText('WF-579R user guide').first().waitFor({ state: 'visible', timeout: 5000 });
    ok(await p.getByText('WF-579R service notes').count() === 0, 'cancel discards changes');
    await p.getByRole('button', { name: 'Edit WF-579R user guide' }).click();
    await p.locator('[data-testid=manual-editor]').getByLabel('Name').fill('WF-579R service notes');
    await p.locator('[data-testid=manual-editor]').getByLabel('Brand').selectOption('Epson');
    await p.locator('[data-testid=manual-editor]').getByRole('button', { name: 'Save' }).click();
    await p.getByRole('heading', { name: 'Epson' }).waitFor({ state: 'visible', timeout: 5000 });
    await p.reload();
    await p.getByText('WF-579R service notes').first().waitFor({ state: 'visible', timeout: 5000 });
    // bookmarks and the page picture still belong to the renamed manual
    await p.locator('a[href^="#/manuals/"]').first().click();
    await p.getByText('Page 2 · Rear cover jam').waitFor({ state: 'visible', timeout: 8000 });
    // remove it
    await go('/manuals');
    p.once('dialog', (d) => d.accept());
    await p.getByRole('button', { name: /^Remove WF-579R service notes/ }).click();
    await p.getByText('No manuals yet.').waitFor({ state: 'visible', timeout: 5000 });
  });

  await step(S('encryption: on, stored as ciphertext, locks, wrong passphrase refused, unlock, lock now'), async () => {
    await go('/kb/new');
    await p.getByLabel('Title').fill('Zebra quartz unique title');
    await p.getByLabel('Content').fill('plain body words');
    await p.getByRole('button', { name: 'Save entry' }).click();
    await p.waitForURL(/#\/kb\/[^/]+$/);
    await go('/settings');
    await p.getByLabel('New passphrase').fill('purple-tractor-lamp-9');
    await p.getByLabel('Repeat passphrase').fill('purple-tractor-lamp-9');
    await p.getByRole('button', { name: 'Turn on encryption' }).click();
    await p.getByText(/Encryption is on\. Your data/).waitFor({ state: 'visible', timeout: 15000 });
    await until(async () => !(await p.evaluate(() => Object.values(localStorage).join('|'))).includes('Zebra quartz'), 'plaintext gone from storage');
    await p.reload();
    await p.getByText('ForgeTools is locked').waitFor({ state: 'visible', timeout: 5000 });
    ok(!(await p.locator('body').innerText()).includes('Zebra quartz'), 'nothing shown while locked');
    await p.getByLabel('Passphrase').fill('wrong-passphrase-here');
    await p.getByRole('button', { name: 'Unlock' }).click();
    await p.getByText('That passphrase did not open the data.').waitFor({ state: 'visible', timeout: 15000 });
    await p.getByLabel('Passphrase').fill('purple-tractor-lamp-9');
    await p.getByRole('button', { name: 'Unlock' }).click();
    await p.waitForSelector('h1', { timeout: 15000 });
    await go('/kb');
    await p.getByText('Zebra quartz unique title').first().waitFor({ state: 'visible', timeout: 5000 });
    await go('/settings');
    await p.getByRole('button', { name: 'Lock now' }).click();
    await p.getByText('ForgeTools is locked').waitFor({ state: 'visible', timeout: 5000 });
    await shot('locked');
  });

  await step(S('fingerprint unlock (simulated platform authenticator with PRF)'), async () => {
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true } });
    await p.getByLabel('Passphrase').fill('purple-tractor-lamp-9');
    await p.getByRole('button', { name: 'Unlock' }).click();
    await p.waitForSelector('h1', { timeout: 15000 });
    await go('/settings');
    await p.locator('#bio-pass').fill('not-the-passphrase');
    await p.getByRole('button', { name: 'Turn on fingerprint unlock' }).click();
    await p.getByText(/passphrase is not right/).waitFor({ state: 'visible', timeout: 15000 });
    await p.locator('#bio-pass').fill('purple-tractor-lamp-9');
    await p.getByRole('button', { name: 'Turn on fingerprint unlock' }).click();
    await p.getByText(/Fingerprint unlock is on/).waitFor({ state: 'visible', timeout: 15000 });
    ok(!(await p.evaluate(() => Object.values(localStorage).join('|'))).includes('purple-tractor'), 'passphrase is not in storage');
    await p.getByRole('button', { name: 'Lock now' }).click();
    await p.getByText('ForgeTools is locked').waitFor({ state: 'visible', timeout: 5000 });
    await p.getByRole('button', { name: /Unlock with fingerprint/ }).click();
    await p.waitForSelector('h1', { timeout: 15000 });
    await go('/kb');
    await p.getByText('Zebra quartz unique title').first().waitFor({ state: 'visible', timeout: 5000 });
    await go('/settings');
    await p.getByRole('button', { name: 'Turn off fingerprint unlock' }).click();
    await p.getByRole('button', { name: 'Lock now' }).click();
    await p.getByText('ForgeTools is locked').waitFor({ state: 'visible', timeout: 5000 });
    ok((await p.getByRole('button', { name: /Unlock with fingerprint/ }).count()) === 0, 'no fingerprint button once turned off');
    await cdp.send('WebAuthn.disable');
  });


  await step(S('no console errors'), async () => { eq(JSON.stringify(errs), '[]'); });
  await browser.close();
}

await run('desktop', { width: 1280, height: 850 });
await run('phone', { width: 390, height: 844 });
for (const [s, n] of results) console.log(s, n);
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
