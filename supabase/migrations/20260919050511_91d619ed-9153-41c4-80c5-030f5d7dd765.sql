ALTER TABLE public.competitions
  ADD COLUMN schedule_type text NOT NULL DEFAULT 'timed';

ALTER TABLE public.competitions
  ADD CONSTRAINT competitions_schedule_type_check
  CHECK (schedule_type IN ('lifetime', 'date_range', 'timed'));

ALTER TABLE public.competitions
  ALTER COLUMN date DROP NOT NULL,
  ALTER COLUMN start_time DROP NOT NULL,
  ALTER COLUMN end_time DROP NOT NULL;

ALTER TABLE public.competitions
  ADD CONSTRAINT competitions_schedule_fields_check
  CHECK (
    schedule_type = 'lifetime'
    OR (schedule_type = 'date_range' AND date IS NOT NULL)
    OR (schedule_type = 'timed' AND date IS NOT NULL AND start_time IS NOT NULL AND end_time IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.competition_window(p_competition_id uuid)
RETURNS TABLE (window_start timestamptz, window_end timestamptz, duration_minutes integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE c.schedule_type
      WHEN 'lifetime' THEN NULL::timestamptz
      WHEN 'date_range' THEN (c.date::timestamp AT TIME ZONE 'Asia/Kolkata')
      ELSE ((c.date + c.start_time) AT TIME ZONE 'Asia/Kolkata')
    END,
    CASE c.schedule_type
      WHEN 'lifetime' THEN NULL::timestamptz
      WHEN 'date_range' THEN ((COALESCE(c.end_date, c.date) + time '23:59:59.999999') AT TIME ZONE 'Asia/Kolkata')
      ELSE ((COALESCE(c.end_date, c.date) + c.end_time) AT TIME ZONE 'Asia/Kolkata')
    END,
    c.duration_minutes
  FROM public.competitions c
  WHERE c.id = p_competition_id
$$;

REVOKE ALL ON FUNCTION public.competition_window(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.competition_window(uuid) TO service_role;