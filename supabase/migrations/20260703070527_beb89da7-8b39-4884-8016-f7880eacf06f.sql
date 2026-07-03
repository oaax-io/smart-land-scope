
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS regulation_comparison jsonb;

CREATE TABLE IF NOT EXISTS public.regulation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  document_id uuid,
  document_title text,
  document_version text,
  document_valid_from date,
  archived_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'deactivated',
  knowledge_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  regulation_rules jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_regsnap_muni ON public.regulation_snapshots(municipality_id);
CREATE INDEX IF NOT EXISTS idx_regsnap_archived_at ON public.regulation_snapshots(archived_at DESC);

GRANT SELECT ON public.regulation_snapshots TO authenticated;
GRANT ALL ON public.regulation_snapshots TO service_role;
ALTER TABLE public.regulation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regsnap_read_all" ON public.regulation_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "regsnap_admin_write" ON public.regulation_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.snapshot_regulation_document(p_doc_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc regulation_documents%ROWTYPE;
  v_entries jsonb;
  v_rules jsonb;
BEGIN
  SELECT * INTO v_doc FROM regulation_documents WHERE id = p_doc_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(k) - 'municipality_id' - 'source_document'), '[]'::jsonb)
    INTO v_entries
    FROM knowledge_entries k
    WHERE k.source_document = p_doc_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) - 'municipality_id' - 'source_document'), '[]'::jsonb)
    INTO v_rules
    FROM regulation_rules r
    WHERE r.source_document = p_doc_id;

  IF jsonb_array_length(v_entries) = 0 AND jsonb_array_length(v_rules) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO regulation_snapshots(
    municipality_id, document_id, document_title, document_version,
    document_valid_from, reason, knowledge_entries, regulation_rules
  ) VALUES (
    v_doc.municipality_id, v_doc.id, v_doc.title, v_doc.version,
    v_doc.valid_from, COALESCE(p_reason, 'deactivated'), v_entries, v_rules
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_snapshot_regulation_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.active = true AND NEW.active = false THEN
    PERFORM public.snapshot_regulation_document(OLD.id, 'deactivated');
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.snapshot_regulation_document(OLD.id, 'deleted');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS regdoc_snapshot ON public.regulation_documents;
CREATE TRIGGER regdoc_snapshot
  BEFORE UPDATE OR DELETE ON public.regulation_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_snapshot_regulation_document();

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT d.id FROM regulation_documents d
    LEFT JOIN regulation_snapshots s ON s.document_id = d.id
    WHERE d.active = false AND s.id IS NULL
  LOOP
    PERFORM public.snapshot_regulation_document(r.id, 'backfill');
  END LOOP;
END $$;
