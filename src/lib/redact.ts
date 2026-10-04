/** Geometry helpers for the screenshot redactor. The drawing itself happens on a canvas in the page. */
export interface Rect { x: number; y: number; w: number; h: number }
export type RedactMode = 'solid' | 'pixel';

/** A rectangle from two drag points, in image pixels, clamped to the image. Returns null if too small to matter. */
export function rectFromPoints(ax: number, ay: number, bx: number, by: number, width: number, height: number, min = 3): Rect | null {
  const cl = (v: number, m: number) => Math.min(Math.max(v, 0), m);
  const x1 = cl(Math.min(ax, bx), width), x2 = cl(Math.max(ax, bx), width);
  const y1 = cl(Math.min(ay, by), height), y2 = cl(Math.max(ay, by), height);
  const r = { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
  return r.w >= min && r.h >= min ? r : null;
}

/** Converts a pointer position on the displayed canvas to image pixels. */
export function toImage(clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }, imgW: number, imgH: number): [number, number] {
  return [((clientX - box.left) / box.width) * imgW, ((clientY - box.top) / box.height) * imgH];
}

/** Pixel block size for the coarse mode: large enough that text cannot be read back. */
export const pixelBlock = (r: Rect): number => Math.max(8, Math.round(Math.min(r.w, r.h) / 3));

export const MAX_EDGE = 2000;
export const fitSize = (w: number, h: number, max = MAX_EDGE): { w: number; h: number } => {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
};
