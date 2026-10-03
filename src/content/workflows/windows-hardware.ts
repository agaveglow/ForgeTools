import type { Workflow } from '../types';

export const WINDOWS_HARDWARE_WORKFLOWS: Workflow[] = [
  // ---------------------------------------------------------------- 1
  {
    id: 'win-slow-computer',
    category: 'Windows',
    title: 'Slow computer',
    summary:
      'A Windows 10/11 device that is sluggish, laggy or slow to respond. Work from cheap checks (resources, startup load, free space) towards disk health and reimage decisions.',
    tags: ['slow', 'performance', 'high cpu', 'high memory', 'startup apps', 'lag'],
    symptoms: [
      'Applications take a long time to open or switch between',
      'Mouse or typing lags, windows freeze briefly',
      'Fan runs loudly or constantly, device runs hot',
      'Task Manager shows CPU, memory or disk pinned near 100%',
      'Slowness started after an update, new software install or a long uptime',
    ],
    initialChecks: [
      'Is it one device or several? Several slow devices at once suggests a network, cloud or shared-resource cause rather than the PC.',
      'Is it slow everywhere or only in one application or website? Browser-only slowness points to extensions or the network.',
      'When did it start, and what changed (Windows update, new software, new hardware, moved to a new building)?',
      'When was the last full restart? Fast Startup and sleep can leave a machine up for weeks.',
      'Confirm the user has a recent backup or that their files are in OneDrive/server storage before any cleanup or repair.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Restart and re-test',
        detail:
          'Choose Restart (not Shut down, which can use Fast Startup) and let the device settle for a few minutes after sign-in. Check whether the slowness returns.',
        lookFor: 'Whether performance is normal straight after restart and degrades over time.',
        meaning:
          'Good after restart then degrading suggests a leaking process, long uptime or a resource-hungry application. Slow immediately points to startup load, disk or hardware.',
        ifAbnormal: 'Carry on to step 2 and identify what is consuming resources.',
      },
      {
        id: 's2',
        title: 'Check live resource use',
        detail:
          'Open Task Manager (Ctrl+Shift+Esc) > Processes. Click the CPU, Memory and Disk column headers to sort. Note the top consumers. Use the Performance tab to see overall CPU, memory, disk and network.',
        commandIds: ['get-process', 'tasklist'],
        lookFor:
          'A single process using sustained high CPU, memory above roughly 85-90% in use, or disk at 100% active time.',
        meaning:
          'High CPU from one process: runaway application or scan. High memory: too many apps or too little RAM for the workload. Disk at 100% with a mechanical drive: drive is the bottleneck.',
        ifAbnormal:
          'If the process is security software, Windows Update or OneDrive sync, let it finish and re-check. If an unknown or suspicious process, treat as a possible security issue and escalate before deleting anything.',
      },
      {
        id: 's3',
        title: 'Review startup load',
        detail:
          'Task Manager > Startup apps (or Settings > Apps > Startup). Sort by Startup impact. Also review scheduled tasks and startup entries from the command line.',
        commandIds: ['get-startup-commands', 'get-scheduledtask'],
        lookFor: 'Many items with High impact, duplicate updaters, or unfamiliar entries.',
        meaning:
          'A heavy startup list slows boot and sign-in and keeps memory busy all day.',
        ifAbnormal:
          'Disable clearly non-essential items (record each one first so it can be re-enabled). Do not disable security, VPN, backup or management agents.',
      },
      {
        id: 's4',
        title: 'Check free space and disk activity',
        detail:
          'Open Settings > System > Storage (or File Explorer > This PC). Check free space on C:. In Task Manager > Performance > Disk note the drive type (SSD/HDD) and active time. For detail open Resource Monitor (resmon) > Disk tab.',
        commandIds: ['get-volume', 'get-physicaldisk'],
        lookFor: 'Less than about 10-15% free on the system drive, an HDD as the system disk, or sustained 100% active time.',
        meaning:
          'Low free space hurts paging, updates and temp files. An HDD in a modern Windows 10/11 machine is often the main cause of slowness.',
        ifAbnormal:
          'Follow the Disk / storage issues workflow. If the system disk is a mechanical drive, recommend SSD replacement.',
      },
      {
        id: 's5',
        title: 'Check for malware and background scans',
        detail:
          'Confirm Microsoft Defender (or the managed AV) is healthy and up to date, and whether a scan is currently running.',
        commandIds: ['get-mpcomputerstatus', 'update-mpsignature'],
        lookFor: 'Real-time protection state, signature age, a scan in progress, or any detected threats.',
        meaning:
          'A running scan explains temporary slowness. Detections or disabled protection mean this may be a security incident rather than a performance fault.',
        ifAbnormal:
          'If threats are found or protection has been switched off, follow your incident process and escalate. Do not simply clean and carry on.',
      },
      {
        id: 's6',
        title: 'Look at errors and history',
        detail:
          'Open Reliability Monitor and look for a pattern of application failures or critical events. In Event Viewer check Windows Logs > System for repeated disk, driver or hardware warnings around the time of slowness.',
        commandIds: ['reliability-monitor', 'get-winevent', 'get-hotfix'],
        lookFor: 'Repeated disk-related warnings, driver failures, or slowness starting at the date of a particular update.',
        meaning:
          'Disk or hardware warnings suggest a failing component. A clear date match suggests a bad update or driver.',
        ifAbnormal:
          'Follow the relevant workflow (disk, driver, update). Consider uninstalling a problem update only if it is confirmed as the cause and policy allows.',
      },
      {
        id: 's7',
        title: 'Check power plan, thermals and hardware limits',
        detail:
          'Check the power mode (Settings > System > Power) is not on a battery-saver setting while plugged in. Feel for heat and check that vents are not blocked. Compare installed RAM and CPU against the workload.',
        commandIds: ['systeminfo', 'get-computerinfo'],
        lookFor: 'Low installed RAM (for example 4 GB), very old CPU, dust-clogged vents, or throttling when hot.',
        meaning:
          'Insufficient RAM or thermal throttling gives slowness that no software cleanup will fix.',
        ifAbnormal:
          'Raise a hardware upgrade or replacement. Cleaning vents is fine on a device you are authorised to open, with power disconnected.',
      },
    ],
    causes: [
      {
        cause: 'Too many startup programs or background services',
        indicators: 'Slow after sign-in, many High-impact startup items, memory high at idle.',
      },
      {
        cause: 'Mechanical hard drive or failing/very full SSD',
        indicators: 'Disk at 100% active time with low throughput, low free space, disk warnings in the System log.',
      },
      {
        cause: 'Insufficient RAM for the workload',
        indicators: 'Memory consistently high, heavy paging, many browser tabs and Office apps open.',
      },
      {
        cause: 'Background scan, update or sync in progress',
        indicators: 'Defender, Windows Update or OneDrive near the top of Task Manager, improves when finished.',
      },
      {
        cause: 'Malware or unwanted software',
        indicators: 'Unknown high-CPU processes, browser hijacks, security tooling disabled, Defender detections.',
      },
      {
        cause: 'Overheating or poor power settings',
        indicators: 'Hot chassis, loud fans, performance drops under load, battery-saver mode while on AC.',
      },
    ],
    remediation: [
      {
        title: 'Restart and let background work finish',
        detail:
          'Perform a full restart, allow Windows Update, Defender and OneDrive to complete, and re-test. Teach the user to restart weekly.',
      },
      {
        title: 'Trim startup items',
        detail:
          'Disable non-essential startup apps via Task Manager > Startup apps. Keep a list of what was disabled.',
        caution:
          'Do not disable security, VPN, backup or remote-management agents. Record changes so they can be reversed.',
      },
      {
        title: 'Free up disk space',
        detail:
          'Use Storage Sense / Settings > System > Storage > Temporary files and Disk Cleanup. Move large user files to OneDrive or approved storage.',
        commandIds: ['cleanmgr'] as unknown as undefined,
        caution:
          'Confirm with the user before removing anything from Downloads or Desktop. Do not delete files you have not checked are backed up.',
      },
      {
        title: 'Hardware upgrade',
        detail:
          'If the cause is an HDD system drive or too little RAM, recommend an SSD and/or RAM upgrade or device replacement, with a business case in the ticket.',
        caution:
          'Back up first. Replacing a drive means reinstalling or restoring Windows. Check BitLocker recovery key access before hardware changes.',
      },
      {
        title: 'Rebuild as a last resort',
        detail:
          'If the system is still slow with healthy hardware and unexplained software state, plan a reset or reimage using the organisation standard build.',
        caution:
          'Destroys local data and settings. Only with a verified backup and authorisation.',
      },
    ],
    verification: [
      'Task Manager shows normal CPU, memory and disk figures at idle after a fresh restart.',
      'Boot to usable desktop time is noticeably improved compared with before.',
      'The user opens their usual applications and confirms responsiveness.',
      'Performance remains good after a second restart and a few hours of normal use.',
    ],
    documentation: [
      'Symptoms as reported, when they started and what changed',
      'Top resource consumers observed and values (CPU, memory, disk %)',
      'Free disk space and drive type (SSD/HDD)',
      'What was changed (startup items disabled, files moved) and how to undo it',
      'Outcome, user confirmation and any follow-up (hardware upgrade, monitoring)',
    ],
    skills: ['windows', 'troubleshooting', 'hardware', 'customer-support'],
  },

  // ---------------------------------------------------------------- 2
  {
    id: 'win-app-crash',
    category: 'Windows',
    title: 'Application crashes / not responding',
    summary:
      'An application closes unexpectedly, hangs or shows "Not responding". Establish whether it is the app, its data/profile, a conflicting component or the system underneath.',
    tags: ['crash', 'not responding', 'hang', 'application error', 'event viewer', 'faulting module'],
    symptoms: [
      'Application closes without warning or shows an error dialog',
      'Title bar shows "(Not Responding)" and the window greys out',
      'App crashes on opening a particular file or feature',
      'Crashes began after an update, add-in or driver change',
      'Other applications behave normally',
    ],
    initialChecks: [
      'Which application and version, and does it fail for other users or on other devices?',
      'Does it fail every time, or only with a specific file, add-in or action?',
      'What changed recently (Windows update, app update, new add-in, new printer or graphics driver)?',
      'Is any unsaved work open? Recover or save it before closing anything.',
      'Check the user data is backed up or in cloud/server storage before any repair or reinstall.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Reproduce and capture the exact error',
        detail:
          'Watch the user reproduce the fault. Note any dialog text, the time, and the exact action that triggers it. Take a screenshot.',
        lookFor: 'A repeatable trigger, an error code or a named module in the dialog.',
        meaning: 'A repeatable trigger narrows the cause to a file, add-in or feature; random crashes suggest system or hardware causes.',
        ifAbnormal: 'If it cannot be reproduced, use Reliability Monitor and Event Viewer to find past crashes.',
      },
      {
        id: 's2',
        title: 'Check Reliability Monitor',
        detail:
          'Search for Reliability Monitor (View reliability history). Find the red X entries for the application and open View technical details.',
        commandIds: ['reliability-monitor'],
        lookFor: 'Frequency and timing of crashes, and whether they follow an install or update.',
        meaning: 'A cluster of failures starting on one date points to a change on that date.',
        ifAbnormal: 'Correlate with Windows Update history and software installs (step 6).',
      },
      {
        id: 's3',
        title: 'Read the Application log',
        detail:
          'Event Viewer > Windows Logs > Application. Filter for Error and look for Application Error and Application Hang entries at the time of the crash. Note the faulting application, faulting module name and exception code. Query from PowerShell if easier.',
        commandIds: ['get-winevent'],
        lookFor: 'A faulting module that is a third-party DLL, a graphics or printer driver, or a core Windows component.',
        meaning:
          'A third-party add-in or driver module implicates that component. The app executable itself as faulting module suggests a damaged install or bug. System DLLs repeatedly faulting suggests wider corruption or hardware.',
        ifAbnormal: 'Disable or update the named add-in or driver. If system components or memory errors are involved, see System file corruption and RAM health workflows.',
      },
      {
        id: 's4',
        title: 'Check resources at the time of failure',
        detail:
          'Open Task Manager while using the app. Watch memory, CPU and disk. Check free space on C: and installed RAM.',
        commandIds: ['get-process', 'get-volume'],
        lookFor: 'Memory exhaustion, a full disk or the app consuming ever-increasing memory.',
        meaning: 'Resource starvation or a memory leak can cause crashes and hangs.',
        ifAbnormal: 'Free space, close other applications or raise a RAM upgrade. Report leaks to the vendor with evidence.',
      },
      {
        id: 's5',
        title: 'Isolate add-ins, profile and compatibility',
        detail:
          'Start the app in safe or no-add-in mode where supported (Office apps: hold Ctrl while launching, or run the executable with /safe). Try a new test file, and try a different Windows user profile if available. Check Properties > Compatibility has no odd settings.',
        commandIds: ['outlook-safe'],
        lookFor: 'Whether the crash stops without add-ins, with a new file, or under another profile.',
        meaning: 'Fixed in safe mode means an add-in. Fixed with a new file means the data file is damaged. Fixed under another profile means a profile-level setting or cache.',
        ifAbnormal: 'Disable the add-in permanently, restore the file from backup, or reset the application settings for that user (backup first).',
      },
      {
        id: 's6',
        title: 'Check updates, drivers and security software',
        detail:
          'Compare the app version with the current vendor release. Check Windows Update history for recent installs. For graphics-heavy apps check the display driver in Device Manager. Review whether security software logged blocks for the app.',
        commandIds: ['get-hotfix', 'get-mpcomputerstatus'],
        lookFor: 'Out-of-date app or driver, a recent update date matching the first crash, or security block entries.',
        meaning: 'Version mismatches and driver incompatibility are common crash causes.',
        ifAbnormal: 'Update or roll back the relevant component. If security software is blocking a legitimate app, raise an exclusion request via the proper change process rather than disabling protection.',
      },
      {
        id: 's7',
        title: 'Repair or reinstall the application',
        detail:
          'Settings > Apps > Installed apps > (app) > Advanced options > Repair, or Modify > Repair for Office. If that fails, uninstall and reinstall from the approved source.',
        lookFor: 'Whether the app is stable after repair.',
        meaning: 'Success means a damaged install. Failure after clean reinstall means the cause is outside the app.',
        ifAbnormal: 'Escalate to the vendor with Event Viewer details, or move to the system corruption workflow.',
      },
    ],
    causes: [
      {
        cause: 'Faulty or incompatible add-in/plug-in',
        indicators: 'Safe/no-add-in mode is stable; faulting module is a third-party DLL.',
      },
      {
        cause: 'Corrupt document, data file or user cache',
        indicators: 'Only fails with one file or one user profile; new file works.',
      },
      {
        cause: 'Damaged application install or out-of-date version',
        indicators: 'Faulting module is the app itself; repair or update resolves it.',
      },
      {
        cause: 'Driver conflict (graphics, printer, peripheral)',
        indicators: 'Crash on print, display or hardware actions; faulting module is a driver DLL; began after driver update.',
      },
      {
        cause: 'Insufficient resources',
        indicators: 'Low memory or disk space, hangs under heavy load, memory growing over time.',
      },
      {
        cause: 'System file corruption or failing hardware',
        indicators: 'Several unrelated applications crash, system DLLs faulting, memory or disk warnings in the System log.',
      },
    ],
    remediation: [
      {
        title: 'Disable or update the problem add-in',
        detail: 'Turn off the identified add-in, update it to the supported version, or remove it if not required.',
      },
      {
        title: 'Repair the application',
        detail: 'Run the built-in Repair option, update to the latest supported version, then retest.',
      },
      {
        title: 'Reset application data or profile for the user',
        detail:
          'Rename (do not delete) the application settings folder or create a new app profile so the old one can be restored.',
        caution:
          'Back up first. Some caches hold unsynced local data (for example Outlook OST/PST). Confirm what is stored locally before resetting.',
      },
      {
        title: 'Update or roll back the driver',
        detail: 'Install the manufacturer driver, or use Device Manager > Properties > Driver > Roll Back Driver if the issue began after an update.',
        caution: 'May need a restart. Record the original driver version.',
      },
      {
        title: 'Reinstall the application',
        detail: 'Uninstall, restart, then install the current approved version from your software source.',
        caution: 'Confirm licensing and that local data or settings are backed up before uninstalling.',
      },
    ],
    verification: [
      'The user repeats the original action that caused the crash and it completes.',
      'No new Application Error or Application Hang events for that app after use.',
      'Stable after restarting the app and after a full device restart.',
      'Reliability Monitor shows no new failures over the following days.',
    ],
    documentation: [
      'Application name and version, and exact trigger',
      'Event Viewer entry: faulting module, exception code, time',
      'What isolation tests were done (safe mode, new file, other profile) and results',
      'What was changed (add-in disabled, repair, update) and how to undo it',
      'Whether the issue is user-specific, device-specific or widespread',
    ],
    skills: ['windows', 'troubleshooting', 'investigation', 'customer-support'],
  },

  // ---------------------------------------------------------------- 3
  {
    id: 'win-update-failing',
    category: 'Windows',
    title: 'Windows Update problems',
    summary:
      'Windows Update fails to download or install, loops, rolls back or stays stuck. Check basics (space, time, connectivity, policy), then the update components and logs.',
    tags: ['windows update', 'patching', 'update failed', 'rollback', 'stuck', 'wuauserv'],
    symptoms: [
      'Update shows "Failed to install" or repeatedly retries',
      'Update stuck at a percentage or on "Working on updates" at restart',
      'Device reverts changes after restart',
      'Windows Update page shows an error code or never finishes checking',
      'Security patches missing on a device that should be compliant',
    ],
    initialChecks: [
      'Is the device managed by policy (WSUS, Intune/Windows Update for Business, deferral rings)? A policy may be intentionally holding updates.',
      'Is it one device or many? Many devices failing the same update suggests a bad update or an infrastructure issue.',
      'Is there enough free disk space and is the device on stable power and network?',
      'Is the user in the middle of an install right now? Do not power off during "Working on updates".',
      'Check backups exist before any servicing repair, and the device is authorised for the work.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Read the status and update history',
        detail:
          'Settings > Windows Update > Update history. Note which update fails, its KB number, the date, and any error code shown on the Windows Update page.',
        commandIds: ['get-hotfix'],
        lookFor: 'A specific update repeatedly failing, and the error code displayed.',
        meaning: 'One update failing repeatedly points to that update or a prerequisite. Every update failing points to the update components or environment.',
        ifAbnormal: 'Record the exact code and KB. Search Microsoft documentation for that exact code rather than guessing.',
      },
      {
        id: 's2',
        title: 'Check basics: space, date/time, power, network',
        detail:
          'Confirm at least several GB free on C: (feature updates need much more), correct date/time/time zone, and a working internet connection. Disconnect unneeded USB devices and docks for the update.',
        commandIds: ['get-volume', 'test-netconnection'],
        lookFor: 'Very low free space, wrong system clock, or no connectivity to Microsoft services.',
        meaning: 'These are common and easily fixed causes of failed downloads and installs.',
        ifAbnormal: 'Free space (see Disk / storage workflow), fix time sync, resolve connectivity or proxy/firewall blocks.',
      },
      {
        id: 's3',
        title: 'Check policy and management',
        detail:
          'Establish how updates are controlled. Review applied policies and join/management state.',
        commandIds: ['gpresult', 'gpupdate-force', 'dsregcmd-status'],
        lookFor: 'WSUS or update policy settings, deferral or pause settings, or conflicting policies.',
        meaning: 'Policy can legitimately block, defer or redirect updates, which looks like failure to the user.',
        ifAbnormal: 'If policy is the cause, raise with whoever manages the update rings. Do not override policy on a managed device without authorisation.',
      },
      {
        id: 's4',
        title: 'Run the Windows Update troubleshooter',
        detail:
          'Settings > System > Troubleshoot > Other troubleshooters > Windows Update > Run. Let it finish and apply any fixes, then retry the update.',
        lookFor: 'Reported and fixed problems, or "could not identify the problem".',
        meaning: 'It can reset basic components and clear simple blockers. A clean result does not rule out update problems.',
        ifAbnormal: 'Move to the logs and services.',
      },
      {
        id: 's5',
        title: 'Check update services and the client log',
        detail:
          'Confirm the Windows Update (wuauserv), Background Intelligent Transfer (BITS) and Cryptographic services are not disabled. In Event Viewer open Applications and Services Logs > Microsoft > Windows > WindowsUpdateClient > Operational and review failures around the install attempt.',
        commandIds: ['get-service', 'sc-query', 'get-winevent'],
        lookFor: 'Services disabled or stopped unexpectedly, and failure entries naming an update and result code.',
        meaning: 'Disabled services stop updates entirely. Log entries confirm which update and stage failed (download, install, commit).',
        ifAbnormal: 'Set affected services back to their default start type if they were changed, then retry. Otherwise note the code from the log.',
      },
      {
        id: 's6',
        title: 'Check system file and component store health',
        detail:
          'From an elevated prompt run the integrity checks in order: DISM health check/restore, then SFC (see the System file corruption workflow for how to interpret results).',
        commandIds: ['dism-checkhealth', 'dism-restorehealth', 'sfc-scannow'],
        lookFor: 'Component store corruption reported or repaired.',
        meaning: 'A damaged component store commonly blocks cumulative updates.',
        ifAbnormal: 'If DISM cannot repair, follow the corruption workflow and consider an in-place repair upgrade or reimage.',
      },
      {
        id: 's7',
        title: 'Reset update components or reinstall the update manually',
        detail:
          'If still failing, a Microsoft-documented reset of the update components (stop services, rename SoftwareDistribution and catroot2, restart services) may help, or download the specific update from the Microsoft Update Catalog and install it manually.',
        lookFor: 'Update installs successfully via the manual route.',
        meaning: 'Manual success suggests a download or cache problem. Manual failure with an error points to a deeper servicing problem.',
        ifAbnormal: 'Escalate, or plan an in-place upgrade repair using official Windows media.',
      },
    ],
    causes: [
      {
        cause: 'Insufficient disk space',
        indicators: 'Low free space on C:, failures at download or install stage.',
      },
      {
        cause: 'Corrupt update cache or component store',
        indicators: 'Same update fails repeatedly, DISM/SFC report corruption, resolves after cache reset.',
      },
      {
        cause: 'Policy, WSUS or management misconfiguration',
        indicators: 'Updates paused or deferred, policy references an unreachable update server, many devices affected.',
      },
      {
        cause: 'Network, proxy or firewall blocking Microsoft endpoints',
        indicators: 'Downloads stall or fail to start, other sites work, test connections fail.',
      },
      {
        cause: 'Driver or third-party software conflict',
        indicators: 'Rollback after restart, failure only on certain hardware, security or encryption software interference.',
      },
      {
        cause: 'Failing disk or memory',
        indicators: 'Random failures, other corruption signs, disk warnings in System log.',
      },
    ],
    remediation: [
      {
        title: 'Free space and retry',
        detail: 'Clear temporary files, remove unused apps, move user data to approved storage and rerun the update.',
        caution: 'Confirm with the user before deleting any files.',
      },
      {
        title: 'Restore update services to defaults',
        detail: 'Set the Windows Update, BITS and Cryptographic services back to their normal start types, start them, and retry.',
      },
      {
        title: 'Repair the component store',
        detail: 'Run DISM RestoreHealth followed by SFC, restart, and retry the update.',
        caution: 'Needs elevated access and internet or a valid source. Do not interrupt it.',
      },
      {
        title: 'Reset update components / manual install',
        detail: 'Follow Microsoft documented steps to rename the SoftwareDistribution and catroot2 folders (not delete), or install the KB from the Update Catalog.',
        caution: 'Requires admin rights and a restart. Note exactly what was renamed so it can be reversed.',
      },
      {
        title: 'In-place repair upgrade or reimage',
        detail: 'If the servicing stack remains broken, run a repair upgrade using official media (keeps files and apps) or reimage to the standard build.',
        caution: 'Back up first. Repair upgrades take a long time and can fail. Schedule outside working hours with the user.',
      },
    ],
    verification: [
      'Windows Update page shows "You are up to date" or the update appears under Update history as Successfully installed.',
      'The device remains stable after the restart and does not roll back.',
      'Get-HotFix or the installed updates list shows the expected KB.',
      'Compliance or management portal reports the device as patched (if applicable).',
    ],
    documentation: [
      'Update name/KB number and the exact error code observed',
      'Free disk space, management/policy state and network checks',
      'Event Viewer WindowsUpdateClient Operational findings',
      'Steps tried in order and what each did',
      'What was changed, any renamed folders, and how to undo it',
    ],
    skills: ['windows', 'endpoint-security', 'troubleshooting', 'vuln-awareness'],
  },

  // ---------------------------------------------------------------- 4
  {
    id: 'win-startup-problems',
    category: 'Windows',
    title: 'Startup / boot problems',
    summary:
      'Windows is slow to start, shows a black screen, hangs on the logo or loops in Automatic Repair. Decide quickly whether it is a software, boot configuration or hardware problem and protect the data.',
    tags: ['boot', 'startup', 'black screen', 'automatic repair', 'winre', 'safe mode'],
    symptoms: [
      'Very slow boot or long wait at the sign-in screen',
      'Black screen after the logo or after sign-in (sometimes with a cursor)',
      'Stuck on the Windows or manufacturer logo with a spinning circle',
      'Automatic Repair / "Preparing Automatic Repair" loop',
      'Blue screen with a stop code during startup',
    ],
    initialChecks: [
      'Does the device reach the manufacturer logo or BIOS/UEFI? If nothing at all, use the No power / boot workflow.',
      'What happened just before (update, power cut, forced shutdown, new hardware, driver install)?',
      'Is BitLocker enabled? Make sure the recovery key is available before changing anything in firmware or boot options.',
      'Does the user have important unsaved or unbacked-up data on this device?',
      'Disconnect USB drives, docks and external displays that may interfere with boot.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Establish where in the boot process it fails',
        detail:
          'Watch the boot. Note: firmware logo, Windows logo with spinner, sign-in screen, or black screen after sign-in. Note whether the drive activity light or fans respond.',
        lookFor: 'The last stage reached before failure.',
        meaning:
          'Fails before the Windows logo: firmware or boot device. Stuck at logo: boot files, drivers or disk. Black after sign-in: display driver or shell/profile issue.',
        ifAbnormal: 'Use the stage to choose the next step. If the firmware does not see the drive at all, suspect the disk or connection.',
      },
      {
        id: 's2',
        title: 'Remove external devices and test display basics',
        detail:
          'Remove USB devices, dock and extra monitors, then try booting. For a black screen with the device running, try Win+Ctrl+Shift+B to restart the graphics driver, Win+P to change projection mode, and Ctrl+Shift+Esc to see if Task Manager opens.',
        lookFor: 'Whether the display recovers or Task Manager appears.',
        meaning: 'A working system with a wrong display output points to a display driver or projection setting, not corruption.',
        ifAbnormal: 'If Task Manager opens, use Run new task to examine processes or services. Otherwise continue to recovery options.',
      },
      {
        id: 's3',
        title: 'Enter Windows Recovery Environment',
        detail:
          'Power the device on and force it off during the logo three times in a row (hold the power button), which normally triggers Automatic Repair and then Advanced options. Alternatively boot from official Windows installation media and choose Repair your computer.',
        lookFor: 'Whether the Advanced options screen appears (Startup Repair, Uninstall Updates, Startup Settings, Command Prompt).',
        meaning: 'Reaching WinRE confirms the disk and basic hardware are working. No WinRE at all suggests disk or firmware problems.',
        ifAbnormal: 'Boot from external recovery media. If the drive is not detected, treat as hardware failure.',
      },
      {
        id: 's4',
        title: 'Try Safe Mode',
        detail:
          'From WinRE: Troubleshoot > Advanced options > Startup Settings > Restart, then choose Safe Mode with Networking. If it boots, check Event Viewer, recent installs and drivers.',
        commandIds: ['get-winevent', 'reliability-monitor'],
        lookFor: 'Whether Windows is stable in Safe Mode, and what failed on the previous boot.',
        meaning: 'Works in Safe Mode but not normally: a driver, service or startup program is responsible.',
        ifAbnormal: 'Uninstall the recent update or driver, or disable startup items, then boot normally. If Safe Mode also fails, continue.',
      },
      {
        id: 's5',
        title: 'Run Startup Repair or uninstall a recent update',
        detail:
          'In WinRE choose Startup Repair. If a recent update is the suspect, use Uninstall Updates (latest quality update first). Take note of what each option reports.',
        lookFor: 'Whether the repair completes successfully or reports it could not repair the PC.',
        meaning: 'A failed repair log (SrtTrail.txt) indicates boot files, disk or hardware problems beyond simple repair.',
        ifAbnormal: 'Check disk health and consider boot record repair (next step).',
      },
      {
        id: 's6',
        title: 'Check the disk and repair boot files',
        detail:
          'From WinRE Command Prompt identify the Windows drive letter (it may not be C:). Check the disk with chkdsk <drive>: /scan first. Boot record repair uses bootrec /scanos, /fixmbr, /fixboot and /rebuildbcd as appropriate for the firmware mode.',
        commandIds: ['chkdsk', 'diskpart-list-disk'],
        lookFor: 'Disk errors, missing or unreadable Windows installation, or a missing boot partition.',
        meaning: 'Boot files damaged but disk healthy: repairable. Many bad sectors or an unrecognised disk: failing storage.',
        ifAbnormal: 'Stop repair attempts on a failing disk. Recover data first (step 7) and replace the drive.',
      },
      {
        id: 's7',
        title: 'Protect data and decide on rebuild',
        detail:
          'If Windows will not start, copy important user data out via WinRE Command Prompt, a bootable recovery environment, or by connecting the drive to another machine. Have the BitLocker recovery key ready if the drive is encrypted.',
        commandIds: ['manage-bde-status'],
        lookFor: 'Whether data is accessible and whether BitLocker is protecting the volume.',
        meaning: 'Accessible data allows a safe reset or reimage. Inaccessible data may need specialist recovery.',
        ifAbnormal: 'If data is critical and the disk is failing, stop and escalate. Avoid repeated power cycling, which can worsen a dying drive.',
      },
    ],
    causes: [
      {
        cause: 'Failed or partial Windows update',
        indicators: 'Began right after an update or interrupted shutdown; Uninstall Updates or Safe Mode helps.',
      },
      {
        cause: 'Corrupt boot configuration or system files',
        indicators: 'Startup Repair fails, boot files missing, cured by bootrec or repair install.',
      },
      {
        cause: 'Faulty driver or startup program',
        indicators: 'Safe Mode works, normal mode hangs or black screens; recent driver install.',
      },
      {
        cause: 'Failing disk or loose storage connection',
        indicators: 'Disk not detected in firmware or WinRE, clicking noises, errors in chkdsk, very slow file access.',
      },
      {
        cause: 'Display driver or output problem',
        indicators: 'Device is running (sounds, drive activity) but screen is black; Win+Ctrl+Shift+B or Win+P changes behaviour.',
      },
      {
        cause: 'Firmware or BitLocker recovery trigger',
        indicators: 'Blue BitLocker recovery screen after hardware or firmware change; boot order changed.',
      },
    ],
    remediation: [
      {
        title: 'Uninstall the offending update or driver',
        detail: 'Use WinRE Uninstall Updates or Safe Mode to remove the latest quality update or the recently installed driver.',
        caution: 'Record what was removed so it can be reinstalled later. Security updates should be re-applied once the underlying issue is fixed.',
      },
      {
        title: 'Run Startup Repair / rebuild boot configuration',
        detail: 'Use Startup Repair first, then bootrec options and rebuild BCD if needed.',
        caution: 'Boot record commands need to be matched to UEFI/GPT or legacy/MBR. Wrong choices can leave the PC unbootable. Image or copy data first if it matters.',
      },
      {
        title: 'Disable troublesome startup items',
        detail: 'In Safe Mode or a clean boot, disable non-essential startup apps and services, then re-enable one at a time.',
        caution: 'Never disable security agents as a fix. Record every change.',
      },
      {
        title: 'Replace failing storage and restore',
        detail: 'If the drive is failing, replace it and restore from backup or reimage.',
        caution: 'Copy data first where possible. Confirm BitLocker recovery key access. Do not keep power cycling a failing drive.',
      },
      {
        title: 'Reset or reimage',
        detail: 'If the OS is unrecoverable and hardware is healthy, use Reset this PC or reimage with the standard build.',
        caution: 'Destroys local data and settings. Only with a verified backup and authorisation.',
      },
    ],
    verification: [
      'Device boots to the sign-in screen and the desktop without intervention.',
      'Boots successfully after at least two further restarts, including a cold power-on.',
      'No unexpected shutdown or critical boot errors in Event Viewer after startup.',
      'Boot time is reasonable and the user can open their normal applications and files.',
    ],
    documentation: [
      'Exact boot stage where it failed, and what happened just before',
      'Any stop code, error screen or repair log result',
      'Data backup/copy status and BitLocker recovery key handling',
      'Repairs attempted in order, and results',
      'What was changed or removed and how to undo it',
    ],
    skills: ['windows', 'hardware', 'troubleshooting', 'endpoint-security'],
  },

  // ---------------------------------------------------------------- 5
  {
    id: 'win-disk-storage',
    category: 'Windows',
    title: 'Disk / storage issues',
    summary:
      'Low free space, constant high disk activity or signs that a drive is failing. Separate capacity problems from performance problems from genuine hardware faults.',
    tags: ['disk space', 'storage', 'high disk usage', 'chkdsk', 'failing drive', 'cleanup'],
    symptoms: [
      'Low disk space warnings or updates failing for lack of space',
      'Task Manager shows disk at or near 100% active time',
      'Files take a long time to open, copy or save',
      'Disk-related errors or warnings in Event Viewer',
      'Clicking or grinding noises, files vanishing or corruption messages',
    ],
    initialChecks: [
      'Is the problem capacity (full drive), performance (busy drive) or reliability (errors)? They are fixed differently.',
      'Is the system drive an SSD or a mechanical HDD?',
      'Are there recent backups of the important data? Confirm before any repair or cleanup.',
      'What changed recently (large download, sync client enabled, new update, new software)?',
      'If drive failure is suspected, avoid heavy use and prioritise backing up the data.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Check capacity and drive layout',
        detail:
          'Check free space on each volume and the layout of physical disks.',
        commandIds: ['get-volume', 'get-physicaldisk', 'diskpart-list-disk'],
        lookFor: 'Volumes with little free space, and the media type (SSD/HDD) and health status of each physical disk.',
        meaning: 'Under about 10-15% free is a problem on the system drive. HealthStatus other than Healthy is a hardware warning.',
        ifAbnormal: 'If HealthStatus is Warning or Unhealthy, go straight to the RAM and storage hardware health workflow and back up data.',
      },
      {
        id: 's2',
        title: 'Find what is using space',
        detail:
          'Settings > System > Storage shows categories (Apps, Temporary files, Documents). Expand Temporary files and Show more categories. Check the user profile folder size, the Downloads folder, OneDrive offline copies and old Windows.old.',
        lookFor: 'Very large user folders, old installers, recycle bin, local mail caches, or Windows.old.',
        meaning: 'Identifies what can be moved, archived or safely cleaned.',
        ifAbnormal: 'Agree with the user what can be moved or removed. Never delete user files without confirming.',
      },
      {
        id: 's3',
        title: 'Find what is causing high disk activity',
        detail:
          'Task Manager > Processes, sort by Disk. Open Resource Monitor (resmon) > Disk tab for per-file activity and response time. Note whether the culprit is Windows Update, Defender scan, search indexing, OneDrive sync, backup or an application.',
        commandIds: ['get-process', 'tasklist'],
        lookFor: 'A single process responsible, a scan or update that will finish, or high activity with very low throughput.',
        meaning: 'Temporary activity from scans and updates is normal. 100% active time with tiny throughput on an HDD suggests a struggling drive or heavy random I/O.',
        ifAbnormal: 'Allow scheduled work to finish, reschedule scans, or investigate the process if unfamiliar.',
      },
      {
        id: 's4',
        title: 'Check logs for disk errors',
        detail:
          'Event Viewer > Windows Logs > System. Filter by Level Error and Warning and look at disk, storage and NTFS related sources around times of slowness or freezes. Open Reliability Monitor for the timeline.',
        commandIds: ['get-winevent', 'reliability-monitor'],
        lookFor: 'Repeated disk or file system errors, controller resets, or retries.',
        meaning: 'Repeated disk errors in the log indicate media or connection trouble and raise the urgency of backup and replacement.',
        ifAbnormal: 'Back up immediately. Do not run repair tools that write to a failing disk until data is safe.',
      },
      {
        id: 's5',
        title: 'Check file system health (read-only first)',
        detail:
          'From an elevated prompt run chkdsk with no repair switch, or chkdsk C: /scan for an online scan. This reports problems without fixing them.',
        commandIds: ['chkdsk'],
        lookFor: 'Whether Windows reports it found no problems or found file system errors.',
        meaning: 'File system errors may follow an unexpected shutdown. Errors alongside hardware warnings suggest failing media.',
        ifAbnormal: 'If errors are reported and data is backed up, schedule a repair at the next restart. On SSDs CHKDSK rarely fixes performance or health problems, so do not treat it as the answer.',
      },
      {
        id: 's6',
        title: 'Check encryption and drive configuration before changes',
        detail:
          'Before moving partitions, replacing drives or doing firmware work, check BitLocker state and confirm the recovery key is stored.',
        commandIds: ['manage-bde-status'],
        lookFor: 'Whether the volume is encrypted and whether protection is on.',
        meaning: 'Encrypted drives can trigger recovery after hardware changes.',
        ifAbnormal: 'Confirm access to the recovery key (Entra ID, AD or the documented store) before any work.',
      },
      {
        id: 's7',
        title: 'Decide: clean up, repair or replace',
        detail:
          'Combine the findings: capacity issue only, performance issue from a process, file system errors, or hardware warnings.',
        lookFor: 'Which category fits best.',
        meaning: 'Capacity and process problems are fixed in software. Hardware warnings mean replacement.',
        ifAbnormal: 'For failing hardware, back up, replace the drive and restore or reimage.',
      },
    ],
    causes: [
      {
        cause: 'Drive nearly full',
        indicators: 'Low free space, failed updates, Storage settings show large categories.',
      },
      {
        cause: 'Background scan, indexing, sync or update',
        indicators: 'Specific process at the top of disk usage; activity subsides after it finishes.',
      },
      {
        cause: 'Mechanical hard drive as system disk',
        indicators: 'Disk active time at 100% with low throughput, slow everything, HDD media type.',
      },
      {
        cause: 'File system errors after unexpected shutdown',
        indicators: 'CHKDSK reports errors, NTFS entries in the System log, history of power loss.',
      },
      {
        cause: 'Failing drive or storage controller/cable',
        indicators: 'Unhealthy status, repeated disk errors, bad sectors, disappearing drive, clicking noises.',
      },
    ],
    remediation: [
      {
        title: 'Clean up temporary and unneeded files',
        detail: 'Use Storage Sense or Disk Cleanup for temporary files and the Recycle Bin. Uninstall unused applications with the user.',
        caution: 'Do not delete anything from user folders without confirmation. Removing Windows.old prevents rolling back an upgrade.',
      },
      {
        title: 'Move or archive large data',
        detail: 'Move large files to OneDrive, a file server or external storage per policy, and verify copies before removing originals.',
        caution: 'Verify the copy is complete and accessible before deleting the source.',
      },
      {
        title: 'Reschedule or tune heavy background work',
        detail: 'Let scans and updates complete, reschedule backups or scans out of hours, and check sync clients are not re-syncing huge libraries.',
      },
      {
        title: 'Repair file system errors',
        detail: 'After backing up, run chkdsk with the repair option and restart if prompted.',
        caution: 'Can cause data loss if the disk is failing. Needs a restart for the system drive. Backup first.',
      },
      {
        title: 'Replace the drive',
        detail: 'For unhealthy drives or HDDs in unsuitable roles, fit an SSD, then restore from backup or reimage.',
        caution: 'Back up first, power off and disconnect power before opening, use ESD care, and confirm BitLocker recovery key access.',
      },
    ],
    verification: [
      'Free space on the system drive is at a healthy level and updates now proceed.',
      'Disk active time returns to normal at idle after restart.',
      'Get-PhysicalDisk reports Healthy and no new disk errors appear in the System log.',
      'Copies of moved data are confirmed intact and accessible to the user.',
    ],
    documentation: [
      'Free space before and after, and drive type',
      'Process or cause of high disk activity',
      'Disk health status and any error events observed',
      'Files moved or deleted (with user agreement) and where they went',
      'Backup status, any repair/replacement and how to undo changes',
    ],
    skills: ['windows', 'hardware', 'troubleshooting', 'documentation'],
  },

  // ---------------------------------------------------------------- 6
  {
    id: 'win-system-corruption',
    category: 'Windows',
    title: 'System file corruption',
    summary:
      'Windows shows signs of damaged system files or component store. Use the DISM then SFC repair path in the right order, and know when to stop and reimage.',
    tags: ['sfc', 'dism', 'corruption', 'component store', 'repair install', 'reimage'],
    symptoms: [
      'Built-in apps or Windows features fail to open or crash',
      'Windows Update fails repeatedly with servicing errors',
      'Blue screens or errors referencing system files',
      'Settings or Start menu behave oddly or fail to load',
      'SFC reports it found corrupt files that it could not fix',
    ],
    initialChecks: [
      'Confirm that you have authorisation and admin rights, and that the user is aware of possible long run times.',
      'Back up user data or confirm it is in OneDrive/server storage before running repairs.',
      'Is it one device or several? Several devices with the same fault may point to a bad update or image.',
      'Check disk and memory health first if symptoms are random: corruption can be a symptom of failing hardware.',
      'Make sure the device is on AC power and has a working internet connection (DISM may need Windows Update).',
    ],
    steps: [
      {
        id: 's1',
        title: 'Rule out hardware and malware as the underlying cause',
        detail:
          'Check disk health, available space and Defender status. Review the System log for disk or memory warnings.',
        commandIds: ['get-physicaldisk', 'get-mpcomputerstatus', 'get-winevent'],
        lookFor: 'Unhealthy disks, repeated disk errors, memory errors or malware detections.',
        meaning: 'Repairing software on top of failing hardware or an active infection is wasted effort.',
        ifAbnormal: 'Address the hardware or security problem first (see the hardware health workflow, or escalate as an incident).',
      },
      {
        id: 's2',
        title: 'Run DISM CheckHealth',
        detail:
          'Open an elevated Command Prompt or PowerShell (Run as administrator) and run DISM /Online /Cleanup-Image /CheckHealth. This is quick and only checks whether corruption has already been flagged.',
        commandIds: ['dism-checkhealth'],
        lookFor: 'No component store corruption detected, or the component store is repairable.',
        meaning: 'Repairable means DISM RestoreHealth is the correct next step. No corruption flagged does not guarantee there is none.',
        ifAbnormal: 'Continue to RestoreHealth.',
      },
      {
        id: 's3',
        title: 'Run DISM RestoreHealth',
        detail:
          'Run DISM /Online /Cleanup-Image /RestoreHealth. It needs internet access to Windows Update, or a valid repair source specified with /Source. Allow it to complete; progress may appear to pause for long periods.',
        commandIds: ['dism-restorehealth'],
        lookFor: 'The operation completed successfully, or an error that the source files could not be found.',
        meaning: 'Success means the component store has been repaired. A source error means DISM could not get clean files (no internet, blocked WSUS, or a mismatched source).',
        ifAbnormal: 'Check connectivity and update policy, or provide a matching install media source. Review C:\\Windows\\Logs\\DISM\\dism.log.',
      },
      {
        id: 's4',
        title: 'Run SFC',
        detail:
          'After DISM, run sfc /scannow from the elevated prompt. Let it reach 100%.',
        commandIds: ['sfc-scannow'],
        lookFor: 'One of: no integrity violations; found and repaired; found corrupt files but could not fix some.',
        meaning: 'The first means files are fine. The second means repaired successfully. The third means the component store or the files need further repair.',
        ifAbnormal: 'Run DISM RestoreHealth again then SFC again. If it still cannot repair, review CBS.log (filter lines containing [SR]) at C:\\Windows\\Logs\\CBS\\CBS.log.',
      },
      {
        id: 's5',
        title: 'Re-test the original symptom',
        detail:
          'Restart the device and repeat the action that was failing (app, feature, Windows Update).',
        lookFor: 'Whether the symptom is gone.',
        meaning: 'Resolved means corruption was the cause. Unchanged suggests the cause is elsewhere (driver, profile, app) or the corruption is deeper.',
        ifAbnormal: 'Test with a new user profile to rule out profile-level issues; consider an in-place repair upgrade.',
      },
      {
        id: 's6',
        title: 'Decide: repair install or reimage',
        detail:
          'If SFC/DISM repeatedly fail, or corruption keeps returning, stop spending time on tools. Weigh up an in-place repair upgrade with official Windows media (keeps apps and files) against a reimage to the standard build.',
        lookFor: 'Repeat corruption after repair, hardware warnings, or time spent exceeding the cost of a rebuild.',
        meaning: 'Recurring corruption often means failing storage or memory. Persistent servicing failure is cheaper to rebuild than to chase.',
        ifAbnormal: 'Back up verified data, then reimage. If hardware is suspected, test before restoring user data to the same disk.',
      },
    ],
    causes: [
      {
        cause: 'Interrupted update or unexpected power loss',
        indicators: 'Began after a failed update or abrupt shutdown; DISM repairs successfully.',
      },
      {
        cause: 'Failing disk or memory',
        indicators: 'Corruption returns after repair; disk or memory warnings; random crashes across apps.',
      },
      {
        cause: 'Malware or aggressive software removal',
        indicators: 'Security detections, missing system files after cleanup tools, unusual processes.',
      },
      {
        cause: 'Damaged component store with no repair source',
        indicators: 'DISM RestoreHealth fails with source errors; Windows Update blocked by policy.',
      },
      {
        cause: 'Bad update or image',
        indicators: 'Multiple devices from the same build or update show the same fault.',
      },
    ],
    remediation: [
      {
        title: 'DISM RestoreHealth then SFC',
        detail: 'Run in that order from an elevated prompt, restart, and retest. Repeat once if SFC reports unrepaired files.',
        caution: 'Needs admin rights and can take a long time. Do not interrupt or power off.',
      },
      {
        title: 'Supply a repair source',
        detail: 'If DISM cannot reach Windows Update, mount matching Windows installation media and point DISM at its install image with /Source.',
        caution: 'The source must match the installed edition and build closely, or the repair fails.',
      },
      {
        title: 'In-place repair upgrade',
        detail: 'Run setup from official media and choose to keep personal files and apps.',
        caution: 'Back up first. It is a major servicing operation and can fail. Schedule time and keep the device on AC power.',
      },
      {
        title: 'Reimage / reset',
        detail: 'Rebuild to the standard image and restore user data from backup.',
        caution: 'Destroys local data and settings. Only with a verified backup and authorisation. Test hardware first if corruption keeps recurring.',
      },
    ],
    verification: [
      'SFC reports no integrity violations after a final run (following a DISM RestoreHealth).',
      'The original symptom (app, feature or update) no longer occurs after a restart.',
      'Windows Update completes cleanly (if it was affected).',
      'No recurrence over the following days, and no new disk or memory errors in the System log.',
    ],
    documentation: [
      'Symptoms and what led you to suspect corruption',
      'Exact output of each DISM and SFC run (including any error text)',
      'Hardware and malware checks done before repair',
      'Backup status and the decision on repair upgrade versus reimage',
      'What was changed, time spent and how to undo it',
    ],
    skills: ['windows', 'troubleshooting', 'endpoint-security', 'documentation'],
  },

  // ---------------------------------------------------------------- 7
  {
    id: 'win-user-profile',
    category: 'Windows',
    title: 'User profile problems',
    summary:
      'A user signs in to a temporary profile, the profile will not load, or their Desktop and files seem to be missing. Protect the data first, then work out whether the profile is damaged or simply redirected.',
    tags: ['user profile', 'temporary profile', 'missing desktop', 'ntuser.dat', 'profile corrupt', 'onedrive'],
    symptoms: [
      'Message that you have been signed in with a temporary profile',
      '"The User Profile Service failed the sign-in" or the profile cannot be loaded',
      'Desktop, Documents or settings look reset or missing after sign-in',
      'Sign-in is very slow or loops back to the sign-in screen',
      'Changes made in the session are lost at sign-out',
    ],
    initialChecks: [
      'Do NOT delete the profile. Establish first whether the data still exists on disk or in OneDrive/server redirection.',
      'Is the account local, domain, or Entra ID (Microsoft 365)? Folder redirection and OneDrive Known Folder Move change where files live.',
      'Is it only this user, or several users on the device or several devices? Several suggests disk, policy or server issues.',
      'What changed recently (update, forced shutdown, disk full, antivirus, profile migration)?',
      'Confirm a backup of C:\\Users\\<name> exists or take one before any repair.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Confirm who is signed in and which profile is loaded',
        detail:
          'Have the user sign in, open a prompt and check the account and profile path. A temporary profile usually shows a path like C:\\Users\\TEMP or a name with a .000 suffix.',
        commandIds: ['whoami', 'whoami-all', 'quser'],
        lookFor: 'The account name, the profile path, and whether other users are signed in.',
        meaning: 'A TEMP path confirms Windows failed to load the real profile. A normal path with missing files points to redirection or a sync issue instead.',
        ifAbnormal: 'Sign the user out cleanly and continue without making further changes in the temporary session.',
      },
      {
        id: 's2',
        title: 'Check free space and disk health',
        detail:
          'A full or failing system disk is a common reason a profile cannot load.',
        commandIds: ['get-volume', 'get-physicaldisk'],
        lookFor: 'Little or no free space on C:, or an unhealthy disk.',
        meaning: 'The profile service cannot write the profile hive or temp files when the disk is full.',
        ifAbnormal: 'Free space, then retest. For disk problems follow the Disk / storage workflow.',
      },
      {
        id: 's3',
        title: 'Read the event logs',
        detail:
          'Event Viewer > Windows Logs > Application and System. Look for entries from the User Profile Service (source User Profile Service) around the sign-in time, such as warnings that the local profile could not be found or loaded.',
        commandIds: ['get-winevent'],
        lookFor: 'User Profile Service events naming the profile, with the reason text.',
        meaning: 'The message text usually states whether the profile is missing, locked, corrupt or has a SID mismatch.',
        ifAbnormal: 'Record the exact message text. A recurring disk or permissions message points to the disk or security software.',
      },
      {
        id: 's4',
        title: 'Check the profile folder and ProfileList entries',
        detail:
          'Check C:\\Users for the user folder and any leftover TEMP or .bak folders. Compare with the user SID (whoami /user). In the registry (regedit, read only to look) check HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList for the SID key and whether a matching key ending in .bak exists.',
        commandIds: ['whoami-all', 'get-localuser'],
        lookFor: 'A SID key with .bak suffix, a ProfileImagePath pointing at a missing folder, or two keys for the same SID.',
        meaning: 'A .bak duplicate is the classic cause of a temporary profile after an unclean sign-out or failed profile load.',
        ifAbnormal: 'Back up the registry key and the user folder before editing. If you are not confident, create a new profile and migrate data instead.',
      },
      {
        id: 's5',
        title: 'Locate the missing files',
        detail:
          'If files seem missing, check the original profile folder in C:\\Users, the OneDrive folder and online OneDrive/SharePoint, and any folder redirection path. Check whether Known Folder Move changed Desktop and Documents to OneDrive locations.',
        lookFor: 'The files in the old profile folder, in OneDrive online, or in a redirected location.',
        meaning: 'Files normally still exist; the user is just looking at a different or temporary profile.',
        ifAbnormal: 'Copy the data to safe storage before any further changes. Escalate if data is genuinely absent.',
      },
      {
        id: 's6',
        title: 'Test with a fresh profile and check policy',
        detail:
          'Create a new test account or have the user sign in to another device. Review applied policies for the user, including roaming, redirection and login scripts.',
        commandIds: ['gpresult', 'gpupdate-force', 'net-user'],
        lookFor: 'Whether a new profile loads normally and whether policy applies as expected.',
        meaning: 'New profile OK and the old one not: the old profile is damaged. Both fail: system, disk or policy problem.',
        ifAbnormal: 'For a damaged profile, build a new one and migrate data (see remediation). For policy issues, involve whoever manages the policy.',
      },
    ],
    causes: [
      {
        cause: 'Corrupt profile registry hive (NTUSER.DAT) or profile folder',
        indicators: 'User Profile Service errors, temporary profile after unclean shutdown, new profile works.',
      },
      {
        cause: 'Stale .bak ProfileList registry entry',
        indicators: 'Two registry keys for the same SID, one with .bak, path pointing to a missing or wrong folder.',
      },
      {
        cause: 'Disk full or failing',
        indicators: 'Little free space, disk warnings, multiple users affected.',
      },
      {
        cause: 'Security software or permissions blocking the profile',
        indicators: 'Access denied entries, began after security changes or a profile folder permission change.',
      },
      {
        cause: 'Redirection or OneDrive sync change (files not actually lost)',
        indicators: 'Files exist in OneDrive online or old profile; Desktop path points to a different location.',
      },
    ],
    remediation: [
      {
        title: 'Back up the existing profile first',
        detail: 'Copy C:\\Users\\<name> (including hidden files) to external or approved storage, or confirm OneDrive/server copies are complete.',
        caution: 'Do this before every other remediation step. Never delete the original profile until the user confirms their data is recovered.',
      },
      {
        title: 'Free disk space and restart',
        detail: 'Resolve capacity issues, restart, and test sign-in again. Sometimes this alone clears a temporary profile.',
      },
      {
        title: 'Repair the ProfileList entry',
        detail: 'With a registry backup, remove or rename the incorrect .bak/duplicate SID key as per Microsoft guidance so the SID points at the correct profile path, then restart.',
        caution: 'Registry edits need admin rights and can prevent sign-in if wrong. Export the key first and record exactly what was changed.',
      },
      {
        title: 'Create a new profile and migrate data',
        detail: 'Sign in so a new profile is created, copy documents and key data (Desktop, Documents, Downloads, browser favourites, Outlook data as appropriate), then reconfigure apps and sync.',
        caution: 'Do not copy NTUSER.DAT or system files across. Confirm email, OneDrive and app sign-ins afterwards. The old profile folder should be kept until the user is happy.',
      },
      {
        title: 'Restore redirection or sync',
        detail: 'If files are redirected, restore the redirection or OneDrive Known Folder Move settings and allow sync to complete.',
      },
    ],
    verification: [
      'The user signs in and whoami / the profile path shows their normal profile, not TEMP.',
      'Desktop, Documents and expected files are present and the user confirms nothing is missing.',
      'Settings and changes persist after signing out and in again, and after a restart.',
      'No further User Profile Service errors in the Application log.',
    ],
    documentation: [
      'Which account type and the exact message the user saw',
      'Event Viewer entries from User Profile Service and the profile path observed',
      'Backup taken (what, where, date) before changes',
      'Registry or folder changes made, with exported originals to undo',
      'Data migration performed and confirmation from the user',
    ],
    skills: ['windows', 'identity-access', 'troubleshooting', 'customer-support'],
  },

  // ---------------------------------------------------------------- 8
  {
    id: 'win-driver-device-manager',
    category: 'Windows',
    title: 'Driver issues / Device Manager errors',
    summary:
      'A device shows a yellow warning triangle or error code in Device Manager, or hardware misbehaves after a driver change. Identify the code, then update, roll back or reinstall the right driver.',
    tags: ['driver', 'device manager', 'yellow bang', 'code 10', 'code 43', 'rollback'],
    symptoms: [
      'Yellow triangle (warning) on a device in Device Manager',
      'Device shows "This device cannot start (Code 10)" or "Windows has stopped this device because it has reported problems (Code 43)"',
      'Wi-Fi, audio, graphics, Bluetooth or USB stops working after an update',
      'Unknown device listed with no driver',
      'Blue screens or crashes naming a driver',
    ],
    initialChecks: [
      'Which device, and did it ever work? Note when it stopped and what changed (Windows update, driver update, new hardware, BIOS update).',
      'Is the device internal or external? For external devices, try a different port or cable before blaming the driver.',
      'Is internet access affected? A missing network driver may need the installer from another machine.',
      'Is the device managed? Drivers may be controlled by policy, Intune or the vendor tool; check before installing manually.',
      'Create a restore point or confirm a backup before making broad driver changes.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Open Device Manager and note the status',
        detail:
          'Right-click Start > Device Manager. Expand categories and look for warning icons. Double-click the device, read the Device status box and note the error code and text.',
        lookFor: 'The exact code and message, for example Code 10, 22 (disabled), 28 (drivers not installed), 31, 43.',
        meaning:
          'Code 10: device cannot start. Code 22: device is disabled. Code 28: no driver installed. Code 43: Windows stopped the device because it reported problems (driver or hardware fault).',
        ifAbnormal: 'Disabled (22): right-click and Enable. Otherwise carry on with the steps below.',
      },
      {
        id: 's2',
        title: 'Check the device is present and review the Details',
        detail:
          'In the device properties note the Hardware IDs (Details tab) and the driver provider, date and version (Driver tab). You can also list problem devices from PowerShell with Get-PnpDevice -PresentOnly | Where-Object Status -ne OK.',
        lookFor: 'Driver provider (Microsoft generic vs manufacturer), driver date, and any devices reporting Error or Unknown.',
        meaning: 'A generic Microsoft driver may work but lack features. A very old or newly changed driver date helps correlate with the start of the fault.',
        ifAbnormal: 'Use the hardware ID to confirm the right vendor driver.',
      },
      {
        id: 's3',
        title: 'Check the System log and recent changes',
        detail:
          'Event Viewer > Windows Logs > System for device and driver related errors around the time of the fault. Check Windows Update history and installed hotfixes for drivers installed automatically.',
        commandIds: ['get-winevent', 'get-hotfix', 'reliability-monitor'],
        lookFor: 'Driver install events, failures, or a recent update that matches the start of the problem.',
        meaning: 'An automatic driver update immediately before the fault strongly suggests that driver.',
        ifAbnormal: 'Plan a rollback (step 4).',
      },
      {
        id: 's4',
        title: 'Roll back the driver if it recently changed',
        detail:
          'Device properties > Driver tab > Roll Back Driver (only available if a previous driver is stored). Restart if asked.',
        lookFor: 'Whether the device starts working after rollback.',
        meaning: 'Success means the newer driver was faulty or incompatible. Not available means no previous version is stored.',
        ifAbnormal: 'Install a known-good version from the manufacturer.',
      },
      {
        id: 's5',
        title: 'Install the vendor driver for the exact model',
        detail:
          'Download the driver from the device or PC manufacturer support page for the exact model and Windows version (or via the approved management tool). Install it, preferring the vendor installer over generic packs. Restart afterwards.',
        lookFor: 'Whether the device status changes to "This device is working properly".',
        meaning: 'Vendor-matched drivers resolve most Code 28 and many Code 10/43 cases.',
        ifAbnormal: 'Uninstall the device (tick "Attempt to remove the driver" only if sure), restart and let Windows redetect, then install the vendor driver.',
      },
      {
        id: 's6',
        title: 'Check power management, firmware and connections',
        detail:
          'On USB and network adaptors untick "Allow the computer to turn off this device to save power" under Power Management if it applies. Check for BIOS/UEFI or device firmware updates from the vendor. Reseat external devices and try different ports.',
        commandIds: ['powercfg-batteryreport'],
        lookFor: 'Devices that fail after sleep or resume, or only on certain ports.',
        meaning: 'Resume failures and port-specific faults indicate power management or physical connection problems rather than corrupt drivers.',
        ifAbnormal: 'Before any BIOS/UEFI update, confirm AC power and suspend BitLocker; have the recovery key to hand.',
      },
      {
        id: 's7',
        title: 'Distinguish software from hardware faults',
        detail:
          'Test the device on another computer or boot another OS/Windows environment. Persisting Code 43 or no detection in firmware suggests hardware failure.',
        lookFor: 'Whether the device fails the same way elsewhere.',
        meaning: 'Same failure elsewhere indicates a hardware fault. Works elsewhere indicates a driver or configuration problem on this machine.',
        ifAbnormal: 'Raise hardware replacement or warranty repair. For system-wide oddities see System file corruption.',
      },
    ],
    causes: [
      {
        cause: 'Faulty or incompatible driver update',
        indicators: 'Began right after a Windows or driver update; Roll Back Driver fixes it.',
      },
      {
        cause: 'Missing or generic driver',
        indicators: 'Code 28 or Unknown device, Microsoft generic provider, works after vendor driver install.',
      },
      {
        cause: 'Device disabled or power management issue',
        indicators: 'Code 22, or device vanishes after sleep; Power Management setting changes behaviour.',
      },
      {
        cause: 'Hardware fault, cable or port issue',
        indicators: 'Persistent Code 43 or Code 10 after clean driver install; fails on other machines.',
      },
      {
        cause: 'Outdated firmware or BIOS',
        indicators: 'Vendor release notes list a fix; problem across many identical models.',
      },
    ],
    remediation: [
      {
        title: 'Enable the device / restart',
        detail: 'Enable a disabled device, restart the PC and retest. Reseat or change the port for external devices.',
      },
      {
        title: 'Roll back to the previous driver',
        detail: 'Use Roll Back Driver in the device properties and pause driver updates for that device if the problem recurs.',
        caution: 'Note the version being replaced. A restart may be needed, so pick a suitable time.',
      },
      {
        title: 'Install the manufacturer driver',
        detail: 'Install the vendor-supplied driver for the exact model, then restart and recheck Device Manager.',
        caution: 'Only download from the official vendor site or approved tool. Wrong-model drivers can cause instability or blue screens.',
      },
      {
        title: 'Clean reinstall of the device driver',
        detail: 'Uninstall the device, restart to let Windows redetect, then apply the vendor driver.',
        caution: 'For network adaptors make sure you can get the installer onto the machine first. Removing a graphics driver may change display output temporarily.',
      },
      {
        title: 'Update firmware/BIOS',
        detail: 'Apply a vendor-approved BIOS or device firmware update if release notes match the fault.',
        caution: 'Never interrupt a firmware update; keep on AC power. Suspend BitLocker beforehand and have the recovery key available. Hard to undo.',
      },
    ],
    verification: [
      'Device Manager shows the device without a warning icon and status "This device is working properly".',
      'The device performs its function (audio plays, Wi-Fi connects, display works).',
      'Still working after a full restart and after sleep/resume.',
      'No new related errors in the System log over the next few days.',
    ],
    documentation: [
      'Device name, hardware ID and the error code observed',
      'Driver provider, version and date before and after',
      'Recent updates or changes that may be linked',
      'Actions taken (rollback, vendor install, firmware) and how to undo them',
      'Whether hardware testing on another machine was done and the result',
    ],
    skills: ['windows', 'hardware', 'troubleshooting', 'documentation'],
  },

  // ---------------------------------------------------------------- 9
  {
    id: 'hw-no-power-boot',
    category: 'Hardware',
    title: 'PC / laptop will not power on or boot',
    summary:
      'A desktop or laptop that shows no signs of life, powers on without display, or fails before Windows loads. Work from power source to POST to display, and keep data and BitLocker in mind.',
    tags: ['no power', 'dead', 'will not boot', 'post', 'beep codes', 'charger', 'psu'],
    symptoms: [
      'No lights, fans or sounds when the power button is pressed',
      'Fans and lights come on but the screen stays black',
      'Powers on then immediately shuts down or restarts repeatedly',
      'Beep codes or flashing LED patterns on startup',
      'Laptop only works while plugged in, or does not charge',
    ],
    initialChecks: [
      'Is the device authorised for you to open and repair? Check warranty and asset status before opening any case.',
      'Did anything happen beforehand (power cut, liquid, drop, update, hardware change)? Liquid damage means stop and escalate.',
      'Is the data backed up? Do not start hardware swaps before understanding data risk.',
      'Is BitLocker enabled? Have the recovery key accessible, as hardware or firmware changes can trigger recovery.',
      'Is it one device or a group (for example a whole desk or building)? That points to power distribution.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Check the external power path',
        detail:
          'Test the wall socket with a known-working device, check the extension lead/surge protector switch, and reseat the power cable at both ends. For desktops check the PSU rear switch is on. For laptops try a known-good compatible charger.',
        lookFor: 'Whether any lights or fans respond after power is confirmed good.',
        meaning: 'A dead socket, lead or charger is the commonest and cheapest cause.',
        ifAbnormal: 'Replace the faulty cable or charger. A charger of the wrong wattage/connector can cause charging faults, so match the specification.',
      },
      {
        id: 's2',
        title: 'Look for indicator lights and sounds',
        detail:
          'Look at the charging/power LEDs, caps lock light, drive activity LED and listen for fans, drive spin-up and beeps. Note any light patterns or beep sequences.',
        lookFor: 'Any sign of life, and repeating beep or LED patterns.',
        meaning:
          'Beep and LED codes are specific to the manufacturer, so check the maker documentation for that exact model. Some life but no display is a different fault from no life at all.',
        ifAbnormal: 'Record the pattern precisely (count and timing) for the manual or support call.',
      },
      {
        id: 's3',
        title: 'Perform a power reset (drain residual power)',
        detail:
          'Disconnect all peripherals, docks and external displays. Unplug power; on laptops with a removable battery remove it. Hold the power button for around 15-30 seconds, reconnect power only and try again.',
        lookFor: 'Whether the device powers up after the reset.',
        meaning: 'This clears a stuck power state in firmware or the embedded controller and often revives an apparently dead device.',
        ifAbnormal: 'If still dead, move on to battery and PSU checks.',
      },
      {
        id: 's4',
        title: 'Battery and charging checks (laptops)',
        detail:
          'Try running on AC with the battery removed (if removable) or on battery alone. If Windows starts, generate a battery report to assess health.',
        commandIds: ['powercfg-batteryreport'],
        lookFor: 'Whether the laptop runs on AC without the battery, charge cycle count and design versus full charge capacity.',
        meaning: 'Works only with battery removed suggests the battery is faulty. Works only on battery suggests charger or power port. Very low full charge capacity indicates a worn battery.',
        ifAbnormal: 'Replace the battery or charger as appropriate. Swollen batteries are a safety risk: stop using, do not charge, escalate for safe disposal.',
      },
      {
        id: 's5',
        title: 'Decide: no POST or POST with no display',
        detail:
          'If fans and lights run, test the display: try an external monitor, a different cable/port, and for desktops check the cable is in the graphics card (not the motherboard) output if a card is fitted. Check the caps lock key toggles its light, which implies the system is running.',
        lookFor: 'Whether an image appears on another display, and whether the keyboard LEDs respond.',
        meaning: 'Image on external monitor: internal panel, cable or backlight fault. No image anywhere with life signs: system not completing POST (memory, graphics, board or CPU).',
        ifAbnormal: 'Continue to the minimal-configuration test.',
      },
      {
        id: 's6',
        title: 'Minimal-configuration test (authorised, power disconnected)',
        detail:
          'Power off and disconnect mains power. Use anti-static precautions (wrist strap or touch bare metal chassis, avoid carpets). Reseat memory modules and cables, remove optional cards and extra drives, and try booting with one RAM module at a time.',
        lookFor: 'Whether POST completes with a particular module, slot or after removing a component.',
        meaning: 'POST success with one module and not another shows a bad module or slot. Success after removing a card or drive points to that device.',
        ifAbnormal: 'Do not force parts. Stop if you find damage, burning smells or liquid, and escalate.',
      },
      {
        id: 's7',
        title: 'Test power supply or move the drive',
        detail:
          'Desktops: swap in a known-good PSU of suitable rating if you are authorised and equipped to do so. Do not open a PSU casing. To check data, connect the drive to another machine (using a suitable adaptor) or boot from external recovery media.',
        commandIds: ['manage-bde-status'],
        lookFor: 'Whether the system powers with a known-good PSU, and whether the data is readable elsewhere.',
        meaning: 'A working PSU swap proves the PSU. Data intact on the drive means the fault is elsewhere in the machine, and you can recover files.',
        ifAbnormal: 'If still dead, the motherboard or CPU is likely faulty: repair versus replace decision and warranty claim.',
      },
    ],
    causes: [
      {
        cause: 'Faulty power outlet, lead, PSU or charger',
        indicators: 'No lights at all; works with a different lead/charger; other devices on the same socket fail.',
      },
      {
        cause: 'Faulty or worn battery (laptop)',
        indicators: 'Does not charge, shuts down when unplugged, battery report shows low capacity, swelling.',
      },
      {
        cause: 'Stuck power state in firmware',
        indicators: 'Revives after drain and hold-power-button reset.',
      },
      {
        cause: 'RAM or add-in card problem preventing POST',
        indicators: 'Fans spin, no display, beep or LED codes, boots with one module or without a card.',
      },
      {
        cause: 'Failed display, cable or graphics output',
        indicators: 'System appears to run (caps lock responds, drive activity) and external monitor shows an image.',
      },
      {
        cause: 'Motherboard or CPU failure',
        indicators: 'No POST with known-good PSU, RAM and display; liquid or physical damage.',
      },
    ],
    remediation: [
      {
        title: 'Replace the faulty lead, charger or socket',
        detail: 'Use a known-good, correctly rated replacement. Report faulty sockets or power strips to facilities.',
        caution: 'Use the manufacturer or an equivalent-rated charger. Cheap or mismatched chargers can damage the device.',
      },
      {
        title: 'Perform the power drain reset',
        detail: 'Remove power and peripherals, hold the power button 15-30 seconds, reconnect only power and retry.',
      },
      {
        title: 'Reseat or replace memory / cards',
        detail: 'With mains disconnected and ESD care, reseat RAM and cards, or replace a failed module with a compatible one.',
        caution: 'Only open devices you are authorised to open; this may affect warranty. Disconnect power, and for laptops disconnect the battery if the design allows.',
      },
      {
        title: 'Replace the battery or PSU',
        detail: 'Fit an approved replacement battery or PSU of the right specification.',
        caution: 'Never open a PSU or attempt to repair a swollen battery. Dispose of batteries via a proper recycling route.',
      },
      {
        title: 'Recover data and escalate for board-level repair/replacement',
        detail: 'If the motherboard or CPU is suspected, recover data from the drive where possible, then arrange warranty repair or replacement.',
        caution: 'Encrypted drives need the BitLocker recovery key. A moved drive or changed hardware can trigger recovery. Confirm the key is available first.',
      },
    ],
    verification: [
      'Device powers on from cold and reaches the Windows sign-in screen.',
      'Stable across at least two further cold boots and a restart.',
      'Laptop charges correctly and runs on battery and AC as expected.',
      'Display output is correct, and no beep or LED fault patterns remain.',
    ],
    documentation: [
      'Symptoms and what happened before the fault',
      'Beep or LED pattern observed (exact count and timing) and device model',
      'Components swapped or reseated and results of each test',
      'Data recovery status and BitLocker recovery key handling',
      'Parts ordered, warranty reference and how to undo changes',
    ],
    skills: ['hardware', 'troubleshooting', 'customer-support', 'documentation'],
  },

  // ---------------------------------------------------------------- 10
  {
    id: 'hw-memory-storage-health',
    category: 'Hardware',
    title: 'RAM and storage hardware health',
    summary:
      'Check whether memory or a drive is failing, using Windows Memory Diagnostic, drive health status and SMART data, and decide when to back up and replace.',
    tags: ['ram', 'memory test', 'smart', 'drive health', 'get-physicaldisk', 'ssd failure'],
    symptoms: [
      'Random blue screens or reboots with memory-related stop codes',
      'Application crashes and freezes with no pattern',
      'Files becoming corrupt or unreadable, or disk errors reported',
      'Very slow disk access, clicking or grinding noises from an HDD',
      'Drive disappears intermittently or is reported as Warning/Unhealthy',
    ],
    initialChecks: [
      'Is the data backed up? If a drive is suspected, take the backup first, before further testing or repairs.',
      'Are symptoms random (suggests memory) or tied to file access (suggests storage)?',
      'Did anything change (new RAM, moved device, power loss, impact)?',
      'Is the device under warranty or on a maintenance contract? Hardware replacement may need approval.',
      'Is BitLocker enabled and the recovery key known? Needed before drive or firmware work.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Collect hardware and OS details',
        detail:
          'Record installed RAM, drive models and sizes, and OS version.',
        commandIds: ['systeminfo', 'get-computerinfo'],
        lookFor: 'Installed memory amount, drive types, and device age.',
        meaning: 'Older devices and HDDs have higher failure likelihood. Mismatched or unexpected RAM amounts can mean a module has failed to be detected.',
        ifAbnormal: 'If RAM shows less than installed, reseat the modules (authorised, power off).',
      },
      {
        id: 's2',
        title: 'Check drive health from Windows',
        detail:
          'Run Get-PhysicalDisk and note HealthStatus and OperationalStatus. For more detail, Get-PhysicalDisk | Get-StorageReliabilityCounter shows values such as temperature, wear and read/write error totals where the drive supports it.',
        commandIds: ['get-physicaldisk', 'get-volume'],
        lookFor: 'HealthStatus Healthy versus Warning or Unhealthy, and non-zero or growing error counters.',
        meaning: 'Warning or Unhealthy means Windows or the drive firmware sees a problem. Healthy is reassuring but not proof the drive is fine.',
        ifAbnormal: 'Back up immediately and plan replacement.',
      },
      {
        id: 's3',
        title: 'Review SMART data with vendor or trusted tooling',
        detail:
          'Use the drive manufacturer diagnostic tool or an approved SMART utility to read attributes. Focus on reallocated or pending sectors for HDDs, and wear level, spare capacity and media errors for SSDs.',
        lookFor: 'Reallocated/pending/uncorrectable sectors, high wear, or a SMART status of failing or caution.',
        meaning: 'Growing bad sector counts or exhausted spare capacity predict failure. A single static low value on an old drive may be stable, but trend matters.',
        ifAbnormal: 'Replace the drive. Use the vendor tool for warranty evidence if available.',
      },
      {
        id: 's4',
        title: 'Look for disk errors in the logs',
        detail:
          'Event Viewer > Windows Logs > System: filter for disk and file-system related errors and warnings. Check Reliability Monitor for the pattern.',
        commandIds: ['get-winevent', 'reliability-monitor'],
        lookFor: 'Repeated disk errors, retries or controller resets, particularly near crashes.',
        meaning: 'Repeated errors correlate with media or connection failure.',
        ifAbnormal: 'Back up and replace. Do not repeatedly stress a failing disk.',
      },
      {
        id: 's5',
        title: 'Run a file system check (read-only first)',
        detail:
          'Run chkdsk without repair switches, or chkdsk C: /scan for an online check, to see if file system errors exist.',
        commandIds: ['chkdsk'],
        lookFor: 'Reports of file system errors or bad sectors.',
        meaning: 'File system errors without hardware warnings are often from unclean shutdowns. On SSDs CHKDSK rarely addresses health issues.',
        ifAbnormal: 'Only run repair (chkdsk /f) after a verified backup.',
      },
      {
        id: 's6',
        title: 'Test memory with Windows Memory Diagnostic',
        detail:
          'Save work, run mdsched.exe (Windows Memory Diagnostic) and choose Restart now and check for problems. Choose the Extended test if time allows. After sign-in view the result in Event Viewer > Windows Logs > System, source MemoryDiagnostics-Results.',
        lookFor: 'A result of no memory errors detected, or errors reported.',
        meaning: 'Any error reported means faulty RAM (or sometimes slot/board). A pass is not conclusive for intermittent faults.',
        ifAbnormal: 'Replace the failing module. For a more rigorous test, run an extended multi-pass test with a trusted bootable tool such as MemTest86.',
      },
      {
        id: 's7',
        title: 'Isolate the faulty module or slot',
        detail:
          'With power disconnected and ESD care, test each RAM module on its own in the same slot, then the same module in other slots. Reseat modules and check for dust or damage.',
        lookFor: 'Errors that follow a specific module or a specific slot.',
        meaning: 'Follows the module: bad RAM. Follows the slot: motherboard or slot fault.',
        ifAbnormal: 'Replace the module with a compatible one, or escalate for board repair/replacement if the slot is bad.',
      },
      {
        id: 's8',
        title: 'Decide when to replace',
        detail:
          'Replace storage with Unhealthy status, growing bad sectors, exhausted SSD spare capacity or repeated disk errors. Replace RAM that fails any test. Consider replacing an old HDD pre-emptively when it is the system drive.',
        commandIds: ['manage-bde-status'],
        lookFor: 'Evidence meeting the replacement criteria, and BitLocker state.',
        meaning: 'Storage and RAM faults tend to worsen and cause corruption.',
        ifAbnormal: 'Back up, check the recovery key, replace and restore or reimage.',
      },
    ],
    causes: [
      {
        cause: 'Failing RAM module or slot',
        indicators: 'Memory diagnostic errors, random blue screens, faults follow a module or slot.',
      },
      {
        cause: 'Worn or failing SSD',
        indicators: 'Warning/Unhealthy status, high wear or low spare capacity, read/write errors, drive vanishing.',
      },
      {
        cause: 'Failing mechanical hard drive',
        indicators: 'Clicking noises, rising reallocated/pending sectors, very slow access, SMART warnings.',
      },
      {
        cause: 'Loose or faulty cable or connector',
        indicators: 'Intermittent drive loss, errors disappearing after reseating, controller reset events.',
      },
      {
        cause: 'Unclean shutdowns causing file system errors',
        indicators: 'CHKDSK finds errors but SMART and health status are fine; history of power loss.',
      },
    ],
    remediation: [
      {
        title: 'Back up data first',
        detail: 'Take a full backup or image, or copy critical data, before more testing or repair.',
        caution: 'A failing drive may fail further under load. Prioritise the most important data and avoid repeated retries.',
      },
      {
        title: 'Reseat memory and connectors',
        detail: 'With mains power disconnected and ESD precautions, reseat RAM modules and drive connectors, then retest.',
        caution: 'Only for devices you are authorised to open. Laptops: disconnect the battery if the design requires it.',
      },
      {
        title: 'Replace the faulty RAM module',
        detail: 'Fit a compatible replacement (matching type and speed to the system), and rerun the memory test.',
        caution: 'Check the manufacturer compatibility list. Mixing mismatched modules can cause instability.',
      },
      {
        title: 'Replace the drive and restore',
        detail: 'Install a new drive, then restore from backup or reimage with the standard build.',
        caution: 'Confirm BitLocker recovery key access before hardware changes. Wipe or securely dispose of the old drive according to policy.',
      },
      {
        title: 'Repair file system errors',
        detail: 'If hardware is healthy, run chkdsk with repair at a restart after a verified backup.',
        caution: 'Can lose data if the drive is failing. Needs a restart for the system volume.',
      },
    ],
    verification: [
      'Windows Memory Diagnostic (or extended test) completes with no errors after replacement.',
      'Get-PhysicalDisk shows Healthy and the System log shows no new disk errors.',
      'Crashes and corruption symptoms have stopped over several days of normal use.',
      'Restored data opens correctly and the device is stable after restarts.',
    ],
    documentation: [
      'Symptoms and the evidence for memory vs storage (event IDs, error text)',
      'Drive model, health status and SMART values noted',
      'Memory test tool, number of passes and result',
      'Parts replaced (model/serial) and warranty or order reference',
      'Backup status, BitLocker key handling and disposal of old media',
    ],
    skills: ['hardware', 'troubleshooting', 'windows', 'investigation'],
  },

  // ---------------------------------------------------------------- 11
  {
    id: 'hw-display-peripherals',
    category: 'Hardware',
    title: 'Displays and peripherals',
    summary:
      'Monitors with no signal, flicker or the wrong resolution, plus USB devices, docks, keyboards and mice that misbehave. Isolate cable, port and device before blaming drivers.',
    tags: ['monitor', 'no signal', 'flicker', 'resolution', 'usb', 'docking station'],
    symptoms: [
      'Monitor shows "No signal" or stays black',
      'Screen flickers, flashes or shows lines/artefacts',
      'Wrong resolution, blurry text or incorrect scaling',
      'USB device, dock, keyboard or mouse not recognised or keeps disconnecting',
      'External monitors detected intermittently after sleep or when docking',
    ],
    initialChecks: [
      'Is it the display, the cable/port, the dock, or the PC? Note which devices are involved and whether it ever worked.',
      'What changed (driver or Windows update, new dock/monitor, desk move, power event)?',
      'Is it one user or many? Several users with the same dock model suggests firmware or driver.',
      'Is the device managed or on a standard build? Check before installing vendor software or firmware.',
      'Take care with power and ESD before opening or replacing hardware, and never open monitors or power supplies.',
    ],
    steps: [
      {
        id: 's1',
        title: 'Check power and the physical connections',
        detail:
          'Confirm the monitor power light and input selection (HDMI, DisplayPort, USB-C). Reseat the video and power cables at both ends. For laptops check the lid and function-key display toggle.',
        lookFor: 'Power LED state, correct input selected, and loose or damaged connectors.',
        meaning: 'A wrong input or loose cable is the most common cause of No signal.',
        ifAbnormal: 'Select the right input and reseat or replace the cable.',
      },
      {
        id: 's2',
        title: 'Swap one thing at a time',
        detail:
          'Try a different cable, a different port on the PC and on the monitor, and a different monitor on the same cable. For docks, try connecting directly to the PC.',
        lookFor: 'Which swap changes the symptom.',
        meaning: 'Follows the cable: cable fault. Follows the monitor: monitor fault. Follows the port or dock: port, dock or driver fault.',
        ifAbnormal: 'Replace the faulty component. Use the correct cable standard for the resolution and refresh rate needed.',
      },
      {
        id: 's3',
        title: 'Check Windows display settings',
        detail:
          'Win+P to check the projection mode (Extend, Duplicate etc.). Settings > System > Display: click Detect, check resolution (recommended), scaling, and refresh rate under Advanced display. Try Win+Ctrl+Shift+B to reset the graphics driver.',
        lookFor: 'Whether the monitor is detected, and the resolution and refresh rate selected.',
        meaning: 'Wrong resolution or refresh rate commonly stems from a generic driver, a poor cable or an unsupported mode.',
        ifAbnormal: 'Set the recommended resolution. If options are limited, update the graphics driver (step 5).',
      },
      {
        id: 's4',
        title: 'Check USB devices in Windows',
        detail:
          'Open Device Manager and look for Unknown devices or warnings under Universal Serial Bus controllers, Keyboards, Mice, Human Interface Devices. Try other ports (rear ports on desktops), and avoid unpowered hubs for power-hungry devices.',
        lookFor: 'Devices with warnings, USB Root Hub entries with errors, or devices that appear and disappear.',
        meaning: 'Warnings point to drivers or power. Disconnecting suggests power management, a bad cable or port, or a faulty device.',
        ifAbnormal: 'Follow the Driver issues / Device Manager workflow. Untick power saving for USB hubs/devices where appropriate.',
      },
      {
        id: 's5',
        title: 'Update the graphics, chipset and dock drivers/firmware',
        detail:
          'Install the manufacturer graphics and chipset drivers for the exact PC model, and the dock vendor driver and firmware where available. Check firmware release notes for display or sleep/resume fixes.',
        commandIds: ['get-computerinfo'],
        lookFor: 'Whether drivers are generic Microsoft ones or old, and whether updates exist for the dock.',
        meaning: 'Generic or outdated drivers cause many resolution, multi-monitor and dock detection problems.',
        ifAbnormal: 'Apply the updates via the approved route. Suspend BitLocker before BIOS/firmware updates and have the recovery key available.',
      },
      {
        id: 's6',
        title: 'Check power management and cables for intermittent faults',
        detail:
          'For flicker or drops after sleep, check Power Options (USB selective suspend) and test with a different power adaptor for the dock. Check cable length and quality for high resolutions, and look for bent pins or damage.',
        lookFor: 'Faults correlated with sleep/resume, load or movement of the cable.',
        meaning: 'Intermittent faults often come from marginal cables, underpowered docks or power saving rather than hard failures.',
        ifAbnormal: 'Replace cables or the power adaptor, and adjust power settings with approval.',
      },
      {
        id: 's7',
        title: 'Test on another system',
        detail:
          'Connect the monitor, dock or peripheral to a different, known-good computer. Test the PC with a different known-good monitor.',
        lookFor: 'Whether the fault follows the device.',
        meaning: 'Fault follows the device: hardware failure or warranty claim. Fault stays with the PC: PC graphics output, driver or settings.',
        ifAbnormal: 'Raise a warranty or replacement request. If the PC itself is at fault, see the PC will not boot workflow for the no-display case.',
      },
    ],
    causes: [
      {
        cause: 'Wrong input source or loose/faulty cable',
        indicators: 'No signal that clears when the input is changed or the cable reseated or swapped.',
      },
      {
        cause: 'Generic or outdated graphics/chipset/dock driver',
        indicators: 'Wrong resolution or refresh rate options, monitors not detected after docking or sleep.',
      },
      {
        cause: 'Unsupported mode or low-quality cable for resolution/refresh rate',
        indicators: 'Flicker or blank screen at high resolutions; works at lower settings.',
      },
      {
        cause: 'USB power or power management issue',
        indicators: 'Devices drop out after sleep or on unpowered hubs; changing port or power settings helps.',
      },
      {
        cause: 'Failed monitor, dock or peripheral',
        indicators: 'Fault follows the device to another computer.',
      },
    ],
    remediation: [
      {
        title: 'Reseat or replace cables and change ports',
        detail: 'Use a known-good, correctly rated cable and test alternative ports or inputs.',
      },
      {
        title: 'Set the correct display configuration',
        detail: 'Use Win+P and Display settings to choose Extend/Duplicate, the recommended resolution, scaling and refresh rate.',
      },
      {
        title: 'Update graphics, chipset and dock software',
        detail: 'Install the manufacturer drivers and dock firmware via the approved route, then restart.',
        caution: 'Firmware updates can be hard to undo; keep the device on AC power, and suspend BitLocker with the recovery key to hand for BIOS updates. Record versions.',
      },
      {
        title: 'Adjust USB power management',
        detail: 'Turn off USB selective suspend or device power saving for the affected port or device, or use a powered hub.',
        caution: 'Changes power behaviour and battery life. Note the original setting and check policy before changing.',
      },
      {
        title: 'Replace the failed monitor, dock or peripheral',
        detail: 'Swap with a known-good unit and arrange warranty return for the failed hardware.',
      },
    ],
    verification: [
      'Monitor shows a clear image at the recommended resolution and refresh rate, with no flicker.',
      'Dock and peripherals are detected after a restart, sleep/resume and unplug/replug.',
      'Keyboard, mouse and USB devices work consistently over a working session.',
      'The user confirms the setup behaves as expected at their desk.',
    ],
    documentation: [
      'Devices involved (monitor, dock, cable types, ports) and symptoms',
      'Which swap or test isolated the fault',
      'Driver and firmware versions before and after',
      'Settings changed (display, power management) and how to undo them',
      'Hardware replaced, warranty reference and user confirmation',
    ],
    skills: ['hardware', 'troubleshooting', 'customer-support', 'windows'],
  },
];
