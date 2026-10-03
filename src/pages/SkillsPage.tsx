import { useState } from 'react';
import { SKILLS, SKILL_LEVELS, SKILL_LEVEL_HELP } from '../content/skills';
import type { SkillLevel } from '../content/skills';
import { store, useCollection } from '../data/hooks';
import { evaluateSkills } from '../lib/skills-eval';
import { formatDate, plural } from '../lib/util';
import { Badge, Card, Collapsible, PageHeader, Select, TextInput } from '../ui/primitives';
import { Link } from '../ui/router';
import { useTitle } from '../ui/hooks';

const GROUPS = ['IT Engineering', 'Cybersecurity', 'Professional'] as const;

export function SkillsPage() {
  useTitle('Skills profile');
  const logs = useCollection('workLogs');
  const ratings = useCollection('skillRatings');
  const ev = evaluateSkills(logs, ratings);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const setRating = (skillId: string, level: SkillLevel | null, note?: string) => {
    const cur = ratings.find((r) => r.skillId === skillId);
    store.upsert('skillRatings', { id: skillId, skillId, level, note: note ?? cur?.note ?? '', demo: false });
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Skills profile" sub="Levels come from you. Logged work is shown as evidence, never counted automatically." />
      <details className="mb-4 text-sm bg-surface border border-line rounded-md p-3">
        <summary className="cursor-pointer min-h-8 flex items-center font-medium">How levels work</summary>
        <ul className="mt-2 space-y-1">{SKILL_LEVELS.map((l) => <li key={l}><strong>{l}</strong>: {SKILL_LEVEL_HELP[l]}</li>)}</ul>
        <p className="mt-2 text-muted">A suggestion appears once you have real logs: 1 day of work = Exposure, 2–3 = Developing, 4–7 = Practised, 8+ = Confident. “Demonstrated” is always your decision and needs at least 3 logs with evidence.</p>
      </details>
      {GROUPS.map((g) => (
        <div key={g} className="mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{g}</h2>
          <ul className="space-y-2">
            {ev.filter((e) => SKILLS.find((s) => s.id === e.skillId)!.group === g).map((e) => {
              const def = SKILLS.find((s) => s.id === e.skillId)!;
              const note = noteDraft[e.skillId] ?? ratings.find((r) => r.skillId === e.skillId)?.note ?? '';
              return (
                <li key={e.skillId}>
                  <Card className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{def.name}</p>
                        <p className="text-sm text-muted">{def.description}</p>
                      </div>
                      <div className="w-full sm:w-48">
                        <label className="text-xs text-muted" htmlFor={'lvl-' + e.skillId}>Your level</label>
                        <Select id={'lvl-' + e.skillId} value={e.chosen ?? ''} onChange={(ev2: { target: { value: string } }) => setRating(e.skillId, (ev2.target.value || null) as SkillLevel | null)}>
                          <option value="">Not rated</option>
                          {SKILL_LEVELS.map((l) => <option key={l}>{l}</option>)}
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                      <Badge tone={e.days ? 'info' : 'neutral'}>{plural(e.logs.length, 'log')} · {plural(e.days, 'day')}</Badge>
                      {e.suggested && <Badge tone="accent">Evidence suggests: {e.suggested}</Badge>}
                      {!e.logs.length && <Badge>No evidence yet</Badge>}
                    </div>
                    {e.warning && <p role="status" className="mt-2 text-sm rounded-sm border border-warn/50 bg-warn/5 p-2">{e.warning}</p>}
                    {(e.logs.length > 0 || e.chosen) && (
                      <div className="mt-2">
                        <Collapsible title="Evidence and notes">
                          <div className="space-y-2 pt-1">
                            <TextInput aria-label={`Note for ${def.name}`} placeholder="Why this level? (optional)" value={note} onChange={(x: { target: { value: string } }) => setNoteDraft({ ...noteDraft, [e.skillId]: x.target.value })} onBlur={() => e.chosen && setRating(e.skillId, e.chosen, note)} />
                            <ul className="text-sm space-y-1">{e.logs.slice(0, 8).map((l) => <li key={l.id}><Link to={`/logs/${l.id}`} className="underline wrap-any">{l.ref}</Link> · {formatDate(l.occurredAt)} · {l.problem.slice(0, 70)}</li>)}</ul>
                          </div>
                        </Collapsible>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
