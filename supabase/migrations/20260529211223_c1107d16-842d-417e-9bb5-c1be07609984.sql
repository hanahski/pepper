ALTER TABLE public.library_books DROP CONSTRAINT IF EXISTS library_books_category_check;
ALTER TABLE public.library_books ADD CONSTRAINT library_books_category_check CHECK (category = ANY (ARRAY['novel'::text, 'book'::text, 'comics'::text, 'poetry'::text, 'course'::text]));
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS source_url text;