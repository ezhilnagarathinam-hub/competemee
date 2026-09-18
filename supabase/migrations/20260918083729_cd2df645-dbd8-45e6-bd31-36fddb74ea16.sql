ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS enrollment_requires_approval boolean NOT NULL DEFAULT true;

ALTER TABLE public.student_signup_requests
  ADD COLUMN IF NOT EXISTS competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL;

CREATE TABLE public.competition_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, batch_id)
);

GRANT SELECT ON public.competition_batches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.competition_batches TO authenticated;
GRANT ALL ON public.competition_batches TO service_role;

ALTER TABLE public.competition_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members view competition batches"
ON public.competition_batches FOR SELECT
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id AND o.status = 'active'
  )
);

CREATE POLICY "Organization admins manage competition batches"
ON public.competition_batches FOR ALL TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE INDEX IF NOT EXISTS idx_competition_batches_organization ON public.competition_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_competition_batches_competition ON public.competition_batches(competition_id);
CREATE INDEX IF NOT EXISTS idx_student_signup_requests_competition ON public.student_signup_requests(competition_id);
CREATE INDEX IF NOT EXISTS idx_student_signup_requests_batch ON public.student_signup_requests(batch_id);