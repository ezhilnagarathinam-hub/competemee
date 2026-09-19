CREATE OR REPLACE FUNCTION public.start_new_attempt(p_student_id uuid, p_competition_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed integer;
  v_used integer;
  v_id uuid;
  w_start timestamptz;
  w_end timestamptz;
BEGIN
  SELECT sc.id, COALESCE(sc.attempts_used, 0), COALESCE(sc.attempts_allowed, c.max_attempts, 1)
  INTO v_id, v_used, v_allowed
  FROM public.student_competitions sc
  JOIN public.competitions c ON c.id = sc.competition_id
  WHERE sc.student_id = p_student_id
    AND sc.competition_id = p_competition_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'You are not allotted to this test.';
  END IF;

  SELECT window_start, window_end INTO w_start, w_end
  FROM public.competition_window(p_competition_id);

  IF w_start IS NOT NULL AND now() < w_start THEN
    RAISE EXCEPTION 'This test has not started yet.';
  END IF;

  IF w_end IS NOT NULL AND now() > w_end + interval '45 seconds' THEN
    RAISE EXCEPTION 'This test window has already closed.';
  END IF;

  IF v_allowed <> 0 AND v_used >= v_allowed THEN
    RAISE EXCEPTION 'No attempts left for this test.';
  END IF;

  DELETE FROM public.student_answers
  WHERE student_id = p_student_id
    AND competition_id = p_competition_id;

  UPDATE public.student_competitions
  SET has_started = true,
      has_submitted = false,
      is_locked = false,
      started_at = now(),
      submitted_at = NULL,
      total_marks = 0,
      current_question = 1,
      last_seen = now(),
      attempts_used = v_used + 1
  WHERE id = v_id;

  RETURN true;
END;
$$;