ALTER TABLE public.analysis_wirtschaft
  ADD COLUMN IF NOT EXISTS kennwert_inkl_honorare boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bkp1_pct numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS abbruch_m3 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS abbruch_pro_m3 numeric NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS umgebung_pro_m2 numeric NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS parkplaetze integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preis_pro_parkplatz numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entwicklergewinn_pct numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS vermarktung_pct numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS finanzierung_pct numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS grundstuecks_nebenkosten_pct numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS sicherheitsabschlag_pct numeric NOT NULL DEFAULT 0;

UPDATE public.analysis_wirtschaft SET sicherheitsabschlag_pct = 0 WHERE sicherheitsabschlag_pct IS DISTINCT FROM 0;

COMMENT ON COLUMN public.analysis_wirtschaft.risikoabschlag_prozent IS 'DEPRECATED: replaced by entwicklergewinn_pct / sicherheitsabschlag_pct (wirtschaft-engine)';