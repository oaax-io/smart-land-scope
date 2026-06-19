ALTER TABLE public.knowledge_entries
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.regulation_rules
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

COMMENT ON COLUMN public.knowledge_entries.verified IS 'true = von einem Menschen geprüft/bestätigt, false = nur KI-Extraktion, ungeprüft';
COMMENT ON COLUMN public.regulation_rules.verified IS 'true = von einem Menschen geprüft/bestätigt, false = nur KI-Extraktion, ungeprüft';