INSERT INTO storage.buckets (id, name, public) VALUES ('book-covers', 'book-covers', true) ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
  CREATE POLICY "book-covers public read" ON storage.objects FOR SELECT USING (bucket_id = 'book-covers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "book-covers service write" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'book-covers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "book-covers service update" ON storage.objects FOR UPDATE TO service_role USING (bucket_id = 'book-covers') WITH CHECK (bucket_id = 'book-covers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;