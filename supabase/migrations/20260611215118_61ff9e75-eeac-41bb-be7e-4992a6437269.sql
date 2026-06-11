
-- 1) Status enum: add 'draft'
ALTER TYPE public.analysis_status ADD VALUE IF NOT EXISTS 'draft';

-- 2) Extracted-data fields on analyses
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS building_coverage_ratio numeric,
  ADD COLUMN IF NOT EXISTS setbacks jsonb,
  ADD COLUMN IF NOT EXISTS special_provisions text,
  ADD COLUMN IF NOT EXISTS design_plan_required boolean,
  ADD COLUMN IF NOT EXISTS heritage_protected boolean,
  ADD COLUMN IF NOT EXISTS noise_zone text,
  ADD COLUMN IF NOT EXISTS water_setbacks text,
  ADD COLUMN IF NOT EXISTS extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS error_message text;

-- 3) Document kind enum
DO $$ BEGIN
  CREATE TYPE public.analysis_document_kind AS ENUM ('bzr','bzo','zonenplan','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) analysis_documents table
CREATE TABLE IF NOT EXISTS public.analysis_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind public.analysis_document_kind NOT NULL DEFAULT 'other',
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analysis_documents_analysis_idx ON public.analysis_documents(analysis_id);
CREATE INDEX IF NOT EXISTS analysis_documents_org_idx ON public.analysis_documents(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_documents TO authenticated;
GRANT ALL ON public.analysis_documents TO service_role;

ALTER TABLE public.analysis_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read analysis_documents"
  ON public.analysis_documents FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org members insert analysis_documents"
  ON public.analysis_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org members update analysis_documents"
  ON public.analysis_documents FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org members delete analysis_documents"
  ON public.analysis_documents FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
