CREATE TABLE IF NOT EXISTS public.analysis_wirtschaft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kosten_oberirdisch_pro_m3 numeric NOT NULL DEFAULT 950,
  kosten_ug_pro_m3 numeric NOT NULL DEFAULT 550,
  sia_honorare_min numeric NOT NULL DEFAULT 12,
  sia_honorare_max numeric NOT NULL DEFAULT 15,
  bkp5_min numeric NOT NULL DEFAULT 3,
  bkp5_max numeric NOT NULL DEFAULT 5,
  bkp6_min numeric NOT NULL DEFAULT 5,
  bkp6_max numeric NOT NULL DEFAULT 8,
  nwf_faktor numeric NOT NULL DEFAULT 0.65,
  marktpreis_pro_m2 numeric NOT NULL DEFAULT 8500,
  parzellenpreis numeric,
  slider_bandbreite numeric NOT NULL DEFAULT 20,
  risikoabschlag_prozent numeric NOT NULL DEFAULT 15,
  aussenflaeche_m2 numeric NOT NULL DEFAULT 0,
  aussenflaeche_anrechnungsfaktor numeric NOT NULL DEFAULT 0.35,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(analysis_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_wirtschaft TO authenticated;
GRANT ALL ON public.analysis_wirtschaft TO service_role;

ALTER TABLE public.analysis_wirtschaft ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage wirtschaft" ON public.analysis_wirtschaft
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER set_analysis_wirtschaft_updated_at
  BEFORE UPDATE ON public.analysis_wirtschaft
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();