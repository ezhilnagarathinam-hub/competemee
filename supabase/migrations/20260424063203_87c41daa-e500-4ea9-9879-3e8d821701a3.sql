DO $$
BEGIN
  WITH ranked_answers AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY student_id, competition_id, question_id
             ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM public.student_answers
  )
  DELETE FROM public.student_answers sa
  USING ranked_answers ra
  WHERE sa.id = ra.id
    AND ra.rn > 1;

  WITH ranked_competitions AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY student_id, competition_id
             ORDER BY submitted_at DESC NULLS LAST, last_seen DESC NULLS LAST, started_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM public.student_competitions
  )
  DELETE FROM public.student_competitions sc
  USING ranked_competitions rc
  WHERE sc.id = rc.id
    AND rc.rn > 1;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_answers_student_competition_question_key'
  ) THEN
    ALTER TABLE public.student_answers
      ADD CONSTRAINT student_answers_student_competition_question_key
      UNIQUE (student_id, competition_id, question_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_competitions_student_competition_key'
  ) THEN
    ALTER TABLE public.student_competitions
      ADD CONSTRAINT student_competitions_student_competition_key
      UNIQUE (student_id, competition_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.competition_result_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_competition_id uuid NULL REFERENCES public.student_competitions(id) ON DELETE SET NULL,
  started_at timestamp with time zone NULL,
  submitted_at timestamp with time zone NULL,
  last_activity_at timestamp with time zone NULL,
  attempted_questions integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  wrong_answers integer NOT NULL DEFAULT 0,
  correct_marks numeric NOT NULL DEFAULT 0,
  negative_marks numeric NOT NULL DEFAULT 0,
  total_marks numeric NOT NULL DEFAULT 0,
  max_marks numeric NOT NULL DEFAULT 0,
  percentage numeric NOT NULL DEFAULT 0,
  rank integer NULL,
  is_topper boolean NOT NULL DEFAULT false,
  is_finalized boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT competition_result_summaries_competition_student_key UNIQUE (competition_id, student_id)
);

ALTER TABLE public.competition_result_summaries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'competition_result_summaries'
      AND policyname = 'Allow public read competition_result_summaries'
  ) THEN
    CREATE POLICY "Allow public read competition_result_summaries"
      ON public.competition_result_summaries
      FOR SELECT
      USING (true);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_competition_result_summaries_competition_rank
  ON public.competition_result_summaries (competition_id, rank);

CREATE INDEX IF NOT EXISTS idx_competition_result_summaries_student_submitted
  ON public.competition_result_summaries (student_id, submitted_at DESC);

