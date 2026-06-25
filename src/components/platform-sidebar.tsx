import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldCheck, Building2, Users, BookOpen, LayoutDashboard, ArrowLeft, MessageSquare, Map } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items: { title: string; url: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { title: "Übersicht", url: "/platform", icon: LayoutDashboard, exact: true },
  { title: "Organisationen", url: "/platform/organisationen", icon: Building2 },
  { title: "Benutzer", url: "/platform/benutzer", icon: Users },
  { title: "Reglemente", url: "/platform/reglemente", icon: BookOpen },
  { title: "Regionen", url: "/platform/regionen", icon: Map },
  { title: "Feedback", url: "/feedback", icon: MessageSquare },
];

export function PlatformSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/platform" className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-destructive text-destructive-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            Plattform-Admin
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Verwaltung</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.exact
                  ? pathname === item.url
                  : pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Zurück zur App">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                <span>Zurück zur App</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
