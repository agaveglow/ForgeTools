import { useRef, useState } from 'react';
import { store, useSettings, useStoreVersion, useVault } from '../data/hooks';
import { COLLECTIONS } from '../data/types';
import { downloadText, nowIso, plural, timeAgo } from '../lib/util';
import { Button, Card, Checkbox, Chip, Field, Modal, PageHeader, SectionTitle, TextInput } from '../ui/primitives';
import { useTitle } from '../ui/hooks';
import { migrateFiles, saveCreatedFile } from '../data/files';
import { CryptoError, cryptoAvailable, isEnvelope, openWithPassphrase, passphraseProblem, sealWithPassphrase } from '../lib/crypto';
import type { Envelope } from '../lib/crypto';
import { getTranscribeKey, setTranscribeKey } from '../lib/transcribe';
import { REDACTION_EXAMPLES, NEVER_ENTER } from '../lib/sensitive';

export function SettingsPage() {
  useTitle('Settings and data');
  useStoreVersion();
  const s = useSettings();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [includeDemo, setIncludeDemo] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<unknown>(null);
  const [confirm, setConfirm] = useState<null | 'demo' | 'reset' | 'reset-demo'>(null);
  const [typed, setTyped] = useState('');
  const [tKey, setTKey] = useState(getTranscribeKey());
  const vault = useVault();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [sec, setSec] = useState<{ ok: boolean; text: string } | null>(null);
  const [secBusy, setSecBusy] = useState(false);
  const [encBackup, setEncBackup] = useState(false);
  const [bkPass, setBkPass] = useState('');
  const [env, setEnv] = useState<Envelope | null>(null);
  const [impPass, setImpPass] = useState('');

  const counts = COLLECTIONS.filter((c) => c !== 'usage' && c !== 'skillRatings').map((c) => [c, store.list(c).filter((r) => !r.demo).length] as const);
  const total = counts.reduce((n, [, c]) => n + c, 0);

  const doExport = async () => {
    const f = store.exportAll({ includeDemo });
    let text = JSON.stringify(f, null, 2);
    if (encBackup) {
      const prob = passphraseProblem(bkPass);
      if (prob) { setMsg({ ok: false, text: prob }); return; }
      setMsg({ ok: true, text: 'Encrypting…' });
      try { text = JSON.stringify(await sealWithPassphrase(bkPass, text)); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); return; }
    }
    const day = new Date().toISOString().slice(0, 10);
    downloadText(`forgetools-backup-${day}${encBackup ? '.encrypted' : ''}.json`, text);
    store.updateSettings({ lastExportAt: nowIso() });
    saveCreatedFile('backups', `forgetools-backup-${day}${encBackup ? '-encrypted' : ''}`, 'json', text).catch(() => undefined);
    setMsg({ ok: true, text: encBackup ? 'Encrypted backup downloaded and a copy kept in Files. You need the passphrase to restore it; it cannot be recovered.' : 'Backup downloaded and a copy kept in Files. It is NOT encrypted and contains everything you have recorded, so keep it somewhere safe.' });
  };
  const onFile = async (e: { target: { files: FileList | null; value: string } }) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      if (f.size > 20 * 1024 * 1024) throw new Error('too big');
      const parsed = JSON.parse(await f.text()) as unknown;
      if (isEnvelope(parsed)) { setEnv(parsed); setImpPass(''); setMsg(null); } else { setPending(parsed); setMsg(null); }
    } catch {
      setMsg({ ok: false, text: 'That file could not be read as a ForgeTools backup.' });
    }
    e.target.value = '';
  };
  const decryptImport = async () => {
    if (!env) return;
    try { const inner = JSON.parse(await openWithPassphrase(impPass, env)) as unknown; setEnv(null); setImpPass(''); setPending(inner); }
    catch (e) { setMsg({ ok: false, text: e instanceof CryptoError ? e.message : 'That backup could not be opened.' }); }
  };
  const turnOn = async () => {
    const prob = passphraseProblem(p1) ?? (p1 !== p2 ? 'The two passphrases do not match.' : null);
    if (prob) { setSec({ ok: false, text: prob }); return; }
    setSecBusy(true); setSec({ ok: true, text: 'Encrypting your data…' });
    try { await vault.enable(p1); await migrateFiles('encrypt'); store.reload(); setP1(''); setP2(''); setSec({ ok: true, text: 'Encryption is on. Your data is now stored encrypted and the app locks after inactivity.' }); }
    catch (e) { setSec({ ok: false, text: (e as Error).message }); }
    setSecBusy(false);
  };
  const turnOff = async () => {
    setSecBusy(true);
    try { await migrateFiles('decrypt'); await vault.disable(); store.reload(); setSec({ ok: true, text: 'Encryption is off. Your data is stored in plain form again.' }); }
    catch (e) { setSec({ ok: false, text: (e as Error).message }); }
    setSecBusy(false);
  };
  const doImport = (mode: 'merge' | 'replace') => {
    const r = store.importAll(pending, mode);
    setPending(null);
    setMsg(r.ok ? { ok: true, text: `Imported. ${plural(r.added, 'new record')} added.` } : { ok: false, text: r.error });
  };

  return (
    <div className="max-w-3xl space-y-5 pb-8">
      <PageHeader title="Settings and data" sub="Everything is stored in this browser on this device. There is no account and no server." />

      <section>
        <SectionTitle>Appearance and behaviour</SectionTitle>
        <Card className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">Theme</p>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Theme">{(['system', 'light', 'dark'] as const).map((t) => <Chip key={t} active={s.theme === t} onClick={() => store.updateSettings({ theme: t })}>{t[0].toUpperCase() + t.slice(1)}</Chip>)}</div>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Work log form</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Work log form">{([['auto', 'Automatic'], ['quick', 'Always quick'], ['full', 'Always full']] as const).map(([v, l]) => <Chip key={v} active={s.logMode === v} onClick={() => store.updateSettings({ logMode: v })}>{l}</Chip>)}</div>
            <p className="text-xs text-muted mt-1">Automatic uses the quick three-field form on phones and the full form on larger screens.</p>
          </div>
          <Checkbox checked={s.showDemo} onChange={(v) => store.updateSettings({ showDemo: v })} label="Show demo records in lists" />
        </Card>
      </section>

      <section>
        <SectionTitle>Security</SectionTitle>
        <Card className="p-4 space-y-3">
          {vault.state === 'off' ? (
            <>
              <p className="text-sm"><strong>Encryption is off.</strong> Anyone who can open this app or browser profile on your device can read your notes. Turn on a passphrase to encrypt records and saved files and to lock the app when idle.</p>
              {!cryptoAvailable() ? <p className="text-sm text-warn" role="note">Encryption is not available here. It needs https, localhost or the phone app.</p> : (
                <>
                  <Field label="New passphrase" htmlFor="sec-p1" hint="At least 8 characters. Four random words is a good choice. It is never stored and cannot be recovered."><TextInput id="sec-p1" type="password" autoComplete="new-password" value={p1} onChange={(e: { target: { value: string } }) => setP1(e.target.value)} /></Field>
                  <Field label="Repeat passphrase" htmlFor="sec-p2"><TextInput id="sec-p2" type="password" autoComplete="new-password" value={p2} onChange={(e: { target: { value: string } }) => setP2(e.target.value)} /></Field>
                  <Button variant="primary" disabled={secBusy || !p1} onClick={turnOn}>Turn on encryption</Button>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-sm"><strong className="text-ok">Encryption is on.</strong> Records and file contents are encrypted with your passphrase. File names, which include guide titles, are not.</p>
              <Field label="Lock after inactivity" htmlFor="sec-auto">
                <select id="sec-auto" className="min-h-11 rounded-sm border border-line bg-surface px-2 text-sm" value={String(s.autoLockMinutes ?? 5)} onChange={(e: { target: { value: string } }) => store.updateSettings({ autoLockMinutes: Number(e.target.value) })}>
                  <option value="1">1 minute</option><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="0">Never (only when I lock it)</option>
                </select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { vault.lock().then(() => store.reload()); }}>Lock now</Button>
                <Button variant="danger" disabled={secBusy} onClick={turnOff}>Turn off encryption</Button>
              </div>
            </>
          )}
          {sec && <p role="status" className={'text-sm ' + (sec.ok ? 'text-ok' : 'text-bad')}>{sec.text}</p>}
          <p className="text-xs text-muted">Limits: this protects data stored on the device while locked. It cannot protect against malware on your phone, someone watching you type, or a weak passphrase. Cleared or lost site data also removes your data, so keep an encrypted backup.</p>
        </Card>
      </section>

      <section>
        <SectionTitle>Backup</SectionTitle>
        <Card className="p-4 space-y-3">
          <p className="text-sm">{store.persistent ? 'Data is saved in this browser. Clearing site data, using a private window or switching browser will lose it, so export a backup regularly.' : <strong className="text-bad">This browser is not allowing storage. Changes will be lost when you close the tab. Export a backup before leaving.</strong>}</p>
          <p className="text-sm text-muted">Your records: {total === 0 ? 'none yet' : counts.filter(([, c]) => c).map(([n, c]) => `${c} ${n}`).join(', ')}. {s.lastExportAt ? `Last backup ${timeAgo(s.lastExportAt)}.` : 'No backup made yet.'}</p>
          <Checkbox checked={includeDemo} onChange={setIncludeDemo} label="Include demo records in the backup" />
          <Checkbox checked={encBackup} onChange={setEncBackup} label="Protect the backup with a passphrase (recommended)" />
          {encBackup && <Field label="Backup passphrase" htmlFor="bk-pass" hint="Needed to restore this backup. It cannot be recovered."><TextInput id="bk-pass" type="password" autoComplete="new-password" value={bkPass} onChange={(e: { target: { value: string } }) => setBkPass(e.target.value)} /></Field>}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={doExport}>Export backup (JSON)</Button>
            <Button onClick={() => fileRef.current?.click()}>Import backup…</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Import backup file" onChange={onFile} />
          </div>
          {msg && <p role="status" className={'text-sm ' + (msg.ok ? 'text-ok' : 'text-bad')}>{msg.text}</p>}
        </Card>
      </section>

      <section>
        <SectionTitle>Voice transcription</SectionTitle>
        <Card className="p-4 space-y-3">
          <p className="text-sm text-muted">Optional. To turn an uploaded <em>audio</em> file into text, give the address of a speech-to-text service that accepts the OpenAI-style <code>/audio/transcriptions</code> upload. <strong>The audio is sent to that address.</strong> Transcript files and dictation work without this. Not tested against a live service.</p>
          <Field label="Service address" htmlFor="st-url" hint="For example https://api.openai.com/v1/audio/transcriptions or your own server."><TextInput id="st-url" inputMode="url" value={s.transcribeUrl ?? ''} onChange={(e: { target: { value: string } }) => store.updateSettings({ transcribeUrl: e.target.value.trim() || undefined })} placeholder="https://…" /></Field>
          <Field label="Model name (optional)" htmlFor="st-model"><TextInput id="st-model" value={s.transcribeModel ?? ''} onChange={(e: { target: { value: string } }) => store.updateSettings({ transcribeModel: e.target.value.trim() || undefined })} placeholder="whisper-1" /></Field>
          <Field label="Access key (this session only)" htmlFor="st-key" hint="Kept in memory and forgotten when you close or reload the app. It is never saved or included in backups."><TextInput id="st-key" type="password" autoComplete="off" value={tKey} onChange={(e: { target: { value: string } }) => { setTKey(e.target.value); setTranscribeKey(e.target.value); }} /></Field>
        </Card>
      </section>

      <section>
        <SectionTitle>Demo and reset</SectionTitle>
        <Card className="p-4 space-y-3">
          <p className="text-sm">{store.hasDemo() ? `${plural(store.countDemo(), 'demo record')} present. They are fictional examples.` : 'No demo records present.'}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!store.hasDemo()} onClick={() => setConfirm('demo')}>Clear demo data</Button>
            <Button onClick={() => setConfirm('reset-demo')}>Restore demo data</Button>
            <Button variant="danger" onClick={() => setConfirm('reset')}>Erase everything…</Button>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Privacy</SectionTitle>
        <Card className="p-4 text-sm space-y-2">
          <p>ForgeTools checks what you type for passwords, keys, tokens, card numbers and personal details before saving. Secrets are blocked outright. Other details need your confirmation.</p>
          <p className="font-medium">Do not enter:</p>
          <ul className="list-disc pl-5">{NEVER_ENTER.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="font-medium pt-1">Write it like this instead:</p>
          <ul className="space-y-1">{REDACTION_EXAMPLES.map((r) => <li key={r.use} className="wrap-any"><span className="text-bad line-through">{r.instead}</span><br /><span className="text-ok">{r.use}</span></li>)}</ul>
        </Card>
      </section>

      {env && (
        <Modal title="Encrypted backup" onClose={() => { setEnv(null); setImpPass(''); }} footer={<><Button onClick={() => { setEnv(null); setImpPass(''); }}>Cancel</Button><Button variant="primary" disabled={!impPass} onClick={decryptImport}>Decrypt</Button></>}>
          <Field label="Backup passphrase" htmlFor="imp-pass"><TextInput id="imp-pass" type="password" autoComplete="off" value={impPass} onChange={(e: { target: { value: string } }) => setImpPass(e.target.value)} /></Field>
        </Modal>
      )}
      {pending !== null && (
        <Modal title="Import backup" onClose={() => setPending(null)} footer={<><Button onClick={() => setPending(null)}>Cancel</Button><Button onClick={() => doImport('merge')}>Merge</Button><Button variant="danger" onClick={() => doImport('replace')}>Replace everything</Button></>}>
          <p className="text-sm"><strong>Merge</strong> keeps your current records and adds the backup's, with the newer copy winning on matches. <strong>Replace</strong> discards current records first.</p>
        </Modal>
      )}
      {confirm === 'demo' && <Modal title="Clear demo data?" onClose={() => setConfirm(null)} footer={<><Button onClick={() => setConfirm(null)}>Cancel</Button><Button variant="primary" onClick={() => { store.clearDemo(); setConfirm(null); }}>Clear demo data</Button></>}><p className="text-sm">Only records marked DEMO are removed. Your own records are untouched.</p></Modal>}
      {confirm === 'reset-demo' && <Modal title="Restore demo data?" onClose={() => setConfirm(null)} footer={<><Button onClick={() => setConfirm(null)}>Cancel</Button><Button variant="danger" onClick={() => { store.resetAll({ withDemo: true }); setConfirm(null); }}>Erase and restore demo</Button></>}><p className="text-sm">This erases <strong>all</strong> data, including your own, and reloads the sample records. Export a backup first.</p></Modal>}
      {confirm === 'reset' && (
        <Modal title="Erase everything?" onClose={() => { setConfirm(null); setTyped(''); }} footer={<><Button onClick={() => { setConfirm(null); setTyped(''); }}>Cancel</Button><Button variant="danger" disabled={typed !== 'ERASE'} onClick={() => { store.resetAll({ withDemo: false }); setConfirm(null); setTyped(''); }}>Erase all data</Button></>}>
          <p className="text-sm mb-2">This permanently deletes all records on this device, including demo data. Export a backup first if you might need anything.</p>
          <Field label="Type ERASE to confirm" htmlFor="erase"><TextInput id="erase" value={typed} onChange={(e: { target: { value: string } }) => setTyped(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  );
}
