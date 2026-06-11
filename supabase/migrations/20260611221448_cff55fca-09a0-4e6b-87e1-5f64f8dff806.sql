CREATE TABLE public.analysis_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  model TEXT,
  parcel_snapshot JSONB,
  ai_answer JSONB,
  extracted_data JSONB,
  unit_calculation JSONB,
  potential_score INTEGER,
  potential_category TEXT,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation TEXT,
  summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_results_analysis ON public.analysis_results(analysis_id);
CREATE INDEX idx_analysis_results_org ON public.analysis_results(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_results TO authenticated;
GRANT ALL ON public.analysis_results TO service_role;

ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org analysis_results"
  ON public.analysis_results FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can create org analysis_results"
  ON public.analysis_results FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can update org analysis_results"
  ON public.analysis_results FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Owners can delete org analysis_results"
  ON public.analysis_results FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), organization_id, 'owner'::app_role));

CREATE TRIGGER trg_analysis_results_updated
  BEFORE UPDATE ON public.analysis_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();