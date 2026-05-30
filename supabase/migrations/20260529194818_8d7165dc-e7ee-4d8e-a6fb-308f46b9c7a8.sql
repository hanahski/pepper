-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.rank_tier AS ENUM ('normal', 'active', 'legend', 'pro', 'sure_plug');
CREATE TYPE public.post_type AS ENUM ('past_question', 'assignment', 'note', 'novel', 'news', 'request', 'general');

CREATE TABLE public.faculties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, name)
);

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, code)
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text,
  avatar_key text NOT NULL DEFAULT 'boy-1',
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  bio text,
  rank_tier public.rank_tier NOT NULL DEFAULT 'normal',
  rank_step int NOT NULL DEFAULT 1 CHECK (rank_step BETWEEN 1 AND 5),
  approved_post_count int NOT NULL DEFAULT 0,
  show_online boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  post_type public.post_type NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  file_url text,
  file_name text,
  view_count int NOT NULL DEFAULT 0,
  like_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  repost_count int NOT NULL DEFAULT 0,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_created_at_idx ON public.posts(created_at DESC);
CREATE INDEX posts_course_idx ON public.posts(course_id);
CREATE INDEX posts_author_idx ON public.posts(author_id);

CREATE TABLE public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  post_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quizzes_post_id ON public.quizzes(post_id);

CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 1,
  prompt text NOT NULL,
  options jsonb NOT NULL,
  correct_index int NOT NULL,
  explanation text
);

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score int NOT NULL,
  total int NOT NULL,
  answers jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.bump_author_rank()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count int; new_tier public.rank_tier; new_step int; total_steps int;
BEGIN
  UPDATE public.profiles SET approved_post_count = approved_post_count + 1
  WHERE id = NEW.author_id RETURNING approved_post_count INTO new_count;
  total_steps := LEAST(new_count / 10, 24);
  CASE
    WHEN total_steps < 5  THEN new_tier := 'normal';     new_step := total_steps + 1;
    WHEN total_steps < 10 THEN new_tier := 'active';     new_step := total_steps - 4;
    WHEN total_steps < 15 THEN new_tier := 'legend';     new_step := total_steps - 9;
    WHEN total_steps < 20 THEN new_tier := 'pro';        new_step := total_steps - 14;
    ELSE                       new_tier := 'sure_plug';  new_step := LEAST(total_steps - 19, 5);
  END CASE;
  UPDATE public.profiles SET rank_tier = new_tier, rank_step = new_step WHERE id = NEW.author_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER posts_bump_rank AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.bump_author_rank();

CREATE OR REPLACE FUNCTION public.adjust_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id; RETURN OLD;
  END IF; RETURN NULL;
END; $$;
CREATE TRIGGER post_likes_count AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.adjust_like_count();

ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.faculties TO anon, authenticated;
GRANT SELECT ON public.departments TO anon, authenticated;
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.faculties, public.departments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT ON public.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT SELECT ON public.post_likes TO anon;
GRANT SELECT ON public.quizzes TO anon, authenticated;
GRANT INSERT ON public.quizzes TO authenticated;
GRANT SELECT ON public.quiz_questions TO anon, authenticated;
GRANT INSERT ON public.quiz_questions TO authenticated;
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.faculties, public.departments, public.courses, public.profiles, public.posts, public.post_likes, public.quizzes, public.quiz_questions, public.quiz_attempts TO service_role;

