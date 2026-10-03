import { useMemo, useState } from 'react';
import { PRIORITIES, deadlines } from '../lib/sla';
import type { Priority } from '../lib/sla';
import { ymd } from '../lib/progress';
import { Badge, Button, Card, Chip, Field, PageHeader, SectionTitle, TextInput } from '../ui/primitives';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

const stamp = (d: Date) => d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const mins = (m: number) => (m < 60 ? `${m} minutes` : m === 60 ? '1 hour' : m % 60 === 0 ? `${m / 60} hours` : `${m} minutes`);
const localInput = (d: Date) => `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function SlaPage() {
  useTitle('Response times');
  const [pri, setPri] = useState<Priority>('high');
  const [when, setWhen] = useState(() => localInput(new Date()));
  const p = PRIORITIES.find((x) => x.id === pri)!;
  const logged = useMemo(() => { const d = new Date(when); return Number.isNaN(d.getTime()) ? new Date() : d; }, [when]);
  const r = deadlines(p, logged);
  return (
    <div className="max-w-3xl pb-10 space-y-5">
      <PageHeader title="Priorities and response times" sub="Call priorities, targets and update frequency, with a clock for the deadlines." actions={<Link to="/checks"><Button>Check guides</Button></Link>} />
      <p className="text-xs text-muted" role="note">From your Tasks checklist. Times are counted on business days between 09:00 and 17:00 and do not allow for public holidays. This is a planning helper: check the wording and times against the current agreement.</p>

      <Card className="p-4 space-y-3" aria-label="Deadline clock">
        <SectionTitle>Deadline clock</SectionTitle>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Priority">{PRIORITIES.map((x) => <Chip key={x.id} active={pri === x.id} onClick={() => setPri(x.id)}>{x.label}</Chip>)}</div>
        <Field label="Logged at" htmlFor="sla-when"><TextInput id="sla-when" type="datetime-local" value={when} onChange={(e: { target: { value: string } }) => setWhen(e.target.value)} /></Field>
        {r.outsideHours && <p role="status" className="text-sm text-warn">That is outside 09:00 to 17:00 on a business day, so the clock starts at the next opening.</p>}
        <dl className="grid gap-2 sm:grid-cols-3" data-testid="deadlines">
          <div className="rounded-md border border-line p-3"><dt className="text-xs text-muted">Target response ({mins(p.targetResponse)})</dt><dd className="font-semibold" data-testid="respond-by">{stamp(r.respondBy)}</dd></div>
          <div className="rounded-md border border-line p-3"><dt className="text-xs text-muted">Contractual response ({mins(p.contractualResponse)})</dt><dd className="font-semibold" data-testid="contract-by">{stamp(r.contractualBy)}</dd></div>
          <div className="rounded-md border border-line p-3"><dt className="text-xs text-muted">First update due ({p.updateEvery.label.toLowerCase()})</dt><dd className="font-semibold" data-testid="update-by">{stamp(r.firstUpdateBy)}</dd></div>
        </dl>
        <p className="text-xs text-muted">The 24-hour update is counted as the same time on the next business day. Then keep updating at that interval until it is resolved.</p>
      </Card>

      <section aria-label="Response table">
        <SectionTitle>Response and update times</SectionTitle>
        <div className="overflow-x-auto"><table className="w-full text-sm border border-line rounded-md">
          <thead className="bg-surface2 text-left"><tr><th className="p-2">Priority</th><th className="p-2">Target response</th><th className="p-2">Contractual response</th><th className="p-2">Update</th></tr></thead>
          <tbody>{PRIORITIES.map((x) => <tr key={x.id} className="border-t border-line"><th scope="row" className="p-2 text-left font-medium">{x.label}</th><td className="p-2">{mins(x.targetResponse)}</td><td className="p-2">{mins(x.contractualResponse)}</td><td className="p-2">{x.updateEvery.label}</td></tr>)}</tbody>
        </table></div>
        <p className="text-xs text-muted mt-1">On business days between 09:00 and 17:00.</p>
      </section>

      <section aria-label="What each priority means">
        <SectionTitle>What each priority means</SectionTitle>
        <ul className="space-y-2">{PRIORITIES.map((x) => (
          <li key={x.id}><Card className="p-3 space-y-1"><p className="font-medium"><Badge tone={x.id === 'critical' ? 'bad' : x.id === 'high' ? 'warn' : 'neutral'}>{x.label}</Badge></p>
            <ul className="list-disc pl-5 text-sm">{x.description.map((d) => <li key={d}>{d}</li>)}</ul>
            <p className="text-sm text-muted"><span className="font-medium text-ink">Example: </span>{x.example}</p>
          </Card></li>
        ))}</ul>
      </section>
    </div>
  );
}
