-- Saved items (bookmarks) — users can save posts, books, market listings, past questions
CREATE TABLE public.saved_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('post','book','market','past_question','note')),
  item_id text NOT NULL,
  title text,
  subtitle text,
  thumb_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);

GRANT SELECT, INSERT, DELETE ON public.saved_items TO authenticated;
GRANT ALL ON public.saved_items TO service_role;

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own saves" ON public.saved_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users add own saves" ON public.saved_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users remove own saves" ON public.saved_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_saved_items_user ON public.saved_items(user_id, created_at DESC);

-- Student verification attempts — audit log for parse.bot EBSU checks
CREATE TABLE public.student_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  jamb_reg_number text NOT NULL,
  verified boolean NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.student_verifications TO authenticated;
GRANT ALL ON public.student_verifications TO service_role;

ALTER TABLE public.student_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own verifications" ON public.student_verifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all verifications" ON public.student_verifications FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_student_verif_user ON public.student_verifications(user_id, created_at DESC);
CREATE INDEX idx_student_verif_jamb ON public.student_verifications(jamb_reg_number);