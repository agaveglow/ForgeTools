import { describe, expect, test } from 'bun:test';
import { baseNet, SCENARIOS } from '../../src/content/lab';
import { banner, goalMet, HELP, resolve, route, runCommand, type Net, type Session } from '../../src/lib/netsim';

const BANNED = /360|manchester|hull|kieran|ritarian|itarian|\beset\b|barracuda|aptem|kyocera|ricoh|skillsforall|cisco|powercert|youtube|lucidchart|datto|n-able|atera|splashtop|teamviewer|anydesk/i;
const sess = (net: Net, at = 'pc1'): Session => ({ net, at, arp: [] });
const run = (s: Session, c: string) => runCommand(s, c);
const text = (r: { out: string[] }) => r.out.join('\n');

describe('network lab', () => {
  test('healthy network: everything reachable', () => {
    const n = baseNet();
    expect(route(n, 'pc1', '192.168.10.50').ok).toBe(true);
    expect(route(n, 'pc1', '203.0.113.10').ok).toBe(true);
    expect(resolve(n, 'pc1', 'files.lab.test').ip).toBe('192.168.10.5');
    expect(resolve(n, 'pc1', 'www.example.test').ip).toBe('203.0.113.10');
    expect(resolve(n, 'pc1', 'prn-01').ip).toBe('192.168.10.50');
  });
  test('ping, tracert, nslookup output', () => {
    const s = sess(baseNet());
    expect(text(run(s, 'ping 192.168.10.50'))).toMatch(/Reply from 192\.168\.10\.50: bytes=32 time<1ms TTL=64/);
    expect(text(run(s, 'ping -n 2 www.example.test'))).toMatch(/Received = 2, Lost = 0/);
    expect(text(run(s, 'tracert 203.0.113.10'))).toMatch(/192\.168\.10\.1[\s\S]*198\.51\.100\.1[\s\S]*203\.0\.113\.10/);
    expect(text(run(s, 'nslookup files.lab.test'))).toMatch(/Address:\s+192\.168\.10\.5/);
    expect(text(run(s, 'nslookup nope.lab.test'))).toMatch(/Non-existent domain/);
    expect(text(run(s, 'ping nope.lab.test'))).toMatch(/could not find host/);
  });
  test('ipconfig and arp', () => {
    let s = sess(baseNet());
    expect(text(run(s, 'ipconfig'))).toMatch(/192\.168\.10\.20[\s\S]*255\.255\.255\.0[\s\S]*192\.168\.10\.1/);
    expect(text(run(s, 'ipconfig /all'))).toMatch(/PC-01/);
    expect(text(run(s, 'arp -a'))).toMatch(/No ARP/);
    s = run(s, 'ping 192.168.10.50').session;
    expect(text(run(s, 'arp -a'))).toMatch(/192\.168\.10\.50\s+02-00-c0-a8-0a-32/);
  });
  test('unknown command and help', () => {
    const s = sess(baseNet());
    expect(text(run(s, 'format c:'))).toMatch(/not recognized/);
    expect(run(s, 'help').out).toEqual(HELP);
    expect(run(s, 'cls').clear).toBe(true);
    expect(banner().join(' ')).toMatch(/simulation/);
  });
  test('every scenario starts broken (except free play) and its fix works', () => {
    for (const sc of SCENARIOS) {
      const n = sc.setup(baseNet());
      if (sc.id === 'free') { expect(sc.goal).toBeUndefined(); continue; }
      expect(goalMet(n, sc.goal!)).toBe(false);
    }
  });
  test('wrong address / cable / gateway / dns / dhcp / port faults and fixes', () => {
    const get = (id: string) => SCENARIOS.find(x => x.id === id)!;
    // wrong IP
    let n = get('wrong-ip').setup(baseNet());
    expect(text(run(sess(n), 'ping 192.168.10.50'))).toMatch(/Reply from 192\.168\.10\.20: Destination host unreachable/);
    expect(route(n, 'pc1', '192.168.20.50').ok).toBe(false);
    n = { ...n, devices: n.devices.map(d => d.id === 'prn' ? { ...d, ifaces: [{ ip: '192.168.10.50', mask: '255.255.255.0' }] } : d) };
    expect(goalMet(n, get('wrong-ip').goal!)).toBe(true);
    // cable
    n = get('cable').setup(baseNet());
    expect(text(run(sess(n), 'ping 192.168.10.50'))).toMatch(/Reply from 192\.168\.10\.20: Destination host unreachable/);
    n = { ...n, links: n.links.map(l => ({ ...l, up: true })) };
    expect(goalMet(n, get('cable').goal!)).toBe(true);
    // gateway
    n = get('gateway').setup(baseNet());
    expect(route(n, 'pc1', '192.168.10.5').ok).toBe(true);
    expect(route(n, 'pc1', '203.0.113.10').ok).toBe(false);
    n = { ...n, devices: n.devices.map(d => d.id === 'pc1' ? { ...d, gateway: '192.168.10.1' } : d) };
    expect(goalMet(n, get('gateway').goal!)).toBe(true);
    // dns
    n = get('dns').setup(baseNet());
    expect(text(run(sess(n), 'nslookup files.lab.test'))).toMatch(/timed out/);
    expect(route(n, 'pc1', '192.168.10.5').ok).toBe(true);
    n = { ...n, devices: n.devices.map(d => d.id === 'pc1' ? { ...d, dns: '192.168.10.5' } : d) };
    expect(goalMet(n, get('dns').goal!)).toBe(true);
    // port
    n = get('port').setup(baseNet());
    expect(text(run(sess(n), 'ping 192.168.10.50'))).toMatch(/Received = 4/);
    expect(text(run(sess(n), 'Test-NetConnection prn-01.lab.test -Port 9100'))).toMatch(/TcpTestSucceeded : False/);
    n = { ...n, devices: n.devices.map(d => d.id === 'prn' ? { ...d, blocked: [] } : d) };
    expect(text(run(sess(n), 'tnc 192.168.10.50 -port 9100'))).toMatch(/TcpTestSucceeded : True/);
  });
  test('dhcp: apipa until the server is on, then renew works', () => {
    const sc = SCENARIOS.find(x => x.id === 'dhcp')!;
    let s = sess(sc.setup(baseNet()), 'pc2');
    expect(text(run(s, 'ipconfig'))).toMatch(/169\.254\./);
    expect(text(run(s, 'ipconfig /renew'))).toMatch(/unable to contact your DHCP server/);
    s = { ...s, net: { ...s.net, devices: s.net.devices.map(d => d.id === 'srv' ? { ...d, up: true } : d) } };
    const r = run(s, 'ipconfig /renew');
    expect(text(r)).toMatch(/192\.168\.10\.22/);
    expect(goalMet(r.session.net, sc.goal!)).toBe(true);
    expect(text(run(sess(baseNet()), 'ipconfig /renew'))).toMatch(/no adapter is in the state/);
  });
  test('powered-off seat and a switch outage', () => {
    const n = baseNet();
    const off = { ...n, devices: n.devices.map(d => d.id === 'pc1' ? { ...d, up: false } : d) };
    expect(text(run(sess(off), 'ipconfig'))).toMatch(/switched off/);
    const noSw = { ...n, devices: n.devices.map(d => d.id === 'sw1' ? { ...d, up: false } : d) };
    expect(text(run(sess(noSw), 'ipconfig'))).toMatch(/Media disconnected/);
    expect(route(noSw, 'pc1', '192.168.10.5').ok).toBe(false);
  });
  test('vlans separate devices on one switch', () => {
    const n = baseNet();
    const v = { ...n, devices: n.devices.map(d => d.id === 'prn' ? { ...d, ifaces: [{ ...d.ifaces[0], vlan: 20 }] } : d) };
    expect(route(v, 'pc1', '192.168.10.50').ok).toBe(false);
  });
  test('scenario text is original and generic', () => {
    expect(BANNED.test(JSON.stringify(SCENARIOS.map(s => ({ ...s, setup: 0 }))) + HELP.join(' '))).toBe(false);
  });
  test('hostile input does not throw', () => {
    const s = sess(baseNet());
    for (const c of ['ping', 'ping -n x 1.2.3', 'ping 999.1.1.1', 'tracert', 'nslookup', 'nslookup a b c', 'arp', 'tnc', 'tnc x -Port zz', 'ping ' + 'a'.repeat(5000), '   ', 'ipconfig /bogus'])
      expect(() => run(s, c)).not.toThrow();
  });
});
