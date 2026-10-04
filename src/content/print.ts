import type { CheckList } from './hardening';

/** Managed print and scan reference. Original, general practice. No make or model specifics. */
export const PRINT_FIRST: Array<[string, string]> = [
  ['One person cannot print, others can', 'That PC: its queue, port and driver, or the application. Compare with a PC that works.'],
  ['Nobody can print', 'The printer itself, its network link, an address change, or the shared print server.'],
  ['Printer web page opens, jobs still do not print', 'The queue, port or driver on the PC. Network reachability is fine.'],
  ['Printer web page does not open', 'Printer power and link lights, its address, the network port, or the wider network.'],
  ['Prints gibberish or the wrong layout', 'Wrong driver for the model. Match the customer standard.'],
  ['Jobs sit in the queue', 'The port points at an old address, or the spooler is stuck.'],
  ['Printing works, scanning fails', 'The scan destination, its sign-in, or the mail connection. Not the print driver.'],
  ['Copying fails as well', 'A device fault or service issue rather than the user PC.'],
  ['Scan-to-folder stopped after a password change', 'The saved scan account sign-in. Strong suspect.'],
  ['Small scans email, large ones fail', 'A message or file size limit in the mail path.'],
  ['Paper jams in one spot, repeatedly', 'Worn rollers or the wrong paper. Escalate for a service visit.'],
];

export const PRINT_PROTOCOLS: Array<[string, string, string]> = [
  ['Raw print, port 9100', 'Direct jobs to the printer by address. What the standard TCP/IP port uses.', 'Printer address changed, firewall blocks it'],
  ['IPP, port 631', 'Internet Printing Protocol. Used by modern systems and mobile printing.', 'Wrong path or certificate warning'],
  ['SMB, port 445', 'Scan to a shared folder. Also shared print queues from a server.', 'Password changed, no write permission, name no longer resolves'],
  ['SMTP, port 587 or 465', 'Scan to email through a mail server or connector.', 'Wrong sign-in, security mode, sender not allowed, wrong clock'],
  ['LDAP, port 389 or 636', 'Looks up an address book of people.', 'Search account locked, wrong base path'],
  ['SNMP, port 161', 'Counters, toner and status for monitoring.', 'Community string changed, blocked between networks'],
  ['HTTPS, port 443', 'The printer\'s own web page.', 'Certificate warning is normal on first visit'],
];

export const PRINT_CHECKS: CheckList[] = [
  { id: 'pr-intake', title: 'Printer or scanner ticket: first minutes', intro: 'Before you touch anything.', items: [
    'Confirm the right site, user and device',
    'Ask whether it is printing, scanning, copying or more than one',
    'Ask whether one user or everyone is affected',
    'Note the exact error from the screen or panel',
    'Ask when it last worked and what changed',
    'Record the printer address from its own panel or status page',
    'Check power, paper, toner and any jam before anything else',
    'Do not reset, change addresses or change admin settings without approval' ] },
  { id: 'pr-add', title: 'Add a network printer by address', intro: 'Follow the customer\'s standard if they have one.', items: [
    'Confirm the printer is online and note its address',
    'If there is a print server, use it instead of a direct address unless agreed',
    'Add a printer using the TCP/IP address option',
    'Use or create a standard TCP/IP port',
    'Install the right driver for the exact model',
    'Name the queue clearly and set it as default only if wanted',
    'Print a Windows test page',
    'Print from the user\'s normal application' ] },
  { id: 'pr-queue', title: 'Stuck queue', intro: 'Smallest change first. Spooler restarts on a server can affect many people.', items: [
    'Look for one job blocking the queue',
    'Cancel the failed job',
    'Print a small test page',
    'Close and reopen the application if only one program is affected',
    'Check the port still points at the printer\'s current address',
    'Restart the spooler on this PC only if the queue is hung',
    'Get approval before restarting the spooler on a print server',
    'Do a real test print after any change' ] },
  { id: 'pr-folder', title: 'Scan to folder will not save', intro: 'Test the destination from another PC first.', items: [
    'Open the folder from another PC using the same path',
    'Check whether the scan account\'s password was changed',
    'Check the saved sign-in includes the right domain or computer name where needed',
    'Check the account can create files in the folder',
    'Check the folder name still resolves, and was not moved to a new server',
    'Read the job log on the printer for the exact error',
    'Check the printer clock is correct',
    'Make the change with the customer\'s approval, then scan a single page to test' ] },
  { id: 'pr-email', title: 'Scan to email will not send', intro: 'Do not weaken security settings to make it work. Escalate those.', items: [
    'Scan one small page first',
    'Find out whether every recipient fails or just one',
    'Check the mail server, port and security mode',
    'Check the sign-in used and whether its password or multi-factor setting changed',
    'Check the sender address is allowed to send',
    'Check the printer clock is correct (certificates depend on it)',
    'If small scans work and large fail, check the size limits',
    'Read the job log for the exact error',
    'Escalate any change to security settings or mail connectors' ] },
  { id: 'pr-close', title: 'Before closing a printer ticket', intro: 'Prove it with the real task.', items: [
    'The user prints or scans the thing they originally needed',
    'Other users of the same device still work',
    'Test page or test scan kept out of the ticket if it has real content',
    'What was found, changed and tested is written in the ticket',
    'Anything left outstanding or escalated is recorded' ] },
];