CREATE POLICY "anyone reads faculties" ON public.faculties FOR SELECT USING (true);
CREATE POLICY "anyone reads departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "anyone reads courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "auth can add courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admins manage faculties" ON public.faculties FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage departments" ON public.departments FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "anyone reads profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "anyone reads posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "auth creates posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author or admin updates posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "author or admin deletes posts" ON public.posts FOR DELETE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "auth reads likes" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "auth likes posts" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user unlikes own" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "anyone reads quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "auth creates quizzes" ON public.quizzes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "anyone reads quiz_questions" ON public.quiz_questions FOR SELECT USING (true);
CREATE POLICY "auth creates quiz_questions" ON public.quiz_questions FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.created_by = auth.uid())
);
CREATE POLICY "user reads own attempts" ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user creates own attempts" ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public) VALUES ('post-files', 'post-files', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "authed read post-files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'post-files');
CREATE POLICY "authed upload post-files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner deletes post-files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Credits
ALTER TABLE public.profiles ADD COLUMN credits integer NOT NULL DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN referral_code text UNIQUE;

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL,
  metadata jsonb,
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own tx" ON public.credit_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.spend_credits(_amount integer, _reason text, _metadata jsonb DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new_balance integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  UPDATE public.profiles SET credits = credits - _amount WHERE id = _uid AND credits >= _amount RETURNING credits INTO _new_balance;
  IF _new_balance IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
  INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after) VALUES (_uid, -_amount, _reason, _metadata, _new_balance);
  RETURN _new_balance;
END; $$;

CREATE OR REPLACE FUNCTION public.earn_credits(_user_id uuid, _amount integer, _reason text, _metadata jsonb DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new_balance integer;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  UPDATE public.profiles SET credits = credits + _amount WHERE id = _user_id RETURNING credits INTO _new_balance;
  IF _new_balance IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after) VALUES (_user_id, _amount, _reason, _metadata, _new_balance);
  RETURN _new_balance;
END; $$;
GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.earn_credits(uuid, integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.earn_credits(uuid, integer, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uname text; ucode text; is_target_admin boolean;
BEGIN
  uname := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  ucode := upper(substr(md5(NEW.id::text || random()::text), 1, 6));
  is_target_admin := (lower(uname) LIKE '%ikechukwu%ebube%' OR lower(uname) LIKE '%ebube%ikechukwu%');
  INSERT INTO public.profiles (id, display_name, email, referral_code) VALUES (NEW.id, uname, NEW.email, ucode);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, CASE WHEN is_target_admin THEN 'admin'::app_role ELSE 'user'::app_role END) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Market listings
CREATE TABLE public.market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'other',
  contact text NOT NULL,
  location text,
  photos text[] NOT NULL DEFAULT '{}',
  is_sold boolean NOT NULL DEFAULT false,
  listing_kind text NOT NULL DEFAULT 'product',
  is_ai_generated boolean NOT NULL DEFAULT false,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_market_listings_kind ON public.market_listings(listing_kind);
GRANT SELECT ON public.market_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_listings TO authenticated;
GRANT ALL ON public.market_listings TO service_role;
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads listings" ON public.market_listings FOR SELECT USING (true);
CREATE POLICY "auth creates listings" ON public.market_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "seller or admin updates" ON public.market_listings FOR UPDATE USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "seller or admin deletes" ON public.market_listings FOR DELETE USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER market_listings_touch BEFORE UPDATE ON public.market_listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Referrals
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL UNIQUE,
  credited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see their referrals" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE OR REPLACE FUNCTION public.redeem_referral(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _inviter uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _inviter FROM public.profiles WHERE referral_code = upper(_code) LIMIT 1;
  IF _inviter IS NULL THEN RAISE EXCEPTION 'INVALID_CODE'; END IF;
  IF _inviter = _uid THEN RAISE EXCEPTION 'CANNOT_SELF_REFER'; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE invitee_id = _uid) THEN RAISE EXCEPTION 'ALREADY_REDEEMED'; END IF;
  INSERT INTO public.referrals (code, inviter_id, invitee_id, credited) VALUES (upper(_code), _inviter, _uid, true);
  PERFORM public.earn_credits(_inviter, 100, 'referral_invite', jsonb_build_object('invitee_id', _uid));
  PERFORM public.earn_credits(_uid, 50, 'referral_signup', jsonb_build_object('inviter_id', _inviter));
  RETURN jsonb_build_object('ok', true, 'inviter', _inviter);
END; $$;

