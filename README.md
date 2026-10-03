# ForgeTools

A personal IT engineering toolkit for an IT engineer / cybersecurity apprentice: log the work, troubleshoot with guided workflows, look up commands, run security checks, turn questions and voice notes into guides you keep, store notes, and see skills backed by real evidence.

It is a real working app (not a mock-up). Everything is stored on your device. There is no account and no server. The internet is used only for the optional web lookup and optional audio transcription.

**What is in it:** Progress dashboard (today, this week, requirements, apprenticeship) · Tasks (daily, weekly, one-off) · Requirements (job and apprenticeship) · Apprenticeship log (off-the-job hours) · Work logger with a rough-notes assistant · **Guide agent** (ask how to do something, get a guide, save it) · **Voice notes** (transcript or recording to a step-by-step walkthrough) · Troubleshooting toolkit (34 workflows) · CMD/PowerShell reference (70 commands) · Security checklist · Knowledge base · Skills profile · **Files** (guides, transcripts and backups you created) · Settings (backup, **encryption and app lock**, transcription service).

## Run it

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

## What was verified

- Type-check clean (strict, no unused locals).
- 48 unit tests: sensitive-data scanner, notes structurer, guide agent, skills evaluation, store, walkthrough builder, transcript parsing and transcription request (fake fetch), web search/page extraction/URL rules (fake fetch), file storage (memory, native with a fake plugin, encrypting wrapper), and the crypto and vault.
- 49 end-to-end checks in headless Chromium at 1280×850 and 390×844, including: guide agent save to Knowledge base and Files, secret blocking, web lookup against a mocked endpoint and offline messaging, voice note from a transcript file, audio sent to a mocked transcription service (key not persisted), and encryption on, ciphertext in storage, lock after reload, wrong passphrase refused, unlock, lock now.
- Accessibility sweep: every control has an accessible name; one `h1` per page; no horizontal overflow at phone width.
- Content validation: 34 workflows and 70 commands, zero broken references.
- A Content Security Policy is applied and the app runs under it with no console errors.

**Not tested:** real phones, Safari/Firefox, screen readers, the Vite build, the GitHub Actions workflows, the Capacitor/APK build, the real Microsoft Learn search response shape, cross-origin behaviour of live sites, and real speech-to-text services. The offline route in this repo is what the tests ran against.

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

## Privacy and honesty rules (enforced in code)

- **Secrets are never saved.** Passwords, keys, tokens, BitLocker recovery keys, private keys and card numbers block the save button with no override. Offer to redact in one click.
- **Personal details need confirmation.** Emails, IPs, MACs, phone numbers, postcodes, NI numbers, user paths, UNC paths and long token-like strings require ticking a confirmation or redacting. This applies to every free-text form (logs, questions, transcripts, sessions, checklist notes, KB).
- **The assistant never invents.** `src/lib/notes.ts` re-organises *your* words into sections using verb and keyword rules. A missing result stays blank and is flagged; a lone "tested" is an action, not a result. "Areas you may also want to mention" and suggested skills are unticked until you tick them.
- **Skills are not inflated.** Suggested level comes from distinct days of real work (1 → Exposure, 2–3 → Developing, 4–7 → Practised, 8+ → Confident). "Demonstrated" is only ever set by you and warns if fewer than 3 logs have evidence. You pick the level.
- **No sample data.** The app starts empty. Records left from earlier sample-data versions are removed on load and are never imported.
- **No fake system access.** Nothing runs commands or touches a device. The app guides and records.

## Guide agent

`src/lib/agent.ts` + `src/pages/AgentPage.tsx`. Type a how-to, a command or a problem. It matches your troubleshooting library, command reference, Knowledge base notes and past logs and builds a guide with sources. You can ask follow-ups ("what should I check first?", "what are the risks?", "which commands?"); when nothing matches it says so instead of guessing. **Save guide** stores it in the Knowledge base (tag `generated`) and as a file in Files. **Look it up online** searches Microsoft Learn and can add a cited, dated section from a page, labelled as external and unchecked.

It is local and rules-based, not a language model. To add a real model, implement `AgentProvider` and keep the save guard in front of anything sent off-device.

## Confidentiality: import, scrub, keep only the guide

Built for work where customer details must not be stored.

