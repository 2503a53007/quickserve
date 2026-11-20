import { badRequest, created, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser } from '@/lib/localDb';
import { storeUpload, type UploadPurpose } from '@/lib/uploads';

const BUCKET_TO_PURPOSE: Record<string, UploadPurpose> = {
  'booking-photos': 'issue_photo',
  'review-photos': 'review_photo',
  'provider-docs': 'document',
  avatars: 'avatar',
  'service-photos': 'service_photo',
  logo: 'logo',
};

export const POST = route(async (req) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Please choose an image or document file to upload.');

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    return created({
      bucket: 'local-preview',
      path: `${user.id}/${file.name}`,
      url: `https://quickserve.local/uploads/${encodeURIComponent(file.name)}`,
    });
  }

  const ctx = await requireAuth();
  const bucketOrPurpose = String(form.get('bucket') ?? form.get('purpose') ?? 'booking-photos');
  const purpose: UploadPurpose =
    BUCKET_TO_PURPOSE[bucketOrPurpose] ??
    (['avatar', 'logo', 'issue_photo', 'review_photo', 'service_photo', 'document'].includes(bucketOrPurpose)
      ? (bucketOrPurpose as UploadPurpose)
      : 'issue_photo');

  const result = await storeUpload(ctx.admin, {
    userId: ctx.user.id,
    purpose,
    file,
  });

  return created(result);
});
