import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, MapPinned, FolderKanban, FileText, Users, Settings, Layers, BookOpen, Map as MapIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Analysen", url: "/analysen", icon: MapPinned },
  { title: "Karte", url: "/analysen/karte", icon: MapIcon },
  { title: "Wissensdatenbank", url: "/wissen", icon: BookOpen },
  { title: "Projekte", url: "/projekte", icon: FolderKanban },
  { title: "Berichte", url: "/berichte", icon: FileText },
  { title: "Einstellungen", url: "/einstellungen", icon: Settings },
] as const;

const adminItems = [
  { title: "Reglemente", url: "/admin/reglemente", icon: BookOpen },
  { title: "Team", url: "/admin/team", icon: Users },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Layers className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            SmarTerra
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const matches = pathname === item.url || pathname.startsWith(item.url + "/");
                const moreSpecific = items.some(
                  (o) => o.url !== item.url && o.url.startsWith(item.url + "/") && (pathname === o.url || pathname.startsWith(o.url + "/")),
                );
                const active = matches && !moreSpecific;
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
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
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
    </Sidebar>
  );
}
