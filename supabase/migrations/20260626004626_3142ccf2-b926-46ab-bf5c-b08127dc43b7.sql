
CREATE TABLE public.analysis_easements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  easement_type text NOT NULL DEFAULT 'dienstbarkeit',
  reg_nr text,
  title text NOT NULL,
  description text,
  beneficiary text,
  burdened_parcel text,
  legal_basis text,
  amount_chf numeric,
  rank integer,
  established_date date,
  notes text,
  ai_confidence text,
  source_document_id uuid REFERENCES public.analysis_documents(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_easements_analysis ON public.analysis_easements(analysis_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_easements TO authenticated;
GRANT ALL ON public.analysis_easements TO service_role;

ALTER TABLE public.analysis_easements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage easements" ON public.analysis_easements
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER set_analysis_easements_updated_at
  BEFORE UPDATE ON public.analysis_easements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
