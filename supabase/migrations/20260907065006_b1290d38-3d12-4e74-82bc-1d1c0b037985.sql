CREATE TABLE public.organization_signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name text NOT NULL,
  slug text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  plan_code text NOT NULL DEFAULT 'starter' CHECK (plan_code IN ('starter', 'growth', 'professional', 'enterprise')),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'approved', 'rejected')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT INSERT ON public.organization_signup_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.organization_signup_requests TO authenticated;
GRANT ALL ON public.organization_signup_requests TO service_role;
ALTER TABLE public.organization_signup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit organization registration" ON public.organization_signup_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Authenticated platform users can review organization registrations" ON public.organization_signup_requests FOR SELECT TO authenticated USING (public.has_platform_role(auth.uid(), 'super_admin'));
CREATE POLICY "Authenticated platform users can update organization registrations" ON public.organization_signup_requests FOR UPDATE TO authenticated USING (public.has_platform_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'));
CREATE OR REPLACE FUNCTION public.update_organization_signup_requests_updated_at()
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
REVOKE EXECUTE ON FUNCTION public.update_organization_signup_requests_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER organization_signup_requests_updated_at
BEFORE UPDATE ON public.organization_signup_requests
FOR EACH ROW EXECUTE FUNCTION public.update_organization_signup_requests_updated_at();