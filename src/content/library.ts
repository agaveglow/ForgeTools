/**
 * Built-in procedures and study references.
 * Written from scratch as general IT-support practice: no employer, customer, product-vendor or training-provider
 * names, no addresses, no credentials. Tests keep it that way.
 */

export type Block =
  | { kind: 'steps'; title: string; items: string[] }
  | { kind: 'points'; title: string; items: string[] }
  | { kind: 'caution'; title: string; items: string[] }
  | { kind: 'table'; title: string; head: [string, string]; rows: Array<[string, string]> }
  | { kind: 'note'; title: string; text: string };

export interface LibGuide {
  id: string;
  set: 'procedures' | 'library';
  title: string;
  summary: string;
  tags: string[];
  blocks: Block[];
}

const steps = (title: string, items: string[]): Block => ({ kind: 'steps', title, items });
const points = (title: string, items: string[]): Block => ({ kind: 'points', title, items });
const caution = (title: string, items: string[]): Block => ({ kind: 'caution', title, items });
const table = (title: string, head: [string, string], rows: Array<[string, string]>): Block => ({ kind: 'table', title, head, rows });
const note = (title: string, text: string): Block => ({ kind: 'note', title, text });

export const PROCEDURES: LibGuide[] = [
  {
    id: 'proc-ticket-flow', set: 'procedures', title: 'Work a support ticket from start to finish',
    summary: 'A repeatable eight-step routine: understand, check, investigate, fix safely, prove it, tell the customer, record it, close it.',
    tags: ['ticket', 'process', 'notes', 'escalation', 'closure'],
    blocks: [
      points('Principles', [
        'Read-only checks first. Change one thing at a time. Prove the fix with the original task.',
        'Decide early whether this is one device, one user, one site or a wider fault. Do not spend an hour on one PC when the real problem is a shared service.',
        'Escalating with clear evidence is good practice, not a failure.',
      ]),
      steps('The routine', [
        'Read the whole request and any history. Work out what the customer actually wants fixed, then acknowledge it so they know it is being handled.',
        'Gather facts: who is affected, which device, what happens versus what should happen, when it started, whether it ever worked, the exact error wording, and what changed recently.',
        'Run the quick checks: is the device reachable, is the network up, is there free space, is a restart or update pending, is a service-wide issue already known?',
        'Reproduce the fault if you can, preferably while the user does the task. Look at logs, settings and status instead of guessing. Compare with a working user or device.',
        'Fix it safely. Record the original setting before changing anything important. Use the least disruptive fix first and never remove something you do not understand.',
        'Test: repeat the exact action that failed. Where possible let the user try it themselves. Restart and retest if the fix depends on a service, driver or update.',
        'Update the customer in plain English: what was found, what was changed, that it was tested, and anything they need to do.',
        'Write the notes, log the time and close the ticket only when it is resolved or a clear next step is agreed.',
      ]),
      points('Useful evidence to capture', [
        'Exact error text and time, device name and user, application and version.',
        'What works versus what fails, and what you ruled out.',
        'Screenshots or log lines rather than descriptions.',
      ]),
      caution('Stop and escalate when', [
        'Anything suggests a security incident: unexpected remote-access tools, suspicious sign-ins, malware, possible data exposure. Preserve evidence before cleaning up.',
        'There is a risk of data loss, or a backup or restore is needed.',
        'More than one user, a server, or a whole site is affected.',
        'The change is high-impact (firewall, DNS, identity, tenant-wide, backups).',
        'You lack the access or authority, or you cannot explain what the change will affect.',
      ]),
      points('Do not close until', [
        'The original problem has been tested and works.',
        'The customer has been updated and any follow-up agreed.',
        'The notes would let a colleague understand it without asking you.',
        'Time is recorded and any wider concern has been passed on.',
      ]),
      note('Closure note template', 'Reported: [what the user described]. Checks: [key checks done]. Cause: [if known, otherwise "not identified"]. Action: [exactly what was changed]. Test: [how it was proved]. Customer updated. Follow-up: [none / what and who].'),
      note('Customer update template', 'Hello, I have looked into this. The cause was [plain-English cause]. I have [what was done] and tested it, and it is now working. If anything else happens, reply to this message. Thank you.'),
    ],
  },
  {
    id: 'proc-new-pc', set: 'procedures', title: 'Build and hand over a new PC or laptop',
    summary: 'A build and handover checklist so every device leaves the same: named, managed, protected, updated and tested.',
    tags: ['new pc', 'build', 'handover', 'laptop', 'setup'],
    blocks: [
      points('A device is not ready until', [
        'It has the correct name.',
        'The management agent is installed and a remote session has been tested.',
        'Endpoint protection is installed and reporting.',
        'Windows is fully updated and the final restart is clean.',
        'The user-facing checks below have passed.',
      ]),
      points('Before you start', [
        'Confirm which customer and which user the device is for.',
        'Confirm any customer-specific software, printers or VPN needs.',
        'Keep licence keys and setup details with the job paperwork, not in the ticket.',
      ]),
      steps('Base build', [
        'Complete Windows setup and connect to the network.',
        'Run Windows Update, restart, and repeat until nothing important is left.',
        'Check Device Manager for missing drivers or warnings.',
        'Check the date, time and time zone.',
        'Rename the device using the naming convention (three letters for the customer, a device-type code, then a three-digit number). Restart if asked.',
      ]),
      steps('Management and protection', [
        'Enrol the device in the remote-management platform under the right customer, then confirm the name shows correctly.',
        'Test a remote connection before moving on.',
        'Install endpoint protection with the right policy, confirm it is activated and reporting, update it and run an initial scan if required.',
        'Remove old or expired security software. Never leave two active antivirus products installed.',
      ]),
      steps('Software and accounts', [
        'Check installed apps and remove previous-provider tools, expired trials and bloatware (check first if unsure whether something is still used).',
        'Install the Microsoft 365 apps if needed, sign the user in, test mail send and receive, check cloud file sync and the chat/meeting app.',
        'Set up multi-factor sign-in where required.',
        'Install only the customer software the user needs.',
      ]),
      steps('Printing and scanning', [
        'Add the required printers and set the default the user wants.',
        'Print a test page, then test scanning to the right destination.',
      ]),
      steps('Final checks', [
        'Windows fully updated and correctly named.',
        'Management agent reporting and remote access tested.',
        'Endpoint protection active and updated.',
        'Mail, cloud files and chat apps working.',
        'Printers and scanners tested; required software installed; unwanted software removed.',
        'Final restart done with no warnings.',
      ]),
      note('Closure note template', 'New device prepared for [user]. Named to the standard, enrolled in management with remote access tested, protection installed and reporting. Updates completed, Microsoft 365 and required software configured, printers and scanners tested, unwanted software removed. Final checks passed.'),
    ],
  },
  {
    id: 'proc-takeover-cleanup', set: 'procedures', title: 'Take over a device and clear out old IT software',
    summary: 'Work out what is current, what is legacy and what is security-sensitive before removing anything.',
    tags: ['takeover', 'cleanup', 'legacy', 'remote access', 'antivirus', 'offboarding'],
    blocks: [
      points('Golden rules', [
        'Unknown software is not automatically bad. Identify it first, and escalate if you cannot explain what it does.',
        'Never remove the only active protection or the only working remote-access agent.',
        'A clean PC is one where every installed tool has a purpose, an owner and a support route, not one with the fewest apps.',
      ]),
      steps('Order of work', [
        'Confirm ownership and that the clean-up is authorised.',
        'Make an inventory: management, remote access, security, backup, VPN, and manufacturer utilities. Mark each as current, legacy or unknown.',
        'Confirm the replacement tools are installed, active and reporting under the right customer.',
        'Remove confirmed legacy tools one at a time with the normal uninstaller (never by deleting folders).',
        'Restart, then check protection, remote access, VPN, printing, backup and business apps still work.',
        'Record what was found, removed, kept and why.',
      ]),
      points('Identify before you uninstall', [
        'Open the app and see whether it names a company, tenant or support provider.',
        'Check publisher, version and install date (a clue, not proof).',
        'Check whether it is running in Task Manager or Services.',
        'Keep logs or screenshots if its origin or activity is in question.',
      ]),
      points('Questions per tool type', [
        'Old backup agent: does any current job or restore depend on it?',
        'Old VPN client: does the user still reach a service through it?',
        'Old Office or add-ins: does an accounting or document system need it?',
        'Browser extensions, scheduled tasks, local accounts: what created them and who uses them?',
        'Printer and scanner software: would removal break scan-to-folder or address books?',
      ]),
      caution('Do not over-clean', [
        'Leave Microsoft runtimes, Visual C++ packages, .NET and hardware drivers alone unless you know why they are there.',
        'Do not remove manufacturer tools needed for docks, displays or firmware without checking.',
        'Do not remove user data, mail archives, certificates or VPN keys without a verified backup and approval.',
        'If an old security product needs an uninstall password or special removal tool, stop and get the correct process. Do not force it.',
      ]),
      caution('Escalate when', [
        'You cannot tell who owns a management or security tool.',
        'A previous provider still seems to have active access.',
        'You see an unknown remote session, suspicious sign-in or unexpected admin activity.',
        'The device stops reporting to the current management platform after the clean-up.',
      ]),
      note('Closure note template', 'Reviewed device after takeover. Current management and protection confirmed reporting. Removed approved legacy items with the normal uninstaller, kept [items] because [reason]. Restarted and verified remote access, protection and required applications.'),
    ],
  },
  {
    id: 'proc-add-printer-ip', set: 'procedures', title: 'Add a network printer by IP address with the exact driver',
    summary: 'Install by TCP/IP with a downloaded driver, without changing the default printer or removing the existing one.',
    tags: ['printer', 'tcp/ip', 'driver', 'install', 'test page', 'default printer'],
    blocks: [
      points('Why it needs care', [
        'An install can look successful even when the port is wrong or the network blocks printing. It is only finished once the physical test page is confirmed.',
      ]),
      steps('Before connecting', [
        'Get the user\'s permission and confirm they are on the office network or an approved VPN that reaches the printer.',
        'Check whether the printer is already installed. If so, inspect and test it instead of adding a duplicate.',
        'Note the current default printer. Do not change it during the install.',
        'Be ready for approved admin credentials if Windows asks. Use your authorised method and do not bypass controls.',
      ]),
      steps('Get the driver', [
        'Go to the manufacturer\'s own support site, not a third-party driver site.',
        'Choose the exact model, the language and the correct Windows version.',
        'Download the model-specific PCL driver. Avoid the universal driver unless the customer standard says otherwise.',
        'If it is a self-extracting program, run it just to unpack and note the folder it creates. Do not launch the vendor wizard.',
      ]),
      steps('Add the printer', [
        'Open Printers and scanners and choose Add device, then "The printer that I want isn\'t listed".',
        'Choose "Add a printer using a TCP/IP address or hostname". Do not choose a shared printer by name or an automatic WSD entry.',
        'Device type TCP/IP Device, enter the printer address, accept the suggested port name.',
        'Untick "Query the printer and automatically select the driver". If asked for port details, choose Standard then Generic Network Card.',
        'Choose Have Disk, browse to the unpacked folder and pick the driver\'s setup information (.inf) file.',
        'Select the exact model entry, not a neighbouring model or a rebrand.',
        'Name it clearly. If that name exists, stop and inspect the existing queue instead.',
        'Choose not to share it, finish, and leave the default printer alone.',
      ]),
      steps('Verify', [
        'Open Printer properties (not just Preferences). On Ports, confirm a Standard TCP/IP port with the right address. On Advanced, confirm the driver is the exact model.',
        'Print a test page and have someone confirm the page came out of the right machine.',
        'Recheck the default. If "Let Windows manage my default printer" is on, printing may have switched it. Put it back and tell the user.',
        'Record the result. Mark complete only when the print is confirmed and the old printer is still there.',
      ]),
      table('If it does not work', ['Symptom', 'Look at'], [
        ['Cannot reach the printer', 'LAN or VPN, the printer address, its web page (a missing page alone does not prove it is unreachable)'],
        ['Shows Offline', 'Power, address, port and queue first; SNMP and protocol only after reachability is proved'],
        ['Driver not listed', 'Go back to Have Disk and pick the .inf in the unpacked folder; confirm the exact model'],
        ['Admin prompt blocks you', 'Use the approved method; if remote elevation is impossible, mark Blocked rather than done'],
        ['Test job stuck', 'The queue error, port and printer state; never delete other people\'s jobs without permission'],
        ['Test prints but real work fails', 'Paper size, tray, duplex, account or code settings with the site contact'],
      ]),
      caution('Avoid', [
        'Setting the new printer as default or removing the old one unless asked.',
        'The universal driver, a different model in the same range, or a WSD port.',
        'Sharing the printer from a user\'s PC.',
        'Changing codes, PINs, secure print or billing settings without approved instructions.',
        'Assuming an empty queue means paper printed.',
      ]),
    ],
  },
  {
    id: 'proc-mfa-reset', set: 'procedures', title: 'Reset MFA or move an authenticator to a new phone',
    summary: 'Which account action does what, how to verify the user, and how to finish the move safely.',
    tags: ['mfa', 'authenticator', 'password reset', 'microsoft 365', 'new phone', 'sign-in'],
    blocks: [
      points('Rules', [
        'Verify the right customer and the right user before any account change.',
        'A password reset and an MFA reset are different actions.',
        'Do not remove licences, block sign-in or delete methods unless the ticket needs it.',
        'If the account may be compromised, stop and escalate as a security incident.',
      ]),
      table('Which action does what', ['Action', 'Effect'], [
        ['Reset password', 'Changes the sign-in secret only. Does not move the authenticator.'],
        ['Require re-registration of MFA', 'The user must set up their methods again at next sign-in.'],
        ['Revoke sessions', 'Signs the user out everywhere so they must authenticate again.'],
        ['Block sign-in', 'Stops all access. A security or leaver action, not a normal reset.'],
      ]),
      steps('Admin-side reset (lost, broken or replaced phone)', [
        'Confirm the request really comes from the user, using your verification process.',
        'Open the identity admin portal, find the user and open their authentication methods.',
        'Review the methods already registered.',
        'Choose to require re-registration. Revoke sessions too if there is any security concern.',
        'Ask the user to sign in and register the authenticator on the new phone.',
        'Confirm they approve a test prompt before closing the ticket.',
      ]),
      steps('Self-service move (old phone still works)', [
        'The user opens their security-info page and signs in.',
        'Choose Add sign-in method and then the authenticator app.',
        'On the new phone, add a work or school account and scan the code shown on the computer.',
        'Approve the test prompt.',
        'Only after the new phone works, remove the old method.',
      ]),
      caution('Treat as a security matter when', [
        'The phone was stolen, or the user did not request the change.',
        'There are unexpected prompts, unfamiliar locations or sign-ins.',
        'It is an administrator account and the action is outside your role.',
        'The user is still locked out after a correct password and MFA reset.',
      ]),
      steps('Locked out? Work down the causes', [
        'Password wrong: reset it and test.',
        'Authentication method missing or old: review methods and require re-registration.',
        'Sign-in blocked: find out why before changing the status.',
        'Licence missing: confirm the expected licence is assigned.',
        'Policy failure: read the sign-in log for the failure reason and escalate policy changes outside your permissions.',
      ]),
      note('Closure note template', 'User unable to complete sign-in after changing phone. Confirmed account active and licensed, reviewed authentication methods, required MFA re-registration and assisted with setup on the new phone. User signed in and approved a test prompt. Customer updated.'),
    ],
  },
  {
    id: 'proc-free-disk-space', set: 'procedures', title: 'Free up disk space on a Windows PC',
    summary: 'Seven safe ways to reclaim space, agreed with the user before anything is deleted.',
    tags: ['disk space', 'storage', 'cleanup', 'storage sense'],
    blocks: [
      points('First', [
        'Open Settings, System, Storage and see what is really using the space.',
        'Agree with the customer before removing programs or choosing what to delete.',
      ]),
      steps('Steps', [
        'Run Disk Cleanup for the system drive, tick temporary files, Recycle Bin and thumbnails, then use "Clean up system files" for a deeper pass.',
        'Review Settings, Apps, Installed apps and remove things the user confirms they do not need. Leave anything system-related.',
        'Use Settings, System, Storage, Temporary files and remove only what you and the customer agree on.',
        'Turn on Storage Sense and set how often it runs and what it cleans.',
        'Empty the Recycle Bin.',
        'Find big files in File Explorer by searching the drive for size:>500MB and review old installers, videos and backups with the owner.',
        'Defragment only on a spinning hard disk. Skip it on an SSD.',
      ]),
      caution('Never', [
        'Delete user files, Windows folders, mail data files or application folders just to make room.',
      ]),
      points('Afterwards', [
        'Recheck free space and note before and after.',
        'If the space fills again quickly, find what is growing (sync folders, downloads, mail cache, backups) instead of repeating the clean-up.',
      ]),
    ],
  },
  {
    id: 'proc-client-discovery', set: 'procedures', title: 'Onboard a new client: discovery checklist',
    summary: 'What to ask and record when taking on a new client, in the order that builds a full picture.',
    tags: ['onboarding', 'discovery', 'audit', 'asset', 'backup', 'documentation'],
    blocks: [
      caution('Keep it safe', [
        'Record findings in your approved system, not here. Never write admin passwords into a document; use the secure vault.',
      ]),
      steps('1. Kick-off call', [
        'What does the business do, who are the key users and departments?',
        'Which applications and systems are business-critical?',
        'Who are the current IT contacts, internal or external?',
        'Biggest IT pain points today?',
        'Which hours matter most, and is there out-of-hours work?',
        'For larger sites: existing network diagrams and inventories?',
        'Any compliance needs (data protection, cyber certification, card payments)?',
      ]),
      points('2. Technical audit', [
        'PCs: number and OS (including tills), email type (cloud, on-site, hybrid), number of mail domains, admin access to the cloud tenant, licence levels, MFA.',
        'Servers: roles, OS, hypervisor, cloud hosting, backup software, schedule and storage, disaster recovery and tested recovery targets.',
        'Security: antivirus or EDR and how it is managed, firewall model and firmware, VPN users and MFA, email protection, where MFA is on, external exposure (public addresses, open ports, published services).',
        'Cloud services: accounting, CRM, HR and other SaaS; domain registrar and DNS host.',
        'Networking: switches and firmware, Wi-Fi access points and security, internet lines and failover, addressing, VLANs, DHCP and DNS servers.',
        'Peripherals: printers and copiers; cameras and door access if IT-managed.',
      ]),
      points('3. Endpoints', [
        'Count and type: desktops, laptops, thin clients, mobiles.',
        'OS versions and patching status.',
        'Whether staff use personal devices, and any device-management tooling.',
      ]),
      points('4. Users and permissions', [
        'Active users and service accounts; how people are added and removed.',
        'Privileged admins, shared mailboxes, distribution groups, external guests.',
      ]),
      points('5. Licences, contracts, support', [
        'Software licences and renewal dates (especially existing Microsoft licences), antivirus and backup.',
        'Hardware warranties and expiry.',
        'Other vendor support agreements and telecoms (phone system, trunks, leased lines).',
      ]),
      points('6. Backups and recovery', [
        'What is backed up, where, retention, encryption.',
        'Date of the last tested restore, and whether a recovery plan is written and tested.',
      ]),
      steps('7. Documentation and handover', [
        'Draw or update the network diagram.',
        'Build the asset inventory (serials, purchase dates, locations).',
        'Store credentials only in the secure vault.',
        'Record vendor and warranty details and write quick-start runbooks for common jobs.',
        'Deliver: an audit summary, a risk register (legacy systems, unsupported OS, gaps), a recommendations roadmap, and the runbook and vault handover.',
      ]),
    ],
  },
  {
    id: 'proc-remote-network-change', set: 'procedures', title: 'Change network settings safely while connected remotely',
    summary: 'How not to cut off your own access, and what needs approval first.',
    tags: ['network', 'remote', 'ip', 'dns', 'static', 'safe change'],
    blocks: [
      steps('Before you change anything', [
        'Work out which adapter and session you are connected through.',
        'Capture the existing settings (for example with ipconfig /all) and save them in the ticket.',
        'Have a way back in: the user on the phone or on site, or an out-of-band route.',
        'If losing access is a realistic risk, get the user ready or escalate first.',
      ]),
      caution('Do not do casually while remote', [
        'Disable or reset the active adapter, or run a full network reset.',
        'Release the only DHCP lease.',
        'Change the gateway or DNS servers as a guess.',
        'Assign a static address because it looks right.',
        'Remove VPN keys, routes or security settings to get a tunnel up.',
      ]),
      caution('Never without approval', [
        'Rebooting a router, firewall, switch or access point.',
        'Exposing a service to the internet or adding port forwarding.',
      ]),
      points('Choosing the addressing method', [
        'Dynamic (DHCP): normal for user PCs.',
        'Reservation: the server always gives the same address; safer than hard-coding many devices.',
        'Static: for devices that must keep a known address; a wrong value can break connectivity or cause conflicts.',
      ]),
      steps('Afterwards', [
        'Retest the original service.',
        'Record exactly what changed so it can be reversed.',
      ]),
    ],
  },
];

