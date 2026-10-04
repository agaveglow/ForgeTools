/** Only secure web addresses may become links. Anything else (javascript:, data:, http:) is dropped. */
export function safeHref(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  try { const u = new URL(raw.trim()); return u.protocol === 'https:' ? u.toString() : undefined; } catch { return undefined; }
}
