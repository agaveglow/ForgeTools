import type { Dev, Goal, Link, Net } from '../lib/netsim';

/** Practice scenarios for the network lab. Every name and address is made up (private and documentation ranges). */
export interface Scenario {
  id: string; title: string; symptom: string; at: string;
  hints: string[]; solution: string; goal?: Goal; setup: (n: Net) => Net;
}

export function baseNet(): Net {
  const devices: Dev[] = [
    { id: 'cloud', name: 'Internet', kind: 'cloud', up: true, ifaces: [{ ip: '198.51.100.1', mask: '255.255.255.252' }], publicIps: ['203.0.113.10', '203.0.113.53'], records: { 'www.example.test': '203.0.113.10' } },
    { id: 'r1', name: 'Router', kind: 'router', up: true, ifaces: [{ ip: '192.168.10.1', mask: '255.255.255.0' }, { ip: '198.51.100.2', mask: '255.255.255.252' }], gateway: '198.51.100.1' },
    { id: 'sw1', name: 'Switch', kind: 'switch', up: true, ifaces: [] },
    { id: 'pc1', name: 'PC-01', kind: 'pc', up: true, ifaces: [{ ip: '192.168.10.20', mask: '255.255.255.0' }], gateway: '192.168.10.1', dns: '192.168.10.5', listen: [135, 445] },
    { id: 'pc2', name: 'PC-02', kind: 'pc', up: true, dhcp: true, ifaces: [{ ip: '192.168.10.21', mask: '255.255.255.0' }], gateway: '192.168.10.1', dns: '192.168.10.5', listen: [135, 445] },
    { id: 'prn', name: 'PRN-01', kind: 'printer', up: true, ifaces: [{ ip: '192.168.10.50', mask: '255.255.255.0' }], gateway: '192.168.10.1', listen: [80, 443, 631, 9100] },
    { id: 'srv', name: 'SRV-01', kind: 'server', up: true, ifaces: [{ ip: '192.168.10.5', mask: '255.255.255.0' }], gateway: '192.168.10.1', dns: '192.168.10.5', listen: [53, 67, 445],
      forwards: true, records: { 'srv-01.lab.test': '192.168.10.5', 'files.lab.test': '192.168.10.5', 'prn-01.lab.test': '192.168.10.50' },
      lease: { mask: '255.255.255.0', gateway: '192.168.10.1', dns: '192.168.10.5', next: '192.168.10.22' } },
  ];
  const links: Link[] = [
    { id: 'l-r1-sw1', a: 'r1', aIf: 0, b: 'sw1', up: true },
    { id: 'l-r1-cloud', a: 'r1', aIf: 1, b: 'cloud', up: true },
    { id: 'l-sw1-pc1', a: 'sw1', b: 'pc1', up: true },
    { id: 'l-sw1-pc2', a: 'sw1', b: 'pc2', up: true },
    { id: 'l-sw1-prn', a: 'sw1', b: 'prn', up: true },
    { id: 'l-sw1-srv', a: 'sw1', b: 'srv', up: true },
  ];
  return { devices, links };
}

const edit = (n: Net, id: string, f: (d: Dev) => Dev): Net => ({ ...n, devices: n.devices.map(d => (d.id === id ? f(d) : d)) });
const cut = (n: Net, id: string): Net => ({ ...n, links: n.links.map(l => (l.id === id ? { ...l, up: false } : l)) });

