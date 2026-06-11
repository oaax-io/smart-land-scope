
DROP POLICY IF EXISTS "Authenticated can create organizations" ON public.organizations;
CREATE POLICY "Users without org can create organization" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()));
