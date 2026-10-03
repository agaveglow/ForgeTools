/**
 * Getting text out of a voice recording.
 *
 * Three routes, because turning audio into text needs a speech-to-text service and none can run
 * offline inside this app:
 *  1. A transcript file (.txt, .md, .srt, .vtt). Many phone voice-memo apps can produce one. Fully on-device.
 *  2. Live dictation using the phone's own speech recognition (Web Speech API). Quick, but the browser
 *     or phone vendor may process the audio on its servers.
 *  3. An audio file sent to a transcription service you choose (an OpenAI-compatible
 *     /audio/transcriptions endpoint, including one you host yourself). The audio is sent to that address.
 */

export interface TranscribeConfig {
  url: string;
  model?: string;
  /** Held in memory only. Never written to storage. */
  key?: string;
}

let sessionKey = '';
export const setTranscribeKey = (k: string) => { sessionKey = k; };
export const getTranscribeKey = () => sessionKey;

export const AUDIO_EXT = /\.(?:m4a|mp3|wav|ogg|oga|opus|webm|aac|flac|mp4|3gp|amr)$/i;
export const TRANSCRIPT_EXT = /\.(?:txt|md|srt|vtt)$/i;

export const isAudioFile = (f: { name: string; type?: string }) => /^audio\//.test(f.type ?? '') || AUDIO_EXT.test(f.name);
export const isTranscriptFile = (f: { name: string; type?: string }) => TRANSCRIPT_EXT.test(f.name) || f.type === 'text/plain';

/** Turn SRT/VTT cue files into plain text; leave other text alone. */
export function parseTranscriptText(name: string, raw: string): string {
  const text = raw.replace(/^﻿/, '').replace(/\r/g, '');
  if (!/\.(?:srt|vtt)$/i.test(name) && !/^WEBVTT/.test(text)) return text.trim();
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || /^WEBVTT/.test(t) || /^NOTE\b/.test(t) || /^\d+$/.test(t) || /-->/.test(t)) continue;
    out.push(t.replace(/<[^>]+>/g, '').replace(/^\[?(?:speaker\s*\d+|spk_\d+)\]?:\s*/i, ''));
  }
  // Join cue lines into running text and drop immediate repeats (common in auto-captions).
  const dedup = out.filter((l, i) => l !== out[i - 1]);
  return dedup.join(' ').replace(/\s+/g, ' ').trim();
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class TranscribeError extends Error {
  constructor(message: string, public kind: 'config' | 'size' | 'network' | 'http' | 'response') { super(message); }
}

type FormFetch = (url: string, init: { method: string; body: unknown; headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export async function transcribeAudio(file: Blob & { name?: string }, cfg: TranscribeConfig, f: FormFetch = (globalThis.fetch as unknown as FormFetch)): Promise<string> {
  if (!cfg.url.trim()) throw new TranscribeError('No transcription service is set up. Add its address in Settings, or upload a transcript file instead.', 'config');
  let url: URL;
  try { url = new URL(cfg.url.trim()); } catch { throw new TranscribeError('The transcription address is not valid.', 'config'); }
  if (url.protocol !== 'https:' && !/^(?:localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(url.hostname)) throw new TranscribeError('Use an https address for the transcription service.', 'config');
  if (file.size > MAX_UPLOAD_BYTES) throw new TranscribeError('That recording is over 25 MB, which most services reject. Trim it or split it.', 'size');
  const body = new FormData();
  body.append('file', file, file.name ?? 'recording.m4a');
  body.append('model', cfg.model?.trim() || 'whisper-1');
  body.append('response_format', 'json');
  const headers: Record<string, string> = {};
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  let res: Awaited<ReturnType<FormFetch>>;
  try { res = await f(url.toString(), { method: 'POST', body, headers }); }
  catch { throw new TranscribeError('Could not reach the transcription service. Check the address and your connection.', 'network'); }
  const raw = await res.text();
  if (!res.ok) throw new TranscribeError(`The transcription service answered with an error (${res.status}).`, 'http');
  let text = '';
  try { text = String((JSON.parse(raw) as { text?: unknown }).text ?? ''); } catch { text = raw; }
  text = text.trim();
  if (!text) throw new TranscribeError('The service returned no text. The recording may be silent or in an unsupported format.', 'response');
  return text;
}

// ---------- live dictation ----------

interface RecognitionLike {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export function dictationSupported(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface Dictation { stop(): void }

export function startDictation(cb: { onFinal(text: string): void; onInterim(text: string): void; onError(msg: string): void; onEnd(): void }, lang = 'en-GB'): Dictation | null {
  const w = window as unknown as Record<string, new () => RecognitionLike>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.continuous = true; r.interimResults = true; r.lang = lang;
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) cb.onFinal(res[0].transcript.trim()); else interim += res[0].transcript;
    }
    cb.onInterim(interim);
  };
  r.onerror = (e) => cb.onError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Microphone access was refused. Allow it in your browser or phone settings.' : e.error === 'no-speech' ? 'No speech was heard.' : `Dictation stopped (${e.error}).`);
  r.onend = () => cb.onEnd();
  try { r.start(); } catch { cb.onError('Dictation could not start.'); return null; }
  return { stop: () => { try { r.stop(); } catch { /* already stopped */ } } };
}
