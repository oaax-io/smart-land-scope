ALTER TABLE public.lu_bzr_import_log
  ADD COLUMN IF NOT EXISTS content_length bigint,
  ADD COLUMN IF NOT EXISTS etag text,
  ADD COLUMN IF NOT EXISTS last_checked timestamptz;