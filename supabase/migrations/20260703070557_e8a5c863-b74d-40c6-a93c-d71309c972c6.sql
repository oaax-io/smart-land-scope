
REVOKE EXECUTE ON FUNCTION public.snapshot_regulation_document(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_snapshot_regulation_document() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_regulation_document(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_snapshot_regulation_document() TO service_role;
