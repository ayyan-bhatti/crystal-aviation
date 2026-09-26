import type { SupabaseClient } from '@supabase/supabase-js';
import { POSTER_BUCKET } from '../config';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = Math.floor(2.8 * 1024 * 1024); // bucket limit is 3 MB
export const MAX_DIMENSION = 2200; // long edge; keeps poster text legible

export interface PreparedPoster {
  blob: Blob;
  ext: 'webp' | 'jpg' | 'png';
  width: number;
  height: number;
}

export function checkPosterFile(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'Please choose a JPEG, PNG or WebP image. Videos and PDFs aren’t supported.';
  if (file.size > MAX_INPUT_BYTES) return 'That image is larger than 15 MB. Please choose a smaller file.';
  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Resize and re-encode in the browser. Re-encoding also strips metadata such
 * as GPS location. Quality stays high so text on posters remains readable.
 */
export async function preparePoster(file: File): Promise<PreparedPoster> {
  const problem = checkPosterFile(file);
  if (problem) throw new Error(problem);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This file couldn’t be read as an image. Please try a different file.');
  }

  let scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  for (let attempt = 0; attempt < 6; attempt++) {
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser couldn’t process the image.');
    ctx.fillStyle = '#ffffff'; // flatten transparency (JPEG fallback has no alpha)
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [0.9, 0.82, 0.74]) {
      let blob = await canvasToBlob(canvas, 'image/webp', quality);
      let ext: PreparedPoster['ext'] = 'webp';
      if (!blob || blob.type !== 'image/webp') {
        // Browsers without WebP encoding fall back to JPEG.
        blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        ext = 'jpg';
      }
      if (blob && blob.size <= MAX_OUTPUT_BYTES) {
        bitmap.close();
        return { blob, ext, width, height };
      }
    }
    scale *= 0.8;
  }
  bitmap.close();
  throw new Error('This image is too detailed to compress under 3 MB. Please export a smaller version and try again.');
}

export function newPosterPath(ext: PreparedPoster['ext']): string {
  return `posters/${crypto.randomUUID()}.${ext}`;
}

export async function uploadPoster(sb: SupabaseClient, poster: PreparedPoster): Promise<string> {
  const path = newPosterPath(poster.ext);
  const contentType = poster.ext === 'webp' ? 'image/webp' : poster.ext === 'jpg' ? 'image/jpeg' : 'image/png';
  // upsert: false — a new unique path each time, so nothing is ever overwritten.
  const { error } = await sb.storage.from(POSTER_BUCKET).upload(path, poster.blob, {
    contentType,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) throw error;
  return path;
}

/**
 * Delete a poster only if no promotion still references it (duplicated offers
 * can share a poster). Best effort: a failure leaves an orphan file, never a
 * broken offer.
 */
export async function deletePosterIfUnused(sb: SupabaseClient, path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    const { count, error } = await sb
      .from('promotions')
      .select('id', { count: 'exact', head: true })
      .eq('image_path', path);
    if (error || (count ?? 1) > 0) return;
    await sb.storage.from(POSTER_BUCKET).remove([path]);
  } catch {
    /* leave orphan; see docs/SETUP.md for the orphan clean-up query */
  }
}
