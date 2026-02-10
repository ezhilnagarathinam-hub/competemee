-- Allow deleting student_answers (needed for admin reset of student competition)
CREATE POLICY "Allow public delete student_answers"
ON public.student_answers
FOR DELETE
USING (true);