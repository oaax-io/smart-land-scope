REVOKE ALL ON FUNCTION public.tick_lu_fill_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tick_lu_fill_job() TO postgres, service_role;