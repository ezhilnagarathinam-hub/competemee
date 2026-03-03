
-- Add explanation column to questions table
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS explanation text;

-- Add is_locked column to student_competitions (default true = locked after submission)
ALTER TABLE public.student_competitions ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;
