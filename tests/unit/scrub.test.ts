import { describe, expect, test } from 'bun:test';
import { scrubText, scrubSummary } from '../../src/lib/scrub';

const s = (t: string, x: string[] = []) => scrubText(t, x);

describe('scrub', () => {
  test('removes contact details and secrets', () => {
    const r = s('Email jo.bloggs@acmedental.co.uk or ring 01632 960123. Admin password is Winter2024!x. Printer at 192.168.4.20.');
    expect(r.text).not.toMatch(/acmedental|960123|Winter2024|192\.168/);
    expect(r.items.length).toBeGreaterThanOrEqual(4);
  });
  test('labelled customer, contract and serial fields', () => {
    const r = s('Customer: Acme Dental Practice\nContract no: MP-20481-77\nSerial: W8Z1234567\nModel: Ricoh IM C3000');
    expect(r.text).not.toMatch(/Acme|20481|W8Z1234567/);
    expect(r.text).toContain('Ricoh IM C3000'); // product model is useful and kept
  });
  test('company names, greeting and named people', () => {
    const r = s('Dear Sarah, we spoke to Mark Jones at Brightwater Solicitors Ltd about the copier.');
    expect(r.text).not.toMatch(/Sarah|Mark Jones|Brightwater/);
  });
  test('host names and private links go, vendor links stay', () => {
    const r = s('Connect to PC-FRONTDESK-01 then see https://portal.acme-internal.co.uk/x and https://learn.microsoft.com/en-us/windows/x');
    expect(r.text).not.toMatch(/FRONTDESK|acme-internal/);
    expect(r.text).toContain('learn.microsoft.com');
  });
  test('technical content survives', () => {
    const t = 'Run net stop spooler then delete files in C:\\Windows\\System32\\spool\\PRINTERS. Check KB5034441 and error 0x80070005 in Event Viewer, Group Policy and Device Manager.';
    const r = s(t);
    expect(r.text).toContain('net stop spooler');
    expect(r.text).toContain('KB5034441');
    expect(r.text).toContain('0x80070005');
    expect(r.text).toContain('Group Policy');
    expect(r.text).toContain('Device Manager');
  });
  test('extra words removed, case-insensitive, and summary is honest', () => {
    const r = s('Visit Northgate and northgate again', ['Northgate']);
    expect(r.text).toBe('Visit [removed] and [removed] again');
    expect(scrubSummary(s('nothing here'))).toMatch(/Read the text carefully/);
  });
  test('idempotent', () => {
    const once = s('Customer: Acme Ltd, ring 01632 960123, serial W8Z1234567').text;
    expect(s(once).text).toBe(once);
  });
});
