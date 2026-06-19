import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export function usePlatformAdmin() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["platform-admin", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc("is_platform_admin", { _user_id: user.id });
      if (error) return false;
      return Boolean(data);
    },
  });
  return { isAdmin: Boolean(data), loading: isLoading };
}
