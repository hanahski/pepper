
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS link_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "post-media public read" ON storage.objects;
CREATE POLICY "post-media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "post-media auth upload" ON storage.objects;
CREATE POLICY "post-media auth upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "post-media owner delete" ON storage.objects;
CREATE POLICY "post-media owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);
