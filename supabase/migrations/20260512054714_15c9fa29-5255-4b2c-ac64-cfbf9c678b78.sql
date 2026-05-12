ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_text_secondary text,
  ADD COLUMN IF NOT EXISTS option_a_secondary text,
  ADD COLUMN IF NOT EXISTS option_b_secondary text,
  ADD COLUMN IF NOT EXISTS option_c_secondary text,
  ADD COLUMN IF NOT EXISTS option_d_secondary text,
  ADD COLUMN IF NOT EXISTS explanation_secondary text,
  ADD COLUMN IF NOT EXISTS secondary_language text;