-- Rewrite is_platform_admin to check the dedicated platform_admin role
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'platform_admin'
  )
$$;

-- Grant platform_admin to existing super-admins (per-org row reuses their current org for FK satisfaction)
INSERT INTO public.user_roles (user_id, organization_id, role)
SELECT p.id, p.organization_id, 'platform_admin'::public.app_role
FROM public.profiles p
WHERE p.email IN ('bilel.chagra@oaase.com', 'ki@ip3.ch')
  AND p.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id, role) DO NOTHING;