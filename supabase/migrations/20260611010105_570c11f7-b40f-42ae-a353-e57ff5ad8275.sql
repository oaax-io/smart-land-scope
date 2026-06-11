
-- Potential-Level Enum
DO $$ BEGIN
  CREATE TYPE public.potential_level AS ENUM ('low','medium','high','very_high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS floor_area NUMERIC,
  ADD COLUMN IF NOT EXISTS living_area NUMERIC,
  ADD COLUMN IF NOT EXISTS unit_count INTEGER,
  ADD COLUMN IF NOT EXISTS potential_level public.potential_level,
  ADD COLUMN IF NOT EXISTS risks JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS feasibility TEXT,
  ADD COLUMN IF NOT EXISTS document_path TEXT,
  ADD COLUMN IF NOT EXISTS document_name TEXT,
  ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- Storage RLS für analysis-documents Bucket (Bucket selbst wird via Tool angelegt)
DO $$ BEGIN
  CREATE POLICY "org members read analysis docs"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'analysis-documents'
      AND public.is_org_member(auth.uid(), (split_part(name, '/', 1))::uuid)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "org members upload analysis docs"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'analysis-documents'
      AND public.is_org_member(auth.uid(), (split_part(name, '/', 1))::uuid)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "org members delete analysis docs"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'analysis-documents'
      AND public.is_org_member(auth.uid(), (split_part(name, '/', 1))::uuid)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
