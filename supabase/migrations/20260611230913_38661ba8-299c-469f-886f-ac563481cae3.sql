
-- Add active flag to regulation_documents
ALTER TABLE public.regulation_documents
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- regulation_rules
CREATE TABLE public.regulation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  zone text,
  rule_type text NOT NULL,
  title text NOT NULL,
  description text,
  source_document uuid REFERENCES public.regulation_documents(id) ON DELETE SET NULL,
  article_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_regrules_muni ON public.regulation_rules(municipality_id);
CREATE INDEX idx_regrules_zone ON public.regulation_rules(zone);
CREATE INDEX idx_regrules_type ON public.regulation_rules(rule_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regulation_rules TO authenticated;
GRANT ALL ON public.regulation_rules TO service_role;

ALTER TABLE public.regulation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regrules_read_all" ON public.regulation_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "regrules_admin_insert" ON public.regulation_rules
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "regrules_admin_update" ON public.regulation_rules
  FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "regrules_admin_delete" ON public.regulation_rules
  FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER set_regrules_updated_at
  BEFORE UPDATE ON public.regulation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- knowledge_entries
CREATE TABLE public.knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  category text NOT NULL,
  key text NOT NULL,
  value text,
  source_document uuid REFERENCES public.regulation_documents(id) ON DELETE SET NULL,
  source_article text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_knowledge_muni ON public.knowledge_entries(municipality_id);
CREATE INDEX idx_knowledge_category ON public.knowledge_entries(category);
CREATE UNIQUE INDEX idx_knowledge_unique ON public.knowledge_entries(municipality_id, category, key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_entries TO authenticated;
GRANT ALL ON public.knowledge_entries TO service_role;

ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_read_all" ON public.knowledge_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "knowledge_admin_insert" ON public.knowledge_entries
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "knowledge_admin_update" ON public.knowledge_entries
  FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "knowledge_admin_delete" ON public.knowledge_entries
  FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER set_knowledge_updated_at
  BEFORE UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
