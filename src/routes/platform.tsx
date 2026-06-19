import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PlatformSidebar } from "@/components/platform-sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/platform")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: data.user.id });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
    return { user: data.user };
  },
  component: PlatformLayout,
});

function PlatformLayout() {
  return (
    <SidebarProvider>
      <PlatformSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
          <SidebarTrigger />
          <Badge variant="destructive" className="uppercase tracking-wide">Platform</Badge>
          <span className="text-sm text-muted-foreground">Organisationsübergreifende Verwaltung</span>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
