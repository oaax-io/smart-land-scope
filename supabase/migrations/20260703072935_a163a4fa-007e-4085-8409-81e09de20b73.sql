
CREATE TABLE public.zone_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  zone_code text NOT NULL,
  canton_code text NOT NULL DEFAULT 'LU',
  setback_small_m numeric,
  setback_large_m numeric,
  setback_building_m numeric,
  setback_road_main_m numeric,
  setback_road_local_m numeric,
  parking_rate text,
  attic_counted boolean,
  basement_counted boolean,
  source text NOT NULL DEFAULT 'community',
  source_article text,
  contributed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX zone_regulations_muni_zone_idx
  ON public.zone_regulations (municipality_id, zone_code);

GRANT SELECT, INSERT ON public.zone_regulations TO authenticated;
GRANT ALL ON public.zone_regulations TO service_role;

ALTER TABLE public.zone_regulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read zone_regulations"
  ON public.zone_regulations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert zone_regulations"
  ON public.zone_regulations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = contributed_by);

CREATE POLICY "Platform admins can manage zone_regulations"
  ON public.zone_regulations
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER zone_regulations_set_updated_at
  BEFORE UPDATE ON public.zone_regulations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
