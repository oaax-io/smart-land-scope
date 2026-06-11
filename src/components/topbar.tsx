import { useNavigate } from "@tanstack/react-router";
import { LogOut, User as UserIcon, Building2, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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

export function Topbar() {
  const { user } = useAuth();
  const { memberships, currentOrg, currentOrgId, setCurrentOrgId } = useOrg();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const trialDaysLeft = currentOrg?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(currentOrg.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="max-w-[180px] truncate">{currentOrg?.name ?? "Organisation"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Organisationen</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {memberships.map((m) => (
              <DropdownMenuItem key={m.org_id} onClick={() => setCurrentOrgId(m.org_id)} className="gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{m.organizations.name}</span>
                {m.org_id === currentOrgId && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {currentOrg?.plan === "trial" && trialDaysLeft !== null && (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Trial · noch {trialDaysLeft} {trialDaysLeft === 1 ? "Tag" : "Tage"}
          </Badge>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
              {(user?.email?.[0] ?? "U").toUpperCase()}
            </div>
            <span className="hidden max-w-[160px] truncate text-sm sm:inline">{user?.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/einstellungen" })}>
            <UserIcon className="mr-2 h-4 w-4" />
            Profil & Einstellungen
          </DropdownMenuItem>
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
