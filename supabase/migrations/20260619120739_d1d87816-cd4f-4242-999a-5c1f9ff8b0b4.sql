
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS postal_code   TEXT,
  ADD COLUMN IF NOT EXISTS city          TEXT,
  ADD COLUMN IF NOT EXISTS country       TEXT,
  ADD COLUMN IF NOT EXISTS phone         TEXT,
  ADD COLUMN IF NOT EXISTS email         TEXT,
  ADD COLUMN IF NOT EXISTS website       TEXT,
  ADD COLUMN IF NOT EXISTS vat_number    TEXT,
  ADD COLUMN IF NOT EXISTS contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;
CREATE POLICY "Owners and admins can update their organization"
  ON public.organizations
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), id, 'owner'::app_role)
    OR public.has_role(auth.uid(), id, 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), id, 'owner'::app_role)
    OR public.has_role(auth.uid(), id, 'admin'::app_role)
  );
