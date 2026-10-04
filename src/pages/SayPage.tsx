import { useEffect, useState } from 'react';
import { Block, Blocks } from '../ui/PageCustomizer';
import { CLOSINGS, NEEDS, PHRASES, STAGES } from '../content/say';
import { EMPTY_COMPOSE, EMPTY_VARS, compose, fill, phraseText, wrapText } from '../lib/say';
import type { SayVars, Tone } from '../lib/say';
import { scanText } from '../lib/sensitive';
import { vault } from '../data/hooks';
import { Button, Card, Checkbox, Chip, CopyButton, Field, PageHeader, SectionTitle, Select, TextArea, TextInput } from '../ui/primitives';
import { PrivacyNote, SensitivePanel, useSaveGuard } from '../ui/SensitivePanel';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

type Chg = { target: { value: string } };
const KEY = 'say';
interface Mine { id: string; title: string; text: string }
const readMine = (): Mine[] => {
  try {
    const v = vault.read(KEY);
    return Array.isArray(v) ? (v as unknown[]).filter((x): x is Mine => !!x && typeof (x as Mine).id === 'string' && typeof (x as Mine).title === 'string' && typeof (x as Mine).text === 'string').slice(0, 40) : [];
  } catch { return []; }
};
const WRAP = 60;

export function SayPage() {
  useTitle('Remote session messages');
  const [v, setV] = useState<SayVars>(EMPTY_VARS);
  const [tone, setTone] = useState<Tone>('friendly');
  const [opening, setOpening] = useState(true);
  const [askTime, setAskTime] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [needs, setNeeds] = useState<string[]>([]);
  const [closing, setClosing] = useState('');
  const [action, setAction] = useState('');
  const [wrap, setWrap] = useState(false);
  const [q, setQ] = useState('');
  const [mine, setMine] = useState<Mine[]>(readMine);
  const [draft, setDraft] = useState({ title: '', text: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { try { vault.write(KEY, mine); } catch { /* storage unavailable */ } }, [mine]);

  const text = { name: v.name, me: v.me, issue: v.issue, action, app: v.app };
  const guard = useSaveGuard(text);
  const apply = (r: Record<string, string>) => { setV({ ...v, name: r.name ?? v.name, me: r.me ?? v.me, issue: r.issue ?? v.issue, app: r.app ?? v.app }); setAction(r.action ?? action); guard.setConfirmed(false); };
  const set = (k: keyof SayVars) => (e: Chg) => setV({ ...v, [k]: e.target.value });
  const out = compose({ ...EMPTY_COMPOSE, tone, vars: v, opening, askTime, privacy, thanks, action, needs, closing, wrap: wrap ? WRAP : 0 });
  const toggle = (id: string, on: boolean) => setNeeds(on ? [...needs, id] : needs.filter((x) => x !== id));
  const body = (t: string) => (wrap ? wrapText(t, WRAP) : t);

  const ql = q.trim().toLowerCase();
  const lib = PHRASES.filter((p) => !ql || `${p.title} ${p.friendly} ${p.stage}`.toLowerCase().includes(ql));
  const myShown = mine.filter((m) => !ql || `${m.title} ${m.text}`.toLowerCase().includes(ql));

  const addMine = () => {
    const title = draft.title.trim().slice(0, 40), t = draft.text.trim().slice(0, 400);
    if (!title || !t) return;
    if (scanText(title + ' ' + t).length) { setMsg('That looks like it contains a secret or a personal detail, so it was not saved. Keep saved wording generic and use {name} and {issue} for the details.'); return; }
    setMsg(''); setMine([...mine, { id: 'm' + Date.now().toString(36), title, text: t }].slice(0, 40)); setDraft({ title: '', text: '' });
  };
  const ok = guard.canSave;

  return (
    <div className="max-w-3xl pb-10 space-y-4" data-testid="say">
      <PageHeader title="Remote session messages" sub="Quick, clean wording to paste into a text window on the user's screen while you work." actions={<Link to="/tools"><Button>Toolbox</Button></Link>} />
      <Blocks pageKey="SayPage" group="SayPage" className="space-y-4">
        <Block title="Section 1">
      <Card className="p-4 text-sm space-y-1">
        <p>Build a message below, or copy a ready-made line from the library. <strong>Only send what is true</strong>: check each line matches what you are actually doing.</p>
        <p className="text-muted">The boxes are not saved and nothing is sent anywhere. Do not type passwords, account numbers or other customer details.</p>
      </Card>
        </Block>
        <Block title="Tone">
      <Card className="p-4 space-y-3">
        <SectionTitle>Message builder</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Their first name" htmlFor="say-name"><TextInput id="say-name" value={v.name} autoComplete="off" onChange={set('name')} /></Field>
          <Field label="Your name (optional)" htmlFor="say-me"><TextInput id="say-me" value={v.me} autoComplete="off" onChange={set('me')} /></Field>
          <Field label="What it is about" htmlFor="say-issue" hint="A few words, for example: the printer queue"><TextInput id="say-issue" value={v.issue} onChange={set('issue')} /></Field>
          <Field label="What you are doing right now" htmlFor="say-action" hint="For example: checking the print queue"><TextInput id="say-action" value={action} onChange={(e: Chg) => setAction(e.target.value)} /></Field>
          <Field label="How long, in minutes" htmlFor="say-mins"><TextInput id="say-mins" value={v.mins} inputMode="numeric" onChange={set('mins')} /></Field>
          <Field label="Application to test (optional)" htmlFor="say-app"><TextInput id="say-app" value={v.app} onChange={set('app')} /></Field>
        </div>
        <div className="flex gap-2 items-center flex-wrap" role="group" aria-label="Tone"><span className="text-sm font-medium">Tone</span><Chip active={tone === 'friendly'} onClick={() => setTone('friendly')}>Friendly</Chip><Chip active={tone === 'brief'} onClick={() => setTone('brief')}>Brief</Chip></div>
        <fieldset className="space-y-1"><legend className="text-sm font-medium mb-1">Include</legend>
          <Checkbox checked={opening} onChange={setOpening} label="Introduce yourself" />
          <Checkbox checked={askTime} onChange={setAskTime} label="Check it is a good time" />
          <Checkbox checked={privacy} onChange={setPrivacy} label="Privacy reassurance" />
        </fieldset>
        <fieldset className="space-y-1"><legend className="text-sm font-medium mb-1">I need you to</legend>
          {NEEDS.map((n) => <Checkbox key={n.id} checked={needs.includes(n.id)} onChange={(on: boolean) => toggle(n.id, on)} label={n.label} />)}
        </fieldset>
        <Field label="Closing" htmlFor="say-closing"><Select id="say-closing" value={closing} onChange={(e: Chg) => setClosing(e.target.value)}>{CLOSINGS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
        <Checkbox checked={thanks} onChange={setThanks} label="Finish with a thank you" />
        <Checkbox checked={wrap} onChange={setWrap} label="Break into short lines (for a plain text window that does not wrap)" />
        <SensitivePanel guard={guard} fieldLabels={{ name: 'Name', me: 'Your name', issue: 'About', action: 'Doing', app: 'Application' }} onRedactAll={() => apply(guard.redactAll(text))} onRedactKind={(k) => apply(guard.redactOneKind(text, k))} />
        <div className="flex justify-between items-center"><PrivacyNote /><Button variant="ghost" onClick={() => { setV(EMPTY_VARS); setAction(''); setNeeds([]); setClosing(''); setOpening(true); setAskTime(false); setPrivacy(false); setThanks(false); guard.setConfirmed(false); }}>Clear</Button></div>
      </Card>
        </Block>
        <Block title="Your message">
      <Card className="p-4 space-y-2" aria-label="Your message">
        <SectionTitle action={out && ok ? <CopyButton text={out} label="Copy message" /> : undefined}>Your message</SectionTitle>
        <pre className="text-sm whitespace-pre-wrap wrap-any" data-testid="say-out">{out || 'Choose something above and the message appears here.'}</pre>
        {out && !ok && <p role="status" className="text-sm text-warn">Copying is off until the details flagged above are removed or confirmed.</p>}
      </Card>
        </Block>
        <Block title="Ready-made lines">
      <Card className="p-4 space-y-3">
        <SectionTitle>Ready-made lines</SectionTitle>
        <Field label="Search the lines" htmlFor="say-q"><TextInput id="say-q" value={q} placeholder="restart, password, test" onChange={(e: Chg) => setQ(e.target.value)} /></Field>
        <p className="text-xs text-muted" aria-live="polite" data-testid="say-count">{lib.length + myShown.length} line{lib.length + myShown.length === 1 ? '' : 's'}</p>
        {STAGES.map((s) => {
          const items = lib.filter((p) => p.stage === s);
          if (!items.length) return null;
          return (
            <section key={s} aria-label={s} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted">{s}</h3>
              <ul className="space-y-2">{items.map((p) => {
                const t = body(phraseText(p, tone, v));
                return <li key={p.id} data-testid={`say-phrase-${p.id}`} className="rounded-md border border-line p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{p.title}</span>{ok && <CopyButton text={t} label="Copy" />}</div>
                  <p className="text-sm text-muted whitespace-pre-wrap wrap-any">{t}</p>
                </li>;
              })}</ul>
            </section>
          );
        })}
      </Card>
        </Block>
        <Block title="My own lines">
      <Card className="p-4 space-y-3" data-testid="say-mine">
        <SectionTitle>My own lines</SectionTitle>
        <p className="text-xs text-muted">Saved on this device only (encrypted if encryption is on). Use {'{name}'}, {'{issue}'}, {'{time}'} and {'{app}'} where the details go. Names and numbers are refused.</p>
        {msg && <p role="alert" className="text-sm text-warn">{msg}</p>}
        {myShown.length === 0 && <p className="text-sm text-muted">{mine.length ? 'No saved line matches the search.' : 'None yet.'}</p>}
        <ul className="space-y-2">{myShown.map((m) => {
          const t = body(fill(m.text, v));
          return <li key={m.id} data-testid="say-mine-item" className="rounded-md border border-line p-3 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap"><span className="text-sm font-medium">{m.title}</span>
              <span className="flex gap-1">{ok && <CopyButton text={t} label="Copy" />}<Button size="sm" variant="ghost" aria-label={`Remove ${m.title}`} onClick={() => setMine(mine.filter((x) => x.id !== m.id))}>Remove</Button></span></div>
            <p className="text-sm text-muted whitespace-pre-wrap wrap-any">{t}</p>
          </li>;
        })}</ul>
        <form className="space-y-2" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); addMine(); }}>
          <Field label="Title" htmlFor="say-new-title"><TextInput id="say-new-title" maxLength={40} value={draft.title} onChange={(e: Chg) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Wording" htmlFor="say-new-text"><TextArea id="say-new-text" rows={3} maxLength={400} value={draft.text} onChange={(e: Chg) => setDraft({ ...draft, text: e.target.value })} /></Field>
          <Button type="submit" disabled={!draft.title.trim() || !draft.text.trim()}>Save this line</Button>
        </form>
      </Card>
        </Block>
      </Blocks>
    </div>
  );
}
