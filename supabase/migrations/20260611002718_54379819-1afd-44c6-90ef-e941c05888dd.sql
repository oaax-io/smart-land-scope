
-- ============ Enums ============
CREATE TYPE public.app_role AS ENUM ('admin', 'owner', 'member');
CREATE TYPE public.subscription_plan AS ENUM ('trial', 'free', 'starter', 'pro', 'enterprise');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
CREATE TYPE public.analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.project_status AS ENUM ('draft', 'active', 'on_hold', 'completed', 'archived');

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ organizations ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan public.subscription_plan NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
  stripe_customer_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ organization_members ============
CREATE TABLE public.organization_members (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);

-- ============ has_role security definer (no recursion) ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _org_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id
  )
$$;

-- Policies for organizations
CREATE POLICY "members can view their orgs" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "owners can update org" ON public.organizations
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), id, 'owner'));
CREATE POLICY "authenticated can create org" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Policies for organization_members
CREATE POLICY "members can view memberships of their orgs" ON public.organization_members
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "owners can manage memberships" ON public.organization_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'owner'))
  WITH CHECK (public.has_role(auth.uid(), org_id, 'owner'));
CREATE POLICY "user can insert own membership" ON public.organization_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  default_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ Auto-create profile + default org on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
BEGIN
  org_slug := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), '[^a-z0-9]+', '-', 'g'))
              || '-' || substr(NEW.id::text, 1, 8);

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (
    coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
    org_slug,
    NEW.id
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, full_name, default_org_id)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', new_org_id);

  INSERT INTO public.organization_members (org_id, user_id, role, joined_at)
  VALUES (new_org_id, NEW.id, 'owner', now());

  INSERT INTO public.subscriptions (org_id, plan, status, current_period_end)
  VALUES (new_org_id, 'trial', 'trialing', now() + INTERVAL '14 days');

  RETURN NEW;
END; $$;

-- ============ teams ============
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "members access teams in their orgs" ON public.teams
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE TABLE public.team_members (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members visible to org members" ON public.team_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.is_org_member(auth.uid(), t.org_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.is_org_member(auth.uid(), t.org_id)));

-- ============ projects ============
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status public.project_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_projects_org ON public.projects(org_id);
CREATE POLICY "members access projects in their orgs" ON public.projects
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- ============ parcels ============
CREATE TABLE public.parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  address TEXT,
  parcel_number TEXT,
  canton TEXT,
  municipality TEXT,
  egrid TEXT,
  lat NUMERIC,
  lng NUMERIC,
  area_m2 NUMERIC,
  zone_code TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcels TO authenticated;
GRANT ALL ON public.parcels TO service_role;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_parcels_updated BEFORE UPDATE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_parcels_org ON public.parcels(org_id);
CREATE POLICY "members access parcels in their orgs" ON public.parcels
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- ============ analyses ============
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parcel_id UUID REFERENCES public.parcels(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status public.analysis_status NOT NULL DEFAULT 'pending',
  ausnuetzungsziffer NUMERIC,
  geschossigkeit INTEGER,
  gebaeudehoehe_m NUMERIC,
  nutzungsmoeglichkeiten JSONB DEFAULT '[]'::jsonb,
  einschraenkungen JSONB DEFAULT '[]'::jsonb,
  entwicklungspotenzial JSONB DEFAULT '{}'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO authenticated;
GRANT ALL ON public.analyses TO service_role;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_analyses_updated BEFORE UPDATE ON public.analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_analyses_org ON public.analyses(org_id);
CREATE INDEX idx_analyses_parcel ON public.analyses(parcel_id);
CREATE POLICY "members access analyses in their orgs" ON public.analyses
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- ============ favorites ============
CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, analysis_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own favorites" ON public.favorites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.is_org_member(auth.uid(), org_id));

-- ============ reports ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "members access reports in their orgs" ON public.reports
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- ============ subscriptions (Stripe-ready) ============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'trial',
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  current_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "members view subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "owners manage subscription" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'owner'))
  WITH CHECK (public.has_role(auth.uid(), org_id, 'owner'));

-- ============ invitations ============
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'owner'))
  WITH CHECK (public.has_role(auth.uid(), org_id, 'owner'));

-- ============ audit_log ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners view audit" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), org_id, 'owner'));
CREATE POLICY "members insert audit" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- ============ Signup trigger ============
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
