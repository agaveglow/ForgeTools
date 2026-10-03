import type { ChecklistRun, CollectionMap, CollectionName, KbEntry, TroubleshootSession, UsageEvent, WorkLog } from './types';
import { WORKFLOW_BY_ID } from '../content/workflows';

type Seed = { [K in CollectionName]: CollectionMap[K][] };

/**
 * Sample records so the app is demonstrable on first run.
 * Everything here is fictional and flagged `demo: true` — it is shown with a DEMO badge,
 * never counts towards skill evidence, and can be removed from Settings > Data.
 */
export function buildSeed(now: Date): Seed {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const base = (id: string, hoursAgo: number) => ({ id: `demo-${id}`, createdAt: ago(hoursAgo), updatedAt: ago(hoursAgo), demo: true as const });

  const workLogs: WorkLog[] = [
    {
      ...base('wl-1', 2),
      ref: 'DEMO-0001',
      occurredAt: ago(2.5),
      client: 'Client A (small office)',
      device: 'Reception MFP',
      category: 'Printers',
      problem: 'Printer printed a few pages then showed an error and stopped.',
      investigation: 'Checked the network connection and tray. Inspected the feed path and found paper misfeeding around the fuser entry.',
      actions: 'Cleared paper debris from the feed path near the fuser entry and checked the rollers visually. Ran test prints.',
      result: 'Completed test prints with no further misfeeds. User confirmed normal output.',
      followUp: 'Monitor for recurrence. Suggest a roller inspection at the next service visit.',
      status: 'resolved',
      skills: ['printer-engineering', 'troubleshooting', 'customer-support'],
      learned: 'Debris near the fuser entry can cause repeat misfeeds even when the rollers look fine.',
      evidence: 'Ticket T-10231 update; test print pages kept by user',
      ticket: 'T-10231',
      learning: {
        demonstrated: 'Isolating a paper-path fault by location before touching components.',
        learned: 'How paper moves from tray to registration to fuser, and where debris causes misfeeds.',
        concepts: ['Paper feed path', 'Fuser operation', 'Registration', 'Preventative maintenance'],
        toResearch: [
          { id: 'demo-r1', text: 'How fuser temperature control works', done: false },
          { id: 'demo-r2', text: 'Typical roller replacement intervals and how to read the maintenance counter', done: false },
        ],
        nextActivity: 'Read the paper-path section of the service manual for this model and sketch the path.',
      },
    },
    {
      ...base('wl-2', 26),
      ref: 'DEMO-0002',
      occurredAt: ago(26),
      client: 'Client B (accounts team)',
      device: 'User laptop',
      category: 'Microsoft 365',
      problem: 'Shared mailbox not available in desktop Outlook but opened in Outlook on the web.',
      investigation: 'Compared desktop Outlook against Outlook on the web. Reviewed Full Access on the mailbox in the admin centre.',
      actions: 'Created a new Outlook profile and added the account again.',
      result: 'Shared mailbox appeared in the new profile after a short wait.',
      followUp: 'Ask the user to confirm it still works tomorrow. Note possible propagation delay.',
      status: 'follow-up',
      skills: ['m365', 'troubleshooting', 'identity-access'],
      learned: 'Web access working but desktop not points at the client profile or auto-mapping rather than permissions.',
      evidence: '',
      ticket: 'T-10218',
    },
    {
      ...base('wl-3', 50),
      ref: 'DEMO-0003',
      occurredAt: ago(50),
      client: 'Client C (design studio)',
      device: 'Remote worker laptop',
      category: 'Networking',
      problem: 'Internal file server names would not resolve while on the VPN.',
      investigation: 'Tested ping by IP and by name. Used nslookup against the internal DNS server. Checked the DNS servers listed while connected.',
      actions: 'Raised a change request with the VPN administrator to push internal DNS servers in the profile.',
      result: '',
      followUp: 'Retest after the VPN profile change is made.',
      status: 'follow-up',
      skills: ['networking', 'troubleshooting', 'communication'],
      learned: 'IP working but names failing is a DNS signal. Check which DNS servers the VPN provides.',
      evidence: '',
      ticket: 'T-10199',
    },
    {
      ...base('wl-4', 74),
      ref: 'DEMO-0004',
      occurredAt: ago(74),
      client: 'Client A (small office)',
      device: 'Office desktop',
      category: 'Cybersecurity',
      problem: 'Windows Security showed a protection warning.',
      investigation: 'Checked Defender status and the security providers list. Found a leftover trial antivirus registered.',
      actions: 'Removed the trial product with the vendor removal tool and restarted. Updated Defender signatures.',
      result: 'Windows Security shows no warnings and real-time protection is on.',
      followUp: '',
      status: 'resolved',
      skills: ['endpoint-security', 'windows', 'troubleshooting'],
      learned: 'Leftover security products can leave Defender in passive mode.',
      evidence: 'Before and after Windows Security status noted on ticket',
      ticket: 'T-10187',
    },
    {
      ...base('wl-5', 120),
      ref: 'DEMO-0005',
      occurredAt: ago(120),
      client: 'Client B (accounts team)',
      device: 'Finance PC',
      category: 'Windows',
      problem: 'Cumulative update failed repeatedly.',
      investigation: 'Checked free space on the system drive and found it very low. Reviewed update history.',
      actions: 'Cleared temporary files with Disk Cleanup, with the user’s agreement, then retried the update.',
      result: 'Update installed after a restart.',
      followUp: 'Recommend a larger drive or moving large files off the system disk.',
      status: 'resolved',
      skills: ['windows', 'troubleshooting', 'hardware'],
      learned: 'Check free space before anything else when updates fail.',
      evidence: '',
      ticket: 'T-10150',
    },
    {
      ...base('wl-6', 168),
      ref: 'DEMO-0006',
      occurredAt: ago(168),
      client: 'Client D (clinic)',
      device: 'Reception laptop',
      category: 'Windows',
      problem: 'Laptop very slow after login.',
      investigation: 'Opened Task Manager and Startup apps. Checked disk usage and installed updates.',
      actions: 'Disabled two non-essential startup items with the user’s agreement.',
      result: 'Somewhat quicker, but still slow on first login of the day.',
      followUp: 'Check drive health and consider replacing the disk if it is a hard drive.',
      status: 'unresolved',
      skills: ['windows', 'troubleshooting'],
      learned: '',
      evidence: '',
      ticket: 'T-10102',
    },
  ];

  // Session in progress: pick real step ids from the workflow so the demo can never go stale.
  const slow = WORKFLOW_BY_ID['win-slow-computer'];
  const sessionSteps: TroubleshootSession['steps'] = {};
  if (slow) {
    const [s1, s2] = slow.steps;
    if (s1) sessionSteps[s1.id] = { state: 'done', note: 'Task Manager showed disk at 100% shortly after login.' };
    if (s2) sessionSteps[s2.id] = { state: 'done', note: '' };
  }
  const sessions: TroubleshootSession[] = [
    {
      ...base('ts-1', 5),
      workflowId: 'win-slow-computer',
      title: slow?.title ?? 'Slow computer',
      ticket: 'T-10244',
      device: 'Reception laptop',
      status: 'open',
      steps: sessionSteps,
      checks: { '0': true, '1': true },
      notes: 'User reports slowness is worst for the first 10 minutes after login.',
      treePath: [],
    },
  ];

  const checklistRuns: ChecklistRun[] = [
    {
      ...base('cr-1', 30),
      templateId: 'security-maintenance-v1',
      label: 'Demo laptop 01',
      ticket: 'T-10240',
      status: 'open',
      items: {
        informed: { state: 'pass', note: '' },
        authorised: { state: 'pass', note: 'Authorisation on ticket' },
        device: { state: 'pass', note: '' },
        ticket: { state: 'pass', note: '' },
        updates: { state: 'pass', note: '' },
        defender: { state: 'pass', note: 'Real-time protection on, signatures current' },
        firewall: { state: 'pass', note: '' },
        encryption: { state: 'fail', note: 'BitLocker protection is off on the system drive. Raise with client; do not enable until recovery key escrow is agreed.' },
      },
    },
  ];

  const kbBase = (id: string, hoursAgo: number, over: Partial<KbEntry>): KbEntry => ({
    ...base('kb-' + id, hoursAgo),
    title: '',
    category: 'Procedures',
    tags: [],
    body: '',
    pinned: false,
    ...over,
  });

  const kbEntries: KbEntry[] = [
    kbBase('queue', 200, {
      title: 'Clear a stuck print queue (safe order)',
      category: 'Printers',
      tags: ['printing', 'spooler', 'queue'],
      pinned: true,
      body: [
        'Check whether other users have jobs waiting before clearing: this deletes every queued job on the machine.',
        '',
        '```',
        'net stop spooler',
        'del /Q /F /S "%SystemRoot%\\System32\\spool\\PRINTERS\\*.*"',
        'net start spooler',
        '```',
        '',
        'If the queue jams again straight away, suspect the driver or the document, not the spooler.',
      ].join('\n'),
    }),
    kbBase('mailbox', 180, {
      title: 'Shared mailbox: Full Access vs Send As vs Send on Behalf',
      category: 'Microsoft',
      tags: ['exchange', 'shared-mailbox', 'permissions'],
      pinned: true,
      body: [
        'Full Access: open and read the mailbox. Auto-mapping can add it to Outlook automatically.',
        'Send As: send so the message appears to come from the mailbox itself.',
        'Send on Behalf: send so the message shows "user on behalf of mailbox".',
        '',
        'Full Access does not include sending. Check each permission separately and allow time for changes to propagate.',
      ].join('\n'),
    }),
    kbBase('triage', 160, {
      title: 'Network triage order',
      category: 'Networking',
      tags: ['triage', 'ping', 'dns'],
      body: [
        '1. ipconfig /all: address, gateway, DNS present? 169.254.x.x means no DHCP lease.',
        '2. Ping the default gateway.',
        '3. Ping a public IP (for example 1.1.1.1).',
        '4. nslookup a name.',
        '',
        'IP works but names fail: DNS. Gateway fails: local path. Gateway works but public IP fails: upstream.',
      ].join('\n'),
    }),
    kbBase('paper', 140, {
      title: 'Generic laser printer paper path',
      category: 'Printers',
      tags: ['printers', 'paper-path', 'fuser'],
      body: [
        'Tray and pickup roller -> separation -> feed rollers -> registration -> transfer -> fuser -> exit rollers.',
        '',
        'Where the paper first goes wrong tells you which components to inspect. The fuser is hot: power off and let it cool before opening.',
        'Always follow the service manual for the specific model.',
      ].join('\n'),
    }),
    kbBase('bitlocker', 120, {
      title: 'Before changing firmware on a BitLocker device',
      category: 'Cybersecurity',
      tags: ['bitlocker', 'firmware', 'recovery-key'],
      body: [
        'Confirm the recovery key is stored where you can retrieve it before the change.',
        'Suspend BitLocker for the change, then resume it afterwards.',
        '',
        '```',
        'manage-bde -status',
        '```',
      ].join('\n'),
    }),
    kbBase('ps', 100, {
      title: 'PowerShell one-liners for triage',
      category: 'Commands',
      tags: ['powershell', 'triage'],
      body: [
        '```',
        'Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10 Name,Id,WorkingSet',
        "Get-Service | Where-Object { $_.Status -eq 'Stopped' -and $_.StartType -eq 'Automatic' }",
        'Get-PhysicalDisk | Select-Object FriendlyName,MediaType,HealthStatus',
        '```',
      ].join('\n'),
    }),
    kbBase('lesson', 80, {
      title: 'Lesson: compare desktop Outlook with Outlook on the web first',
      category: 'Lessons learned',
      tags: ['outlook', 'm365', 'isolation'],
      body:
        'Testing the same mailbox in the browser splits server-side problems (permissions, licence) from client-side ones (profile, cache, add-ins) in about a minute. Do it before changing anything.',
    }),
    kbBase('ranges', 60, {
      title: 'Reference: private and special IPv4 ranges',
      category: 'References',
      tags: ['ip', 'reference', 'apipa'],
      body: [
        '10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16: private ranges.',
        '169.254.0.0/16: link-local (APIPA), assigned when DHCP fails.',
        '127.0.0.0/8: loopback.',
        '192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24: documentation ranges, safe for examples.',
      ].join('\n'),
    }),
  ];

  const usage: UsageEvent[] = [
    { ...base('u1', 3), kind: 'workflow', refId: 'win-slow-computer', label: 'Slow computer', route: '/troubleshoot/win-slow-computer' },
    { ...base('u2', 20), kind: 'command', refId: 'ipconfig-all', label: 'ipconfig /all', route: '/commands/ipconfig-all' },
    { ...base('u3', 30), kind: 'checklist', refId: 'security-maintenance-v1', label: 'Device security check', route: '/security' },
    { ...base('u4', 55), kind: 'command', refId: 'ipconfig-all', label: 'ipconfig /all', route: '/commands/ipconfig-all' },
    { ...base('u5', 70), kind: 'workflow', refId: 'prn-paper-misfeed', label: 'Paper misfeeds and jams', route: '/troubleshoot/prn-paper-misfeed' },
    { ...base('u6', 90), kind: 'command', refId: 'sfc-scannow', label: 'sfc /scannow', route: '/commands/sfc-scannow' },
  ];

  return { workLogs, sessions, checklistRuns, kbEntries, skillRatings: [], usage };
}