- **Import documents** (`/import`, `src/lib/docs.ts`): Word (.docx), text, Markdown and web pages are read on the device (nothing uploaded). PDFs and photos are not read directly yet; copy the text out on the phone and paste it. A procedure with numbered steps becomes ordered steps, commands and cautions; plain prose is organised like a spoken walkthrough.
- **Automatic scrubbing** (`src/lib/scrub.ts`) runs before anything is shown or saved: emails, IP/MAC addresses, phone and long numbers, serials and account/contract/ticket numbers, host names, company names, links to private sites, labelled customer/contact fields, passwords and keys. You can see what was removed (on screen only), remove extra words, and scrub again. It is a safety net, not a guarantee: names inside ordinary sentences can be missed, so saving needs a tick confirming you read it.
- **Only the guide is saved.** The source document, removed details and (by default) voice transcripts are not stored. Voice notes scrub the transcript as it arrives and keep the transcript only if you tick a box.
- **Read aloud and voice questions:** reading steps and answers aloud uses only voices that run on the device; with none installed it stays off rather than using an online voice. The microphone uses the phone or browser's speech recognition, which may send audio to its vendor, and the app says so.
- **Not built:** live screen share or live video help (phone browsers can't reliably share the screen, and live help needs a cloud AI model that would see customer data), reading text out of photos or PDFs directly.

## Progress tracking

The dashboard is built for tracking your own progress: today's daily routine and due one-off tasks, a Monday-to-Sunday strip showing days with activity, weekly tasks, off-the-job hours against a weekly target, requirement progress, and a day-streak. It starts empty. No sample data is shipped (older sample records are removed automatically). ForgeTools does not supply a requirements list or any apprenticeship standard: you enter your own job requirements and apprenticeship criteria, and set your own hour targets from your plan. Every free-text field goes through the same secret and personal-data guard as the rest of the app.

## Visual guides

Any guide with two or more steps gets a **Visual guide** (agent, voice notes, and saved Knowledge base entries):

- **Diagram:** a flowchart of the steps drawn as SVG from the guide itself (`src/lib/visual.ts`, `src/ui/VisualGuide.tsx`). It has a text alternative, and steps that mention a caution get an amber outline.
- **Play:** an animated walkthrough. Steps advance with play/pause/back/next and a speed control, and commands type out in a terminal-style box. It is an illustration: it replays the guide's own steps and commands, shows no invented output, and runs nothing on the device. Animation is skipped when the phone's reduced-motion setting is on.
- **Photos:** on a saved Knowledge base entry you can attach photos or screenshots to a step. Images are re-drawn to JPEG (smaller, rotation fixed, location data removed) and stored in Files (`images/`), encrypted along with everything else if encryption is on. Each needs a tick to confirm you checked it for passwords and private details, because the app cannot read what is inside an image.

There is no AI-generated imagery or video file export. Real footage and generated pictures would need a cloud service.

### Ask about a step

Under the diagram and the player, **Ask about step N** answers questions about one step: why it is there, what could go wrong, a plain-words version, what its command does, what to look for, and what to do if the result looks wrong. Answers come only from the step's own text, the command reference, the closest troubleshooting-library step and your saved notes, with sources. If none of those say anything useful it says so instead of guessing. It runs on this device, nothing is saved, and questions containing names, numbers or secrets are refused.

## Voice notes

`src/lib/walkthrough.ts`, `transcribe.ts`, `src/pages/VoicePage.tsx`. Speech-to-text needs a speech service, so there are three routes:

1. **Transcript file** (.txt .md .srt .vtt): read on the device. Most voice-memo apps can export one.
2. **Dictation**: the browser's speech recognition. It may send audio to the vendor, so don't dictate secrets.
3. **Audio upload** to an OpenAI-style `/audio/transcriptions` endpoint you configure in Settings. The audio is sent there. The key is held in memory for the session only and never saved or backed up. Not tested against a live service.

The walkthrough builder reorganises what was said (what you need, ordered steps, commands, cautions, result) and never adds steps. It warns when steps or a result are missing. The raw transcript is saved with the guide. Audio itself is not stored.

## Security

- **Content Security Policy** in `index.html`: only the app's own scripts run; there is no `eval` and no raw-HTML rendering.
- **Secrets never saved; personal details need confirmation** (see below).
- **Encryption at rest (optional, Settings, Security).** PBKDF2-SHA-256 (600,000 iterations) derives an AES-256-GCM key from your passphrase using the browser's Web Crypto. Records and file contents are stored as ciphertext and held decrypted only in memory while unlocked. The passphrase is never stored; if it is lost the data cannot be recovered. File **names** (which include guide titles) are not encrypted. The app locks after inactivity (default 5 minutes), when hidden for a while, or on demand. Failed attempts are slowed down, which is not a defence against someone who copies the stored data: passphrase strength is.
- **Encrypted backups (optional)** use the same method with a separate passphrase.
- **Web lookup rules:** https only; private/local network addresses refused; page text only, no scripts or links are kept.
- **Limits:** this does not protect against malware on the device, shoulder surfing, or a weak passphrase. Clearing site data deletes your data, so keep an (encrypted) backup. Check your employer's data rules before keeping work notes on a personal phone.

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

## The notes assistant is rules-based, not an LLM

It runs offline and is deterministic, which suits the "don't fabricate" requirement. It will mis-sort unusual phrasing, which is why every suggestion is editable. To use a language model later, implement the `Assistant` interface in `notes.ts` and keep the same output; keep the save guard in front of anything sent off-device.

Work logs still have an optional free-text "ticket reference" field. No ticketing features remain.

## Not built yet (prepared for)

- **Runbooks**: the KB and workflow types are designed to take user-authored runbooks.
- **Printer section with manufacturer knowledge**: printer workflows and commands exist; no manufacturer-specific database.
- **Learning page and LearnForge integration**: work logs already capture concepts, to-research items and a next activity; there is no dedicated page.
- **Accounts and sync**: see the storage adapter above.
- Evidence file attachments (only a text reference is stored), global undo, drafts auto-saved while typing, and a "last used" sort in the KB.
