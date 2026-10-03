import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { VisualModel } from '../lib/visual';
import { layoutDiagram, PHOTO_H, stepDuration } from '../lib/visual';
import type { StepIcon } from '../lib/visual';
import { Button } from './primitives';
import { StepAsk } from './StepAsk';
import { speak, speakFailMessage, speechSupported, stopSpeaking } from '../lib/speech';

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- diagram ----------

const ICON_PATHS: Record<StepIcon, ReactNode> = {
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M12 15h5" /></>,
  warning: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  printer: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  network: <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M12 7.5v4M12 11.5L5 16.5M12 11.5l7 5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
  power: <><path d="M12 3v9" /><path d="M6.3 6.3a8 8 0 1 0 11.4 0" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M16 16l5 5" /></>,
  file: <><path d="M6 2h8l5 5v15H6z" /><path d="M14 2v5h5M9 13h7M9 17h7" /></>,
  shield: <><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" /><path d="M9 12l2 2 4-4" /></>,
  update: <><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20 3v5h-5" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
  step: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></>,
};

export function StepGlyph({ icon, size = 22, color = 'var(--c-accent)' }: { icon: StepIcon; size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON_PATHS[icon]}</svg>;
}

export function GuideDiagram({ model, images }: { model: VisualModel; images?: Record<number, Array<{ src: string; caption: string }>> }) {
  const photoSteps = useMemo(() => new Set(model.steps.filter((x) => (images?.[x.n]?.length ?? 0) > 0).map((x) => x.n)), [model, images]);
  const { nodes, height } = useMemo(() => layoutDiagram(model, 29, 4, photoSteps), [model, photoSteps]);
  const W = 320;
  const desc = model.steps.map((s) => `Step ${s.n}: ${s.text}`).join(' ');
  return (
    <figure className="m-0" data-testid="diagram">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-labelledby="dg-t dg-d" className="w-full max-w-sm mx-auto h-auto" style={{ fontFamily: 'inherit' }}>
        <title id="dg-t">{`Flow of steps: ${model.title}`}</title>
        <desc id="dg-d">{desc}</desc>
        <defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--c-muted)" /></marker></defs>
        {nodes.map((n, i) => {
          const next = nodes[i + 1];
          return (
            <g key={n.id}>
              {next && <line x1={W / 2} y1={n.y + n.h} x2={W / 2} y2={next.y - 2} stroke="var(--c-muted)" strokeWidth="1.5" markerEnd="url(#dg-arrow)" />}
              {n.kind !== 'step' ? (
                <g>
                  <rect x={W / 2 - 80} y={n.y} width="160" height={n.h} rx={n.h / 2} fill={n.kind === 'start' ? 'var(--c-accent)' : 'var(--c-ok)'} />
                  <text x={W / 2} y={n.y + n.h / 2 + 4.5} textAnchor="middle" fontSize="13" fontWeight="600" fill={n.kind === 'start' ? 'var(--c-accent-ink)' : 'var(--c-canvas)'}>{n.lines[0]}</text>
                </g>
              ) : (
                <g>
                  <rect x="8" y={n.y} width={W - 16} height={n.h} rx="8" fill="var(--c-surface)" stroke={n.caution ? 'var(--c-warn)' : 'var(--c-line)'} strokeWidth={n.caution ? 2 : 1.5} />
                  <circle cx="26" cy={n.y + 18} r="11" fill={n.caution ? 'var(--c-warn)' : 'var(--c-accent)'} />
                  <text x="26" y={n.y + 22.5} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--c-canvas)">{n.n}</text>
                  {n.icon && <g transform={`translate(${W - 36} ${n.y + 8})`}><circle cx="11" cy="11" r="15" fill="var(--c-surface2)" /><svg x="0" y="0" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={n.caution ? 'var(--c-warn)' : 'var(--c-accent)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON_PATHS[n.icon]}</svg></g>}
                  {n.lines.map((l, j) => <text key={j} x="46" y={n.y + 22 + j * 17} fontSize="13" fill="var(--c-ink)">{l}</text>)}
                  {n.photo && n.n !== undefined && images?.[n.n]?.[0] && <g><rect x="46" y={n.y + n.h - PHOTO_H - 8 - (n.cmd ? 24 : 0)} width="120" height={PHOTO_H} rx="5" fill="var(--c-surface2)" /><image href={images[n.n][0].src} x="46" y={n.y + n.h - PHOTO_H - 8 - (n.cmd ? 24 : 0)} width="120" height={PHOTO_H} preserveAspectRatio="xMidYMid slice" clipPath="inset(0 round 5px)"><title>{images[n.n][0].caption || `Photo for step ${n.n}`}</title></image></g>}
                  {n.cmd && (
                    <g>
                      <rect x="46" y={n.y + n.h - 28} width={W - 62} height="20" rx="4" fill="var(--c-surface2)" />
                      <text x="52" y={n.y + n.h - 14} fontSize="11" fontFamily="ui-monospace, monospace" fill="var(--c-ink)">{'> ' + n.cmd}</text>
                    </g>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-muted text-center mt-1">Drawn from the guide’s steps. Amber outline = a step that mentions a caution. Your photos appear on the steps they are attached to.</figcaption>
    </figure>
  );
}

// ---------- player ----------

function Terminal({ command, animate }: { command: string; animate: boolean }) {
  const [n, setN] = useState(animate ? 0 : command.length);
  useEffect(() => {
    if (!animate) { setN(command.length); return; }
    setN(0);
    const t = setInterval(() => setN((x) => { if (x >= command.length) { clearInterval(t); return x; } return x + 1; }), 35);
    return () => clearInterval(t);
  }, [command, animate]);
  return (
    <div className="rounded-md border border-line bg-[#0b0d0f] text-[#e7e9ec] font-mono text-xs overflow-hidden" role="group" aria-label="Command from the guide">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1e2125] text-[#9ba4af]"><span aria-hidden className="size-2 rounded-full bg-[#f87171]" /><span aria-hidden className="size-2 rounded-full bg-[#fbbf24]" /><span aria-hidden className="size-2 rounded-full bg-[#4ade80]" /><span className="ml-1">Terminal (illustration only, nothing is run)</span></div>
      <pre className="p-3 whitespace-pre-wrap break-all m-0"><span aria-hidden className="text-[#4ade80]">&gt; </span>{command.slice(0, n)}{n < command.length && <span aria-hidden className="animate-pulse">▌</span>}</pre>
    </div>
  );
}

export function GuidePlayer({ model, images }: { model: VisualModel; images?: Record<number, Array<{ src: string; caption: string }>> }) {
  const steps = model.steps;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [readAloud, setReadAloud] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState('');
  const noMotion = useMemo(reduced, []);
  const canSpeak = useMemo(speechSupported, []);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const prevPlaying = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const s = steps[Math.min(i, steps.length - 1)];

  useEffect(() => {
    const pausedNow = prevPlaying.current && !playing;
    prevPlaying.current = playing;
    if (pausedNow) { stopSpeaking(); return; }
    if (!readAloud || !steps[Math.min(i, steps.length - 1)]) return;
    const st = steps[Math.min(i, steps.length - 1)];
    const r = speak([`Step ${st.n}.`, st.text, ...st.commands.map((c) => `Command: ${c}`)].join(' '), { onEnd: () => { if (playingRef.current) setI((x) => (x < steps.length - 1 ? x + 1 : x)); } });
    if (!r.ok) { setReadAloud(false); setVoiceMsg(speakFailMessage(r)); } else setVoiceMsg('');
    return () => stopSpeaking();
  }, [readAloud, playing, i, steps]);
  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (!playing || readAloud) return;
    timer.current = setTimeout(() => { if (i >= steps.length - 1) setPlaying(false); else setI(i + 1); }, stepDuration(s) / speed);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, readAloud, i, speed, s, steps.length]);

  if (!s) return null;
  const pics = [...(images?.[0] ?? []), ...(images?.[s.n] ?? [])];
  const pct = Math.round(((i + 1) / steps.length) * 100);
  const atEnd = i >= steps.length - 1;
  return (
    <section aria-label="Animated walkthrough" data-testid="player" className="space-y-3">
      <div className="h-1.5 rounded-full bg-surface2 overflow-hidden" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1} aria-label="Progress through the steps"><div className="h-full bg-accent transition-[width] duration-300" style={{ width: pct + '%' }} /></div>
      <div className={'rounded-md border p-4 space-y-3 min-h-40 ' + (s.caution ? 'border-warn' : 'border-line bg-surface')} aria-live="polite" aria-atomic="true">
        <p className="text-xs text-muted">Step {s.n} of {steps.length}{s.caution ? ' · caution' : ''}</p>
        <p key={s.n} className={'text-base wrap-any ' + (noMotion ? '' : 'fade-in')}>{s.text}</p>
        {s.commands.map((c) => <Terminal key={s.n + c} command={c} animate={!noMotion} />)}
        {pics.map((p) => <figure key={p.src.slice(-24)} className="m-0"><img src={p.src} alt={p.caption || `Photo for step ${s.n}`} className="rounded-sm border border-line max-h-72 w-auto max-w-full" />{p.caption && <figcaption className="text-xs text-muted mt-1">{p.caption}</figcaption>}</figure>)}
      </div>
      {model.cautions.length > 0 && atEnd && (
        <ul className="text-sm rounded-sm border border-warn/50 bg-warn/5 p-2 space-y-1"><li className="font-medium">Watch out for</li>{model.cautions.map((c) => <li key={c} className="wrap-any">• {c}</li>)}</ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => { setPlaying(false); setI(Math.max(0, i - 1)); }} disabled={i === 0} aria-label="Previous step">◀ Back</Button>
        <Button variant="primary" onClick={() => { if (atEnd && !playing) setI(0); setPlaying((p) => !p); }} aria-pressed={playing}>{playing ? '❚❚ Pause' : atEnd ? '↺ Replay' : '▶ Play'}</Button>
        <Button onClick={() => { setPlaying(false); setI(Math.min(steps.length - 1, i + 1)); }} disabled={atEnd} aria-label="Next step">Next ▶</Button>
        {canSpeak && <Button onClick={() => { if (readAloud) stopSpeaking(); setReadAloud((r) => !r); }} aria-pressed={readAloud}>{readAloud ? '🔊 Reading aloud' : '🔈 Read aloud'}</Button>}
        <label className="text-sm inline-flex items-center gap-1.5 ml-auto">Speed
          <select className="min-h-11 rounded-sm border border-line bg-surface px-1.5" value={speed} onChange={(e: { target: { value: string } }) => setSpeed(Number(e.target.value))} aria-label="Playback speed">
            <option value="0.5">Slow</option><option value="1">Normal</option><option value="2">Fast</option>
          </select>
        </label>
      </div>
      {voiceMsg && <p role="alert" className="text-sm text-warn">{voiceMsg}</p>}
      <StepAsk model={model} index={Math.min(i, steps.length - 1)} />
      <p className="text-xs text-muted">This replays the guide’s own steps and commands. It is not a recording and does not run anything on your device.</p>
    </section>
  );
}

// ---------- tabbed wrapper ----------

export type VisualTab = 'diagram' | 'play' | 'photos';

export function VisualGuide({ model, images, photos }: { model: VisualModel; images?: Record<number, Array<{ src: string; caption: string }>>; photos?: ReactNode }) {
  const [tab, setTab] = useState<VisualTab>('diagram');
  const [askIdx, setAskIdx] = useState(0);
  const tabs: Array<[VisualTab, string]> = [['diagram', 'Diagram'], ['play', 'Play'], ...(photos ? [['photos', 'Photos'] as [VisualTab, string]] : [])];
  return (
    <div className="space-y-3" data-testid="visual-guide">
      <div role="tablist" aria-label="Visual guide views" className="flex gap-1.5">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} id={`vg-tab-${id}`} aria-controls={`vg-panel-${id}`} onClick={() => setTab(id)} className={'min-h-11 px-4 rounded-sm border text-sm font-medium ' + (tab === id ? 'bg-accent text-accent-ink border-accent' : 'bg-surface border-line hover:bg-surface2')}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`vg-panel-${tab}`} aria-labelledby={`vg-tab-${tab}`}>
        {tab === 'diagram' && <div className="space-y-3"><GuideDiagram model={model} images={images} /><StepAsk model={model} index={Math.min(askIdx, model.steps.length - 1)} onIndex={setAskIdx} /></div>}
        {tab === 'play' && <GuidePlayer model={model} images={images} />}
        {tab === 'photos' && photos}
      </div>
    </div>
  );
}
