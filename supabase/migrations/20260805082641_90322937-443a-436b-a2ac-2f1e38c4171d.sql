-- 1. Signup requests
CREATE TABLE public.student_signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  exam text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_signup_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_signup_requests TO authenticated;
GRANT ALL ON public.student_signup_requests TO service_role;

ALTER TABLE public.student_signup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert signup requests" ON public.student_signup_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read signup requests" ON public.student_signup_requests FOR SELECT USING (true);
CREATE POLICY "Allow public update signup requests" ON public.student_signup_requests FOR UPDATE USING (true);
CREATE POLICY "Allow public delete signup requests" ON public.student_signup_requests FOR DELETE USING (true);

CREATE TRIGGER trg_student_signup_requests_updated_at
BEFORE UPDATE ON public.student_signup_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Exam preference on students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS exam text;

-- 3. Trusted server clock for exam timing
CREATE OR REPLACE FUNCTION public.server_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT now() $$;

GRANT EXECUTE ON FUNCTION public.server_now() TO anon, authenticated, service_role;

-- 4. Window helpers
CREATE OR REPLACE FUNCTION public.competition_window(p_competition_id uuid)
RETURNS TABLE (window_start timestamptz, window_end timestamptz, duration_minutes integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ((c.date + c.start_time) AT TIME ZONE 'Asia/Kolkata'),
    ((COALESCE(c.end_date, c.date) + c.end_time) AT TIME ZONE 'Asia/Kolkata'),
    c.duration_minutes
  FROM public.competitions c
  WHERE c.id = p_competition_id
$$;

GRANT EXECUTE ON FUNCTION public.competition_window(uuid) TO anon, authenticated, service_role;

-- 5. Block starting a test outside its scheduled window
CREATE OR REPLACE FUNCTION public.enforce_test_start_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w_start timestamptz;
  w_end timestamptz;
BEGIN
  IF COALESCE(NEW.has_started, false) = true
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.has_started, false) = false) THEN
    SELECT window_start, window_end INTO w_start, w_end
    FROM public.competition_window(NEW.competition_id);

    IF w_start IS NOT NULL AND now() < w_start THEN
      RAISE EXCEPTION 'This test has not started yet.';
    END IF;

    IF w_end IS NOT NULL AND now() > w_end + interval '45 seconds' THEN
      RAISE EXCEPTION 'This test window has already closed.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_test_start_window
BEFORE INSERT OR UPDATE ON public.student_competitions
FOR EACH ROW EXECUTE FUNCTION public.enforce_test_start_window();

-- 6. Block answer writes after a student's time is up or after lock/submit
CREATE OR REPLACE FUNCTION public.enforce_answer_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_at timestamptz;
  v_locked boolean := false;
  v_submitted boolean := false;
  w_end timestamptz;
  v_duration integer := 0;
BEGIN
  SELECT sc.started_at, COALESCE(sc.is_locked, false), COALESCE(sc.has_submitted, false)
  INTO v_started_at, v_locked, v_submitted
  FROM public.student_competitions sc
  WHERE sc.student_id = NEW.student_id
    AND sc.competition_id = NEW.competition_id;

  IF v_locked OR v_submitted THEN
    RAISE EXCEPTION 'This test is already submitted and locked.';
  END IF;

  SELECT window_end, duration_minutes INTO w_end, v_duration
  FROM public.competition_window(NEW.competition_id);

  IF v_started_at IS NOT NULL AND v_duration > 0
     AND now() > v_started_at + make_interval(mins => v_duration) + interval '45 seconds' THEN
    RAISE EXCEPTION 'Your time for this test has ended.';
  END IF;

  IF w_end IS NOT NULL AND now() > w_end + interval '45 seconds' THEN
    RAISE EXCEPTION 'This test window has already closed.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_answer_window
BEFORE INSERT OR UPDATE ON public.student_answers
FOR EACH ROW EXECUTE FUNCTION public.enforce_answer_window();