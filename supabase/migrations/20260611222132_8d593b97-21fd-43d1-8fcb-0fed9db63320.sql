
-- Add platform-wide admin role check (org-independent)
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Document type enum
DO $$ BEGIN
  CREATE TYPE public.regulation_doc_type AS ENUM (
    'BZR','BZO','Zonenplan','Gestaltungsplan','Sondervorschriften','Sonstige'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Cantons
CREATE TABLE public.cantons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cantons TO authenticated;
GRANT ALL ON public.cantons TO service_role;
ALTER TABLE public.cantons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cantons_read_all" ON public.cantons FOR SELECT TO authenticated USING (true);
CREATE POLICY "cantons_admin_write" ON public.cantons FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "cantons_admin_update" ON public.cantons FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "cantons_admin_delete" ON public.cantons FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE TRIGGER set_cantons_updated_at BEFORE UPDATE ON public.cantons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Municipalities
CREATE TABLE public.municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canton_id uuid NOT NULL REFERENCES public.cantons(id) ON DELETE CASCADE,
  name text NOT NULL,
  bfs_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canton_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.municipalities TO authenticated;
GRANT ALL ON public.municipalities TO service_role;
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "muni_read_all" ON public.municipalities FOR SELECT TO authenticated USING (true);
CREATE POLICY "muni_admin_write" ON public.municipalities FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "muni_admin_update" ON public.municipalities FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "muni_admin_delete" ON public.municipalities FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE TRIGGER set_muni_updated_at BEFORE UPDATE ON public.municipalities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_muni_canton ON public.municipalities(canton_id);

-- Regulation documents
CREATE TABLE public.regulation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  doc_type public.regulation_doc_type NOT NULL,
  title text NOT NULL,
  version text,
  valid_from date,
  file_path text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  notes text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regulation_documents TO authenticated;
GRANT ALL ON public.regulation_documents TO service_role;
ALTER TABLE public.regulation_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regdoc_read_all" ON public.regulation_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "regdoc_admin_write" ON public.regulation_documents FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "regdoc_admin_update" ON public.regulation_documents FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "regdoc_admin_delete" ON public.regulation_documents FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE TRIGGER set_regdoc_updated_at BEFORE UPDATE ON public.regulation_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_regdoc_muni ON public.regulation_documents(municipality_id);
CREATE INDEX idx_regdoc_type ON public.regulation_documents(doc_type);
