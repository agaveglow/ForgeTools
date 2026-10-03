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
  catch (e) { failures++; results.push(['FAIL', name + ' :: ' + String(e.message).split('\n')[0]]); }
}
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m ?? 'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const until = async (fn, m, ms = 3000) => { const t = Date.now(); for (;;) { try { if (await fn()) return; } catch {} if (Date.now() - t > ms) throw new Error(typeof m === 'function' ? await m() : (m ?? 'timed out')); await new Promise((r) => setTimeout(r, 50)); } };
const ok = (c, m) => { if (!c) throw new Error(m ?? 'assertion failed'); };

async function run(label, viewport) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  const go = async (route) => { await p.goto(BASE + '#/__blank'); await p.goto(BASE + '#' + route); await p.waitForTimeout(150); };
  const S = (n) => `${label}: ${n}`;
  const shot = (n) => p.screenshot({ path: `${SHOTS}/${label}-${n}.png` });
  const noHScroll = async () => ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'horizontal overflow');

  await p.goto(BASE);
  await p.waitForSelector('h1');

  await step(S('dashboard shows demo data and banner'), async () => {
    ok(await p.getByText('Sample data is showing').isVisible());
    ok((await p.getByText('DEMO').count()) > 0);
    await shot('dashboard');
  });

  await step(S('no horizontal overflow on every page'), async () => {
    for (const r of ['/', '/logs', '/logs/new', '/troubleshoot', '/commands', '/security', '/agent', '/voice', '/files', '/kb', '/skills', '/settings']) {
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
    await p.getByText('Visual guide: diagram and animated walkthrough').click();
    await p.getByTestId('diagram').locator('svg').waitFor({ state: 'visible', timeout: 3000 });
    ok((await p.getByTestId('diagram').locator('text').count()) > 5, 'diagram has labelled nodes');
    await p.getByTestId('diagram').scrollIntoViewIfNeeded(); await shot('diagram');
    await p.getByRole('tab', { name: 'Play' }).click();
    await p.getByText(/Step 1 of \d+/).waitFor({ state: 'visible', timeout: 3000 });
    await p.getByRole('button', { name: 'Next step' }).click();
    await p.getByText(/Step 2 of \d+/).waitFor({ state: 'visible', timeout: 3000 });
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
    await p.getByText('Saved to Knowledge base and Files.').waitFor({ state: 'visible', timeout: 3000 });
    await go('/files');
    await p.getByText(/\.txt$/).first().waitFor({ state: 'visible', timeout: 3000 });
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

  await step(S('skills: demo logs never count; real logs do'), async () => {
    await go('/skills');
    await p.getByText('How levels work').click();
    await p.getByText(/Demo logs \(\d+\) are never counted/).waitFor({ state: 'visible', timeout: 3000 });
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

  await step(S('export excludes demo; import roundtrip'), async () => {
    await go('/settings');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Export backup (JSON)' }).click()]);
    const path = await dl.path();
    const json = JSON.parse(fs.readFileSync(path, 'utf8'));
    eq(json.app, 'forgetools');
    ok(json.data.collections.workLogs.length >= 3, 'own logs exported');
    ok(json.data.collections.workLogs.every((l) => !l.demo), 'no demo in export');
    fs.copyFileSync(path, `${SHOTS}/${label}-backup.json`);
  });

  await step(S('clear demo then reset requires ERASE'), async () => {
    await go('/settings');
    await p.getByRole('button', { name: 'Clear demo data' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Clear demo data' }).click();
    ok(await p.getByText('No demo records present').isVisible());
    await go('/logs');
    eq(await p.getByText('DEMO', { exact: true }).count(), 0, 'demo gone from list');
    ok(await p.getByText('Scanner would not scan to email').first().isVisible(), 'own data kept');
    await go('/settings');
    await p.getByRole('button', { name: 'Erase everything…' }).click();
    ok(await p.getByRole('button', { name: 'Erase all data' }).isDisabled());
    await p.getByLabel('Type ERASE to confirm').fill('ERASE');
    await p.getByRole('button', { name: 'Erase all data' }).click();
    await go('/logs');
    ok(await p.getByText('No work logs yet.').isVisible());
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

  await step(S('no console errors'), async () => { eq(JSON.stringify(errs), '[]'); });
  await browser.close();
}

await run('desktop', { width: 1280, height: 850 });
await run('phone', { width: 390, height: 844 });
for (const [s, n] of results) console.log(s, n);
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
