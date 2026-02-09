
CREATE POLICY "Allow public delete student_competitions"
ON public.student_competitions
FOR DELETE
USING (true);
