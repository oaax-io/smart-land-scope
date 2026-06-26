ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS project_number text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS project_manager text;

ALTER TYPE public.analysis_document_kind ADD VALUE IF NOT EXISTS 'grundriss';
ALTER TYPE public.analysis_document_kind ADD VALUE IF NOT EXISTS 'schnitt';
ALTER TYPE public.analysis_document_kind ADD VALUE IF NOT EXISTS 'situation';
ALTER TYPE public.analysis_document_kind ADD VALUE IF NOT EXISTS 'umgebung';
ALTER TYPE public.analysis_document_kind ADD VALUE IF NOT EXISTS 'fassade';

CREATE TABLE IF NOT EXISTS public.analysis_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  floor_index integer NOT NULL,
  floor_label text NOT NULL,
  gross_area_m2 numeric,
  floor_height_m numeric NOT NULL DEFAULT 2.85,
  volume_m3 numeric GENERATED ALWAYS AS (gross_area_m2 * floor_height_m) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_floors_analysis ON public.analysis_floors(analysis_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_floors TO authenticated;
GRANT ALL ON public.analysis_floors TO service_role;
ALTER TABLE public.analysis_floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage floors" ON public.analysis_floors
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE IF NOT EXISTS public.analysis_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  floor_index integer NOT NULL,
  unit_label text NOT NULL,
  unit_type text NOT NULL,
  area_m2 numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_units_analysis ON public.analysis_units(analysis_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_units TO authenticated;
GRANT ALL ON public.analysis_units TO service_role;
ALTER TABLE public.analysis_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage units" ON public.analysis_units
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));