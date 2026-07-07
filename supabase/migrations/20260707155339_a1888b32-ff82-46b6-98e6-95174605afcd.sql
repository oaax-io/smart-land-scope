CREATE OR REPLACE FUNCTION public.tick_lu_fill_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url   text := 'https://project--8a88ec10-f9a8-4365-bc56-8862a07ada3d.lovable.app/api/public/hooks/lu-fill-tick';
  v_token text := current_setting('app.cron_secret', true);
  v_has_job boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.background_jobs
    WHERE job_type = 'lu_fill' AND status IN ('queued','running')
  ) INTO v_has_job;
  IF NOT v_has_job THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_token, '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tick_lu_fill_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tick_lu_fill_job() TO postgres, service_role;