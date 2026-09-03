BEGIN;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  plan_code text NOT NULL DEFAULT 'starter',
  contact_name text,
  contact_email text,
  contact_phone text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  welcome_message text,
  subdomain text UNIQUE,
  custom_domain text UNIQUE,
  custom_domain_verified_at timestamp with time zone,
  max_active_students integer NOT NULL DEFAULT 250,
  max_admins integer NOT NULL DEFAULT 3,
  max_competitions integer NOT NULL DEFAULT 25,
  trial_ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  auth_user_id uuid,
  legacy_admin_id uuid,
  legacy_student_id uuid,
  role text NOT NULL CHECK (role IN ('organization_admin', 'staff', 'student')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organization_memberships_one_principal CHECK (auth_user_id IS NOT NULL OR legacy_admin_id IS NOT NULL OR legacy_student_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_memberships TO authenticated;
GRANT ALL ON public.organization_memberships TO service_role;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (auth_user_id, role)
);
GRANT SELECT ON public.platform_roles TO authenticated;
GRANT ALL ON public.platform_roles TO service_role;
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hostname text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'subdomain' CHECK (kind IN ('subdomain', 'custom')),
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  verification_token text,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_domains TO authenticated;
GRANT ALL ON public.organization_domains TO service_role;
ALTER TABLE public.organization_domains ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_auth_user_id uuid,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.organization_audit_events TO authenticated;
GRANT ALL ON public.organization_audit_events TO service_role;
ALTER TABLE public.organization_audit_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_platform_role(p_auth_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE auth_user_id = p_auth_user_id AND role = p_role AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_auth_user_id uuid, p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_platform_role(p_auth_user_id, 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE auth_user_id = p_auth_user_id
          AND organization_id = p_organization_id
          AND is_active = true
      )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_auth_user_id uuid, p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_platform_role(p_auth_user_id, 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE auth_user_id = p_auth_user_id
          AND organization_id = p_organization_id
          AND role = 'organization_admin'
          AND is_active = true
      )
$$;

CREATE POLICY "Platform users manage organizations" ON public.organizations FOR ALL TO authenticated USING (public.has_platform_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'));
CREATE POLICY "Organization members can read their organization" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Platform users manage memberships" ON public.organization_memberships FOR ALL TO authenticated USING (public.has_platform_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'));
CREATE POLICY "Organization admins manage memberships" ON public.organization_memberships FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Members can read own membership" ON public.organization_memberships FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY "Platform role owners can read their role" ON public.platform_roles FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY "Platform users manage domains" ON public.organization_domains FOR ALL TO authenticated USING (public.has_platform_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'));
CREATE POLICY "Organization admins manage their domains" ON public.organization_domains FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Anyone can read verified domains" ON public.organization_domains FOR SELECT USING (verification_status = 'verified');

CREATE POLICY "Platform users read all audit events" ON public.organization_audit_events FOR SELECT TO authenticated USING (public.has_platform_role(auth.uid(), 'super_admin'));
CREATE POLICY "Organization admins read their audit events" ON public.organization_audit_events FOR SELECT TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Authenticated users create audit events" ON public.organization_audit_events FOR INSERT TO authenticated WITH CHECK (actor_auth_user_id = auth.uid());

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.student_competitions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.student_answers ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.competition_result_summaries ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.student_signup_requests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO public.organizations (
    name, slug, status, plan_code, contact_email, subdomain, welcome_message
  ) VALUES (
    'EADREAMSS', 'eadreamss', 'active', 'starter', 'eadreamssindia@gmail.com', 'eadreamss', 'Welcome to EADREAMSS'
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_org_id;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'eadreamss';
  END IF;

  UPDATE public.admins SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.students SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.competitions SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.questions SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.student_competitions SET organization_id = v_org_id WHERE organization_id IS NULL;
  ALTER TABLE public.student_answers DISABLE TRIGGER trg_enforce_answer_window;
  UPDATE public.student_answers SET organization_id = v_org_id WHERE organization_id IS NULL;
  ALTER TABLE public.student_answers ENABLE TRIGGER trg_enforce_answer_window;
  UPDATE public.competition_result_summaries SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.student_signup_requests SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.support_tickets SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.batches SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.categories SET organization_id = v_org_id WHERE organization_id IS NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_admins_organization_id ON public.admins (organization_id);
CREATE INDEX IF NOT EXISTS idx_students_organization_id ON public.students (organization_id);
CREATE INDEX IF NOT EXISTS idx_competitions_organization_id ON public.competitions (organization_id);
CREATE INDEX IF NOT EXISTS idx_questions_organization_id ON public.questions (organization_id);
CREATE INDEX IF NOT EXISTS idx_student_competitions_organization_id ON public.student_competitions (organization_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_organization_id ON public.student_answers (organization_id);
CREATE INDEX IF NOT EXISTS idx_result_summaries_organization_id ON public.competition_result_summaries (organization_id);
CREATE INDEX IF NOT EXISTS idx_signup_requests_organization_id ON public.student_signup_requests (organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_organization_id ON public.support_tickets (organization_id);
CREATE INDEX IF NOT EXISTS idx_batches_organization_id ON public.batches (organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_organization_id ON public.categories (organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_user ON public.organization_memberships (organization_id, auth_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created ON public.organization_audit_events (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_organization_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_organization_updated_at();
DROP TRIGGER IF EXISTS organization_memberships_updated_at ON public.organization_memberships;
CREATE TRIGGER organization_memberships_updated_at BEFORE UPDATE ON public.organization_memberships FOR EACH ROW EXECUTE FUNCTION public.set_organization_updated_at();
DROP TRIGGER IF EXISTS organization_domains_updated_at ON public.organization_domains;
CREATE TRIGGER organization_domains_updated_at BEFORE UPDATE ON public.organization_domains FOR EACH ROW EXECUTE FUNCTION public.set_organization_updated_at();

COMMIT;