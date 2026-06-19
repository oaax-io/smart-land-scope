import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

type Organization = { id: string; name: string; slug: string };
type Subscription = {
  plan: "trial" | "starter" | "pro" | "enterprise";
  status: string;
  current_period_end: string | null;
};
type Role = "admin" | "owner" | "member";

type OrgContextValue = {
  currentOrgId: string | null;
  currentOrg: Organization | null;
  subscription: Subscription | null;
  role: Role | null;
  loading: boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["current-org", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("organization_id, organizations(id, name, slug)")
        .eq("id", user!.id)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) return { org: null, sub: null, role: null as Role | null };

      const orgId = profile.organization_id;
      const [{ data: sub }, { data: roleRow }] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("plan, status, current_period_end")
          .eq("organization_id", orgId)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user!.id)
          .eq("organization_id", orgId),
      ]);

      const rolesList = (roleRow ?? []) as { role: Role }[];
      const pickedRole: Role | null =
        rolesList.find((r) => r.role === "owner")?.role ??
        rolesList.find((r) => r.role === "admin")?.role ??
        rolesList[0]?.role ??
        null;

      return {
        org: (profile.organizations as unknown as Organization) ?? null,
        sub: (sub as Subscription) ?? null,
        role: pickedRole,
      };
    },
  });

  const value: OrgContextValue = {
    currentOrgId: data?.org?.id ?? null,
    currentOrg: data?.org ?? null,
    subscription: data?.sub ?? null,
    role: data?.role ?? null,
    loading: isLoading,
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside <OrgProvider>");
  return ctx;
}
