ALTER TABLE public.background_jobs
  ADD COLUMN IF NOT EXISTS errors jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.tick_lu_fill_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url   text := current_setting('app.cron_base_url', true);
  v_token text := current_setting('app.cron_secret', true);
  v_has_job boolean;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN
    RAISE NOTICE 'app.cron_base_url not set; skipping LU tick';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.background_jobs
    WHERE job_type = 'lu_fill' AND status IN ('queued','running')
  ) INTO v_has_job;
  IF NOT v_has_job THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/api/cron/lu-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_token, '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('lu_fill_tick');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'lu_fill_tick',
  '* * * * *',
  $$SELECT public.tick_lu_fill_job();$$
);