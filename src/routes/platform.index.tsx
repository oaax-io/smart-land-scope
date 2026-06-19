import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, BookOpen, MessageSquare } from "lucide-react";
import { getPlatformStats } from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/platform/")({
  head: () => ({ meta: [{ title: "Plattform — SmarTerra" }] }),
  component: PlatformIndex,
});

function PlatformIndex() {
  const fn = useServerFn(getPlatformStats);
  const { data } = useQuery({ queryKey: ["platform-stats"], queryFn: () => fn() });

  const stats = [
    { label: "Organisationen", value: data?.organizations ?? "—", icon: Building2 },
    { label: "Benutzer", value: data?.users ?? "—", icon: Users },
    { label: "Reglemente", value: data?.regulations ?? "—", icon: BookOpen },
    { label: "Feedback", value: data?.feedback ?? "—", icon: MessageSquare },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Plattform-Übersicht</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verwalten Sie alle Organisationen, Benutzer und plattformweiten Daten.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
