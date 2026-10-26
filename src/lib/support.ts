/**
 * The /support contact form: sends a request to the support-request Edge Function, which saves it,
 * emails the support inbox and sends her an acknowledgment. Nothing is kept in browser storage or
 * sent to analytics. Fields, topics and limits: src/data/support.ts.
 */
import { LIMITS, normalizeSupport, validateSupport, type SupportField, type SupportInput } from '../data/support';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config';

const SUPABASE = SUPABASE_URL;
const ANON = SUPABASE_ANON_KEY;

export const supportConfigured = () => Boolean(SUPABASE && ANON);

/** A resized photo, ready to send. */
export interface PreparedPhoto {
  name: string;
  /** Base64 JPEG, no data: prefix. */
  data: string;
}

export type SupportOutcome =
  | { ok: true; reference: string; acknowledged: boolean }
  | { ok: false; reason: 'invalid'; fields: Partial<Record<SupportField, string>> }
  | { ok: false; reason: 'rate_limited' | 'photo' | 'error' };

/** Validates and sends. Never throws. */
export async function sendSupportRequest(raw: SupportInput, website: string, photo: PreparedPhoto | null): Promise<SupportOutcome> {
  const input = normalizeSupport(raw);
  const fields = validateSupport(input);
  if (Object.keys(fields).length) return { ok: false, reason: 'invalid', fields };
  if (!supportConfigured()) return { ok: false, reason: 'error' };
  try {
    const res = await fetch(`${SUPABASE}/functions/v1/support-request`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, website, photo }),
      signal: AbortSignal.timeout(30000),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; reference?: string; acknowledged?: boolean; fields?: Partial<Record<SupportField, string>> };
    if (data.status === 'ok' && typeof data.reference === 'string') return { ok: true, reference: data.reference, acknowledged: data.acknowledged === true };
    if (data.status === 'invalid') return { ok: false, reason: 'invalid', fields: data.fields ?? {} };
    if (data.status === 'rate_limited') return { ok: false, reason: 'rate_limited' };
    if (data.status === 'photo') return { ok: false, reason: 'photo' };
    return { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/**
 * Resizes a photo in the browser to a JPEG no larger than LIMITS.photoEdge on its long side, which
 * also drops its location data. Null if the browser can't read the file (send it by email instead).
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto | null> {
  if (!file.type.startsWith('image/')) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LIMITS.photoEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    for (const quality of [0.82, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= LIMITS.photoBytes) {
        const data = await blobToBase64(blob);
        return { name: photoName(file.name), data };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** "IMG 0042.HEIC" → "img-0042.jpg" */
export function photoName(name: string): string {
  const base = name.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${base || 'photo'}.jpg`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
