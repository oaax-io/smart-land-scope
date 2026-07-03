
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS detected_zone_precise text,
  ADD COLUMN IF NOT EXISTS detected_zone_source text,
  ADD COLUMN IF NOT EXISTS regulation_basis text NOT NULL DEFAULT 'current';

ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS regulation_comparison jsonb;
