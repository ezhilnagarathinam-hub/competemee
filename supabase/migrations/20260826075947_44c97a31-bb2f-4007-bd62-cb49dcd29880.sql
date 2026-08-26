CREATE TABLE public.batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO anon;
GRANT ALL ON public.batches TO service_role;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read batches" ON public.batches FOR SELECT USING (true);
CREATE POLICY "Allow public insert batches" ON public.batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update batches" ON public.batches FOR UPDATE USING (true);
CREATE POLICY "Allow public delete batches" ON public.batches FOR DELETE USING (true);

CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow public insert categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update categories" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete categories" ON public.categories FOR DELETE USING (true);

INSERT INTO public.categories (name) VALUES ('Free'), ('Paid') ON CONFLICT (name) DO NOTHING;