CREATE OR REPLACE FUNCTION public.claim_admin_coupon(_coupon text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _coupon IS NULL OR _coupon <> 'youandgarri' THEN RAISE EXCEPTION 'INVALID_COUPON'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin'::app_role) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Chat
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','department','course','nearby')),
  scope_ref uuid,
  lat double precision,
  lng double precision
);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT ON public.chat_messages TO anon;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads chat" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "auth sends chat" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author or admin deletes chat" ON public.chat_messages FOR DELETE USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'));
CREATE INDEX idx_chat_scope_created ON public.chat_messages (scope, created_at DESC);
CREATE INDEX idx_chat_geo ON public.chat_messages (lat, lng) WHERE lat IS NOT NULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- Blogs
CREATE TABLE public.blogs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT NOT NULL,
  topic TEXT NOT NULL,
  hero_emoji TEXT DEFAULT '📰',
  hero_image_url TEXT,
  source TEXT DEFAULT 'ai',
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blogs TO anon, authenticated;
GRANT ALL ON public.blogs TO service_role;
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view blogs" ON public.blogs FOR SELECT USING (true);
CREATE INDEX idx_blogs_created_at ON public.blogs (created_at DESC);

INSERT INTO storage.buckets (id, name, public) VALUES ('blog-images', 'blog-images', true) ON CONFLICT (id) DO UPDATE SET public = true;
CREATE POLICY "Blog images public read" ON storage.objects FOR SELECT USING (bucket_id = 'blog-images');
CREATE POLICY "Service can upload blog images" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'blog-images');

-- Profile status + verification
CREATE TYPE public.user_status AS ENUM ('active','blocked','deactivated');
ALTER TABLE public.profiles ADD COLUMN status public.user_status NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN is_verified boolean NOT NULL DEFAULT false;