export const LIBRARY: LibGuide[] = [
  {
    id: 'lib-network-basics', set: 'library', title: 'Networking fundamentals in plain English',
    summary: 'Equipment, addressing, core services and a troubleshooting method, in the order you need them.',
    tags: ['networking', 'osi', 'subnet', 'dhcp', 'dns', 'arp', 'nat', 'vlan', 'wifi'],
    blocks: [
      points('The picture', [
        'A network lets devices share data and services. LAN is local, WLAN is a LAN over Wi-Fi, WAN joins sites, the internet is networks of networks.',
        'A client asks for a service; a server provides it. Most offices use a star layout: devices to a switch or access point, then a router or firewall out to the internet.',
      ]),
      table('Equipment', ['Device', 'Job'], [
        ['Switch', 'Connects devices on the same local network using hardware addresses'],
        ['Router', 'Moves traffic between different networks'],
        ['Firewall', 'Allows or blocks traffic by rule'],
        ['Access point', 'Provides Wi-Fi to the wired network'],
        ['Modem or ONT', 'Ends the provider line'],
        ['PoE', 'Power delivered over the network cable'],
      ]),
      points('Layers as a fault-finding map', [
        'Physical: is there a link? Data link: can the local network see the device? Network: right address and gateway, can it route? Transport and above: is the port, service or app working?',
      ]),
      points('Addressing', [
        'An IPv4 address is four numbers from 0 to 255. The subnet mask says which part is the network. A /24 mask is 255.255.255.0.',
        'The default gateway is the router used for anything outside the local subnet.',
        'Private ranges: 10.x.x.x, 172.16.x.x to 172.31.x.x, 192.168.x.x. Loopback (127.x.x.x) is the PC itself. 169.254.x.x means Windows gave itself an address because DHCP did not answer.',
        'Two devices with the same address cause conflicts.',
        'IPv6 uses longer hexadecimal addresses; fe80:: is link-local and ::1 is loopback.',
      ]),
      points('Local delivery', [
        'A MAC address identifies a network adapter on the local network. ARP finds the MAC that goes with an IP address. For outside destinations the PC asks for the gateway\'s MAC.',
      ]),
      points('DHCP and DNS', [
        'DHCP hands out address, mask, gateway and DNS. The exchange is Discover, Offer, Request, Acknowledge.',
        'DNS turns names into addresses. Record types: A (IPv4), AAAA (IPv6), CNAME (alias), MX (mail), TXT (verification and mail security).',
        'If an IP address works but the name does not, suspect DNS.',
      ]),
      points('Routing, NAT, VLANs, VPN', [
        'Routing moves packets between networks, with a default route for everything else.',
        'NAT lets many private devices share one public address.',
        'A VLAN is a separate logical network on the same hardware; crossing VLANs needs routing.',
        'A VPN is an encrypted link that can add routes and change the path traffic takes.',
      ]),
      points('Wi-Fi', [
        '2.4 GHz reaches further and passes walls better but is busier. 5 GHz is faster with more channels but shorter range.',
        'Being joined to Wi-Fi does not mean the internet works. Check signal, address, gateway and DNS separately.',
      ]),
      points('Security basics', [
        'Authentication proves who you are; authorisation decides what you may do; encryption protects data in transit.',
        'Least privilege: only the access the task needs. Open ports and remote-access tools add risk, so verify before installing or exposing anything.',
      ]),
      steps('Troubleshooting method', [
        'Define the symptom precisely.',
        'Work out the scope: one app, device, user, site, or everyone.',
        'Check the basics: power, link, cable, Wi-Fi, airplane mode, VPN, recent changes.',
        'Inspect configuration: address, mask, gateway, DHCP, DNS, routes.',
        'Test in layers: this PC, the gateway, a public address, a name, then the service.',
        'Compare against a known-good device, port, cable or account.',
        'Make one change with a way back.',
        'Verify and document.',
      ]),
      table('Windows network commands', ['Command', 'Tells you'], [
        ['ipconfig /all', 'Adapter addresses, DHCP, gateway, DNS, hardware address'],
        ['ping <target>', 'Reachability and delay, if the target answers ping'],
        ['tracert <target>', 'The path of hops'],
        ['nslookup <name>', 'What DNS answers'],
        ['getmac', 'Adapter hardware addresses'],
        ['arp -a', 'Learned IP-to-MAC pairs'],
        ['route print', 'The routing table'],
        ['netstat -ano', 'Connections, ports and owning process IDs'],
        ['ipconfig /displaydns', 'The local DNS cache'],
      ]),
      caution('Remember', ['A failed ping proves little; firewalls often block it. Use several tests together.']),
    ],
  },
  {
    id: 'lib-ports', set: 'library', title: 'Common ports and what they are for',
    summary: 'The ports worth knowing by heart in first-line support.',
    tags: ['ports', 'tcp', 'udp', 'protocols', 'firewall'],
    blocks: [
      points('First', [
        'A port is a logical door on a device, not a physical socket. TCP is reliable and ordered; UDP is lighter and used for real-time or simple request and reply.',
      ]),
      table('Port list', ['Port', 'Used for'], [
        ['21 (TCP)', 'File transfer (legacy, not secure by itself)'],
        ['22 (TCP)', 'Secure remote shell'],
        ['25 (TCP)', 'Mail transfer between servers'],
        ['53 (UDP and TCP)', 'DNS'],
        ['67 and 68 (UDP)', 'DHCP server and client'],
        ['80 (TCP)', 'Web, unencrypted'],
        ['123 (UDP)', 'Time sync'],
        ['443 (TCP)', 'Web, encrypted (HTTPS)'],
        ['445 (TCP)', 'Windows file and printer sharing'],
        ['587 (TCP)', 'Authenticated mail submission'],
        ['993 (TCP)', 'Encrypted mailbox access'],
        ['3389 (TCP)', 'Remote Desktop'],
        ['9100 (TCP)', 'Raw printing to many network printers'],
      ]),
    ],
  },
  {
    id: 'lib-copier-process', set: 'library', title: 'How a digital copier or MFP makes a copy',
    summary: 'The seven stages from original to output, so you can tell which stage a fault belongs to.',
    tags: ['copier', 'mfp', 'drum', 'toner', 'fusing', 'scan', 'image quality'],
    blocks: [
      points('The idea', [
        'A multifunction machine is a scanner plus a laser printer with a controller between them. That gives scan, print, copy and fax.',
        'Sequence: scan, process, charge, write, develop, transfer, fuse.',
      ]),
      steps('The stages', [
        'Scan: a lamp lights the original, a lens or contact sensor turns reflected light into voltages, and these become digital values. Shading correction compensates for sensor and lamp differences.',
        'Process: the image is cleaned and adjusted for text, photo, enlarge, reduce and rotation. Grayscale keeps shades; binary keeps black or white only. Patterns clashing can cause moire.',
        'Charge: the photoconductor drum gets an even electrical charge in the dark.',
        'Write: a laser, swept by a spinning mirror, discharges the areas that make the image, leaving an invisible pattern.',
        'Develop: charged toner is attracted to the discharged areas. Two-part developer uses carrier beads to charge the toner; the ratio must stay in range.',
        'Transfer: the paper is charged so it pulls the toner off the drum, then it is separated from the drum.',
        'Fuse: heat and pressure melt the toner into the paper. A thermistor watches temperature and a thermal fuse guards against overheating.',
      ]),
      points('Process control', [
        'The machine measures its own drum, developer and toner as they age and as temperature and humidity change, adjusting charge, laser power, bias and toner supply to keep density steady.',
        'A sensor on the drum or in the developer tells it whether to add more or less toner.',
      ]),
      table('Link a symptom to a stage', ['Symptom pattern', 'Think about'], [
        ['Whole page blank or pale', 'Transfer, developer, toner supply, laser path'],
        ['Repeating mark down the page', 'A roller or drum with a damaged surface (the spacing hints which part)'],
        ['Toner rubs off', 'Fusing temperature, paper type, pressure'],
        ['Dark background', 'Charge, bias, developer condition'],
        ['Scanned copy odd but prints fine', 'The scan side: glass, sensor, shading, processing'],
        ['Moire or patterned areas', 'Image processing mode or screen settings'],
      ]),
      note('Habit', 'Decide first whether the fault is an image problem (follow the stages above) or a paper problem (see the paper path guide). Confirm in the machine\'s service documentation before replacing anything.'),
    ],
  },
  {
    id: 'lib-copier-paper-path', set: 'library', title: 'Copier paper path, feeding and jams',
    summary: 'How paper is picked, separated, timed, duplexed and detected, to narrow down feed faults.',
    tags: ['paper path', 'jam', 'feed', 'duplex', 'registration', 'sensors'],
    blocks: [
      points('Paper basics', [
        'ISO sizes: A3 is 297 x 420 mm, twice an A4 sheet. Weight is in grams per square metre. Grain direction and humidity cause curl, which causes jams and poor separation.',
      ]),
      table('Separation methods', ['Method', 'How it stops double feeds'], [
        ['Feed and reverse roller', 'A reverse roller pushes extra sheets back'],
        ['Friction pad', 'A pad resists the second sheet'],
        ['Corner separators', 'The top sheet bows past the corners and the rest stay held'],
      ]),
      points('Paper sources', [
        'Trays are the main supply. The bypass tray handles odd sizes and thick or stiff media. A large-capacity tray is usually an option.',
        'Size detection uses a dial, end plates or switches. Custom sizes often must be entered in the settings menu.',
        'Paper-end uses a feeler or an optical sensor.',
      ]),
      points('Registration, transport and duplex', [
        'Registration corrects timing and skew before the paper meets the image. Transport uses rollers or belts, sometimes with vacuum fans.',
        'Modern duplex keeps sheets flowing while the controller picks the right stored image for each side.',
      ]),
      points('How jams are detected', [
        'Sensors along the path report when paper arrives and leaves. Firmware compares timing and flags a sensor that never switched on, or stayed on too long. Several sensors help point to the section.',
      ]),
      steps('Fault sequence for paper problems', [
        'Tray and pick-up.',
        'Feed and separation.',
        'Registration.',
        'Transport and duplex.',
        'Fusing.',
        'Exit.',
      ]),
    ],
  },
  {
    id: 'lib-service-docs', set: 'library', title: 'Printer service documents, maintenance codes and firmware',
    summary: 'Which document answers which question, and how firmware updates generally work.',
    tags: ['service manual', 'parts', 'firmware', 'maintenance', 'sc code'],
    blocks: [
      table('Which document', ['Document', 'Use it for'], [
        ['Service manual', 'Installation, maintenance, replacement, adjustments, troubleshooting. The authority for machine-specific work.'],
        ['Parts catalogue', 'Exact part numbers; check variants such as voltage'],
        ['Operating instructions', 'What the customer is told; often useful for settings'],
        ['Technical bulletins and tips', 'Field notices and known issues'],
        ['Special tools list', 'Tools, lubricants, test charts'],
      ]),
      points('Maintenance table codes', ['C clean, R replace, L lubricate, I inspect.']),
      points('Firmware in general', [
        'Modern machines are small computers; firmware gives copy, print, scan, security and network features.',
        'Updates arrive by memory card or over the network through the machine\'s own web page.',
        'Customised firmware may carry special features, so check before upgrading.',
      ]),
      steps('Update checklist', [
        'Get the file only from the approved source for that exact model.',
        'Read the release notes and check any customisation.',
        'Make sure the machine is idle and power is stable.',
        'Start the update and never switch the machine off during transfer or write.',
        'If an error appears, use the error table before retrying.',
        'Afterwards verify the version and test copy, print and scan.',
      ]),
      caution('Safety', [
        'An over-temperature fault can raise a service call code. Correct the cause first, then clear the code in the service menu as the manual describes.',
        'Do not rely on remembered default logins. Check the machine\'s current configuration.',
      ]),
    ],
  },
  {
    id: 'lib-windows-evidence', set: 'library', title: 'Windows evidence: what each tool tells you',
    summary: 'Where to look first for each kind of fault, and what not to conclude from it.',
    tags: ['task manager', 'event viewer', 'device manager', 'sfc', 'dism', 'safe mode', 'evidence'],
    blocks: [
      table('Tool to question', ['Tool', 'Answers'], [
        ['Task Manager', 'What is using CPU, memory, disk or network right now, and how long the PC has been up'],
        ['Event Viewer', 'What was logged around the time of the fault (source, event ID, time)'],
        ['Device Manager', 'Which hardware shows an error, and its status code'],
        ['Settings, Windows Update', 'Pending, failed or restart-needed updates and error codes'],
        ['Storage settings', 'How full the system drive is and why'],
        ['Safe Mode', 'Whether the fault survives with minimal drivers and services'],
      ]),
      points('Reading it sensibly', [
        'A brief spike is normal; sustained use while the user is slow is evidence. Sort by the column you care about while the problem is happening.',
        'High memory use alone does not prove bad RAM. Check what is using it and whether it persists after a restart.',
        'In Event Viewer match times to the fault. One red entry may be a result, not the cause. Look for patterns.',
        'A yellow warning in Device Manager is evidence. "It probably needs a driver" is a guess; record the status first.',
      ]),
      points('System file tools', [
        'sfc /scannow checks protected files. Use it when corruption is plausible, record the final result, and escalate if it cannot repair. DISM repairs the component store and follows your approved process.',
        'Neither is a general speed-up.',
      ]),
      caution('Before a rebuild', [
        'Confirm backups and where the user\'s data really lives, licences, required apps, printers, VPNs and any local-only files. Get approval and never assume cloud sync holds everything.',
      ]),
    ],
  },
];

export const ALL_GUIDES: LibGuide[] = [...PROCEDURES, ...LIBRARY];
export const guideById = (id: string): LibGuide | undefined => ALL_GUIDES.find((g) => g.id === id);

/** Plain text of a guide, for copying or search. */
export function guideText(g: LibGuide): string {
  const out: string[] = [g.title, '', g.summary];
  for (const b of g.blocks) {
    out.push('', b.title.toUpperCase());
    if (b.kind === 'steps') b.items.forEach((s, i) => out.push(`${i + 1}. ${s}`));
    else if (b.kind === 'table') b.rows.forEach(([a, c]) => out.push(`- ${a} - ${c}`));
    else if (b.kind === 'note') out.push(b.text);
    else b.items.forEach((s) => out.push(`- ${s}`));
  }
  return out.join('\n');
}
