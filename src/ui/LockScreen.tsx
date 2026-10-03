import { useEffect, useState } from 'react';
import { store, vault } from '../data/hooks';
import { wipeFiles } from '../data/files';
import { Button, Card, Field, TextInput } from './primitives';
import { readBiometric } from '../lib/biometric';

/** Shown instead of the whole app while encrypted data is locked. */
export function LockScreen() {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => { if (!until) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [until]);
  const wait = Math.max(0, Math.ceil((until - now) / 1000));

  const unlock = async () => {
    if (busy || wait > 0 || !pass) return;
    setBusy(true); setErr('');
    try {
      await vault.unlock(pass);
      setPass('');
      store.reload();
    } catch {
      const n = fails + 1;
      setFails(n);
      // Slow down repeated guesses: 3 free tries, then 2, 4, 8… seconds up to 60. This only slows typing, it is not a defence against someone copying the stored data. Passphrase strength is.
      if (n >= 3) { setUntil(Date.now() + Math.min(60, 2 ** (n - 2)) * 1000); setNow(Date.now()); }
      setErr('That passphrase did not open the data.');
    }
    setBusy(false);
  };

  const bio = vault.bio;
  const unlockBio = async () => {
    if (busy || !bio) return;
    setBusy(true); setErr('');
    const r = await readBiometric(bio.cred, bio.salt);
    if (r.ok) {
      try { await vault.unlockWithBiometric(r.wrapKey); store.reload(); setBusy(false); return; } catch { /* fall through */ }
    }
    setErr(r.ok || r.reason === 'failed' ? 'Fingerprint did not unlock the data. Use your passphrase.' : 'Fingerprint cancelled. You can try again or use your passphrase.');
    setBusy(false);
  };

  const erase = async () => {
    vault.destroy();
    await wipeFiles().catch(() => undefined);
    store.reload();
  };

  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center gap-2 font-semibold text-lg"><span className="inline-grid place-items-center size-7 rounded-sm bg-accent text-accent-ink font-mono text-sm">F</span>ForgeTools is locked</div>
        <Card className="p-4 space-y-3">
          {bio && <Button variant="primary" className="w-full" disabled={busy} onClick={unlockBio}>{busy ? 'Waiting…' : '☝ Unlock with fingerprint'}</Button>}
          <form className="space-y-3" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); unlock(); }}>
            <Field label="Passphrase" htmlFor="lock-pass">
              <TextInput id="lock-pass" type="password" autoComplete="off" autoFocus value={pass} onChange={(e: { target: { value: string } }) => setPass(e.target.value)} />
            </Field>
            {err && <p role="alert" className="text-sm text-bad">{err}{wait > 0 ? ` Try again in ${wait}s.` : ''}</p>}
            <Button type="submit" variant="primary" disabled={busy || wait > 0 || !pass}>{busy ? 'Unlocking…' : 'Unlock'}</Button>
          </form>
          <button type="button" className="text-sm underline min-h-9" onClick={() => setForgot((f) => !f)} aria-expanded={forgot}>Forgot the passphrase?</button>
          {forgot && (
            <div className="text-sm space-y-2 border-t border-line pt-3">
              <p>There is no way to recover it: that is what keeps your data private. The only option is to erase everything on this device and start fresh. If you have an encrypted backup you can restore it afterwards with its own passphrase.</p>
              <Field label="Type ERASE to confirm" htmlFor="lock-erase"><TextInput id="lock-erase" value={typed} onChange={(e: { target: { value: string } }) => setTyped(e.target.value)} /></Field>
              <Button variant="danger" disabled={typed !== 'ERASE'} onClick={erase}>Erase everything</Button>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
