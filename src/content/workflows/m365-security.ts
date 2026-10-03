import type { Workflow } from '../types';

export const M365_SECURITY_WORKFLOWS: Workflow[] = [
  // ---------------------------------------------------------------- 1
  {
    id: 'm365-outlook-desktop',
    category: 'Microsoft 365',
    title: 'Outlook desktop problems',
    summary:
      'Outlook for Windows will not start, hangs on Loading profile, shows Disconnected / Trying to connect, fails to send/receive or search, or crashes with an add-in. Isolate client-side from server-side first, then work from least to most invasive.',
    tags: ['outlook', 'profile', 'ost', 'safe mode', 'disconnected', 'search'],
    symptoms: [
      'Outlook will not open, or closes straight away',
      'Stuck on "Loading profile" or the splash screen',
      'Status bar shows "Disconnected" or "Trying to connect…"',
      'Send/receive errors, or messages stuck in the Outbox',
      'Search returns nothing or misses recent mail',
      'Outlook crashes or freezes, especially after an add-in was installed or updated',
    ],
    initialChecks: [
      'Is it one user or several? Several users at once points to the service, network or tenant rather than the client.',
      'Does the same mailbox work in Outlook on the web (signing in as the user in their own session, never using their password yourself)? Web working but desktop failing means the fault is client-side.',
      'Is the device online and able to sign in to other Microsoft 365 apps (Teams, OneDrive)? Check for a recent password change, MFA change or Conditional Access change.',
      'What changed recently: Windows or Office update, new add-in, new device, profile change, disk nearly full?',
      'Is there a ticket and are you authorised to work on this device and mailbox?',
    ],
    steps: [
      {
        id: 's1',
        title: 'Check service health and basic connectivity',
        detail:
          'Check the Microsoft 365 admin centre service health page (if you have access) for Exchange Online incidents. On the device confirm internet access and that DNS resolves, e.g. `nslookup outlook.office365.com`.',
        commandIds: ['test-netconnection', 'nslookup'],
        lookFor:
          'An active Exchange Online advisory, or failed name resolution / TCP 443 failure to the Microsoft 365 endpoints.',
        meaning:
          'A service incident or network/DNS fault explains the symptom and no client change will fix it.',
        ifAbnormal:
          'Treat as a network or service issue: use the networking workflows, or wait for the advisory and update the user.',
      },
      {
        id: 's2',
        title: 'Compare with Outlook on the web',
        detail:
          'Have the user sign in to Outlook on the web in a browser using their normal sign-in, and confirm the mailbox opens and mail flows. This is the quickest way to split server-side from client-side.',
        lookFor:
          'Web works and desktop does not (client-side), or both fail (account, licence, sign-in or service issue).',
        meaning:
          'Both failing usually means mailbox, licence, blocked sign-in or authentication; go to the sign-in and MFA workflow. Web only working means profile, OST, add-in or Office installation.',
        ifAbnormal:
          'If the web also fails, stop client-side work and check the account in the admin centre (licence assigned, sign-in not blocked).',
      },
      {
        id: 's3',
        title: 'Start Outlook in safe mode',
        detail:
          'Close Outlook fully (check Task Manager for OUTLOOK.EXE), then run `outlook.exe /safe` from Win+R, or hold Ctrl while launching. Choose the existing profile when asked.',
        commandIds: ['outlook-safe', 'tasklist', 'taskkill'],
        lookFor: 'Does Outlook now start and connect normally?',
        meaning:
          'Safe mode disables add-ins and customisations. If it works, an add-in or toolbar customisation is the likely cause.',
        ifAbnormal:
          'If safe mode also fails, continue to the profile and OST steps. If it works, disable add-ins one at a time via File > Options > Add-ins > Manage COM Add-ins.',
      },
      {
        id: 's4',
        title: 'Check the account state inside Outlook',
        detail:
          'Look at File > Account Settings and the connection status. Hold Ctrl, right-click the Outlook icon in the system tray and choose Connection Status to see whether connections are Established. Check Work Offline is not enabled on the Send/Receive tab.',
        lookFor:
          'Repeated credential prompts, "Need password", Work Offline enabled, or connections stuck in Connecting.',
        meaning:
          'Repeated prompts suggest a stale sign-in or token state, or a Conditional Access or MFA change. Work Offline is a simple user toggle.',
        ifAbnormal:
          'Sign the user out of Office (File > Office Account) and back in, letting them enter their own credentials. Never take or record their password or MFA code.',
      },
      {
        id: 's5',
        title: 'Check Office and Windows health and recent errors',
        detail:
          'Check Office is fully updated (File > Office Account > Update Options). Review the Application event log for Outlook crash entries (Application Error, faulting module) with Get-WinEvent, and note disk free space for the OST location.',
        commandIds: ['get-winevent', 'get-volume'],
        lookFor:
          'Faulting module names pointing at an add-in, repeated crashes, very low free disk space.',
        meaning:
          'A named third-party module points at an add-in. Low disk space can stop the OST updating and cause hangs.',
        ifAbnormal:
          'Free disk space, remove or update the offending add-in, or run an Office Quick Repair from Settings > Apps > Installed apps.',
      },
      {
        id: 's6',
        title: 'Test with a new Outlook profile',
        detail:
          'Open Control Panel > Mail (Microsoft Outlook) > Show Profiles (or run the classic profile tool) and add a new profile for the same account. Leave the old profile in place for comparison; do not delete it yet. Choose "Prompt for a profile" so you can switch between them.',
        commandIds: ['mlcfg32'],
        lookFor: 'Does the new profile connect and sync the mailbox?',
        meaning:
          'New profile works means the old profile or its cached data (OST) is corrupt or stale. New profile also fails points to account, licence, authentication or Office installation.',
        ifAbnormal:
          'If the new profile fails with the same symptom, escalate the investigation to account, licence and sign-in (the sign-in and MFA workflow).',
      },
      {
        id: 's7',
        title: 'Consider the cached data (OST) and search index',
        detail:
          'The OST is a local cache, not the master copy, for Exchange Online mailboxes. If the mailbox is healthy on the web, rebuilding the cache is normally safe: a new profile creates a fresh OST. For search only problems, check Outlook Search options (File > Options > Search > Indexing Options) and that Windows Search service is running.',
        commandIds: ['get-service', 'sc-query'],
        lookFor:
          'Windows Search service stopped, indexer showing few items, an OST that is very large or on a nearly full disk.',
        meaning:
          'A stopped Search service or broken index explains search failures. A damaged or oversized OST explains slow, stuck or partial sync.',
        ifAbnormal:
          'Rebuild the index (Indexing Options > Advanced > Rebuild) or recreate the profile. Check for items in the OST that were never synced (Outbox, Drafts) first and ask the user before discarding anything.',
      },
    ],
    causes: [
      {
        cause: 'Faulty or incompatible add-in',
        indicators: 'Safe mode works; crash events name a third-party DLL; started after an add-in install or update.',
      },
      {
        cause: 'Corrupt or stale Outlook profile / OST cache',
        indicators: 'Web works; new profile works; old profile stuck on Loading profile or Disconnected.',
      },
      {
        cause: 'Authentication or token problem',
        indicators: 'Repeated credential prompts; recent password, MFA or Conditional Access change; other Microsoft 365 apps also prompting.',
      },
      {
        cause: 'Network, DNS, proxy or VPN interference',
        indicators: 'Web works on another network; Test-NetConnection to port 443 fails; only on a specific site or VPN.',
      },
      {
        cause: 'Office installation or Windows Search fault',
        indicators: 'Crashes in Office modules even in safe mode; Quick Repair helps; search only fails while Windows Search is stopped.',
      },
      {
        cause: 'Account, licence or mailbox issue (server-side)',
        indicators: 'Outlook on the web also fails or shows an error; admin centre shows no licence or sign-in blocked.',
      },
    ],
    remediation: [
      {
        title: 'Disable or update the offending add-in',
        detail:
          'Use File > Options > Add-ins > Manage COM Add-ins > Go and untick the add-in, restart Outlook, then update or reinstall it from the vendor if it is needed.',
      },
      {
        title: 'Run Office Quick Repair',
        detail:
          'Settings > Apps > Installed apps > Microsoft 365 > Modify > Quick Repair. Try this before Online Repair, which reinstalls Office and takes much longer.',
        caution: 'Close all Office apps first and save work. Online Repair needs a stable connection and can take a long time.',
      },
      {
        title: 'Create a new Outlook profile',
        detail:
          'Add a new profile, let it complete the first sync, confirm mail, calendar and shared mailboxes appear, then make it the default. Keep the old profile until the user confirms everything is present.',
        caution: 'Locally saved PST files, signatures, autocomplete entries and rules that exist only on the device may not follow the new profile. Back up PSTs and signatures first and confirm with the user.',
      },
      {
        title: 'Rebuild the search index',
        detail:
          'Indexing Options > Advanced > Rebuild. Indexing can take hours on large mailboxes and search will be incomplete meanwhile.',
      },
      {
        title: 'Re-authenticate the account',
        detail:
          'Sign out of Office accounts and sign back in so the user can complete their own authentication. If prompts persist, continue with the sign-in and MFA workflow.',
      },
    ],
    verification: [
      'Outlook starts normally, connection status shows Established and the status bar shows Connected.',
      'The user can send a test message and receive a reply, and it appears in Sent Items.',
      'Search returns known recent items.',
      'Calendar, shared mailboxes and signatures are present as before.',
    ],
    documentation: [
      'Symptoms, affected users and whether Outlook on the web worked.',
      'Which isolation steps were tried (safe mode, new profile, add-in disabled) and the result of each.',
      'The root cause found, or best assessment, and the add-in or profile name if relevant.',
      'Any local data backed up or items the user confirmed were safe to discard.',
      'Outcome, user confirmation and any follow-up needed.',
    ],
    skills: ['m365', 'troubleshooting', 'customer-support', 'documentation'],
  },

  // ---------------------------------------------------------------- 2
  {
    id: 'm365-shared-mailbox',
    category: 'Microsoft 365',
    title: 'Shared mailbox access problems',
    summary:
      'A user cannot see, open or send from a shared mailbox, typically working in Outlook on the web but not in desktop Outlook. Separate permission, auto-mapping, propagation and local profile causes, and check the admin side with an authorised role.',
    tags: ['shared mailbox', 'full access', 'send as', 'automapping', 'exchange', 'permissions'],
    symptoms: [
      'Shared mailbox does not appear in the Outlook folder pane',
      'Works in Outlook on the web but not in desktop Outlook',
      '"You do not have permission" or "Cannot expand the folder" when opening it',
      'User can read the mailbox but cannot send as it ("Send As" / "on behalf of" error)',
      'Newly granted access has still not appeared after a while',
      'Sent items from the shared mailbox land in the user’s own Sent Items rather than the shared one',
    ],
    initialChecks: [
      'Which shared mailbox (full address) and which user? Is it one user or everybody who uses it?',
      'What exactly is missing: the mailbox not showing, cannot open it, or cannot send from it? Each maps to different permissions.',
      'When was access granted, and by which method (Exchange admin centre, PowerShell, Microsoft 365 admin centre)? Was it just changed?',
      'Does the mailbox open in Outlook on the web for this user (Open another mailbox, or direct URL)?',
      'Are you authorised to view and change mailbox permissions for this tenant? Viewing permissions needs an appropriate Exchange or Global admin role.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Confirm what is actually failing',
        detail:
          'Ask the user precisely: can they see it in the folder list, open items, and send from it? Note any error text word for word. Confirm the address they use is the shared mailbox, not a distribution list or Microsoft 365 group with a similar name.',
        lookFor: 'Whether the symptom is visibility, read access, or sending.',
        meaning:
          'Visibility/read relates to Full Access (and auto-mapping). Sending as the mailbox relates to Send As or Send on Behalf, which are separate permissions.',
        ifAbnormal:
          'If the name matches a distribution list or group instead of a mailbox, you are looking at a different object: clarify with the client what was intended.',
      },
      {
        id: 's2',
        title: 'Test in Outlook on the web',
        detail:
          'With the user signed in to Outlook on the web, use "Open another mailbox" (the exact wording varies) and enter the shared mailbox address.',
        lookFor: 'Does the shared mailbox open? Can they send from it?',
        meaning:
          'Opens on the web: Full Access is in place and the problem is the desktop profile or auto-mapping. Does not open: permission is missing, not yet propagated, or the object is not what you think.',
        ifAbnormal:
          'If it fails on the web, go straight to the admin-side permission checks (steps 3 and 4).',
      },
      {
        id: 's3',
        title: 'Check Full Access in the admin centre or PowerShell',
        detail:
          'In the Exchange admin centre open the shared mailbox and review mailbox delegation (Read and manage / Full Access). The exact menu names may differ slightly. Or connect with an authorised admin account using `Connect-ExchangeOnline` and run `Get-MailboxPermission -Identity shared@contoso.com | Where-Object { $_.User -notlike "NT AUTHORITY*" }`. Check the user is listed with AccessRights FullAccess and is not marked Deny.',
        commandIds: ['connect-exchangeonline', 'get-mailboxpermission'],
        lookFor:
          'The user (or a group they belong to) with FullAccess and IsInherited / Deny values. Note the engineer needs an authorised admin role to run this.',
        meaning:
          'Missing: the user cannot open the mailbox. Present via a security group: confirm the user is in that group and allow time for group membership to apply. Deny entries override allow.',
        ifAbnormal:
          'If Full Access is missing, obtain authorisation from the client before adding it (see remediation). Do not grant access just because a user asks.',
      },
      {
        id: 's4',
        title: 'Check Send As and Send on Behalf',
        detail:
          'Run `Get-RecipientPermission -Identity shared@contoso.com` for Send As (AccessRights SendAs). Send on Behalf is the GrantSendOnBehalfTo property on the mailbox (viewable in the admin centre or with `Get-Mailbox`). Confirm which the client actually intends: Send As shows the mailbox as the sender; Send on Behalf shows "user on behalf of mailbox".',
        commandIds: ['get-recipientpermission', 'connect-exchangeonline'],
        lookFor: 'The user listed under SendAs or in the send-on-behalf list.',
        meaning:
          'Full Access alone does not allow sending as the mailbox. Without Send As or Send on Behalf, sending fails or the From option is unavailable.',
        ifAbnormal:
          'Add the appropriate send permission only with client authorisation and record which type you chose and why.',
      },
      {
        id: 's5',
        title: 'Check the mailbox itself and licensing',
        detail:
          'Confirm in the admin centre that the shared mailbox exists and is type Shared (not a user mailbox). A shared mailbox generally needs no licence for basic use, but needs one if it exceeds the standard storage limit or uses certain features such as an online archive; check the client’s licensing position. Confirm the user has an Exchange Online mailbox licence of their own.',
        lookFor: 'Mailbox type, unlicensed warnings, and that the user is licensed and not blocked from sign-in.',
        meaning:
          'A user without a valid Exchange Online licence cannot use mailbox access at all. A shared mailbox that has hit its limits can show errors.',
        ifAbnormal:
          'Resolve licensing with whoever manages the client’s subscriptions; do not assign licences without authorisation.',
      },
      {
        id: 's6',
        title: 'Consider auto-mapping and propagation delay',
        detail:
          'Auto-mapping adds a mailbox to Outlook automatically only when Full Access is granted through Exchange with auto-mapping enabled (the default through the admin centre, optional in PowerShell). Permission changes can take time to propagate, and Outlook may need a restart or a fresh profile before the mailbox appears. Group-based permissions do not auto-map.',
        lookFor:
          'When access was granted, whether it was via a group, and whether auto-mapping was disabled with -AutoMapping $false.',
        meaning:
          'Permission present but mailbox missing in desktop usually means auto-mapping did not apply (granted via group, or auto-mapping off) or propagation has not finished.',
        ifAbnormal:
          'Add the mailbox manually in Outlook (File > Account Settings > Change > More Settings > Advanced > Add), or use the web in the meantime.',
      },
      {
        id: 's7',
        title: 'Check the Outlook profile and cached state',
        detail:
          'Restart Outlook fully. If still missing, test with a new Outlook profile (the mlcfg32 profile tool). Remove and re-add the shared mailbox in the profile. Check the user is not on a stale cached Autodiscover or has Work Offline enabled.',
        commandIds: ['mlcfg32', 'outlook-safe'],
        lookFor: 'Does the shared mailbox appear in a brand new profile?',
        meaning:
          'Appears in a new profile only: the old profile has stale cached state. Still missing: it is a permission or object issue, not the client.',
        ifAbnormal:
          'Return to permissions; if all checks pass and the web works but a clean profile fails, escalate with your findings.',
      },
    ],
    causes: [
      {
        cause: 'No Full Access permission (or access granted only to a group the user is not in)',
        indicators: 'Get-MailboxPermission does not list the user; web also fails.',
      },
      {
        cause: 'Permission recently granted and not yet propagated / Outlook not refreshed',
        indicators: 'Granted within the last hours; web may work; restart or time resolves it.',
      },
      {
        cause: 'Auto-mapping did not apply',
        indicators: 'Full Access exists but mailbox absent in desktop; access came from a group or auto-mapping was disabled.',
      },
      {
        cause: 'Missing Send As / Send on Behalf permission',
        indicators: 'Can read but cannot send as it; Get-RecipientPermission shows no entry for the user.',
      },
      {
        cause: 'Stale or corrupt Outlook profile / cached state',
        indicators: 'Works on the web and in a new profile but not in the existing profile.',
      },
      {
        cause: 'User licence or sign-in problem',
        indicators: 'User cannot access their own mailbox reliably either; licence missing in the admin centre.',
      },
    ],
    remediation: [
      {
        title: 'Grant Full Access (with auto-mapping if intended)',
        detail:
          'In the Exchange admin centre add the user under Read and manage permissions for the shared mailbox, or use `Add-MailboxPermission` with FullAccess. Prefer granting to a security group the client manages, so access follows team membership.',
        caution: 'Requires an authorised Exchange/Global admin role and client approval. Granting access exposes the whole mailbox: apply least privilege and record who approved.',
      },
      {
        title: 'Grant Send As or Send on Behalf only if the client wants it',
        detail:
          'Send As makes the message appear to come from the mailbox; Send on Behalf shows the user too. Choose per the client’s policy.',
        caution: 'Send As allows impersonating the mailbox address. Needs authorisation and should be limited to people who genuinely need it.',
      },
      {
        title: 'Add the mailbox manually or restart/refresh Outlook',
        detail:
          'If permissions are correct but the mailbox does not auto-map, add it manually in the account settings, or have the user restart Outlook after waiting for propagation. Use Outlook on the web as an interim workaround.',
      },
      {
        title: 'Recreate the Outlook profile',
        detail:
          'Create a new profile, confirm the shared mailbox and primary mailbox sync, then switch default.',
        caution: 'Back up local PST files and signatures first; the OST cache will be rebuilt and may take time on large mailboxes.',
      },
      {
        title: 'Correct licensing',
        detail:
          'If the user or mailbox lacks a required licence, pass to the person who manages subscriptions to assign it.',
        caution: 'Licence changes have cost implications and need client authorisation.',
      },
    ],
    verification: [
      'The user can open the shared mailbox in Outlook on the web and in desktop Outlook.',
      'The user can send a test message from the shared mailbox (as the intended type) and the recipient sees the correct sender.',
      'Sent items land where the client expects (shared mailbox Sent Items or the user’s, per configuration).',
      'Get-MailboxPermission and Get-RecipientPermission match what was agreed.',
    ],
    documentation: [
      'Shared mailbox, user and symptom (visibility, read, or send).',
      'Permissions found before changes and permissions after (Full Access / Send As / Send on Behalf).',
      'Who authorised the change and the ticket reference.',
      'Whether access was via group or direct, and whether auto-mapping was used.',
      'Any profile changes made and how they were verified.',
    ],
    skills: ['m365', 'identity-access', 'troubleshooting', 'documentation', 'customer-support'],
  },

  // ---------------------------------------------------------------- 3
  {
    id: 'm365-onedrive-sync',
    category: 'Microsoft 365',
    title: 'OneDrive sync problems',
    summary:
      'OneDrive shows a red X, is stuck syncing, or specific files will not upload. Work through account state, file name and path problems, storage, Known Folder Move, then unlink/relink, using reset only as a last resort.',
    tags: ['onedrive', 'sync', 'known folder move', 'quota', 'path length', 'reset'],
    symptoms: [
      'OneDrive cloud icon shows a red X, a warning or a paused state',
      'Sync stuck on "Processing changes" or "Syncing" for a long time',
      'Specific files report they cannot be uploaded',
      'Storage full or quota warning',
      'Desktop, Documents or Pictures folders not backing up (Known Folder Move errors)',
      'OneDrive asks the user to sign in repeatedly',
    ],
    initialChecks: [
      'Does the OneDrive web site show the files? Is the file present and current there?',
      'One user, one folder, or everyone? Which files fail?',
      'Is the account signed in with the work/school account and not paused? Is the device online and on a metered connection or battery saver?',
      'Is there important data that exists only locally (not yet uploaded)? Establish this before any unlink or reset.',
      'Is the device managed by the client with sync policies (Known Folder Move, restricted file types)?',
    ],
    steps: [
      {
        id: 's1',
        title: 'Read the sync status',
        detail:
          'Click the OneDrive cloud icon in the notification area and read the message. Open "View sync problems" or the activity centre to list failing files and the stated reason.',
        lookFor: 'The wording: sign-in required, paused, storage full, file name invalid, file in use, path too long.',
        meaning:
          'OneDrive normally states the reason. Most issues are a small number of problem files rather than OneDrive being broken.',
        ifAbnormal:
          'Follow the specific message first. If there is no message, continue through the steps.',
      },
      {
        id: 's2',
        title: 'Check connectivity and the account',
        detail:
          'Confirm the user is signed in with the correct work account (Settings > Account) and not paused. Check internet and that Microsoft 365 sign-in works elsewhere. Check the web version of OneDrive loads.',
        commandIds: ['test-netconnection'],
        lookFor: 'Sign-in prompts, "Resume syncing", a different or personal account signed in.',
        meaning: 'Sign-in or authentication problems cause sync to stop even though files are fine.',
        ifAbnormal:
          'Use the sign-in and MFA workflow if sign-in itself fails. Never record the user’s credentials.',
      },
      {
        id: 's3',
        title: 'Check storage quota',
        detail:
          'Check the OneDrive storage figure in the app settings, and in the Microsoft 365 admin centre under the user’s OneDrive details if you have access. Also check local disk free space with Get-Volume, because Files On-Demand still needs some space.',
        commandIds: ['get-volume'],
        lookFor: 'OneDrive at or near quota; local drive almost full.',
        meaning: 'A full cloud quota stops uploads; a full local disk stops downloads and can cause errors.',
        ifAbnormal:
          'Free space (with the user’s agreement) or ask the client whether quota or licensing should change. Check the recycle bins too; deleted items can count towards quota.',
      },
      {
        id: 's4',
        title: 'Check file names, path length and illegal characters',
        detail:
          'For failing files, check for characters not allowed in OneDrive names, leading/trailing spaces, names ending in a full stop, reserved names, very long paths, or very large files. Shorten folder nesting or names and let sync retry. Known blocked characters include " * : < > ? / \\ |.',
        lookFor: 'File names with disallowed characters or excessive length; temporary Office files (~$) that are in use.',
        meaning: 'These produce per-file errors while other files sync normally.',
        ifAbnormal:
          'Rename or move the file locally. Do not delete files you have not confirmed with the user.',
      },
      {
        id: 's5',
        title: 'Check for files in use and sync conflicts',
        detail:
          'Close the application that has the file open. Look for duplicate files with the computer name added (conflict copies). Ask whether another person is editing the same file.',
        lookFor: 'Locked files, conflict copies, files open in another program or another device.',
        meaning: 'A file in use cannot be replaced; conflict copies mean both versions changed.',
        ifAbnormal:
          'Compare versions and let the owner decide which to keep before deleting any copy.',
      },
      {
        id: 's6',
        title: 'Check Known Folder Move (Desktop, Documents, Pictures)',
        detail:
          'In OneDrive settings > Sync and backup, check the status of folder backup. Known Folder Move can be configured by the client through policy; check what the client expects. Errors often relate to quota, blocked file types, or a folder redirected elsewhere.',
        lookFor: 'Backup errors, folders redirected to a network path, or policy-driven settings.',
        meaning: 'KFM failures can leave the user’s Desktop partly local and partly cloud. Moving back out of OneDrive can confuse users and break shortcuts.',
        ifAbnormal:
          'Resolve the underlying error rather than stopping the backup; if a policy controls it, speak to whoever administers it.',
      },
      {
        id: 's7',
        title: 'Restart OneDrive, then unlink and relink if needed',
        detail:
          'Quit OneDrive from the notification area and restart it. If still failing, in Settings > Account choose Unlink this PC and sign in again. First confirm everything in the local folder is already in the cloud (web shows the files, or sync status is fully up to date).',
        lookFor: 'After relink, whether the folder reconnects to the existing folder and resyncs without duplicates.',
        meaning: 'Relinking refreshes the account connection and sync database without deleting server data.',
        ifAbnormal:
          'If unsynced local changes exist, copy them to a safe location first. Reset only as a last resort (see remediation).',
      },
    ],
    causes: [
      {
        cause: 'Invalid file name, path too long or blocked file type',
        indicators: 'Specific files listed with errors; rest of library syncs.',
      },
      {
        cause: 'OneDrive storage full or local disk full',
        indicators: 'Quota warning; uploads fail across many files; low free disk space.',
      },
      {
        cause: 'Sign-in, account or token problem',
        indicators: 'Repeated sign-in prompts; red X for all folders; other apps also prompt.',
      },
      {
        cause: 'File locked or conflicting edits',
        indicators: 'Error mentions file in use; conflict copies exist.',
      },
      {
        cause: 'Known Folder Move or policy conflict',
        indicators: 'Backup errors on Desktop/Documents/Pictures; managed device; folder redirection in place.',
      },
      {
        cause: 'Corrupt local sync state',
        indicators: 'No clear per-file error, long "Processing changes", fixed only by unlink or reset.',
      },
    ],
    remediation: [
      {
        title: 'Fix the individual files',
        detail:
          'Rename files with invalid characters, shorten paths, close applications holding files and let sync retry.',
      },
      {
        title: 'Free storage',
        detail:
          'Remove clearly unwanted files with the user’s agreement, empty the recycle bin as agreed, or ask the client about quota changes.',
        caution: 'Deleting is hard to undo once recycle bins are emptied. Confirm with the user and keep to the client’s retention policy.',
      },
      {
        title: 'Unlink and relink the account',
        detail:
          'Settings > Account > Unlink this PC, then sign in again and choose the existing folder location. Files in the cloud are not deleted by unlinking.',
        caution: 'Make sure nothing exists only locally. Copy any unsynced files elsewhere before unlinking.',
      },
      {
        title: 'Reset OneDrive (last resort)',
        detail:
          'The OneDrive reset (onedrive.exe /reset) clears the local sync state and forces a full resync. Use only after the other steps, and prefer unlink and relink first.',
        caution: 'Unsynced local changes can be lost or end up as conflict copies, and a full resync of a large library can use a lot of bandwidth. Copy local-only work to a safe location and get the user’s agreement first.',
      },
    ],
    verification: [
      'The OneDrive icon shows up to date with no red X.',
      'A test file created locally appears on the OneDrive web site, and a change made on the web appears locally.',
      'The previously failing files now sync, or have been renamed with the user’s agreement.',
      'Known Folder Move status is healthy where the client expects it.',
    ],
    documentation: [
      'The error text shown and affected files or folders.',
      'Storage/quota figures and free local disk space.',
      'Any renames, moves or deletions made, with the user’s agreement.',
      'Whether unlink/relink or reset was used and what was backed up first.',
      'Outcome and verification evidence.',
    ],
    skills: ['m365', 'troubleshooting', 'customer-support', 'documentation'],
  },

  // ---------------------------------------------------------------- 4
  {
    id: 'm365-teams',
    category: 'Microsoft 365',
    title: 'Microsoft Teams problems',
    summary:
      'Teams will not sign in, has no audio or video device, is missing messages, or fails to join meetings. Check scope, service, device and account state before clearing the cache.',
    tags: ['teams', 'sign-in loop', 'audio', 'camera', 'meetings', 'cache'],
    symptoms: [
      'Teams stuck in a sign-in loop or keeps asking for credentials',
      'Microphone, speaker or camera not detected in a call',
      'Messages or chats missing or not updating',
      'Cannot join a meeting, or joins without audio',
      'Teams is slow, blank or crashes on start',
      'Notifications or presence wrong',
    ],
    initialChecks: [
      'Does Teams on the web work for this user? This separates client-side from account or service problems.',
      'One user or several? Check Microsoft 365 service health for Teams.',
      'Which Teams client are they using (new or classic, desktop, web, mobile)? Behaviour and cache locations differ between them.',
      'What changed: password/MFA, Windows update, new headset, new device, join method?',
      'For meetings: is the problem the specific meeting (policy, lobby, external organiser) or all meetings?',
    ],
    steps: [
      {
        id: 's1',
        title: 'Check service health and scope',
        detail:
          'Look at Microsoft 365 service health for Teams or ask whether colleagues are affected. Test with Teams on the web in a browser.',
        lookFor: 'An advisory, or web working while desktop fails.',
        meaning: 'Service problem versus client problem.',
        ifAbnormal:
          'If the web also fails to sign in, move to the sign-in and MFA workflow.',
      },
      {
        id: 's2',
        title: 'Check network and time',
        detail:
          'Confirm internet access, that Teams endpoints are reachable on HTTPS, and that VPN or proxy is not interfering. Confirm the device clock and time zone are correct, since sign-in depends on valid time.',
        commandIds: ['test-netconnection', 'nslookup'],
        lookFor: 'Failed name resolution, blocked connections, incorrect device time.',
        meaning: 'Network filtering or wrong time can cause sign-in loops and call failures.',
        ifAbnormal:
          'Resolve DNS/proxy/time first. Test on a different network, such as a mobile hotspot, if permitted.',
      },
      {
        id: 's3',
        title: 'Check the signed-in account and licence',
        detail:
          'In Teams confirm the correct work account is signed in (not a personal one). In the Microsoft 365 admin centre confirm the user has a licence that includes Teams and is not blocked from sign-in.',
        lookFor: 'Wrong account, missing Teams licence, blocked sign-in.',
        meaning: 'Licence or account state can cause errors that look like client faults.',
        ifAbnormal:
          'Fix account or licence with authorisation; for repeated prompts, review sign-in logs in the Entra admin centre.',
      },
      {
        id: 's4',
        title: 'Check audio and video devices',
        detail:
          'In Teams settings > Devices confirm the right microphone, speaker and camera are selected. In Windows, check Settings > Privacy & security > Microphone and Camera permissions, and that the device shows in Device Manager. Test the device in another app.',
        lookFor: 'Device missing, disabled, muted or blocked by privacy settings or another app using the camera.',
        meaning: 'If other apps also cannot see the device, it is a Windows, driver or hardware matter and not Teams.',
        ifAbnormal:
          'Reconnect/replug, update drivers via Windows Update or the vendor, and close apps holding the camera.',
      },
      {
        id: 's5',
        title: 'Investigate missing messages or chats',
        detail:
          'Check on Teams web whether the messages appear. Check filters, the correct team/channel, and whether the user was removed or the chat was hidden. Message retention policies and deleted items can also affect what is visible.',
        lookFor: 'Messages present on web but not desktop, or absent everywhere.',
        meaning: 'Present on web means a client cache or sync issue. Absent everywhere points to membership, permissions, retention or deletion, which is a tenant question.',
        ifAbnormal:
          'Do not search other people’s content without authorisation. Escalate retention or compliance questions to whoever administers them.',
      },
      {
        id: 's6',
        title: 'Diagnose meeting join problems',
        detail:
          'Try the Join link in a browser and in the desktop client. Check whether the meeting is external, whether the organiser’s lobby or policy settings block the user, and whether the user’s Teams meeting policy allows what they are trying to do.',
        lookFor: 'Works in browser only, stuck in lobby, no audio join option.',
        meaning: 'Browser success points to the desktop client; lobby issues point to meeting options or policy.',
        ifAbnormal:
          'Ask the organiser to review meeting options; for policy limits, speak to the Teams administrator.',
      },
      {
        id: 's7',
        title: 'Restart and clear the Teams cache',
        detail:
          'Fully quit Teams (system tray, and end any remaining Teams processes), then clear the client cache. The cache location differs between classic and new Teams, so check Microsoft’s current guidance for the version in use. Alternatively use the Reset option under Settings > Apps > Installed apps > Advanced options for the new client.',
        commandIds: ['tasklist', 'taskkill'],
        lookFor: 'Whether Teams starts cleanly and signs in again afterwards.',
        meaning: 'Clearing the cache fixes most corrupted-local-state loops without affecting server data.',
        ifAbnormal:
          'If it still fails, reinstall the client and re-test; if the web also fails, return to account and licence.',
      },
    ],
    causes: [
      {
        cause: 'Corrupt Teams cache or local state',
        indicators: 'Web works; desktop loops or shows blank screens; fixed after cache clear.',
      },
      {
        cause: 'Authentication or Conditional Access issue',
        indicators: 'Repeated sign-in prompts on web and desktop; sign-in logs show failures.',
      },
      {
        cause: 'Audio/video device, driver or privacy setting',
        indicators: 'Device missing in other apps or blocked in Windows privacy settings.',
      },
      {
        cause: 'Network, proxy, VPN or time problem',
        indicators: 'Fails on one network only; DNS or connection failures; wrong clock.',
      },
      {
        cause: 'Meeting or tenant policy restriction',
        indicators: 'Only certain meetings fail; lobby or policy messages; external organiser.',
      },
      {
        cause: 'Licence or membership change',
        indicators: 'Teams unavailable or messages absent after a licence or group change.',
      },
    ],
    remediation: [
      {
        title: 'Clear the Teams cache or reset the app',
        detail:
          'Quit Teams completely, clear the cache or use the Windows app Reset option, then sign in again.',
        caution: 'Signing in again will be needed, and locally stored settings are lost. Confirm the user can complete their own MFA before starting.',
      },
      {
        title: 'Fix device selection and permissions',
        detail:
          'Choose the right devices in Teams, enable microphone/camera access in Windows privacy settings, and update drivers.',
      },
      {
        title: 'Reinstall Teams',
        detail:
          'Uninstall and reinstall the client from the official source or the client’s deployment tool, then sign in.',
        caution: 'On managed devices use the client’s normal deployment method rather than installing unmanaged copies.',
      },
      {
        title: 'Escalate policy or licence changes',
        detail:
          'If a meeting policy, licence or membership is the cause, request the change from the Teams or tenant administrator with the client’s approval.',
        caution: 'Policy changes can affect many users. Get authorisation and note what you changed.',
      },
    ],
    verification: [
      'The user signs in without a loop and sees their chats and teams.',
      'A test call shows microphone, speaker and camera working (Teams device test or test call).',
      'The user joins a real or test meeting with audio.',
      'Messages expected are visible, or it is confirmed they are absent for a documented reason.',
    ],
    documentation: [
      'Client type (new/classic/web), version where known, and symptoms.',
      'Whether the web client behaved differently.',
      'Devices tested and drivers or settings changed.',
      'Cache clear/reset/reinstall performed and result.',
      'Any policy or licence changes requested and who approved them.',
    ],
    skills: ['m365', 'troubleshooting', 'customer-support', 'documentation'],
  },

  // ---------------------------------------------------------------- 5
  {
    id: 'm365-sharepoint-permissions',
    category: 'Microsoft 365',
    title: 'SharePoint access and permissions',
    summary:
      'A user gets access denied, cannot see a site or library, or a sharing link does not work. Establish how access is meant to be granted, then check group membership, inheritance, links and external sharing policy using least privilege.',
    tags: ['sharepoint', 'access denied', 'permissions', 'sharing links', 'inheritance', 'groups'],
    symptoms: [
      '"Access denied" or "You need permission" on a site, library or file',
      'A site or library is not visible to the user',
      'A sharing link does not open, or opens only for some people',
      'External guest cannot open shared content',
      'Access works for one user but not a colleague doing the same role',
      'A user can see something they should not',
    ],
    initialChecks: [
      'What is the exact URL and exact error text? Is it the site, a library, a folder or a single file?',
      'Who owns the site or data? Do they approve access (not the engineer alone)?',
      'Is the person internal or an external guest? Are they signed in with the right account?',
      'Does a comparable user have access, and how was it given (group, direct, link)?',
      'Are you authorised to view and change SharePoint permissions on this tenant?',
    ],
    steps: [
      {
        id: 's1',
        title: 'Confirm identity and the account used',
        detail:
          'Check the user is signed in with the correct account (a browser may be signed in with a personal or second account). Try an InPrivate/incognito window with their work account.',
        lookFor: 'Different account than expected, or sign-in/MFA prompts failing.',
        meaning: 'Many "access denied" cases are the wrong signed-in identity.',
        ifAbnormal:
          'If sign-in itself fails, use the sign-in and MFA workflow.',
      },
      {
        id: 's2',
        title: 'Establish how the site is meant to grant access',
        detail:
          'In SharePoint, open the site and look at Site permissions. Note whether the site is connected to a Microsoft 365 group or Team, and which owners, members and visitors exist. Read who the site owners are. The exact menu names may differ slightly.',
        lookFor: 'Group-connected site vs standalone site, and the intended permission model.',
        meaning: 'Group-connected sites normally grant access through group membership, which is the preferred approach.',
        ifAbnormal:
          'If direct permissions are scattered throughout, note it as a risk and discuss tidy-up with the site owner.',
      },
      {
        id: 's3',
        title: 'Check whether the user is in the right group',
        detail:
          'In the Microsoft 365 admin centre or the site’s permissions panel, check whether the user is a member of the owners/members/visitors group, or of the security group that was granted access. Allow time for membership changes to apply.',
        lookFor: 'User missing from the group, or added only recently.',
        meaning: 'Missing membership is the most common cause and the correct fix is membership, not a direct grant.',
        ifAbnormal:
          'Request the group owner or client approver to add the user at the appropriate level.',
      },
      {
        id: 's4',
        title: 'Check for unique permissions and inheritance',
        detail:
          'On the library, folder or file, check whether it has unique permissions or inherits from the parent. Use Manage access or Advanced permissions settings. Note any stopped inheritance and who is listed.',
        lookFor: 'Items with inheritance broken, direct user entries, or "limited access" entries.',
        meaning: 'A folder with unique permissions can deny someone who has access to the site. Many unique permissions make auditing hard.',
        ifAbnormal:
          'Prefer to restore inheritance if the exception is no longer needed, but only with the owner’s approval, because it removes the special permissions.',
      },
      {
        id: 's5',
        title: 'Check sharing links',
        detail:
          'Open Manage access on the item and look at links: Anyone, People in your organisation, People with existing access, Specific people. Check expiry, whether a link was deleted, and whether the recipient is the one named.',
        lookFor: 'Specific-people links that name another address, expired links, links disabled by policy.',
        meaning: 'Links for specific people only work for the named identity. Policy may block certain link types.',
        ifAbnormal:
          'Create a new link of the narrowest suitable type, or grant access through the group instead.',
      },
      {
        id: 's6',
        title: 'Check external sharing and guest state',
        detail:
          'For external users, check that external sharing is allowed for the site (site and tenant settings), that the guest account exists and has accepted the invitation, and that the guest is not blocked. Review guest accounts in the Entra admin centre.',
        lookFor: 'Sharing disabled for the site, pending invitations, blocked guests, mismatched email address.',
        meaning: 'The tenant or site sharing setting is a security control; do not loosen it just to make one access work.',
        ifAbnormal:
          'If external access is genuinely needed, get approval from the client and use the narrowest setting for that site.',
      },
      {
        id: 's7',
        title: 'Test after the change and review exposure',
        detail:
          'After the fix, have the user retest in a fresh browser session. Use "Check permissions" or Manage access to confirm the effective access, and check nobody else gained more than intended.',
        lookFor: 'The user has the expected access and no extra people or links were created.',
        meaning: 'Confirms the least-privilege outcome.',
        ifAbnormal:
          'Remove any over-broad permissions or links you created and record it.',
      },
    ],
    causes: [
      {
        cause: 'User not in the owning group or security group',
        indicators: 'Colleagues with access are members; this user is not.',
      },
      {
        cause: 'Unique permissions on a folder or file',
        indicators: 'Site access works but one item is denied; item shows inheritance stopped.',
      },
      {
        cause: 'Wrong account signed in',
        indicators: 'Works in an InPrivate session with the work account.',
      },
      {
        cause: 'Sharing link expired, restricted to named people, or disabled',
        indicators: 'Link opens for some but not others; policy blocks link type.',
      },
      {
        cause: 'External sharing disabled or guest not accepted',
        indicators: 'Guest invitation pending or site/tenant setting blocks sharing.',
      },
      {
        cause: 'Recent change in membership not yet applied',
        indicators: 'Access granted within the last hours and later appears.',
      },
    ],
    remediation: [
      {
        title: 'Add the user to the appropriate group',
        detail:
          'Add them to the owners/members/visitors group or the managed security group, at the lowest level that does the job (Visitors for read-only, Members for edit, Owners only when necessary).',
        caution: 'Needs the data owner’s approval. Avoid giving Owner or Full Control as a shortcut.',
      },
      {
        title: 'Restore inheritance or fix unique permissions',
        detail:
          'Where an exception is no longer needed, delete unique permissions so the item inherits again; otherwise adjust the specific entries.',
        caution: 'Deleting unique permissions removes the custom entries and may change who can see the content. Record the existing permissions first so they can be restored.',
      },
      {
        title: 'Issue a narrower sharing link',
        detail:
          'Use Specific people links with an expiry date for individuals, and avoid Anyone links for business data.',
        caution: 'Anyone links expose content to anyone holding the link and may be blocked by policy.',
      },
      {
        title: 'Adjust external sharing for a site (only if approved)',
        detail:
          'Enable external sharing at the narrowest level for the specific site and invite the guest by name.',
        caution: 'Changes security posture and needs client authorisation. Do not change tenant-wide sharing settings for one request.',
      },
    ],
    verification: [
      'The user can open the site, library or file with the expected permission level.',
      'Effective permissions (Check permissions / Manage access) match the intended model.',
      'No unintended people or links gained access.',
      'The site owner confirms the result.',
    ],
    documentation: [
      'Site/library/file, user and the exact error.',
      'The permission model found (group-based vs direct) and any inheritance exceptions.',
      'What access was granted, at what level, and who approved it.',
      'Links or external sharing created, with expiry.',
      'How to reverse what was changed.',
    ],
    skills: ['m365', 'identity-access', 'troubleshooting', 'documentation'],
  },
];
