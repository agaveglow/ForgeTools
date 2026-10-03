/**
 * Photos and screenshots for guides.
 * Images are re-drawn onto a canvas and saved as JPEG. That shrinks them, fixes rotation and
 * removes metadata such as GPS location. They are kept as data-URL text in Files (images/).
 */
export const MAX_IMAGE_INPUT = 20 * 1024 * 1024;
export const MAX_DIMENSION = 1280;

export class ImageError extends Error {}

export async function prepareImage(file: Blob & { name?: string }): Promise<string> {
  if (!/^image\//.test(file.type)) throw new ImageError('That is not an image file.');
  if (file.size > MAX_IMAGE_INPUT) throw new ImageError('That image is over 20 MB. Choose a smaller one.');
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new ImageError('That image could not be read. Try a JPEG or PNG.'); }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)); const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('Images cannot be processed in this browser.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // flatten transparency
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return canvas.toDataURL('image/jpeg', 0.82);
}

export const isImageData = (s: string | null | undefined): s is string => !!s && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
