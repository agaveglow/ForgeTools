/**
 * How to complete and monitor the recurring checks. General good practice for IT service work, written as
 * a starting point: adapt each one to your own policies and procedures. Nothing here names a customer, and
 * commands use placeholders. Run commands only on systems you are authorised to check.
 */
export type CheckFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface CheckStep { text: string; command?: string }
export interface CheckGuide {
  id: string;
  frequency: CheckFrequency;
  title: string;
  /** Matches the task title it belongs to. */
  match: RegExp;
  /** The task wording used when this check is added to the task list. Defaults to the title. */
  task?: string;
  summary: string;
  before: string[];
  steps: CheckStep[];
  monitor: string[];
  evidence: string[];
  cautions: string[];
}

const CORE_GUIDES: CheckGuide[] = [
  {
    id: 'ca-review', frequency: 'monthly', title: 'Review conditional access rules', match: /conditional access rules/i,
    task: 'Security check: ensure MFA is enforced, review conditional access rules',
    summary: 'Confirm the sign-in rules still protect accounts the way the security policy says, with no gaps and no surprises.',
    before: ['Read-only access to the Microsoft Entra admin center (Security Reader or similar).', 'Last review’s notes and the written security policy.', 'The list of emergency (break-glass) accounts.'],
    steps: [
      { text: 'Open Microsoft Entra admin center, Protection, Conditional Access, Policies. Note each policy’s name, state (On, Report-only or Off), who it targets and what it requires.' },
      { text: 'Check every policy that is Off or Report-only. Decide to enable, fix or remove it, and write down why.' },
      { text: 'Confirm the emergency accounts are excluded from the policies, and that a policy requires MFA for admins and for all users.' },
      { text: 'Look for gaps: legacy authentication blocked, risky sign-ins handled, device compliance required where policy says so, guest users covered.' },
      { text: 'Use the What If tool with a typical user, a guest and an admin to confirm which policies apply to each.' },
      { text: 'Open Monitoring, Sign-in logs. Filter on Conditional Access result of Failure and Not applied. Investigate failures you did not expect and sign-ins no policy covered.' },
      { text: 'Compare with last review and the written policy. List what changed and why.' },
      { text: 'Record the outcome. Raise any change through your change process instead of editing policies straight away.' },
    ],
    monitor: ['Audit logs for policy changes between reviews (who changed what).', 'Sign-in failures by policy: a sudden rise can mean a mistake or an attack.', 'Report-only results before turning a policy on.', 'New policies, new exclusions and accounts added to exclusions.'],
    evidence: ['Date reviewed and by whom.', 'Policy count by state (On, Report-only, Off).', 'Gaps found and the change raised for each.'],
    cautions: ['Never change a policy without approval: a wrong rule can lock everyone out, admins included.', 'Test new rules in Report-only first.', 'Keep at least one emergency account excluded and tested.'],
  },
  {
    id: 'dr-tabletop', frequency: 'monthly', title: 'Test DR plan: tabletop exercise or partial failover', match: /test dr plan/i,
    task: 'Test DR plan: run tabletop exercise or partial failover test',
    summary: 'Prove the disaster recovery plan works, either by talking through a scenario or by recovering one non-critical system.',
    before: ['The current DR plan, contact list and recovery targets (how long recovery may take, how much data may be lost).', 'Agreement on the scenario and the time slot.', 'For a partial failover: approval and a way to isolate what you restore.'],
    steps: [
      { text: 'Pick a realistic scenario, for example ransomware on a file server or loss of a site, and decide: tabletop or partial failover.' },
      { text: 'Tabletop: walk the plan step by step with the people involved. For each step ask who does it, with what, and where the instructions are.' },
      { text: 'Partial failover: restore one non-critical system, or fail one service over, in an agreed window and isolated from live systems.' },
      { text: 'Time each stage and note anything that was missing, out of date or unclear.' },
      { text: 'Compare the times with the recovery targets in the plan.' },
      { text: 'Write the gaps as actions with an owner and a date. Update the plan.' },
      { text: 'Share a short summary with the people who need it.' },
    ],
    monitor: ['Backup job success reports leading up to the test.', 'Actions from the last test: closed or still open.', 'Time taken against the recovery targets, trending over months.'],
    evidence: ['Scenario and type of test.', 'Stage times and the result.', 'Actions raised and plan version updated.'],
    cautions: ['Never restore a copy onto the live network: duplicate addresses and directory conflicts cause outages.', 'Agree a rollback and a stop point before you start.'],
  },
  {
    id: 'vendor-portals', frequency: 'monthly', title: 'Review vendor portals: warranty status and firmware updates', match: /vendor portals/i,
    task: 'Review vendor portals: warranty status, firmware updates for switches, firewalls, etc',
    summary: 'Catch expiring warranties and important firmware or security notices before they become a problem.',
    before: ['A list of vendor portals and your access to each.', 'The asset list: models, serial references held in your own records, and support end dates.'],
    steps: [
      { text: 'Sign in to each vendor portal in turn (switches, firewalls, wireless, servers, printers and so on).' },
      { text: 'Check warranty and support status for the equipment you look after. Flag anything ending within 90 days.' },
      { text: 'Read new firmware release notes and security advisories for models in use. Note anything rated critical or high.' },
      { text: 'Check for end-of-life or end-of-support notices for models or software versions.' },
      { text: 'Check licence and subscription renewal dates held in the portal.' },
      { text: 'Raise a change or a quote request for anything that needs action, and record what you found.' },
    ],
    monitor: ['Vendor security advisory mailing lists or feeds.', 'Items flagged last month: still open or done.', 'Count of assets with support ending in the next 90 days.'],
    evidence: ['Portals checked and the date.', 'Items flagged and what was raised for each.'],
    cautions: ['Do not apply firmware just because it is available: read the release notes and plan it as a change.', 'Keep portal logins in your password manager, never in notes.'],
  },
  {
    id: 'full-dr-test', frequency: 'quarterly', title: 'Full disaster recovery test', match: /full disaster recovery test/i,
    task: 'Full disaster recovery test: test restoring key systems from backup or failover to DR',
    summary: 'Show that key systems really can be restored from backup or brought up at the DR site, within the agreed times.',
    before: ['Written scope, success criteria and approval for the test window.', 'The DR plan, recovery targets and runbooks.', 'Recent backup reports showing the backups you will use exist and completed.', 'An isolated network to restore into.'],
    steps: [
      { text: 'Agree scope: which key systems, and what success looks like (it starts, data is intact, users can do their job, it took no longer than the target).' },
      { text: 'Confirm the backups or replicas you need exist and are recent. Note the age of the data you will restore.' },
      { text: 'Announce the test window and who is involved. Agree a stop point and a rollback.' },
      { text: 'Restore or fail over the systems into the isolated network, following the runbook exactly as written. Note every deviation.' },
      { text: 'Time each stage. Start the clock when the incident is declared in the scenario, stop when the service is usable.' },
      { text: 'Verify: services start, data opens and looks right, a test user can sign in and complete a normal task.' },
      { text: 'Clean up: remove the test copies, restore normal settings, and confirm nothing from the test is reachable from the live network.' },
      { text: 'Write up results against the success criteria, with lessons and actions (owner, date). Update the runbooks.' },
    ],
    monitor: ['Backup success and restore-point age every day or week, not just at test time.', 'Replication health if you fail over to a DR site.', 'Time to recover, trended across tests.', 'Open actions from previous tests.'],
    evidence: ['Systems tested, times achieved against targets.', 'Pass or fail for each success criterion.', 'Actions raised and plan version updated.'],
    cautions: ['An untested backup is only a hope: test restores, not just backup jobs.', 'Keep restored systems isolated until verified and then removed.', 'Do not run it without written approval for the window.'],
  },
  {
    id: 'vuln-assessment', frequency: 'quarterly', title: 'Vulnerability assessment or penetration test', match: /vulnerability assessment/i,
    task: 'Vulnerability assessment / penetration test (internal or external)',
    summary: 'Find known weaknesses before someone else does, rank them, and track each one to a fix.',
    before: ['Written authorisation naming what may be scanned and when.', 'An approved scanner and, for an internal scan, an account for it to use.', 'An asset list so you know what should and should not appear.'],
    steps: [
      { text: 'Agree scope and the time window in writing. Tell the people who watch alerts.' },
      { text: 'Run the internal scan from inside the network with an authenticated (credentialed) scan where possible: results are more accurate.' },
      { text: 'Run the external scan against the public addresses you are authorised to test.' },
      { text: 'Compare what was found with your asset list. Investigate devices you did not expect.' },
      { text: 'Triage: remove false positives, then rank by severity and by exposure (internet-facing first).' },
      { text: 'Turn findings into actions with an owner and a date, for example patch, change a setting, or accept the risk with sign-off.' },
      { text: 'Fix the critical and high items, then rescan to confirm they are closed.' },
      { text: 'Write a short report: scope, method, counts by severity, what was fixed, what remains and why.' },
    ],
    monitor: ['Count of critical and high findings over time.', 'Age of open findings against your target fix times.', 'Vendor advisories between scans for anything affecting your estate.', 'Findings that reappear after being fixed.'],
    evidence: ['Authorisation reference and scan dates.', 'Findings by severity before and after.', 'Actions and sign-offs for accepted risks.'],
    cautions: ['Only scan what you are authorised to scan.', 'Older printers, controllers and other embedded devices can crash under aggressive scans: use gentle settings and a quiet window.', 'Treat the results as sensitive and share them only with those who need them.'],
  },
  {
    id: 'firmware-quarterly', frequency: 'quarterly', title: 'Review and apply firmware updates', match: /firmware updates: servers/i,
    task: 'Review and apply firmware updates: servers, switches, firewalls, wireless APs',
    summary: 'Keep servers, switches, firewalls and wireless access points on supported, patched firmware without causing an outage.',
    before: ['Current firmware versions for each device.', 'Vendor release notes and advisories.', 'A change record and an agreed maintenance window.', 'A current configuration backup for each device.'],
    steps: [
      { text: 'List each device with its model and current firmware version.' },
      { text: 'Check the vendor’s recommended release for each. Read the release notes for fixes, known issues and any required upgrade path.' },
      { text: 'Prioritise: security fixes on internet-facing devices first, then stability fixes, then features.' },
      { text: 'Back up the configuration and note the rollback method before touching anything.' },
      { text: 'Schedule the work as a change with a window, a test and a rollback plan. Tell the people affected.' },
      { text: 'Update one device at a time. For pairs, update the standby first, check, then the other. Start with the least critical.' },
      { text: 'After each update confirm it came back, the version is correct, links and services work, and logs are clean.' },
      { text: 'Record the new versions and the date. Raise anything that failed or was deferred, with the reason.' },
    ],
    monitor: ['Vendor security advisories for the models you run.', 'Devices more than one major release behind.', 'Support end dates for the firmware line.', 'Logs and alerts for a week after each change.'],
    evidence: ['Before and after versions.', 'Change reference and window.', 'Test results and any rollback.'],
    cautions: ['Never interrupt power or connectivity during an update.', 'Do not skip required intermediate versions.', 'Do not update everything at once: you need something working to fall back on.', 'Printers and copiers have their own vendor firmware routes: handle them as separate changes.'],
  },
  {
    id: 'capacity-review', frequency: 'quarterly', title: 'Capacity planning and performance review', match: /capacity planning/i,
    task: 'Capacity planning & performance review: recommend upgrades if needed',
    summary: 'Spot the resources that will run out before they do, and recommend upgrades with evidence.',
    before: ['Monitoring or reporting that holds at least the last 90 days of usage.', 'Thresholds from your policy or the client’s agreement.', 'Any planned growth: new staff, new sites, new systems.'],
    steps: [
      { text: 'Gather the last 90 days of CPU, memory, disk space, network bandwidth and licence usage for the key systems.' },
      { text: 'Look at peaks and sustained levels, not just averages. Note anything above your threshold for long periods.', command: "Get-Counter '\\Processor(_Total)\\% Processor Time','\\Memory\\Available MBytes' -SampleInterval 5 -MaxSamples 12" },
      { text: 'Check free disk space and how fast it is shrinking.', command: 'Get-Volume | Select-Object DriveLetter, SizeRemaining, Size' },
      { text: 'Check internet and WAN link use against capacity, and wireless density where users complain.' },
      { text: 'Project growth forward 6 to 12 months using the trend and any planned change.' },
      { text: 'List what will run short and when. For each, give an option (tune, add, replace) with a rough cost and the risk of doing nothing.' },
      { text: 'Record the findings and recommendations for the business review.' },
    ],
    monitor: ['Disk free space with an alert well before it is full.', 'Sustained CPU or memory use above your threshold.', 'Bandwidth peaks and packet loss.', 'Licence counts against purchased numbers.'],
    evidence: ['Metrics used and the period.', 'Systems at risk with the date they are expected to run short.', 'Recommendations made.'],
    cautions: ['Short peaks are not always a problem: judge by how long and how often.', 'Read counters on production systems gently: do not run heavy tools in business hours.'],
  },
  {
    id: 'security-policy-review', frequency: 'quarterly', title: 'Security policy review', match: /security policy review/i,
    task: 'Security policy review: password policy, conditional access, device management',
    summary: 'Check that the written rules for passwords, sign-in and devices match what is actually enforced.',
    before: ['The written security policy.', 'Read access to identity and device management settings.', 'Any standard you work to (for example Cyber Essentials) and its current requirements.'],
    steps: [
      { text: 'Password policy: compare the enforced length, lockout and expiry settings with the policy and current guidance (long passphrases and MFA over frequent forced changes).' },
      { text: 'Check MFA is required for admins and for all users, and that old or weaker methods are being retired.' },
      { text: 'Conditional access: review the rules as in the monthly check, then compare them with the policy wording.' },
      { text: 'Device management: confirm devices are enrolled, encrypted, patched and compliant, and that unmanaged devices are limited.' },
      { text: 'Check how leavers, joiners and lost devices are handled in practice, against the written process.' },
      { text: 'List differences between policy and reality. For each decide: change the setting, change the policy, or accept with sign-off.' },
      { text: 'Update the policy version and record the review date and next review.' },
    ],
    monitor: ['Accounts without MFA.', 'Non-compliant or unenrolled devices.', 'Policy exceptions: how many, how old, who approved.', 'Changes in guidance from the standard you work to.'],
    evidence: ['Settings compared and the result for each.', 'Exceptions and approvals.', 'Policy version and review date.'],
    cautions: ['Change enforced settings through the change process, not during the review.', 'Do not weaken a control to fix a complaint without recording the risk and approval.'],
  },
  {
    id: 'external-exposure', frequency: 'quarterly', title: 'Review external exposure', match: /external exposure/i,
    task: 'Review external exposure: public DNS, SSL certificate expirations, open ports',
    summary: 'See what the internet can see: DNS records, certificate expiry dates and open ports, and remove what should not be there.',
    before: ['The list of public domains and public IP addresses you are authorised to check.', 'The list of services that are meant to be reachable from outside.'],
    steps: [
      { text: 'DNS: list every public record. Look for records that point to things that no longer exist, test or forgotten systems, and anything unexpected.' },
      { text: 'Check mail records are in place: SPF, DKIM and DMARC.', command: 'nslookup -type=TXT _dmarc.example.com' },
      { text: 'Certificates: check the expiry date of each public certificate and that renewal is automatic or booked.', command: 'openssl s_client -connect host.example.com:443 -servername host.example.com </dev/null 2>/dev/null | openssl x509 -noout -enddate' },
      { text: 'Open ports: scan only the public addresses you are authorised to test, and compare the result with the list of services meant to be reachable.', command: 'nmap -sT -p 1-1024 <authorised-public-address>' },
      { text: 'Remove or restrict anything unexpected: unused port forwards, remote access open to the world, old test services.' },
      { text: 'Record what changed. Raise a change for removals.' },
    ],
    monitor: ['Certificate expiry alerts at 30 and 14 days.', 'Changes in open ports between checks.', 'New or changed DNS records.', 'Remote access logins from unusual places.'],
    evidence: ['Domains and addresses checked.', 'Expiry dates found.', 'Ports open versus expected, and what was closed.'],
    cautions: ['Only scan addresses you are authorised to test.', 'Do not remove a DNS record or close a port without checking what depends on it.', 'Replace the example names above with the real ones.'],
  },
  {
    id: 'permissions-audit', frequency: 'quarterly', title: 'User permissions audit', match: /user permissions audit/i,
    task: 'User permissions audit: validate access based on least privilege',
    summary: 'Make sure people have the access their job needs and no more.',
    before: ['Read access to the directory, groups and shared resources.', 'A way to confirm roles with managers (a list of job roles or a manager contact).'],
    steps: [
      { text: 'List the privileged groups and roles first: administrators, directory admins, global admins.', command: 'Get-ADGroupMember "Domain Admins" -Recursive | Select-Object Name, SamAccountName' },
      { text: 'For each privileged account confirm there is a current need and that the person has a separate admin account where policy says so.' },
      { text: 'Review membership of groups that give access to sensitive shares, mailboxes and systems.' },
      { text: 'Check shared mailboxes, shared folders and delegated access for people who no longer need them.' },
      { text: 'Compare against role needs. Ask managers to confirm any access that looks too wide.' },
      { text: 'Remove or reduce access that is not needed. Record each change and who approved it.' },
      { text: 'Record the result and the date of the next audit.' },
    ],
    monitor: ['Changes to privileged groups (alert on every change).', 'Number of admin accounts over time.', 'Access requests that are never removed.', 'Accounts with access but no recent sign-in.'],
    evidence: ['Groups and roles reviewed.', 'Access removed and approvals.', 'Exceptions kept and why.'],
    cautions: ['Least privilege means asking, not guessing: confirm before removing access people may depend on.', 'Do not store lists of named users in this app: record counts and outcomes.'],
  },
  {
    id: 'inactive-cleanup', frequency: 'quarterly', title: 'Review and clean up inactive devices and accounts', match: /inactive devices/i,
    task: 'Review and clean up inactive devices / accounts',
    summary: 'Remove the unused accounts and devices that attackers like best, safely and in stages.',
    before: ['The inactivity period in your policy (commonly 60 to 90 days).', 'A leavers list or a way to check with the business.', 'Approval for disabling and deleting.'],
    steps: [
      { text: 'List accounts with no sign-in for the policy period.', command: 'Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select-Object Name, LastLogonDate, Enabled' },
      { text: 'List devices that have not checked in or logged on for the same period.', command: 'Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -ComputersOnly | Select-Object Name, LastLogonDate, Enabled' },
      { text: 'Check device management and cloud consoles too: devices and users that have not signed in recently.' },
      { text: 'Cross-check with the business: leavers, long-term leave, service accounts, shared or seasonal accounts. Do not touch service accounts without finding out what uses them.' },
      { text: 'Disable what is confirmed unused. Do not delete yet. Record the date.' },
      { text: 'After the waiting period in your policy (for example 30 days) with no complaints, delete or retire them and reclaim licences.' },
      { text: 'Record counts disabled and deleted.' },
    ],
    monitor: ['Count of inactive accounts and devices each quarter: it should fall.', 'Leavers whose accounts were still active after their last day.', 'Licences in use against needed.'],
    evidence: ['Counts found, disabled and deleted.', 'Approvals and dates.'],
    cautions: ['Disable before you delete, so a mistake can be undone.', 'Last-logon dates can be out of date in some setups: confirm with a second source.', 'Do not keep names of leavers in this app.'],
  },
  {
    id: 'qbr', frequency: 'quarterly', title: 'Quarterly business review with the client', match: /quarterly business review|QBR/i,
    task: 'Quarterly business review (QBR) with client: report on health, risks, recommendations',
    summary: 'Show the client how their IT is doing, what the risks are, and what you recommend.',
    before: ['The last review’s actions.', 'Reports: service performance, backups, patching, security, assets and projects.', 'The capacity and risk findings from the other quarterly checks.'],
    steps: [
      { text: 'Gather the figures: tickets by priority and response against the agreed times, uptime, backup success, patch compliance, security events, assets near end of support.' },
      { text: 'Close out the actions from last time: done, in progress or dropped, with reasons.' },
      { text: 'List the main risks in plain language: what could happen, how likely, what it would cost the business.' },
      { text: 'Write recommendations with an option, a rough cost and the benefit for each. Put the most important first.' },
      { text: 'Build a short agenda: health, risks, recommendations, upcoming projects, anything the client wants to raise.' },
      { text: 'Hold the review. Agree actions with an owner and a date before the meeting ends.' },
      { text: 'Send a short summary of what was agreed and track the actions to the next review.' },
    ],
    monitor: ['Response and update times against the priority table.', 'Open actions from previous reviews.', 'Trend of tickets by category: repeat problems point to a fix.', 'Risks raised before that were not acted on.'],
    evidence: ['Review date and the figures presented.', 'Actions agreed.'],
    cautions: ['Keep client names and details in your own business systems, not in this app.', 'Present facts and options. Do not promise work or costs that have not been agreed.'],
  },
];

import { ROUTINE_GUIDES } from './checkGuidesRoutine';

export const CHECK_GUIDES: CheckGuide[] = [...ROUTINE_GUIDES.filter((g) => g.frequency === 'daily'), ...ROUTINE_GUIDES.filter((g) => g.frequency === 'weekly'), ...CORE_GUIDES.filter((g) => g.frequency === 'monthly'), ...ROUTINE_GUIDES.filter((g) => g.frequency === 'monthly'), ...CORE_GUIDES.filter((g) => g.frequency === 'quarterly'), ...ROUTINE_GUIDES.filter((g) => g.frequency === 'quarterly')];

export const CHECK_GUIDE_BY_ID: Record<string, CheckGuide> = Object.fromEntries(CHECK_GUIDES.map((g) => [g.id, g]));

/** The guide for a task, matched by its title. */
export const guideForTitle = (title: string): CheckGuide | undefined => CHECK_GUIDES.find((g) => g.match.test(title));
