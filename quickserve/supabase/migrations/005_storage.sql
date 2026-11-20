-- ============================================================================
-- QuickServe 005 — Storage buckets & policies (Supabase Storage)
-- Uploads go through /api/uploads (server validates type, size and ownership).
-- ============================================================================
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    -- Public, unguessable-path media (avatars, logos, service photos, review/issue photos)
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('public-media', 'public-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
    -- Private KYC / business documents, accessed with short-lived signed URLs by admins
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('private-documents', 'private-documents', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;
-- No storage.objects policies are created on purpose: with RLS on storage.objects and
-- no policies, clients cannot read/write the buckets directly. The service role (used
-- only by our server) performs uploads and mints signed URLs / serves public media.
