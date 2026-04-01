-- Migration: Tighten RLS for sensitive tables (students, student_answers)
-- Restrict read/update/delete so students can only access their own rows
-- and admins (present in public.admins) retain management privileges.

BEGIN;

    -- Remove permissive policies (if present)
    DROP POLICY
    IF EXISTS "Allow public read students" ON public.students;
    DROP POLICY
    IF EXISTS "Allow public insert students" ON public.students;
    DROP POLICY
    IF EXISTS "Allow public update students" ON public.students;
    DROP POLICY
    IF EXISTS "Allow public delete students" ON public.students;

    -- Students: allow select/update only for the student themselves or admins
    CREATE POLICY "Students can read own row or admin" ON public.students
  FOR
    SELECT
        USING (
    auth.uid() = id
            OR EXISTS(SELECT 1
            FROM public.admins
            WHERE public.admins.id = auth.uid())
  );

    CREATE POLICY "Students can update own row" ON public.students
  FOR
    UPDATE
  USING (
    auth.uid()
    = id
    OR EXISTS
    (SELECT 1
    FROM public.admins
    WHERE public.admins.id = auth.uid())
    )
  WITH CHECK
    (auth.uid
    () = id);

-- Inserts and deletes should be performed by admins only
CREATE POLICY "Admins can insert students" ON public.students
  FOR
INSERT
  WITH CHECK
    (EXISTS(SELECT 1 F
OM public.admins W
ERE public.admins.id = auth.uid()
)
);

CREATE POLICY "Admins can delete students" ON public.students
  FOR
DELETE
  USING (EXISTS
(SELECT 1
FROM public.admins
WHERE public.admins.id = auth.uid())
);

-- Tighten student_answers access: students can only see/modify their own answers
DROP POLICY
IF EXISTS "Allow public read student_answers" ON public.student_answers;
DROP POLICY
IF EXISTS "Allow public insert student_answers" ON public.student_answers;
DROP POLICY
IF EXISTS "Allow public update student_answers" ON public.student_answers;
DROP POLICY
IF EXISTS "Allow public delete student_answers" ON public.student_answers;

CREATE POLICY "Students can read own answers or admin" ON public.student_answers
  FOR
SELECT
    USING (
    student_id = auth.uid()
        OR EXISTS(SELECT 1
        FROM public.admins
        WHERE public.admins.id = auth.uid())
  );

CREATE POLICY "Students can insert own answers" ON public.student_answers
  FOR
INSERT
  WITH CHECK
    (student_id =
auth.uid()

);

CREATE POLICY "Students can update own answers" ON public.student_answers
  FOR
UPDATE
  USING (
    student_id = auth.uid()
OR EXISTS
(SELECT 1
FROM public.admins
WHERE public.admins.id = auth.uid())
)
  WITH CHECK
(student_id = auth.uid
());

CREATE POLICY "Admins can delete student_answers" ON public.student_answers
  FOR
DELETE
  USING (EXISTS
(SELECT 1
FROM public.admins
WHERE public.admins.id = auth.uid())
);

COMMIT;

-- IMPORTANT:
-- 1) This migration tightens RLS but assumes admin accounts are represented
--    in `public.admins` and their `id` equals the auth user id. Adjust if different.
-- 2) The `students.password` column currently stores plaintext. You must migrate
--    to a `password_hash` field and update the application to store/verify hashed
--    passwords (bcrypt/argon2). Ask me to scaffold that migration and app changes.
