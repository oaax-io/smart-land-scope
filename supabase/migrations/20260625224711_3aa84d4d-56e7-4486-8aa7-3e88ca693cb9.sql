
-- 1) Aktiv-Flag für Kantone und Gemeinden
ALTER TABLE public.cantons ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.municipalities ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_cantons_active ON public.cantons(active);
CREATE INDEX IF NOT EXISTS idx_municipalities_active ON public.municipalities(active);

-- 2) Background-Jobs für die LU-Befüllung (und künftige Massen-Jobs)
CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',   -- queued | running | completed | failed | cancelled
  scope jsonb NOT NULL DEFAULT '{}'::jsonb, -- z.B. {"canton":"LU"}
  total int NOT NULL DEFAULT 0,
  done int NOT NULL DEFAULT 0,
  ok int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  current_label text,
  last_error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.background_jobs TO authenticated;
GRANT ALL ON public.background_jobs TO service_role;

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage background jobs"
ON public.background_jobs FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_background_jobs_updated_at
BEFORE UPDATE ON public.background_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON public.background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type_status ON public.background_jobs(job_type, status);

-- 3) Extensions für den Cron-Tick
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
