ALTER TABLE public.questions ALTER COLUMN marks TYPE numeric(10,2) USING marks::numeric;
ALTER TABLE public.questions ALTER COLUMN marks SET DEFAULT 1;
ALTER TABLE public.student_competitions ALTER COLUMN total_marks TYPE numeric(10,2) USING total_marks::numeric;
ALTER TABLE public.student_competitions ALTER COLUMN total_marks SET DEFAULT 0;