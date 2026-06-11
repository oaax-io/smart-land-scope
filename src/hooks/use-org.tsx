import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

type OrgMembership = {
  org_id: string;
  role: "admin" | "owner" | "member";
  organizations: { id: string; name: string; slug: string; plan: string; trial_ends_at: string | null };
};

type OrgContextValue = {
  currentOrgId: string | null;
  memberships: OrgMembership[];
  currentOrg: OrgMembership["organizations"] | null;
  setCurrentOrgId: (id: string) => void;
  loading: boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);
const STORAGE_KEY = "smarterra:active_org";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentOrgId, _setCurrentOrgId] = useState<string | null>(null);

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("org_id, role, organizations(id, name, slug, plan, trial_ends_at)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as OrgMembership[];
    },
  });

  useEffect(() => {
    if (memberships.length === 0) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const valid = memberships.find((m) => m.org_id === stored);
    _setCurrentOrgId(valid?.org_id ?? memberships[0].org_id);
  }, [memberships]);

  const setCurrentOrgId = (id: string) => {
    _setCurrentOrgId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  const currentOrg = memberships.find((m) => m.org_id === currentOrgId)?.organizations ?? null;

  return (
    <OrgContext.Provider value={{ currentOrgId, memberships, currentOrg, setCurrentOrgId, loading: isLoading }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside <OrgProvider>");
  return ctx;
}
