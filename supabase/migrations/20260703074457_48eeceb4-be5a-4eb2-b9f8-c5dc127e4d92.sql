CREATE TABLE IF NOT EXISTS public.lu_bzr_import_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gemeinde text NOT NULL,
  bfs_nr integer NOT NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  document_id uuid REFERENCES public.regulation_documents(id) ON DELETE SET NULL,
  error_message text,
  last_attempt timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lu_bzr_import_log_bfs_nr_unique UNIQUE (bfs_nr),
  CONSTRAINT lu_bzr_import_log_status_chk CHECK (status IN ('pending','downloaded','extracted','failed','unavailable'))
);

GRANT SELECT ON public.lu_bzr_import_log TO authenticated;
GRANT ALL ON public.lu_bzr_import_log TO service_role;

ALTER TABLE public.lu_bzr_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view LU import log"
  ON public.lu_bzr_import_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER lu_bzr_import_log_updated_at
  BEFORE UPDATE ON public.lu_bzr_import_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();