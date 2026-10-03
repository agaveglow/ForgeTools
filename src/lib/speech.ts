/**
 * Read-aloud using the phone's own text-to-speech. Only voices marked as running on the device
 * (localService) are used, so the text is not sent to a vendor's servers. If none exists it says so
 * rather than falling back to an online voice.
 */
export const speechSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

export type SpeakResult = { ok: true } | { ok: false; reason: 'unsupported' | 'loading' | 'no-local-voice' };

export function pickLocalVoice(voices: SpeechSynthesisVoice[], lang = 'en-GB'): SpeechSynthesisVoice | null {
  const local = voices.filter((v) => v.localService);
  return local.find((v) => v.lang === lang) ?? local.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2))) ?? null;
}

export function speak(text: string, opts: { rate?: number; lang?: string; onEnd?: () => void; onError?: () => void } = {}): SpeakResult {
  if (!speechSupported()) return { ok: false, reason: 'unsupported' };
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (!voices.length) return { ok: false, reason: 'loading' };
  const voice = pickLocalVoice(voices, opts.lang);
  if (!voice) return { ok: false, reason: 'no-local-voice' };
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 1200));
  u.voice = voice; u.lang = voice.lang; u.rate = opts.rate ?? 1;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onError?.();
  synth.speak(u);
  return { ok: true };
}

export function stopSpeaking(): void { if (speechSupported()) window.speechSynthesis.cancel(); }

export const speakFailMessage = (r: Extract<SpeakResult, { ok: false }>): string =>
  r.reason === 'no-local-voice' ? 'This device has no offline voice, so reading aloud is off to keep your text on the phone. Install an offline voice in your phone’s text-to-speech settings.'
    : r.reason === 'loading' ? 'Voices are still loading. Try again in a moment.' : 'Reading aloud is not available in this browser.';