CREATE OR REPLACE FUNCTION public.refresh_competition_result_summary(p_competition_id uuid, p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempted_questions integer := 0;
  v_correct_answers integer := 0;
  v_wrong_answers integer := 0;
  v_correct_marks numeric := 0;
  v_negative_marks numeric := 0;
  v_total_marks numeric := 0;
  v_max_marks numeric := 0;
  v_percentage numeric := 0;
  v_first_answer_at timestamp with time zone := NULL;
  v_last_answer_at timestamp with time zone := NULL;
  v_started_at timestamp with time zone := NULL;
  v_submitted_at timestamp with time zone := NULL;
  v_last_seen timestamp with time zone := NULL;
  v_last_activity_at timestamp with time zone := NULL;
  v_has_started boolean := false;
  v_has_submitted boolean := false;
  v_is_locked boolean := false;
  v_is_finalized boolean := false;
  v_student_competition_id uuid := NULL;
  v_duration_minutes integer := 0;
  v_competition_active boolean := false;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE sa.selected_answer IS NOT NULL),
    COUNT(*) FILTER (WHERE sa.selected_answer IS NOT NULL AND sa.is_correct IS TRUE),
    COUNT(*) FILTER (WHERE sa.selected_answer IS NOT NULL AND sa.is_correct IS FALSE),
    COALESCE(SUM(CASE WHEN sa.selected_answer IS NOT NULL AND sa.is_correct IS TRUE THEN COALESCE(q.marks, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN sa.selected_answer IS NOT NULL AND sa.is_correct IS FALSE THEN COALESCE(q.marks, 0) / 3 ELSE 0 END), 0),
    MIN(COALESCE(sa.created_at, sa.updated_at)),
    MAX(COALESCE(sa.updated_at, sa.created_at))
  INTO
    v_attempted_questions,
    v_correct_answers,
    v_wrong_answers,
    v_correct_marks,
    v_negative_marks,
    v_first_answer_at,
    v_last_answer_at
  FROM public.student_answers sa
  JOIN public.questions q ON q.id = sa.question_id
  WHERE sa.competition_id = p_competition_id
    AND sa.student_id = p_student_id;

  SELECT COALESCE(SUM(COALESCE(marks, 0)), 0)
  INTO v_max_marks
  FROM public.questions
  WHERE competition_id = p_competition_id;

  SELECT
    sc.id,
    COALESCE(sc.has_started, false),
    COALESCE(sc.has_submitted, false),
    COALESCE(sc.is_locked, false),
    sc.started_at,
    sc.submitted_at,
    sc.last_seen,
    c.duration_minutes,
    COALESCE(c.is_active, false)
  INTO
    v_student_competition_id,
    v_has_started,
    v_has_submitted,
    v_is_locked,
    v_started_at,
    v_submitted_at,
    v_last_seen,
    v_duration_minutes,
    v_competition_active
  FROM public.competitions c
  LEFT JOIN public.student_competitions sc
    ON sc.competition_id = c.id
   AND sc.student_id = p_student_id
  WHERE c.id = p_competition_id
  LIMIT 1;

  v_started_at := COALESCE(v_started_at, v_first_answer_at);
  v_total_marks := ROUND((v_correct_marks - v_negative_marks)::numeric, 2);

  IF v_max_marks > 0 THEN
    v_percentage := ROUND(((v_total_marks / v_max_marks) * 100)::numeric, 2);
  ELSE
    v_percentage := 0;
  END IF;

  v_is_finalized := (
    v_attempted_questions > 0
    AND (
      v_has_submitted
      OR (v_is_locked AND v_submitted_at IS NOT NULL)
      OR (
        v_started_at IS NOT NULL
        AND v_duration_minutes > 0
        AND now() >= v_started_at + make_interval(mins => v_duration_minutes)
      )
      OR (NOT v_competition_active)
    )
  );

  IF v_is_finalized THEN
    v_submitted_at := COALESCE(
      v_submitted_at,
      v_last_answer_at,
      v_last_seen,
      CASE
        WHEN v_started_at IS NOT NULL AND v_duration_minutes > 0
          THEN v_started_at + make_interval(mins => v_duration_minutes)
        ELSE NULL
      END
    );
  ELSE
    v_submitted_at := NULL;
  END IF;

  v_last_activity_at := COALESCE(v_submitted_at, v_last_answer_at, v_last_seen, v_started_at);

  IF v_student_competition_id IS NULL AND v_attempted_questions = 0 AND v_started_at IS NULL THEN
    DELETE FROM public.competition_result_summaries
    WHERE competition_id = p_competition_id
      AND student_id = p_student_id;
    RETURN;
  END IF;

  INSERT INTO public.competition_result_summaries (
    competition_id,
    student_id,
    student_competition_id,
    started_at,
    submitted_at,
    last_activity_at,
    attempted_questions,
    correct_answers,
    wrong_answers,
    correct_marks,
    negative_marks,
    total_marks,
    max_marks,
    percentage,
    is_finalized
  )
  VALUES (
    p_competition_id,
    p_student_id,
    v_student_competition_id,
    v_started_at,
    v_submitted_at,
    v_last_activity_at,
    v_attempted_questions,
    v_correct_answers,
    v_wrong_answers,
    v_correct_marks,
    v_negative_marks,
    v_total_marks,
    v_max_marks,
    v_percentage,
    v_is_finalized
  )
  ON CONFLICT (competition_id, student_id)
  DO UPDATE SET
    student_competition_id = EXCLUDED.student_competition_id,
    started_at = EXCLUDED.started_at,
    submitted_at = EXCLUDED.submitted_at,
    last_activity_at = EXCLUDED.last_activity_at,
    attempted_questions = EXCLUDED.attempted_questions,
    correct_answers = EXCLUDED.correct_answers,
    wrong_answers = EXCLUDED.wrong_answers,
    correct_marks = EXCLUDED.correct_marks,
    negative_marks = EXCLUDED.negative_marks,
    total_marks = EXCLUDED.total_marks,
    max_marks = EXCLUDED.max_marks,
    percentage = EXCLUDED.percentage,
    is_finalized = EXCLUDED.is_finalized,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_competition_rankings(p_competition_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ranked AS (
    SELECT id,
           dense_rank() OVER (
             ORDER BY total_marks DESC, submitted_at ASC NULLS LAST, updated_at ASC, student_id ASC
           ) AS next_rank
    FROM public.competition_result_summaries
    WHERE competition_id = p_competition_id
      AND is_finalized = true
  )
  UPDATE public.competition_result_summaries crs
  SET rank = ranked.next_rank,
      is_topper = (ranked.next_rank = 1),
      updated_at = now()
  FROM ranked
  WHERE crs.id = ranked.id;

  UPDATE public.competition_result_summaries
  SET rank = NULL,
      is_topper = false,
      updated_at = now()
  WHERE competition_id = p_competition_id
    AND is_finalized = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_student_answers_result_summary_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competition_id uuid;
  v_student_id uuid;
BEGIN
  v_competition_id := COALESCE(NEW.competition_id, OLD.competition_id);
  v_student_id := COALESCE(NEW.student_id, OLD.student_id);

  PERFORM public.refresh_competition_result_summary(v_competition_id, v_student_id);
  PERFORM public.recompute_competition_rankings(v_competition_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_student_competitions_result_summary_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competition_id uuid;
  v_student_id uuid;
BEGIN
  v_competition_id := COALESCE(NEW.competition_id, OLD.competition_id);
  v_student_id := COALESCE(NEW.student_id, OLD.student_id);

  PERFORM public.refresh_competition_result_summary(v_competition_id, v_student_id);
  PERFORM public.recompute_competition_rankings(v_competition_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP VIEW IF EXISTS public.competition_result_reports;
CREATE VIEW public.competition_result_reports
WITH (security_invoker = on) AS
SELECT
  crs.competition_id,
  c.name AS competition_name,
  crs.student_id,
  s.name AS student_name,
  crs.started_at,
  crs.submitted_at,
  crs.last_activity_at,
  crs.attempted_questions,
  crs.correct_answers,
  crs.wrong_answers,
  crs.correct_marks,
  crs.negative_marks,
  crs.total_marks,
  crs.max_marks,
  crs.percentage,
  crs.rank,
  crs.is_topper,
  crs.is_finalized,
  crs.updated_at
FROM public.competition_result_summaries crs
JOIN public.competitions c ON c.id = crs.competition_id
JOIN public.students s ON s.id = crs.student_id;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN (
    SELECT DISTINCT competition_id, student_id
    FROM (
      SELECT competition_id, student_id FROM public.student_competitions
      UNION
      SELECT competition_id, student_id FROM public.student_answers
    ) pairs
  ) LOOP
    PERFORM public.refresh_competition_result_summary(rec.competition_id, rec.student_id);
  END LOOP;

  UPDATE public.student_competitions sc
  SET has_started = COALESCE(sc.has_started, false) OR crs.started_at IS NOT NULL,
      has_submitted = COALESCE(sc.has_submitted, false) OR crs.is_finalized,
      is_locked = COALESCE(sc.is_locked, false) OR crs.is_finalized,
      started_at = COALESCE(sc.started_at, crs.started_at),
      submitted_at = COALESCE(sc.submitted_at, crs.submitted_at),
      total_marks = crs.total_marks,
      last_seen = COALESCE(crs.last_activity_at, sc.last_seen)
  FROM public.competition_result_summaries crs
  WHERE sc.competition_id = crs.competition_id
    AND sc.student_id = crs.student_id;

  INSERT INTO public.student_competitions (
    student_id,
    competition_id,
    current_question,
    has_started,
    has_submitted,
    started_at,
    submitted_at,
    total_marks,
    last_seen,
    is_locked
  )
  SELECT
    crs.student_id,
    crs.competition_id,
    NULL,
    (crs.started_at IS NOT NULL),
    crs.is_finalized,
    crs.started_at,
    crs.submitted_at,
    crs.total_marks,
    crs.last_activity_at,
    crs.is_finalized
  FROM public.competition_result_summaries crs
  LEFT JOIN public.student_competitions sc
    ON sc.competition_id = crs.competition_id
   AND sc.student_id = crs.student_id
  WHERE sc.id IS NULL;

  FOR rec IN (
    SELECT DISTINCT competition_id, student_id
    FROM public.competition_result_summaries
  ) LOOP
    PERFORM public.refresh_competition_result_summary(rec.competition_id, rec.student_id);
  END LOOP;

  FOR rec IN (
    SELECT DISTINCT competition_id
    FROM public.competition_result_summaries
  ) LOOP
    PERFORM public.recompute_competition_rankings(rec.competition_id);
  END LOOP;
END
$$;

DROP TRIGGER IF EXISTS trg_competition_result_summaries_updated_at ON public.competition_result_summaries;
CREATE TRIGGER trg_competition_result_summaries_updated_at
BEFORE UPDATE ON public.competition_result_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_student_answers_result_summary_sync ON public.student_answers;
CREATE TRIGGER trg_student_answers_result_summary_sync
AFTER INSERT OR UPDATE OR DELETE ON public.student_answers
FOR EACH ROW
EXECUTE FUNCTION public.handle_student_answers_result_summary_sync();

DROP TRIGGER IF EXISTS trg_student_competitions_result_summary_sync ON public.student_competitions;
CREATE TRIGGER trg_student_competitions_result_summary_sync
AFTER INSERT OR UPDATE OR DELETE ON public.student_competitions
FOR EACH ROW
EXECUTE FUNCTION public.handle_student_competitions_result_summary_sync();