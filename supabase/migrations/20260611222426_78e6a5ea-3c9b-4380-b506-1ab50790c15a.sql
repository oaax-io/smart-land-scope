
CREATE TYPE public.extraction_status AS ENUM ('pending','processing','completed','failed');

CREATE TABLE public.regulation_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES public.regulation_documents(id) ON DELETE CASCADE,
  status public.extraction_status NOT NULL DEFAULT 'pending',
  error_message text,
  zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  residential_zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  commercial_zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  mixed_zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  utilization_ratio numeric,
  building_coverage_ratio numeric,
  max_floors integer,
  max_height_m numeric,
  setbacks jsonb,
  special_provisions text,
  design_plan_required boolean,
  heritage_protected boolean,
  water_protection text,
  noise_provisions text,
  raw_extraction jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regulation_extractions TO authenticated;
GRANT ALL ON public.regulation_extractions TO service_role;
ALTER TABLE public.regulation_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regextr_read_all" ON public.regulation_extractions FOR SELECT TO authenticated USING (true);
CREATE POLICY "regextr_admin_insert" ON public.regulation_extractions FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "regextr_admin_update" ON public.regulation_extractions FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "regextr_admin_delete" ON public.regulation_extractions FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE TRIGGER set_regextr_updated_at BEFORE UPDATE ON public.regulation_extractions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_regextr_doc ON public.regulation_extractions(document_id);
CREATE INDEX idx_regextr_status ON public.regulation_extractions(status);
