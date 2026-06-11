import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Building2, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useOrg } from "@/hooks/use-org";

export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({ meta: [{ title: "Einstellungen — SmarTerra" }] }),
  component: EinstellungenPage,
});

function EinstellungenPage() {
  const { user } = useAuth();
  const { currentOrg, subscription } = useOrg();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profil, Organisation und Abo verwalten.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <UserIcon className="h-4 w-4 text-secondary" /> Profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>E-Mail</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input defaultValue={(user?.user_metadata?.full_name as string) ?? ""} />
          </div>
          <Button>Speichern</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Building2 className="h-4 w-4 text-secondary" /> Organisation
          </CardTitle>
          <CardDescription>{currentOrg?.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Name der Organisation</Label>
            <Input defaultValue={currentOrg?.name ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label>Slug</Label>
            <Input value={currentOrg?.slug ?? ""} disabled />
          </div>
          <Button>Speichern</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <CreditCard className="h-4 w-4 text-secondary" /> Abonnement
          </CardTitle>
          <CardDescription>Plan, Trial und Abrechnung</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Aktueller Plan</p>
              <p className="text-xs text-muted-foreground capitalize">{subscription?.plan ?? "trial"}</p>
            </div>
            <Badge variant="secondary">Trial aktiv</Badge>
          </div>
          <Button disabled className="w-full sm:w-auto">
            Upgrade — bald verfügbar
          </Button>
          <p className="text-xs text-muted-foreground">
            Die Zahlungsabwicklung über Stripe wird mit dem nächsten Release aktiviert.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
