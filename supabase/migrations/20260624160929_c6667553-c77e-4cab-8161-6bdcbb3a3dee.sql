ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS detected_zone TEXT;
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS zone_override TEXT;