-- Tickets
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  photo_url text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  pay_mode text NOT NULL DEFAULT 'contact',
  contact text,
  is_sold boolean NOT NULL DEFAULT false,
  buyer_id uuid,
  qr_token text UNIQUE,
  sold_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tickets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads tickets" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "qualified users upload tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = uploader_id AND (
    public.has_role(auth.uid(),'admin') OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_verified = true AND p.rank_tier IN ('pro','sure_plug'))
  )
);
CREATE POLICY "uploader or admin updates ticket" ON public.tickets FOR UPDATE USING (auth.uid() = uploader_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = uploader_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "uploader or admin deletes ticket" ON public.tickets FOR DELETE USING (auth.uid() = uploader_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ticket_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  qr_token text NOT NULL,
  price_paid numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_purchases TO authenticated;
GRANT ALL ON public.ticket_purchases TO service_role;
ALTER TABLE public.ticket_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyer or admin read purchases" ON public.ticket_purchases FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR public.has_role(auth.uid(),'admin'));

-- Banner slides
CREATE TABLE public.banner_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text NOT NULL,
  link_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banner_slides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banner_slides TO authenticated;
GRANT ALL ON public.banner_slides TO service_role;
ALTER TABLE public.banner_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active slides" ON public.banner_slides FOR SELECT USING (true);
CREATE POLICY "admins manage slides ins" ON public.banner_slides FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage slides upd" ON public.banner_slides FOR UPDATE USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage slides del" ON public.banner_slides FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- Page views + auth events
CREATE TABLE public.page_views (
  id bigserial PRIMARY KEY,
  user_id uuid,
  path text NOT NULL,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.page_views_id_seq TO anon, authenticated;
GRANT SELECT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone logs page view" ON public.page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "admins read page views" ON public.page_views FOR SELECT USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.auth_events (
  id bigserial PRIMARY KEY,
  user_id uuid,
  event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.auth_events TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.auth_events_id_seq TO anon, authenticated;
GRANT SELECT ON public.auth_events TO authenticated;
GRANT ALL ON public.auth_events TO service_role;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone logs auth" ON public.auth_events FOR INSERT WITH CHECK (true);
CREATE POLICY "admins read auth events" ON public.auth_events FOR SELECT USING (public.has_role(auth.uid(),'admin'));

-- Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _status public.user_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  UPDATE public.profiles SET status=_status WHERE id=_user_id; END $$;

CREATE OR REPLACE FUNCTION public.admin_set_rank(_user_id uuid, _tier public.rank_tier, _step int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  IF _step < 1 OR _step > 5 THEN RAISE EXCEPTION 'Step must be 1..5'; END IF;
  UPDATE public.profiles SET rank_tier=_tier, rank_step=_step WHERE id=_user_id; END $$;

CREATE OR REPLACE FUNCTION public.admin_set_verified(_user_id uuid, _verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  UPDATE public.profiles SET is_verified=_verified WHERE id=_user_id; END $$;

CREATE OR REPLACE FUNCTION public.buy_ticket(_ticket_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _t record; _token text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _t FROM public.tickets WHERE id=_ticket_id FOR UPDATE;
  IF _t IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF _t.is_sold THEN RAISE EXCEPTION 'ALREADY_SOLD'; END IF;
  IF _t.uploader_id = _uid THEN RAISE EXCEPTION 'CANT_BUY_OWN'; END IF;
  IF _t.pay_mode = 'credits' AND _t.price > 0 THEN
    UPDATE public.profiles SET credits = credits - _t.price::int WHERE id=_uid AND credits >= _t.price::int;
    IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
    INSERT INTO public.credit_transactions(user_id,amount,reason,metadata,balance_after)
      SELECT _uid, -_t.price::int, 'ticket_purchase', jsonb_build_object('ticket_id',_ticket_id), credits FROM public.profiles WHERE id=_uid;
    PERFORM public.earn_credits(_t.uploader_id, _t.price::int, 'ticket_sale', jsonb_build_object('ticket_id',_ticket_id));
  END IF;
  _token := encode(gen_random_bytes(16), 'hex');
  UPDATE public.tickets SET is_sold=true, buyer_id=_uid, qr_token=_token, sold_at=now() WHERE id=_ticket_id;
  INSERT INTO public.ticket_purchases(ticket_id,buyer_id,qr_token,price_paid) VALUES (_ticket_id,_uid,_token,_t.price);
  RETURN jsonb_build_object('ok',true,'qr_token',_token);
END $$;

CREATE OR REPLACE FUNCTION public.verify_ticket(_qr_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _t record;
BEGIN
  SELECT t.*, p.display_name AS buyer_name INTO _t FROM public.tickets t LEFT JOIN public.profiles p ON p.id=t.buyer_id WHERE t.qr_token=_qr_token;
  IF _t IS NULL THEN RETURN jsonb_build_object('valid',false); END IF;
  RETURN jsonb_build_object('valid',true,'ticket_id',_t.id,'title',_t.title,'buyer',_t.buyer_name,'sold_at',_t.sold_at);
END $$;

INSERT INTO storage.buckets (id, name, public) VALUES ('tickets','tickets',true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('banners','banners',true) ON CONFLICT DO NOTHING;
CREATE POLICY "public read tickets bucket" ON storage.objects FOR SELECT USING (bucket_id='tickets');
CREATE POLICY "auth upload tickets bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='tickets');
CREATE POLICY "public read banners bucket" ON storage.objects FOR SELECT USING (bucket_id='banners');
CREATE POLICY "admin upload banners bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='banners' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete banners bucket" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='banners' AND public.has_role(auth.uid(),'admin'));

-- Study notes
CREATE TABLE public.study_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL,
  course_id uuid,
  department_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  source_file_url text,
  page_count integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.study_notes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_notes TO authenticated;
GRANT ALL ON public.study_notes TO service_role;
ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads notes" ON public.study_notes FOR SELECT USING (true);
CREATE POLICY "auth uploads notes" ON public.study_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "owner or admin updates notes" ON public.study_notes FOR UPDATE USING (auth.uid() = uploader_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "owner or admin deletes notes" ON public.study_notes FOR DELETE USING (auth.uid() = uploader_id OR has_role(auth.uid(),'admin'));
CREATE TRIGGER study_notes_touch BEFORE UPDATE ON public.study_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_study_notes_course ON public.study_notes(course_id);
CREATE INDEX idx_study_notes_dept ON public.study_notes(department_id);

-- DMs
CREATE TABLE public.dm_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dm_pair_unique UNIQUE (user_a, user_b),
  CONSTRAINT dm_pair_ordered CHECK (user_a < user_b)
);
GRANT SELECT, INSERT, UPDATE ON public.dm_threads TO authenticated;
GRANT ALL ON public.dm_threads TO service_role;
ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.dm_messages TO authenticated;
GRANT ALL ON public.dm_messages TO service_role;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sender deletes own dm" ON public.dm_messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);
CREATE INDEX idx_dm_messages_thread ON public.dm_messages(thread_id, created_at DESC);

-- Comments
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_comments_post ON public.post_comments(post_id, created_at DESC);
GRANT SELECT ON public.post_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads comments" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "auth comments" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author or admin deletes comment" ON public.post_comments FOR DELETE USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'::app_role));

-- Reposts
CREATE TABLE public.post_reposts (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.post_reposts TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_reposts TO authenticated;
GRANT ALL ON public.post_reposts TO service_role;
ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads reposts" ON public.post_reposts FOR SELECT USING (true);
CREATE POLICY "auth reposts" ON public.post_reposts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user un-reposts" ON public.post_reposts FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.adjust_comment_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSIF TG_OP='DELETE' THEN UPDATE public.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id; RETURN OLD;
  END IF; RETURN NULL;
END $$;
CREATE TRIGGER trg_comment_count AFTER INSERT OR DELETE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.adjust_comment_count();

CREATE OR REPLACE FUNCTION public.adjust_repost_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.posts SET repost_count = repost_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSIF TG_OP='DELETE' THEN UPDATE public.posts SET repost_count = GREATEST(repost_count - 1, 0) WHERE id = OLD.post_id; RETURN OLD;
  END IF; RETURN NULL;
END $$;
CREATE TRIGGER trg_repost_count AFTER INSERT OR DELETE ON public.post_reposts FOR EACH ROW EXECUTE FUNCTION public.adjust_repost_count();

INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true) ON CONFLICT (id) DO UPDATE SET public = true;
CREATE POLICY "post-images public read" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
CREATE POLICY "post-images auth upload own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "post-images owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Seed faculty + department
INSERT INTO public.faculties (id, name, icon) VALUES ('00000000-0000-4000-8000-00000000f001', 'Ebonyi State University', '🎓') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.departments (id, faculty_id, name) VALUES ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000f001', 'All Departments') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.posts ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.post_reposts ADD CONSTRAINT post_reposts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.market_listings ADD CONSTRAINT market_listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.ticket_purchases ADD CONSTRAINT ticket_purchases_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
ALTER TABLE public.ticket_purchases ADD CONSTRAINT ticket_purchases_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dm_messages ADD CONSTRAINT dm_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dm_threads ADD CONSTRAINT dm_threads_user_a_fkey FOREIGN KEY (user_a) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dm_threads ADD CONSTRAINT dm_threads_user_b_fkey FOREIGN KEY (user_b) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.study_notes ADD CONSTRAINT study_notes_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.study_notes ADD CONSTRAINT study_notes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;
ALTER TABLE public.study_notes ADD CONSTRAINT study_notes_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.post_likes REPLICA IDENTITY FULL;
ALTER TABLE public.post_comments REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.posts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

CREATE TABLE public.tool_failure_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  tool_name TEXT NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tool_failure_log TO authenticated;
GRANT ALL ON public.tool_failure_log TO service_role;
ALTER TABLE public.tool_failure_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can log their own failures"
  ON public.tool_failure_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users can view their own failures"
  ON public.tool_failure_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ocr_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  image_hash TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ocr_corrections TO authenticated;
GRANT ALL ON public.ocr_corrections TO service_role;
ALTER TABLE public.ocr_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can submit ocr corrections"
  ON public.ocr_corrections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users can view their own ocr corrections"
  ON public.ocr_corrections FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON public.post_comments(parent_id, created_at);

CREATE TABLE IF NOT EXISTS public.post_comment_likes (
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.post_comment_likes TO authenticated;
GRANT SELECT ON public.post_comment_likes TO anon;
GRANT ALL ON public.post_comment_likes TO service_role;

ALTER TABLE public.post_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads comment likes" ON public.post_comment_likes FOR SELECT USING (true);
CREATE POLICY "auth likes comment" ON public.post_comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user unlikes own comment" ON public.post_comment_likes FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.adjust_comment_like_count()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.post_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.post_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_comment_like_count ON public.post_comment_likes;
CREATE TRIGGER trg_comment_like_count
AFTER INSERT OR DELETE ON public.post_comment_likes
FOR EACH ROW EXECUTE FUNCTION public.adjust_comment_like_count();

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comment_likes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS academic_level text;

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'credit',
  value integer not null default 0,
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read coupons" ON public.coupons FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage coupons" ON public.coupons FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null,
  user_id uuid not null,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, user_id)
);
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own redemptions" ON public.coupon_redemptions FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.coupons; _new_credits integer;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'message', 'Please sign in first'); END IF;
  SELECT * INTO _c FROM public.coupons WHERE upper(code) = upper(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'message', 'Invalid or expired code'); END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'message', 'This code has expired'); END IF;
  IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN RETURN jsonb_build_object('ok', false, 'message', 'This code has been fully used'); END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = _c.id AND user_id = _uid) THEN RETURN jsonb_build_object('ok', false, 'message', 'You have already used this code'); END IF;
  INSERT INTO public.coupon_redemptions (coupon_id, user_id) VALUES (_c.id, _uid);
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _c.id;
  IF _c.type = 'credit' THEN
    UPDATE public.profiles SET credits = credits + _c.value WHERE id = _uid RETURNING credits INTO _new_credits;
    INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata) VALUES (_uid, _c.value, 'coupon:' || _c.code, _new_credits, jsonb_build_object('coupon_id', _c.id));
    RETURN jsonb_build_object('ok', true, 'message', '+' || _c.value || ' credits added', 'type', 'credit', 'value', _c.value);
  ELSIF _c.type = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin'::app_role) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'message', 'Admin access granted', 'type', 'admin');
  ELSIF _c.type = 'verified' THEN
    UPDATE public.profiles SET is_verified = true WHERE id = _uid;
    RETURN jsonb_build_object('ok', true, 'message', 'Verified badge unlocked', 'type', 'verified');
  ELSE
    RETURN jsonb_build_object('ok', true, 'message', 'Code redeemed', 'type', _c.type);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text) TO authenticated;

INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "anyone reads covers" ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "users upload own cover" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users update own cover" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own cover" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE TABLE IF NOT EXISTS public.note_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_note_views_note ON public.note_views(note_id);
GRANT SELECT, INSERT ON public.note_views TO authenticated;
GRANT SELECT ON public.note_views TO anon;
GRANT ALL ON public.note_views TO service_role;
ALTER TABLE public.note_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads note views" ON public.note_views FOR SELECT USING (true);
CREATE POLICY "auth records own view" ON public.note_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

ALTER TABLE public.dm_threads
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ALTER COLUMN user_a DROP NOT NULL,
  ALTER COLUMN user_b DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.dm_thread_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_thread_members TO authenticated;
GRANT ALL ON public.dm_thread_members TO service_role;
ALTER TABLE public.dm_thread_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_thread_member(_thread_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.dm_thread_members WHERE thread_id = _thread_id AND user_id = _user_id)
  OR EXISTS (SELECT 1 FROM public.dm_threads WHERE id = _thread_id AND (user_a = _user_id OR user_b = _user_id));
$$;

CREATE OR REPLACE FUNCTION public.is_thread_owner(_thread_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.dm_threads WHERE id = _thread_id AND owner_id = _user_id);
$$;

CREATE POLICY "members read own membership" ON public.dm_thread_members FOR SELECT TO authenticated USING (public.is_thread_member(thread_id, auth.uid()));
CREATE POLICY "owner adds members" ON public.dm_thread_members FOR INSERT TO authenticated WITH CHECK (
  public.is_thread_owner(thread_id, auth.uid())
  OR (user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.dm_thread_members m WHERE m.thread_id = dm_thread_members.thread_id))
);
CREATE POLICY "owner or self removes" ON public.dm_thread_members FOR DELETE TO authenticated USING (public.is_thread_owner(thread_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "participants read threads" ON public.dm_threads FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b OR public.is_thread_member(id, auth.uid()));
CREATE POLICY "auth creates threads" ON public.dm_threads FOR INSERT TO authenticated WITH CHECK (
  (is_group = false AND (auth.uid() = user_a OR auth.uid() = user_b))
  OR (is_group = true AND auth.uid() = owner_id)
);
CREATE POLICY "participants update threads" ON public.dm_threads FOR UPDATE TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b OR public.is_thread_member(id, auth.uid()));

CREATE POLICY "participants read dms" ON public.dm_messages FOR SELECT TO authenticated USING (public.is_thread_member(thread_id, auth.uid()));
CREATE POLICY "participants send dms" ON public.dm_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND public.is_thread_member(thread_id, auth.uid()));

