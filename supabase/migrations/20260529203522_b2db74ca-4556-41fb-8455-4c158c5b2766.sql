
-- 1. Fix dm_threads INSERT policy (use FOR INSERT with cleaner WITH CHECK)
DROP POLICY IF EXISTS "auth creates threads" ON public.dm_threads;
CREATE POLICY "auth creates threads"
ON public.dm_threads FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    (is_group = false AND (auth.uid() = user_a OR auth.uid() = user_b))
    OR (is_group = true AND auth.uid() = owner_id)
  )
);

-- 2. Enable realtime on chat tables (idempotent)
ALTER TABLE public.dm_messages REPLICA IDENTITY FULL;
ALTER TABLE public.dm_threads REPLICA IDENTITY FULL;
ALTER TABLE public.dm_thread_members REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.referrals REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_threads; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_thread_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 3. Welcome-seen flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seen_welcome boolean NOT NULL DEFAULT false;

-- 4. Storage bucket for cached book PDFs (public read so PDF.js can fetch directly)
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-pdfs', 'book-pdfs', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "book pdfs are public" ON storage.objects FOR SELECT USING (bucket_id = 'book-pdfs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Track read-message timestamps per thread for unread badges
CREATE TABLE IF NOT EXISTS public.dm_thread_reads (
  user_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_thread_reads TO authenticated;
GRANT ALL ON public.dm_thread_reads TO service_role;

ALTER TABLE public.dm_thread_reads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users manage own thread reads"
  ON public.dm_thread_reads FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
