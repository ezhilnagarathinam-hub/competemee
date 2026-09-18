CREATE OR REPLACE FUNCTION public.register_student_for_competition(
  p_organization_id uuid,
  p_competition_id uuid,
  p_batch_id uuid,
  p_name text,
  p_phone text,
  p_exam text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competition public.competitions%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_requires_batch boolean := false;
  v_batch_name text := NULL;
  v_request_id uuid;
BEGIN
  IF length(trim(COALESCE(p_name, ''))) < 3 THEN
    RAISE EXCEPTION 'Please enter your full name.';
  END IF;
  IF length(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Please enter a valid phone number.';
  END IF;
  IF length(trim(COALESCE(p_exam, ''))) = 0 THEN
    RAISE EXCEPTION 'Please select your exam.';
  END IF;

  SELECT c.* INTO v_competition
  FROM public.competitions c
  JOIN public.organizations o ON o.id = c.organization_id
  WHERE c.id = p_competition_id
    AND c.organization_id = p_organization_id
    AND COALESCE(c.is_active, false) = true
    AND o.status = 'active';

  IF v_competition.id IS NULL THEN
    RAISE EXCEPTION 'This test is not available for enrollment.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.competition_batches cb
    WHERE cb.competition_id = p_competition_id
      AND cb.organization_id = p_organization_id
  ) INTO v_requires_batch;

  IF v_requires_batch THEN
    SELECT b.name INTO v_batch_name
    FROM public.competition_batches cb
    JOIN public.batches b ON b.id = cb.batch_id
    WHERE cb.competition_id = p_competition_id
      AND cb.batch_id = p_batch_id
      AND cb.organization_id = p_organization_id
      AND b.organization_id = p_organization_id;
    IF v_batch_name IS NULL THEN
      RAISE EXCEPTION 'Please select an available batch for this test.';
    END IF;
  ELSE
    p_batch_id := NULL;
  END IF;

  SELECT s.* INTO v_student
  FROM public.students s
  WHERE s.organization_id = p_organization_id
    AND s.phone = regexp_replace(p_phone, '\D', '', 'g')
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF v_competition.enrollment_requires_approval THEN
    SELECT r.id INTO v_request_id
    FROM public.student_signup_requests r
    WHERE r.organization_id = p_organization_id
      AND r.phone = regexp_replace(p_phone, '\D', '', 'g')
      AND r.competition_id = p_competition_id
      AND r.status = 'pending'
    LIMIT 1;

    IF v_request_id IS NULL THEN
      INSERT INTO public.student_signup_requests (
        organization_id, competition_id, batch_id, name, phone, exam, note, status, student_id
      ) VALUES (
        p_organization_id, p_competition_id, p_batch_id, trim(p_name),
        regexp_replace(p_phone, '\D', '', 'g'), trim(p_exam), nullif(trim(COALESCE(p_note, '')), ''),
        'pending', v_student.id
      ) RETURNING id INTO v_request_id;
    END IF;

    RETURN jsonb_build_object('status', 'pending', 'request_id', v_request_id);
  END IF;

  IF v_student.id IS NULL THEN
    INSERT INTO public.students (
      organization_id, name, phone, exam, batch, category, is_active
    ) VALUES (
      p_organization_id, trim(p_name), regexp_replace(p_phone, '\D', '', 'g'), trim(p_exam),
      v_batch_name, 'Free', true
    ) RETURNING * INTO v_student;

    INSERT INTO public.student_competitions (
      organization_id, student_id, competition_id, attempts_allowed
    ) VALUES (
      p_organization_id, v_student.id, p_competition_id, v_competition.max_attempts
    ) ON CONFLICT (student_id, competition_id) DO NOTHING;

    INSERT INTO public.student_signup_requests (
      organization_id, competition_id, batch_id, name, phone, exam, note, status, student_id, reviewed_at
    ) VALUES (
      p_organization_id, p_competition_id, p_batch_id, trim(p_name),
      regexp_replace(p_phone, '\D', '', 'g'), trim(p_exam), nullif(trim(COALESCE(p_note, '')), ''),
      'approved', v_student.id, now()
    );

    RETURN jsonb_build_object(
      'status', 'created',
      'student_id', v_student.id,
      'username', v_student.username,
      'password', v_student.password
    );
  END IF;

  IF NOT COALESCE(v_student.is_active, true) THEN
    RAISE EXCEPTION 'This player account is inactive. Please contact support.';
  END IF;

  INSERT INTO public.student_competitions (
    organization_id, student_id, competition_id, attempts_allowed
  ) VALUES (
    p_organization_id, v_student.id, p_competition_id, v_competition.max_attempts
  ) ON CONFLICT (student_id, competition_id) DO NOTHING;

  RETURN jsonb_build_object('status', 'existing');
END;
$$;

REVOKE ALL ON FUNCTION public.register_student_for_competition(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_student_for_competition(uuid, uuid, uuid, text, text, text, text) TO anon, authenticated, service_role;