-- library_books
CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openlibrary_key text NOT NULL UNIQUE,
  title text NOT NULL,
  author text,
  cover_url text,
  category text NOT NULL CHECK (category IN ('novel','book','comics','poetry')),
  read_url text,
  description text,
  first_publish_year int,
  price_credits int NOT NULL DEFAULT 20,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_library_books_category ON public.library_books(category);
CREATE INDEX idx_library_books_title ON public.library_books(title);

GRANT SELECT ON public.library_books TO anon, authenticated;
GRANT ALL ON public.library_books TO service_role;

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads library books" ON public.library_books FOR SELECT USING (true);
CREATE POLICY "admins manage library books all" ON public.library_books FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.library_book_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  price_paid int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(book_id, user_id)
);
CREATE INDEX idx_lbp_user ON public.library_book_purchases(user_id);

GRANT SELECT, INSERT ON public.library_book_purchases TO authenticated;
GRANT ALL ON public.library_book_purchases TO service_role;

ALTER TABLE public.library_book_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own book purchases" ON public.library_book_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.purchase_library_book(_book_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _book public.library_books;
  _new_balance int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _book FROM public.library_books WHERE id = _book_id;
  IF _book IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.library_book_purchases WHERE book_id = _book_id AND user_id = _uid) THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true, 'read_url', _book.read_url);
  END IF;

  IF _book.price_credits > 0 THEN
    UPDATE public.profiles SET credits = credits - _book.price_credits
      WHERE id = _uid AND credits >= _book.price_credits
      RETURNING credits INTO _new_balance;
    IF _new_balance IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
    INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
      VALUES (_uid, -_book.price_credits, 'library_book_purchase',
              jsonb_build_object('book_id', _book_id, 'title', _book.title), _new_balance);
  END IF;

  INSERT INTO public.library_book_purchases (book_id, user_id, price_paid)
    VALUES (_book_id, _uid, _book.price_credits);

  RETURN jsonb_build_object('ok', true, 'already_owned', false, 'read_url', _book.read_url);
