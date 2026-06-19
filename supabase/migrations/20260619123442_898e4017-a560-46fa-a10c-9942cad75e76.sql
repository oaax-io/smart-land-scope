CREATE TABLE public.analysis_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  usage_assumption text NOT NULL,
  status public.analysis_status NOT NULL DEFAULT 'draft',
  error_message text,
  zone text,
  usage_types jsonb,
  max_floors integer,
  max_height numeric,
  utilization_ratio numeric,
  building_coverage_ratio numeric,
  floor_area numeric,
  living_area numeric,
  commercial_area numeric,
  unit_count integer,
  potential_level public.potential_level,
  ai_summary text,
  feasibility text,
  risks jsonb,
  ai_answer jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_scenarios_analysis ON public.analysis_scenarios(analysis_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_scenarios TO authenticated;
GRANT ALL ON public.analysis_scenarios TO service_role;

ALTER TABLE public.analysis_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org scenarios" ON public.analysis_scenarios
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members can create org scenarios" ON public.analysis_scenarios
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members can update org scenarios" ON public.analysis_scenarios
  FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members can delete org scenarios" ON public.analysis_scenarios
  FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER set_analysis_scenarios_updated_at
  BEFORE UPDATE ON public.analysis_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();