import 'server-only';
import { randomUUID } from 'crypto';
import { badRequest } from '@/lib/api';
import { publicEnv } from '@/lib/env';
import type { AdminClient } from '@/lib/supabase/server';

export const PUBLIC_BUCKET = 'public-media';
export const PRIVATE_BUCKET = 'private-documents';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOC_BYTES = 8 * 1024 * 1024;

export type UploadPurpose = 'avatar' | 'logo' | 'issue_photo' | 'review_photo' | 'service_photo' | 'document';

/** Detect the REAL file type from magic bytes — never trust the client-declared MIME type. */
export function sniffMime(buf: Uint8Array): { mime: string; ext: string } | null {
  const b = buf;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}

export async function storeUpload(admin: AdminClient, opts: { userId: string; purpose: UploadPurpose; file: File }) {
  const { userId, purpose, file } = opts;
  const isDoc = purpose === 'document';
  const limit = isDoc ? MAX_DOC_BYTES : MAX_IMAGE_BYTES;
  if (file.size === 0) throw badRequest('The file is empty.');
  if (file.size > limit) throw badRequest(`File is too large (max ${limit / 1024 / 1024} MB).`, 'FILE_TOO_LARGE');
  const buf = new Uint8Array(await file.arrayBuffer());
  const kind = sniffMime(buf);
  if (!kind || (!isDoc && kind.mime === 'application/pdf')) throw badRequest(isDoc ? 'Upload a JPG, PNG, WebP or PDF.' : 'Upload a JPG, PNG or WebP image.', 'FILE_TYPE');
  const path = `${userId}/${purpose}/${randomUUID()}.${kind.ext}`;
  const bucket = isDoc ? PRIVATE_BUCKET : PUBLIC_BUCKET;
  const { error } = await admin.storage.from(bucket).upload(path, buf, { contentType: kind.mime, upsert: false, cacheControl: '31536000' });
  if (error) throw new Error(`Storage upload failed: ${error.message}. Did you run the 005_storage.sql migration?`);
  if (isDoc) return { bucket, path, url: null as string | null };
  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return { bucket, path, url: data.publicUrl };
}

/** Only accept media URLs that we generated for THIS user. */
export function isOwnUploadUrl(url: string, userId: string): boolean {
  const prefix = `${publicEnv.supabaseUrl}/storage/v1/object/public/${PUBLIC_BUCKET}/${userId}/`;
  return url.startsWith(prefix);
}
/** Same check for URLs that belong to any one of several users (e.g. provider uploading for own profile). */
export const isMediaUrl = (url: string) => url.startsWith(`${publicEnv.supabaseUrl}/storage/v1/object/public/${PUBLIC_BUCKET}/`);

export async function signedDocumentUrl(admin: AdminClient, path: string, seconds = 300) {
  const { data, error } = await admin.storage.from(PRIVATE_BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