END $$;

GRANT EXECUTE ON FUNCTION public.purchase_library_book(uuid) TO authenticated;

CREATE TABLE public.library_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  subject TEXT,
  level TEXT,
  cover_url TEXT,
  description TEXT,
  read_url TEXT NOT NULL,
  download_url TEXT,
  can_embed BOOLEAN NOT NULL DEFAULT true,
  is_course BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX idx_library_courses_subject ON public.library_courses(subject);
CREATE INDEX idx_library_courses_source ON public.library_courses(source);
GRANT SELECT ON public.library_courses TO anon;
GRANT SELECT ON public.library_courses TO authenticated;
GRANT ALL ON public.library_courses TO service_role;
ALTER TABLE public.library_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Library courses are viewable by everyone" ON public.library_courses FOR SELECT USING (true);
CREATE POLICY "Admins can insert library courses" ON public.library_courses FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update library courses" ON public.library_courses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete library courses" ON public.library_courses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_library_courses_touch BEFORE UPDATE ON public.library_courses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.library_course_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.library_courses(id) ON DELETE CASCADE,
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress_pct INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_course_progress TO authenticated;
GRANT ALL ON public.library_course_progress TO service_role;
ALTER TABLE public.library_course_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own library course progress" ON public.library_course_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own library course progress" ON public.library_course_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own library course progress" ON public.library_course_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);