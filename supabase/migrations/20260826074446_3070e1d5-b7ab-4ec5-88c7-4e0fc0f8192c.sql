ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS batch text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Free';