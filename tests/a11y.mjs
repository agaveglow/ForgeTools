// Lightweight accessibility sweep: unnamed controls, missing page heading, tiny tap targets on phone.
import { chromium } from 'playwright';
const b = await chromium.launch();
let problems = 0;
for (const [name, vp] of [['desktop', { width: 1280, height: 850 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const routes = ['/', '/logs', '/logs/new', '/troubleshoot', '/troubleshoot/net-no-internet', '/commands', '/security', '/kb', '/kb/new', '/skills', '/settings', '/workflow', '/manuals', '/tools', '/tools/cable', '/tools/calc', '/tools/notes', '/tools/kit', '/tools/redact', '/tools/events', '/tools/hash', '/tools/header', '/tools/harden', '/tools/ports', '/tools/dns', '/tools/password', '/tools/convert', '/tools/checks', '/tools/print', '/tools/lab', '/tools/engineer', '/procedures', '/procedures/proc-ticket-flow', '/library', '/library/lib-network-basics', '/requirements', '/today', '/a/today', '/a/fix', '/apps'];
  for (const r of routes) {
    await p.goto('http://localhost:4173/#' + r); await p.waitForTimeout(250);
    const res = await p.evaluate(() => {
      const out = [];
      const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length && 'label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
      for (const el of document.querySelectorAll('button,a[href],input,select,textarea')) {
        if (el.type === 'hidden' || el.closest('.sr-only')) continue;
        const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        const labelled = aria || (el.labels && el.labels.length) || (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA' && el.textContent.trim());
        if (!labelled) out.push('unnamed ' + el.tagName + ' ' + (el.outerHTML.slice(0, 80)));
      }
      if (!document.querySelector('h1')) out.push('no h1');
      if (document.querySelectorAll('h1').length > 1) out.push('multiple h1');
      return out;
    });
    if (res.length) { problems += res.length; console.log(name, r, res); }
    if (name === 'phone') {
      const small = await p.evaluate(() => [...document.querySelectorAll('button,a[href]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 32) && !e.closest('summary') && e.textContent.trim().length > 0 && getComputedStyle(e).display !== 'inline'; }).map((e) => e.textContent.trim().slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().height)));
      if (small.length) console.log('small targets', r, small.slice(0, 5));
    }
  }
}
await b.close();
console.log(problems ? problems + ' problems' : 'a11y sweep clean');
