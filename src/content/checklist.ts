import type { ChecklistTemplate } from './types';

/**
 * Security / device-integrity maintenance checklist.
 * Every item can be set to Not checked / Passed / Failed / Not applicable, with a note.
 * ForgeTools cannot inspect a device: each item says how YOU check it and what a pass looks like.
 */
export const SECURITY_CHECKLIST: ChecklistTemplate = {
  id: 'security-maintenance-v1',
  title: 'Device security and integrity check',
  description:
    'Work through each item on the device yourself and record the result. ForgeTools does not connect to the device — it guides and records.',
  sections: [
    {
      id: 'pre-remote',
      title: 'Pre-remote access',
      intro: 'Before touching a device remotely. Do not proceed if any of these fail.',
      items: [
        { id: 'informed', title: 'User or contact has been informed', how: 'Tell the user who you are, why you are connecting and roughly how long it will take.', passWhen: 'Contact knows and has agreed to the session.' },
        { id: 'authorised', title: 'Authorisation confirmed', how: 'Check the ticket or client record shows you are authorised to access this device or account.', passWhen: 'Authorisation is documented on the ticket or in the client record.' },
        { id: 'device', title: 'Correct device confirmed', how: 'Confirm hostname or asset tag with the user, and that it matches the ticket (run `hostname` or check the asset label).', passWhen: 'Hostname/asset tag matches the ticket.' },
        { id: 'ticket', title: 'Ticket or reference exists', how: 'Make sure there is a ticket number to record work against.', passWhen: 'A ticket reference is recorded.' },
      ],
    },
    {
      id: 'device-security',
      title: 'Device security',
      items: [
        { id: 'updates', title: 'Windows updates', how: 'Settings > Windows Update, and review update history. Optionally `Get-HotFix`.', passWhen: 'No pending critical or security updates and no repeated failures.', commandIds: ['get-hotfix'] },
        { id: 'defender', title: 'Defender / endpoint protection status', how: 'Windows Security overview and `Get-MpComputerStatus`.', passWhen: 'Protection enabled (or another managed AV active), signatures current, no active threats.', commandIds: ['get-mpcomputerstatus'] },
        { id: 'firewall', title: 'Firewall enabled', how: '`Get-NetFirewallProfile` or Windows Security > Firewall.', passWhen: 'All profiles enabled (or managed by another firewall product).', commandIds: ['get-netfirewallprofile'] },
        { id: 'encryption', title: 'Disk encryption', how: '`manage-bde -status` from an elevated prompt.', passWhen: 'System drive fully encrypted with protection on, and recovery key escrowed.', commandIds: ['manage-bde-status'] },
        { id: 'secureboot', title: 'Secure Boot', how: '`Confirm-SecureBootUEFI` from an elevated PowerShell.', passWhen: 'Returns True.', commandIds: ['confirm-securebootuefi', 'get-tpm'] },
        { id: 'localadmins', title: 'Local administrators', how: '`net localgroup administrators`.', passWhen: 'Only expected accounts or groups are members.', commandIds: ['net-localgroup-administrators', 'get-localgroupmember'] },
        { id: 'suspicious-apps', title: 'Suspicious or unauthorised applications', how: 'Review Settings > Apps > Installed apps for unknown software, remote access tools or toolbars. Avoid Win32_Product queries, which can trigger MSI reconfiguration.', passWhen: 'No unknown or unapproved software.' },
        { id: 'startup', title: 'Startup programs', how: 'Task Manager > Startup apps, or `Get-CimInstance Win32_StartupCommand`.', passWhen: 'Only recognised programs start with Windows.', commandIds: ['get-startup-commands', 'get-scheduledtask'] },
        { id: 'integrity', title: 'Device integrity', how: 'Check for system file corruption indicators: recent crashes in Reliability Monitor, `DISM /Online /Cleanup-Image /CheckHealth`.', passWhen: 'No component store corruption and no unexplained crash pattern.', commandIds: ['dism-checkhealth', 'reliability-monitor'] },
        { id: 'disk', title: 'Disk health and free space', how: '`Get-PhysicalDisk` for health and `Get-Volume` for free space.', passWhen: 'HealthStatus Healthy and comfortable free space on the system drive.', commandIds: ['get-physicaldisk', 'get-volume'] },
      ],
    },
    {
      id: 'network',
      title: 'Network',
      items: [
        { id: 'ip-config', title: 'IP configuration', how: '`ipconfig /all`.', passWhen: 'Valid address on the correct subnet with expected gateway and DNS.', commandIds: ['ipconfig-all'] },
        { id: 'dns', title: 'DNS resolution', how: '`nslookup example.com`.', passWhen: 'Names resolve using the expected DNS servers.', commandIds: ['nslookup'] },
        { id: 'gateway', title: 'Gateway reachable', how: 'Ping the default gateway.', passWhen: 'Replies with low latency and no loss.', commandIds: ['ping'] },
        { id: 'vpn', title: 'VPN (if used)', how: 'Connect the VPN client and test an internal resource.', passWhen: 'Connects and internal resources are reachable. Mark Not applicable if no VPN is used.' },
        { id: 'net-profile', title: 'Network profile', how: 'Settings > Network & internet > properties of the connection.', passWhen: 'Profile type is appropriate (Public for untrusted networks, Private for trusted ones).' },
      ],
    },
    {
      id: 'finalisation',
      title: 'Finalisation',
      items: [
        { id: 'test', title: 'System tested', how: 'Restart if required and check the system starts and the affected function works.', passWhen: 'System starts normally and work done is verified.' },
        { id: 'user-confirm', title: 'User confirms functionality', how: 'Ask the user to confirm their applications and files work as expected.', passWhen: 'User confirms they are happy.' },
        { id: 'document-changes', title: 'Changes documented', how: 'Record what was changed and how to undo it on the ticket or in ForgeTools.', passWhen: 'All changes recorded, with no sensitive data or secrets in the notes.' },
        { id: 'outstanding', title: 'Outstanding issues recorded', how: 'Note anything failed, deferred or needing escalation.', passWhen: 'Outstanding items are listed with an owner or next step.' },
      ],
    },
  ],
};

export const CHECKLISTS: ChecklistTemplate[] = [SECURITY_CHECKLIST];
export const CHECKLIST_BY_ID: Record<string, ChecklistTemplate> = Object.fromEntries(CHECKLISTS.map((c) => [c.id, c]));
