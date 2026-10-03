import { useCallback, useEffect, useState } from 'react';
import { files, isNativeApp, notifyFilesChanged, shareStoredFile, subscribeFiles } from '../data/files';
import type { StoredFile } from '../data/files';
import { downloadText, formatDateTime, plural } from '../lib/util';
import { Badge, Button, Card, CopyButton, Empty, Modal, PageHeader } from '../ui/primitives';
import { useTitle } from '../ui/hooks';

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export function FilesPage() {
  useTitle('Files');
  const [list, setList] = useState<StoredFile[] | null>(null);
  const [view, setView] = useState<{ file: StoredFile; text: string } | null>(null);
  const [del, setDel] = useState<StoredFile | null>(null);
  const [msg, setMsg] = useState('');
  const refresh = useCallback(async () => {
    try { setList((await files().list()).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))); } catch { setList([]); setMsg('Storage could not be read.'); }
  }, []);
  useEffect(() => { refresh(); return subscribeFiles(refresh); }, [refresh]);

  const open = async (f: StoredFile) => setView({ file: f, text: (await files().read(f.path)) ?? '(could not read this file)' });
  const dl = async (f: StoredFile) => { const t = await files().read(f.path); if (t !== null) downloadText(f.name, t, f.name.endsWith('.json') ? 'application/json' : 'text/plain'); };
  const share = async (f: StoredFile) => { if (!(await shareStoredFile(f.path, f.name))) setMsg('Sharing is only available in the phone app. Use Download instead.'); };
  const where = files().kind === 'native' ? 'the app’s private storage on this phone' : files().kind === 'browser' ? 'this browser’s storage' : 'memory (lost when you close the page)';

  return (
    <div className="max-w-3xl pb-8">
      <PageHeader title="Files" sub={`Guides, transcripts and backups you have created, kept in ${where}.`} />
      {files().kind !== 'native' && !isNativeApp() && <p className="text-xs text-muted mb-3" role="note">In the phone app these are real files in the app’s private storage. In a browser they are kept in browser storage and can be cleared with site data, so download anything important.</p>}
      {msg && <p role="status" className="text-sm text-warn mb-2">{msg}</p>}
      {list === null ? <p className="text-sm text-muted">Loading…</p> : list.length === 0 ? <Empty title="No files yet.">Save a guide from the Guide agent or Voice notes, or export a backup in Settings.</Empty> : (
        <>
          <p className="text-sm text-muted mb-2">{plural(list.length, 'file')}</p>
          <ul className="space-y-2">
            {list.map((f) => (
              <li key={f.path}>
                <Card className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium wrap-any">{f.name}</p>
                      <p className="text-xs text-muted"><Badge>{f.path.split('/')[0]}</Badge> {kb(f.size)}{f.modifiedAt ? ` · ${formatDateTime(f.modifiedAt)}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" onClick={() => open(f)}>View</Button>
                      <Button size="sm" onClick={() => dl(f)}>Download</Button>
                      {isNativeApp() && <Button size="sm" onClick={() => share(f)}>Share</Button>}
                      <Button size="sm" variant="ghost" aria-label={`Delete ${f.name}`} onClick={() => setDel(f)}>✕</Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
      {view && (
        <Modal title={view.file.name} onClose={() => setView(null)} footer={<CopyButton text={view.text} label="Copy text" size="md" />}>
          <pre className="font-mono text-xs whitespace-pre-wrap wrap-any max-h-[60dvh] overflow-y-auto">{view.text}</pre>
        </Modal>
      )}
      {del && (
        <Modal title="Delete this file?" onClose={() => setDel(null)} footer={<><Button onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={async () => { await files().remove(del.path); setDel(null); notifyFilesChanged(); }}>Delete</Button></>}>
          <p className="text-sm wrap-any">{del.name} will be removed from this device. A saved Knowledge base entry is not affected.</p>
        </Modal>
      )}
    </div>
  );
}