export const SCENARIOS: Scenario[] = [
  { id: 'free', title: 'Free play: a healthy small office', at: 'pc1',
    symptom: 'Everything works. Try the commands, break something in the diagram, then see what the output tells you.',
    hints: ['Power a device off, unplug a cable or change an address, then ping again.', 'Compare what ping, tracert and nslookup say for the same fault.'],
    solution: 'Nothing to fix. Use this to learn what normal output looks like first.', setup: n => n },
  { id: 'wrong-ip', title: 'Printer unreachable: wrong address', at: 'pc1',
    symptom: 'One printer will not print for anyone. Its web page does not open. The cable and lights look fine.',
    hints: ['Ping the printer by name. "Destination host unreachable" from your own address means nothing on your network answers to that address.', 'The printer\'s own panel is the truth. Click the printer in the diagram to see its address. Is it on the same network as the PCs?', 'Compare it with the PC address from ipconfig.'],
    solution: 'The printer had an address on a different network (192.168.20.x). Set it back to an address on the PC network (192.168.10.50 with mask 255.255.255.0) and ping again. In real work: change it on the printer\'s panel or web page with approval, and update any queues that point at the old address.',
    goal: { from: 'pc1', target: 'prn-01.lab.test' }, setup: n => edit(n, 'prn', d => ({ ...d, ifaces: [{ ip: '192.168.20.50', mask: '255.255.255.0' }] })) },
  { id: 'cable', title: 'Printer unreachable: cable unplugged', at: 'pc1',
    symptom: 'The printer stopped responding. Nobody changed any settings.',
    hints: ['Ping the printer. Whose address does "Destination host unreachable" come from?', 'A reply from your own address means the problem is on your own network segment.', 'Look at the diagram for a red dashed cable.'],
    solution: 'The cable between the switch and the printer was unplugged. Reconnect it in the diagram. In real work: check the link lights and port at both ends.',
    goal: { from: 'pc1', target: 'prn-01.lab.test' }, setup: n => cut(n, 'l-sw1-prn') },
  { id: 'gateway', title: 'No internet, office network fine', at: 'pc1',
    symptom: 'PC-01 can open files on the server but nothing outside works.',
    hints: ['Ping the server by address. Then ping 203.0.113.10 (an outside address).', 'Run ipconfig. Does the default gateway look right?', 'Ping the gateway address.'],
    solution: 'The PC had the wrong default gateway (192.168.10.254). Set it to the router\'s address, 192.168.10.1.',
    goal: { from: 'pc1', target: '203.0.113.10' }, setup: n => edit(n, 'pc1', d => ({ ...d, gateway: '192.168.10.254' })) },
  { id: 'dns', title: 'Works by address, not by name', at: 'pc1',
    symptom: 'Opening files.lab.test fails, but the server answers when you use its number.',
    hints: ['Ping files.lab.test. Then ping 192.168.10.5.', 'Run nslookup files.lab.test.', 'ipconfig /all shows which DNS server the PC is using. Is it a real device?'],
    solution: 'The PC pointed at a DNS address (192.168.10.99) where nothing answers. Set DNS to the server, 192.168.10.5.',
    goal: { from: 'pc1', target: 'files.lab.test' }, setup: n => edit(n, 'pc1', d => ({ ...d, dns: '192.168.10.99' })) },
  { id: 'dhcp', title: 'PC has a 169.254 address', at: 'pc2',
    symptom: 'PC-02 has no network access. ipconfig shows an address starting 169.254.',
    hints: ['An address starting 169.254 means the PC could not get an address automatically.', 'Run ipconfig /renew and read the message.', 'What hands out addresses on this network? Is it running?'],
    solution: 'The server that gives out addresses was switched off. Power SRV-01 on in the diagram, then run ipconfig /renew on PC-02.',
    goal: { from: 'pc2', target: '192.168.10.1' }, setup: n => edit(edit(n, 'srv', d => ({ ...d, up: false })), 'pc2', d => ({ ...d, gateway: undefined, ifaces: [{ ip: '169.254.33.14', mask: '255.255.0.0' }] })) },
  { id: 'port', title: 'Printer answers ping but will not print', at: 'pc1',
    symptom: 'The printer replies to ping, its page opens, but jobs sit in the queue.',
    hints: ['Ping works, so the network path is fine. Which port do print jobs use?', 'Run Test-NetConnection prn-01.lab.test -Port 9100.', 'Look for a blocked port on the printer in the diagram.'],
    solution: 'Port 9100 was blocked on the way to the printer. Remove it from the blocked ports on the printer. In real work this is usually a firewall or printer setting; ask before changing it.',
    goal: { from: 'pc1', target: 'prn-01.lab.test', port: 9100 }, setup: n => edit(n, 'prn', d => ({ ...d, blocked: [9100] })) },
];
