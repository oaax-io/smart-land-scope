import { useNavigate } from "@tanstack/react-router";
import { LogOut, User as UserIcon, Building2, MessageSquare, ShieldCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useOrg } from "@/hooks/use-org";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";

export function Topbar() {
  const { user } = useAuth();
  const { currentOrg, subscription } = useOrg();
  const { isAdmin } = usePlatformAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name,last_name,email,avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: avatarUrl } = useQuery({
    queryKey: ["avatar-url", profile?.avatar_url],
    enabled: !!profile?.avatar_url,
    queryFn: async () => {
      const { data } = await supabase.storage.from("avatars").createSignedUrl(profile!.avatar_url!, 3600);
      return data?.signedUrl ?? null;
    },
  });

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  const displayName = fullName || user?.email || "Benutzer";
  const initial = (fullName ? fullName[0] : user?.email?.[0] ?? "U").toUpperCase();


  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const trialDaysLeft = subscription?.current_period_end
    ? Math.max(0, Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[200px] truncate font-medium">{currentOrg?.name ?? "Organisation"}</span>
        </div>

        {subscription?.plan === "trial" && trialDaysLeft !== null && (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Trial · noch {trialDaysLeft} {trialDaysLeft === 1 ? "Tag" : "Tage"}
          </Badge>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
            </div>
            <span className="hidden max-w-[160px] truncate text-sm sm:inline">{displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate">{displayName}</span>
            {fullName && user?.email && (
              <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/einstellungen" })}>
            <UserIcon className="mr-2 h-4 w-4" />
            Profil & Einstellungen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/feedback" })}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Feedback
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => navigate({ to: "/platform" })}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Plattform-Admin
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
