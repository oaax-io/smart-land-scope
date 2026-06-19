ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS egrid text,
  ADD COLUMN IF NOT EXISTS parcel_geometry jsonb;