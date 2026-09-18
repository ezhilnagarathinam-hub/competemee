CREATE POLICY "Legacy organization admins manage competition batches"
ON public.competition_batches
FOR ALL
TO anon
USING (true)
WITH CHECK (true);