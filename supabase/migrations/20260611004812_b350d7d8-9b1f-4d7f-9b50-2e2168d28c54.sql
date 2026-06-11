
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS status analysis_status NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS postal_code TEXT;
