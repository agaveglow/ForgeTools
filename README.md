# ForgeTools

A personal IT engineering toolkit for an IT engineer / cybersecurity apprentice: log the work, troubleshoot with guided workflows, look up commands, run security checks, practise in a network lab, turn questions and voice notes into guides you keep, store notes, and see skills backed by real evidence.

It is a real working app (not a mock-up). Everything is stored on your device. There is no account and no server. The internet is used only for the optional web lookup and optional audio transcription.

## Contents

1. [Where things live](#where-things-live)
2. [Run it and build it](#run-it-and-build-it)
3. [Phone app](#phone-app)
4. [Security and privacy](#security-and-privacy)
5. [Today](#today)
6. [Fix and guides](#fix-and-guides)
7. [Toolbox](#toolbox)
8. [Notes](#notes)
9. [Learning](#learning)
10. [Home, look and navigation](#home-look-and-navigation)
11. [Architecture](#architecture)
12. [What was verified, and what was not](#what-was-verified-and-what-was-not)
13. [Not built yet](#not-built-yet)

## Where things live

The home screen opens five areas. Every page belongs to exactly one. The Toolbox lists only real tools, one entry each.

| Area | Pages |
| --- | --- |
| **Today** | Daily jobs, Daily workflow, Tasks, Task board, Check guides, Response times |
| **Fix & guides** | Guide agent, Troubleshooting, Guide library (procedures, study, troubleshooting flows and your own guides), Commands, Printer guides, Security checklist, Toolbox |
| **Notes** | Live notes, Work logs, Voice notes, Import documents, Files |
| **Learning** | Apprenticeship, Requirements, Skills profile |
| **Settings** | Appearance, Security, Backup (including the encrypted folder copy), Voice transcription, Privacy, Erase |

**Toolbox sections:** Managed print · Networking · Security · Remote session messages · IT service desk · Calculate and convert · Practice and reference (see [Toolbox](#toolbox)).

All the old page addresses still work.

## Run it and build it

Normal route (needs the npm registry):

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run test         # unit tests (bun test)
```

> **Not yet verified:** the Vite route. This project was first built in a sandbox where the npm registry was blocked, so `vite`, `@tailwindcss/vite`, `@types/react` and the pinned versions in `package.json` have never been installed or run. The source follows the standard Vite + React + Tailwind v4 layout, so it should work. Treat the first `npm install && npm run build` as the real check and expect to fix small things.

Offline route (what was actually used to build and test here; needs Bun and local copies of React, Tailwind 4 and TypeScript):

```bash
bun scripts/build.ts                 # builds dist/ (bundles JS, compiles Tailwind CSS)
bun scripts/serve.ts --port 4173     # serves dist/ with SPA fallback
node_modules/typescript/bin/tsc --noEmit -p tsconfig.offline.json
bun test tests/unit
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/e2e.mjs   # needs the server above
node tests/a11y.mjs
bun tools/validate-content.ts        # checks all workflow/command content cross-references
```

`tools/react-lite.d.ts` is an offline-only type shim for React. Delete it, and `tsconfig.offline.json`, once real dependencies install.

## Phone app

Three routes, from quickest to most native. None have been tested on a real phone.

**A. Installable web app (PWA).** Host the built `dist/` over https (for example GitHub Pages), open it in the phone's browser and choose Add to Home Screen. A service worker (`public/sw.js`, network-first with cache fallback) lets it open offline. Data is in browser storage and files are in IndexedDB.

**B. Android app (Capacitor).** `capacitor.config.ts` is set up (`webDir: dist`, `CapacitorHttp` on so web lookups avoid browser cross-origin limits). The Filesystem plugin gives real files in the app's private storage (`Directory.Data`); Share lets you send a file out. `.github/workflows/android.yml` builds a debug APK in the cloud and patches the manifest to turn off Android cloud auto-backup and plain-http traffic. Build locally with:

```bash
npm install && bun scripts/build.ts && npx cap add android && npx cap sync android
cd android && ./gradlew assembleDebug
```

**C. iOS** needs a Mac with Xcode and an Apple developer account. Not set up.

Not done for the native build: hiding the app preview in the app switcher (`FLAG_SECURE`), release signing, store listing.

### Updating the APK without losing data

Every build must be signed with the same key or Android will refuse to install it over the last one, and uninstalling deletes the app's data (export an encrypted backup first). Until a permanent key is added as two repository secrets (`ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASSWORD`), builds use a one-off key and the release notes say so.

### Encrypted folder copy

With encryption on, Settings > Folder copy lets you choose a folder on the device. The app writes only the already-encrypted vault file there and re-saves it after each change. After an update or reinstall, choose the folder and Restore, then unlock with your passphrase. It is unavailable while encryption is off, excludes images attached in Files, and does not encrypt file names. The native part is Android-only and is built by the APK workflow.

## Security and privacy

### Privacy and honesty rules (enforced in code)

- **Secrets are never saved.** Passwords, keys, tokens, BitLocker recovery keys, private keys and card numbers block the save button with no override. Offer to redact in one click.
- **Personal details need confirmation.** Emails, IPs, MACs, phone numbers, postcodes, NI numbers, user paths, UNC paths and long token-like strings require ticking a confirmation or redacting. This applies to every free-text form (logs, questions, transcripts, sessions, checklist notes, KB).
- **The assistant never invents.** `src/lib/notes.ts` re-organises *your* words into sections using verb and keyword rules. A missing result stays blank and is flagged; a lone "tested" is an action, not a result. "Areas you may also want to mention" and suggested skills are unticked until you tick them.
- **Skills are not inflated.** Suggested level comes from distinct days of real work (1 → Exposure, 2–3 → Developing, 4–7 → Practised, 8+ → Confident). "Demonstrated" is only ever set by you and warns if fewer than 3 logs have evidence. You pick the level.
- **No sample data.** The app starts empty. Records left from earlier sample-data versions are removed on load and are never imported.
- **No fake system access.** Nothing runs commands or touches a device. The app guides and records.

### What protects what

This app stores everything on your own device and has no server, so there is nothing for anyone to break into remotely. The real risks are someone getting hold of the phone or browser, something running in the page, and the build and download chain. What is in place:

| Risk | Protection | Your part |
| --- | --- | --- |
| Lost, borrowed or stolen phone | Optional encryption (AES-256-GCM, key from a passphrase with PBKDF2, 600,000 rounds), auto-lock, slowed-down wrong guesses, fingerprint unlock | **Turn encryption on.** Until you do, the app shows a reminder on the home screen. Passphrases must be 12+ characters and not easy to guess. Use four or more random words |
| Someone glancing at the app switcher or screenshots of it | Privacy shield: the screen is covered whenever the app goes to the background (Settings > Security) | Keep it on |
| Code injected into the page | No `innerHTML`, `eval` or inline scripts. Strict Content-Security-Policy: scripts only from this app, no frames, no plugins. Links are only ever https. PDF files are read with scripting and `eval` switched off | None |
| The page loaded inside someone else's site | Refuses to run in a frame | None |
| Hostile backup or pack file | Backups and packs are validated, size-limited and cannot change settings or prototypes. Secrets in a pack are refused | Only import files you made |
| Customer data ending up here | The sensitive-data scanner blocks secrets and warns on personal details before anything is saved | Keep keeping customer details out |
| Tampered build | GitHub Actions are pinned to exact commits, dependency install scripts do not run, Dependabot watches updates, the APK is built from this repo and its SHA-256 is printed on each release so you can check it with the hash tool | Check the hash before installing |
| Web page being found | Not indexed by search engines. The page holds no data: another person opening it sees an empty app | None |

**Limits, honestly:** nothing can protect data from malware or a rooted phone, from someone who watches you type the passphrase, or from a weak passphrase. File names (which hold guide titles) are not encrypted. A backup file is only as safe as its passphrase. If someone has your **unlocked** phone, they can use the app: keep the auto-lock short.

**APK signing:** every build must be signed with the same key or Android will refuse to install it over the last one, and uninstalling deletes the app's data (export an encrypted backup first). Until a permanent key is added as two repository secrets (`ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASSWORD`), builds use a one-off key and the release notes say so.

### Encryption, backups and lookup rules

- **Content Security Policy** in `index.html`: only the app's own scripts run; there is no `eval` and no raw-HTML rendering.
- **Secrets never saved; personal details need confirmation** (see below).
- **Encryption at rest (optional, Settings, Security).** PBKDF2-SHA-256 (600,000 iterations) derives an AES-256-GCM key from your passphrase using the browser's Web Crypto. Records and file contents are stored as ciphertext and held decrypted only in memory while unlocked. The passphrase is never stored; if it is lost the data cannot be recovered. File **names** (which include guide titles) are not encrypted. The app locks after inactivity (default 5 minutes), when hidden for a while, or on demand. Failed attempts are slowed down, which is not a defence against someone who copies the stored data: passphrase strength is.
- **Encrypted backups (optional)** use the same method with a separate passphrase.
- **Web lookup rules:** https only; private/local network addresses refused; page text only, no scripts or links are kept.
- **Limits:** this does not protect against malware on the device, shoulder surfing, or a weak passphrase. Clearing site data deletes your data, so keep an (encrypted) backup. Check your employer's data rules before keeping work notes on a personal phone.

#### Fingerprint unlock

Once encryption is on, **Settings > Security > Fingerprint unlock** lets you unlock with your phone's fingerprint instead of typing the passphrase. It uses a passkey (WebAuthn with the PRF extension): the phone's secure hardware produces a secret only after the fingerprint check, and that secret wraps the data key. The passphrase is never stored, and it keeps working as a backup. It is only offered where the phone supports PRF; otherwise it would only hide the screen, so it stays off. A phone's passkey check may also accept the screen PIN or pattern, and any fingerprint saved on the phone. Tested with a simulated authenticator, not yet on a real phone.

### Confidentiality: import, scrub, keep only the guide

Built for work where customer details must not be stored.

- **Import documents** (`/import`, `src/lib/docs.ts`): Word (.docx), text, Markdown and web pages are read on the device (nothing uploaded). PDFs and photos are not read directly yet; copy the text out on the phone and paste it. A procedure with numbered steps becomes ordered steps, commands and cautions; plain prose is organised like a spoken walkthrough.
- **Automatic scrubbing** (`src/lib/scrub.ts`) runs before anything is shown or saved: emails, IP/MAC addresses, phone and long numbers, serials and account/contract/ticket numbers, host names, company names, links to private sites, labelled customer/contact fields, passwords and keys. You can see what was removed (on screen only), remove extra words, and scrub again. It is a safety net, not a guarantee: names inside ordinary sentences can be missed, so saving needs a tick confirming you read it.
- **Only the guide is saved.** The source document, removed details and (by default) voice transcripts are not stored. Voice notes scrub the transcript as it arrives and keep the transcript only if you tick a box.
- **Read aloud and voice questions:** reading steps and answers aloud uses only voices that run on the device; with none installed it stays off rather than using an online voice. The microphone uses the phone or browser's speech recognition, which may send audio to its vendor, and the app says so.
- **Not built:** live screen share or live video help (phone browsers can't reliably share the screen, and live help needs a cloud AI model that would see customer data), reading text out of photos or PDFs directly.

## Today

### Daily jobs

**Daily jobs** is the page for the general jobs of the day, next to your daily checks. The starting list is: clock in on your clocking-in system, check Outlook emails, check your ticketing system tickets, clock out on your clocking-in system. Edit it to suit: add, rename, reorder or delete jobs. Once-a-day jobs can note the time you ticked them. "Keep watching" jobs (inbox, ticket queue) show when you last checked and turn amber when you are past your chosen interval. The page never connects to your clocking-in system, Outlook or your ticketing system: the ticks and times are your own, kept on this device, and clear themselves the next day. The reminder only shows while the page is open.

### Daily workflow

**Daily workflow** holds the day's operating guide: start of day, priorities, the work/check/respond/document/continue loop, what to monitor, quiet-period work, incidents, the documentation standard and end of day. Ticks apply to the current day only and clear themselves the next day.

### Tasks, task board, check guides and response times

**Tasks** now covers daily, weekly, monthly and quarterly routines. A monthly check stays ticked until the month ends, a quarterly one until the quarter ends, and both show the days left and when they were last done. **Add many at once** adds the starter monthly and quarterly checklists, or any list you paste (one per line, bullets and numbers removed). Pasted text is scanned, so names, emails and numbers are refused. The **Task board** holds one-off jobs in To do, Doing, Blocked and Done columns; cards move with buttons, so it works on a phone. There is no client-name field on purpose: describe the routine, not the customer.

The starter lists under **Add many at once** hold your full checklist: 7 daily, 9 weekly, 9 monthly and 9 quarterly checks, plus the 3 optional ones (added as quarterly reminders). Adding a list skips tasks you already have, including ones added under an older wording.

**Check guides** (menu: Check guides, or the *How to* link on a task row) give a step-by-step guide for each daily, weekly, monthly and quarterly check: before you start, the steps as a diagram and player (with Ask about this step), commands used, how to monitor between checks, evidence to keep and cautions. They are general good practice to adapt to your own policies, with placeholders only. **Response times** holds the call-priority table from your Tasks checklist (target and contractual response, update frequency, definitions and examples) and a deadline clock that works out reply and update times in business hours (09:00 to 17:00, weekdays; public holidays are not allowed for).

### Progress tracking

The dashboard is built for tracking your own progress: today's daily routine and due one-off tasks, a Monday-to-Sunday strip showing days with activity, weekly tasks, off-the-job hours against a weekly target, requirement progress, and a day-streak. It starts empty. No sample data is shipped (older sample records are removed automatically). ForgeTools does not supply a requirements list or any apprenticeship standard: you enter your own job requirements and apprenticeship criteria, and set your own hour targets from your plan. Every free-text field goes through the same secret and personal-data guard as the rest of the app.

## Fix and guides

### Guide agent

`src/lib/agent.ts` + `src/pages/AgentPage.tsx`. Type a how-to, a command or a problem. It matches your troubleshooting library, command reference, Knowledge base notes and past logs and builds a guide with sources. You can ask follow-ups ("what should I check first?", "what are the risks?", "which commands?"); when nothing matches it says so instead of guessing. **Save guide** stores it in the Knowledge base (tag `generated`) and as a file in Files. **Look it up online** searches the vendor documentation site and can add a cited, dated section from a page, labelled as external and unchecked.

It is local and rules-based, not a language model. To add a real model, implement `AgentProvider` and keep the save guard in front of anything sent off-device.

The guide agent only offers a library guide when it really covers what you asked, not just because one word (such as "Outlook") matches. It now also searches the built-in Procedures and Study library, so a request like "how to whitelist a domain in Outlook" finds the built-in allow-list procedure. When nothing covers the request it says so, names the words nothing matched, lists loosely related guides as "related, not the answer", and asks a few questions (the job, the area, whether admin rights are needed, the steps if you know them, how you know it worked, what to watch for). **Build my guide** then assembles a new guide from your own answers; it never invents steps, and with no steps typed it makes an outline and says the steps are still to be added. You can then add pages from the online lookup, save it to the Knowledge base, and it appears under **Procedures > Your own guides**.

### Guide library

Fix & guides → **Guide library** (`/guides`) is one list for every guide: the built-in Procedures, the Study library, the troubleshooting flows and your own guides (including ones from the guide agent). Filter by kind, or search across all of them.

- **Edit a built-in guide:** open it and choose **Edit or add photos**. The editor opens with a copy of the guide's words. The built-in guide is never changed. Your copy is only made when you press **Save guide**, and it takes the original's place in the library, marked "Edited by you". **Restore the original** removes your copy and its photos.
- **Add your own:** **New guide**. Use a heading line such as `STEPS` in capitals followed by numbered lines to get the visual guide; wrap commands in triple backticks.
- **Photos:** every guide of yours has a Photos section, and the editor has one too. Images are re-drawn as JPEG (smaller, rotation fixed, location removed), stored in Files, and each needs a tick that you checked it for passwords and private details.
- Troubleshooting flows are interactive and open as they are; they are not editable.
- The old addresses (`/procedures`, `/library`, `/kb`) still work.

### Procedures

Fix & guides → **Procedures** has eight step-by-step jobs (ticket routine, new PC handover, taking over a device, adding a printer by IP, MFA reset, freeing disk space, client discovery, safe remote network changes) with tickable steps and copyable note templates. Learning → **Study library** has plain-English references (networking, ports, how a copier makes a copy, paper path, service documents, Windows evidence tools). Requirements → **Suggested learning goals** adds a general ten-stage apprenticeship roadmap on request. All of it is written from scratch as general practice: no employer, customer, vendor-platform or training-provider names, no addresses and no credentials. A unit test checks that stays true. Ticks in procedures are for the visit only and are not saved.

### Printer guides (manual library)

Add your own PDF manuals under **Printer guides**. They are stored only on the device (IndexedDB), never uploaded and never part of this repository. Pages are drawn from the file as you open them, so a 190 MB service manual works. The app reads each manual's text in the background so you can search one manual or all of them, bookmark pages, save a page as a picture, or attach a page to a guide as a step photo. Use **Edit** (in the list) or **Edit details** (in the reader) to rename a manual, change its brand or add a short note such as the model and revision. Editing never touches the PDF, and bookmarks and search stay with it.

The PDF reader is Mozilla PDF.js 3.2.146 (Apache-2.0), pre-built, in `public/vendor/pdfjs`. It is served from the app itself, with scripting and eval switched off. Do not add manuals to this repository: they are copyrighted.

### Visual guides

Any guide with two or more steps gets a **Visual guide** (agent, voice notes, and saved Knowledge base entries):

- **Diagram:** a flowchart of the steps drawn as SVG from the guide itself (`src/lib/visual.ts`, `src/ui/VisualGuide.tsx`). It has a text alternative, and steps that mention a caution get an amber outline.
- **Play:** an animated walkthrough. Steps advance with play/pause/back/next and a speed control, and commands type out in a terminal-style box. It is an illustration: it replays the guide's own steps and commands, shows no invented output, and runs nothing on the device. Animation is skipped when the phone's reduced-motion setting is on.
- **Photos:** on a saved Knowledge base entry you can attach photos or screenshots to a step. Images are re-drawn to JPEG (smaller, rotation fixed, location data removed) and stored in Files (`images/`), encrypted along with everything else if encryption is on. Each needs a tick to confirm you checked it for passwords and private details, because the app cannot read what is inside an image.

There is no AI-generated imagery or video file export. Real footage and generated pictures would need a cloud service.

#### Ask about a step

Under the diagram and the player, **Ask about step N** answers questions about one step: why it is there, what could go wrong, a plain-words version, what its command does, what to look for, and what to do if the result looks wrong. Answers come only from the step's own text, the command reference, the closest troubleshooting-library step and your saved notes, with sources. If none of those say anything useful it says so instead of guessing. It runs on this device, nothing is saved, and questions containing names, numbers or secrets are refused.

## Toolbox

Fix & guides → **Toolbox**. Seven sections, each tool listed once, with search and jump chips. Everything runs on this device and nothing is sent anywhere.

| Section | Tools |
| --- | --- |
| Managed print | Print and scan reference: where to look first, ports and protocols, intake, queue, scan-to-folder and scan-to-email checklists |
| Networking | Cable guide (drawn T568A/T568B pinout, straight and crossover, faults, limits, PoE) · Ports and services · DNS and mail records with an SPF and DMARC checker |
| Security | Security event reference · Email header reader with phishing triage · File hash checker · Hardening checklists · Password generator and guessability test |
| Remote session messages | Message builder and ready-made lines for the text window on a user's screen while you work remotely |
| IT service desk | Ticket note builder (copy is withheld while a secret is present) · Procedure checklists · Kit checklists |
| Calculate and convert | Calculators (subnet, number converter, transfer time, cost per page) · Converters (Base64, hex, URL text, timestamps, MAC formats) · Screenshot redactor |
| Practice and reference | Network lab · Engineer tool guide |

The Print and scan reference is generic and original, and holds no customer or company-specific data.

### Remote session messages

Toolbox > Remote session messages. Wording to paste into a text window on the user's screen while you are connected, so updates are quick and clean.

- **Message builder:** fill in their first name, what it is about, what you are doing and how long, pick what you need from them (keep hands off, save work, restart, type their own password, test, confirm), choose a closing (fixed, stopping for now, passing to a specialist, site visit, cannot see the fault) and get one message. Friendly or brief tone. An option breaks the text into short lines for a plain window that does not wrap.
- **Ready-made lines:** 27 lines in six stages (starting, while I work, I need you to, problems and delays, finishing, staying safe), searchable, filled in from the builder boxes.
- **My own lines:** save your own wording with `{name}`, `{issue}`, `{time}` and `{app}` placeholders. They are kept in the vault (encrypted when encryption is on) and refused if they contain a secret or a personal detail.
- The builder boxes are never saved, and copying is withheld while the sensitive-data guard has flagged something. Content is original and generic (`src/content/say.ts`, `src/lib/say.ts`). Only send what is true: nothing is added that was not chosen or typed.

### Network lab (simulation)

Toolbox > Practice and reference > Network lab. A practice command prompt and a visual network diagram for learning and rehearsing a fault-finding flow before touching a customer's PC.

- It is a **simulation**. The prompt (ipconfig, ping, tracert, nslookup, arp, netstat, route print, getmac, hostname, Test-NetConnection) answers from a small made-up network in `src/lib/netsim.ts`. It never runs a real command or touches a real device or network, and real output differs in detail.
- Seven practice scenarios (wrong printer address, unplugged cable, bad gateway, DNS, DHCP, blocked port, plus free play). A "Fixed" badge shows when the goal check passes.
- The diagram lets you power devices off, unplug cables, edit addresses, masks, gateway, DNS, VLAN and blocked ports, and add or remove devices.
- Nothing is saved or sent, and the lab resets when you leave the page. Use made-up addresses only; do not enter customer details.

### Engineer tool guide

Toolbox > Practice and reference > Engineer tool guide. Short orientation notes on well-known tools (ssh, rsync, curl, WireGuard, nmap, Wireshark, PowerShell, Ansible and others): what each is for, when to reach for it, starter commands with made-up documentation addresses, and cautions. Scanning and capture tools carry an authorisation warning. Content is in `src/content/engtools.ts`.

## Notes

### Live notes

A **Note** button sits in the top bar on every page (a dot shows when one is open), and **Live notes** is in the menu. Start a note for the job you are on, then type or dictate lines as you go. Each line gets a time stamp and an optional tag (Tried, Found, Fixed, Next, Caution), and is cleaned of names, numbers and secrets before it is stored. As lines come in, a diagram and guide build underneath; save the guide to the library or turn the note into a work log. **Copy trail** copies the timeline as plain text for your own paper trail. Dictation relies on the phone or browser's speech recognition, which may use the vendor's servers.

### Voice notes

`src/lib/walkthrough.ts`, `transcribe.ts`, `src/pages/VoicePage.tsx`. Speech-to-text needs a speech service, so there are three routes:

1. **Transcript file** (.txt .md .srt .vtt): read on the device. Most voice-memo apps can export one.
2. **Dictation**: the browser's speech recognition. It may send audio to the vendor, so don't dictate secrets.
3. **Audio upload** to an OpenAI-style `/audio/transcriptions` endpoint you configure in Settings. The audio is sent there. The key is held in memory for the session only and never saved or backed up. Not tested against a live service.

The walkthrough builder reorganises what was said (what you need, ordered steps, commands, cautions, result) and never adds steps. It warns when steps or a result are missing. The raw transcript is saved with the guide. Audio itself is not stored.

### Packs and PDF import

Import → **Import a pack** loads a JSON file of guides and requirements onto this device only. The app shows what it would add, skips anything already here (same title), refuses any item that contains a secret, and asks you to tick a box if an item looks like it holds personal details. Format: `{"forgetoolsPack":1,"name":"…","kb":[{"title","category","tags","body"}],"requirements":[{"title","kind":"job|apprenticeship","group","notes"}]}`. Packs exist so employer or training material stays on your device and out of this public repository. Import → document also reads PDFs that have a text layer (scanned PDFs need “copy text from image” first).

### The notes assistant is rules-based, not an LLM

It runs offline and is deterministic, which suits the "don't fabricate" requirement. It will mis-sort unusual phrasing, which is why every suggestion is editable. To use a language model later, implement the `Assistant` interface in `notes.ts` and keep the same output; keep the save guard in front of anything sent off-device.

Work logs still have an optional free-text "ticket reference" field. No ticketing features remain.

## Learning

### Apprenticeship

The entry form mirrors your apprenticeship portal's **Activity details** screen field for field: type of activity, when it took place, a description (counted against your apprenticeship portal's 1,000 characters), date, hours and minutes, and a searchable learning plan component. Each saved entry has **Copy for your apprenticeship portal**, which lays the fields out in your apprenticeship portal's order with a Copy button on each, for pasting by hand. The app does not connect to your apprenticeship portal, sign in or submit anything, so you set each entry's **status** yourself (not entered yet, submitted, accepted, rejected, resubmitted). Only entries you mark as accepted count towards the "Accepted by tutor" total, as in the learner guide. Rules built in: up to 12 hours per entry, no future dates, real time rather than rounded, and a warning when the same date, component and time already exist (so hours are not counted twice). A short "Before you save" checklist sits under the form.

**Log from a video link** takes a video-site link, reads only the public title and channel name (video-site oEmbed) and starts an entry: a factual "Watched the video…" line, the exact minutes you enter, the link, and a **Harvard reference** in the website pattern (Author. (Year). Title. Available at: URL (Accessed: date).). The year is only used if you type it, otherwise it says n.d. It cannot watch the video, so what you learned is yours to add. The component list is your own and editable under **My component list**; the starting list was copied from screenshots and may be incomplete, and it is stored on the device only. Add your provider's PDF guides (off-the-job and referencing guides) under Printer guides, brand Apprenticeship, to read them in the app. They stay on the device and are not part of this repository.

## Home, look and navigation

### Navigation: home is the hub

The long side menu and bottom bar are gone. The top bar has Back, Home, Note, Search and **All apps**. The home bubbles open five areas: **Today** (daily jobs, workflow, tasks, board, check guides, response times), **Fix & guides** (guide agent, troubleshooting, procedures, commands, printer guides, security checklist, knowledge base, toolbox), **Notes** (live notes, work logs, voice notes, import, files), **Learning** (apprenticeship, study library, requirements, skills) and **Settings**, plus shortcuts to a live note and the printer guides. Inside an area, a row of tabs jumps between its pages. Back always goes up one level: detail, list, area, home. All the old page addresses still work. Pages use rounder corners and bigger headings and numbers; the corner style can still be changed in Settings.

### Home screen: Glance

The home page opens in **Glance**, a calm watch-style view: three nested rings around the time (daily jobs, daily checks, weekly checks), the three counts under it, amber pills when something needs checking, and a staggered grid of round app bubbles. Tap the rings for Daily jobs, or any bubble to open that part of the app. The switch at the top right changes to **All widgets**, the full customisable dashboard, and remembers your choice.

### Editing the Glance home screen

On the Glance home screen tap **Edit home**. You can change the colour of each ring, add, rename, recolour, reorder or remove bubbles (any page can be a bubble), and add your own cards (note, checklist, counter, progress bar, countdown, shortcuts) with a colour of your choice. Cards can also be shown or hidden from the All widgets view.

Also in **Edit home**: every block of the home screen (clock and rings, ring numbers, due reminders, stock bubbles, quick links, your cards) has Up, Down and Hide buttons right on the page, so you can reorder or hide each one. The **Look of the home screen** card has six ring designs shown as live examples (classic, thin, bold, dotted, segmented, bars), five bubble shapes (circle, soft square, square, hexagon, pill), three bubble sizes, number-tile styles, a font choice, and colours for the clock, labels and tile edges. **Quick links** sit under the stock bubbles: each can open any page in the app or an https website (opens in a new tab), with its own name, icon, colour and order. Link text is checked for customer details and tokens. Moving is by arrow buttons, not drag and drop. Per-page styling of every other page is not built yet. Everything saves as you go and stays on the device; text is checked for secrets and personal details like all other notes.

### Terminal look

The default style is a green-screen terminal: near-black with green phosphor text, pixel-glyph patterns drifting behind the content, a slow scan beam, scan lines, glowing corner-bracket panels, prompt-style headings with a blinking cursor, and a short draw-in when the page changes. **Settings > Appearance > Style** switches to Classic (plain light or dark). **Animated background and effects** turns the motion off, and the system's reduce-motion setting turns it off too. Headings keep clean accessible names (the prompt marks are decoration only).

### Make it yours

- **Dashboard cards:** press **Customise** on the dashboard to rename, move, resize (Small, Wide, Full) or hide each card, and bring hidden ones back. The layout is saved on the device and included in backups. New charts: progress rings, a 12-week activity heat map, weekly off-the-job hours, requirements by status, due-soon checks and a task board summary.
- **Your own cards:** in Customise, **Add your own card** creates a note, checklist, counter, progress bar, countdown or row of shortcuts. Edit or delete them any time; ticks, counts and progress update straight from the dashboard. Card text is scanned for names, numbers and secrets before it is saved. **Reset layout** keeps your cards.
- **Appearance** (Settings): accent colour (presets or custom), text size, font (from the fonts already on the device), corner style, app name and dashboard heading. A custom colour that would be too faint to read is nudged darker or lighter automatically. Names and headings are scanned like everything else, so keep them neutral.
- **Guide diagrams** show an icon per step (picked from the step's wording) and any photos you attached to that step.

## Architecture

```
src/
  content/   Static reference content shipped with the app (workflows, commands, checklist, skills, learning prompts)
  data/      types, StorageAdapter, Store, React hooks, encryption vault
  lib/       pure logic: sensitive-data scanner, notes structurer, guide agent, walkthrough builder, crypto, web and transcription helpers, skills evaluation, search
  ui/        router, primitives, save guard, assistant panel, search palette
  pages/     one file per feature area
tests/       unit (bun), e2e + a11y (playwright)
```

Design decisions:

- **Static content vs user data.** Workflows, commands and the checklist are code (`src/content`), not data, so they are versioned and validated. User records live in the store.
- **Backend swap point.** `StorageAdapter` (`src/data/storage.ts`) is the only thing that touches `localStorage`. Keys are scoped by account id (`forgetools:v1:{account}:`). To add accounts and sync later, implement the adapter against an API (it is synchronous today; make it async and let the store hydrate on load). Records already carry `id`, `createdAt`, `updatedAt`, and import uses newest-wins-by-id, which is the same rule a sync layer needs.
- **State.** `Store` holds immutable collection arrays; React reads them with `useSyncExternalStore`. No state library.
- **Routing.** A ~40-line hash router. It works from `file://` and inside Capacitor with no server config.
- **Theming.** Semantic CSS variables with light and dark sets, mapped into Tailwind with `@theme inline`; theme is set before first paint.
- **Responsive.** Sidebar on desktop; top bar, bottom nav and a "+ Log" button on phones. The work log editor has Quick mode (what happened / what you did / result, everything else optional) and Full mode, chosen by screen size and overridable in Settings.

## What was verified, and what was not

- Type-check clean (strict, no unused locals).
- Unit tests (bun) cover the sensitive-data scanner, notes structurer, guide agent, skills evaluation, store, walkthrough builder, transcription (fake fetch), web lookup rules (fake fetch), file storage, crypto and vault, folder copy (fake plugin), the security tools, the reference tools, the network lab engine and its scenarios, and the engineer tool guide. A unit test also checks built-in content for employer, vendor and provider names.
- End-to-end checks in headless Chromium at 1280×850 and 390×844, including save guards, encryption (ciphertext in storage, lock, wrong passphrase refused, fingerprint unlock with a simulated authenticator), the guide agent, security and reference tools, the network lab, folder copy with a fake plugin, and no console errors.
- Accessibility sweep over every route: every control has an accessible name, one `h1` per page, no horizontal overflow at phone width.
- Content validation: workflows and commands, zero broken references.
- A Content Security Policy is applied and the app runs under it.

**Not tested:** real phones (including fingerprint unlock and the native folder copy), Safari/Firefox, screen readers, the Vite route, the real vendor search response shape, cross-origin behaviour of live sites, and real speech-to-text services.

## Not built yet

- **Runbooks**: the KB and workflow types are designed to take user-authored runbooks.
- **Printer section with manufacturer knowledge**: printer workflows and commands exist; no manufacturer-specific database.
- **Learning page and LearnForge integration**: work logs already capture concepts, to-research items and a next activity; there is no dedicated page.
- **Accounts and sync**: see the storage adapter above.
- Evidence file attachments (only a text reference is stored), global undo, drafts auto-saved while typing, and a "last used" sort in the KB.
