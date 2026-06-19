import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";
import { listAllUsers } from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/platform/benutzer")({
  head: () => ({ meta: [{ title: "Benutzer — Plattform" }] }),
  component: UsersPage,
});

function UsersPage() {
  const fn = useServerFn(listAllUsers);
  const { data: users = [], isLoading } = useQuery({ queryKey: ["platform-users"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Benutzer</h1>
        <p className="mt-1 text-sm text-muted-foreground">Alle Benutzer aller Organisationen (max. 500).</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Users className="h-4 w-4 text-secondary" />
            {users.length} Benutzer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Benutzer.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Rollen</TableHead>
                  <TableHead>Erstellt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell className="text-sm">{u.organization_name ?? "—"}</TableCell>
                      <TableCell className="space-x-1">
                        {u.roles.length === 0
                          ? <span className="text-xs text-muted-foreground">—</span>
                          : u.roles.map((r) => (
                              <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>
                            ))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("de-CH")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
