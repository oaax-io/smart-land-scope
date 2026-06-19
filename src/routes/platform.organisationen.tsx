import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2 } from "lucide-react";
import { listAllOrganizations } from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/platform/organisationen")({
  head: () => ({ meta: [{ title: "Organisationen — Plattform" }] }),
  component: OrgsPage,
});

function OrgsPage() {
  const fn = useServerFn(listAllOrganizations);
  const { data: orgs = [], isLoading } = useQuery({ queryKey: ["platform-orgs"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Organisationen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Alle Kunden­organisationen auf der Plattform.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Building2 className="h-4 w-4 text-secondary" />
            {orgs.length} Organisationen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Organisationen.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Mitglieder</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{o.slug}</TableCell>
                    <TableCell>{o.member_count}</TableCell>
                    <TableCell>{o.plan ? <Badge variant="secondary" className="capitalize">{o.plan}</Badge> : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.status ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("de-CH")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
