import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Users, UserPlus, Copy, RefreshCw, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrg } from "@/hooks/use-org";
import { supabase } from "@/integrations/supabase/client";
import { createOrgUser } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/team")({
  head: () => ({ meta: [{ title: "Team — SmarTerra" }] }),
  component: TeamPage,
});

type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at: string;
  role: "admin" | "owner" | "member" | null;
};

function generatePassword(length = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

function TeamPage() {
  const { currentOrgId, role } = useOrg();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const canManage = role === "admin" || role === "owner";

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["org-members", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, created_at")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("organization_id", currentOrgId!);

      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as Member["role"]]));
      return (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null }));
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">Verwalten Sie Mitglieder, Rollen und Zugänge.</p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Benutzer erstellen
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Users className="h-4 w-4 text-secondary" />
            Mitglieder
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Mitglieder gefunden.</p>
          ) : (
            <div className="divide-y">
              {members.map((m) => {
                const name = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
                const initials = (m.first_name?.[0] ?? m.email[0] ?? "U").toUpperCase();
                return (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary/15 text-secondary text-sm font-semibold">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.email} · Beigetreten {new Date(m.created_at).toLocaleDateString("de-CH")}
                        </p>
                      </div>
                    </div>
                    {m.role && (
                      <Badge variant={m.role === "owner" ? "default" : "secondary"} className="capitalize">
                        {m.role}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["org-members", currentOrgId] })}
      />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const createFn = useServerFn(createOrgUser);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [userRole, setUserRole] = useState<"admin" | "member">("member");
  const [copied, setCopied] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createFn({
        data: { email, first_name: firstName, last_name: lastName, password, role: userRole },
      }),
    onSuccess: () => {
      toast.success("Benutzer erstellt");
      setCreatedInfo({ email, password });
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword(generatePassword());
    setUserRole("member");
    setCreatedInfo(null);
    setCopied(false);
  }

  async function copyCreds() {
    if (!createdInfo) return;
    await navigator.clipboard.writeText(`E-Mail: ${createdInfo.email}\nPasswort: ${createdInfo.password}`);
    setCopied(true);
    toast.success("Zugangsdaten kopiert");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
          <DialogDescription>
            Der Benutzer wird sofort aktiviert und Ihrer Organisation zugeordnet.
          </DialogDescription>
        </DialogHeader>

        {createdInfo ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">E-Mail: </span>
                <span className="font-mono">{createdInfo.email}</span>
              </p>
              <p className="mt-1">
                <span className="text-muted-foreground">Passwort: </span>
                <span className="font-mono">{createdInfo.password}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Notieren Sie das Passwort jetzt — es wird nicht mehr angezeigt.
            </p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={copyCreds}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                Kopieren
              </Button>
              <Button onClick={() => { onOpenChange(false); reset(); }}>Fertig</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fn">Vorname</Label>
                <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ln">Name</Label>
                <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="em">E-Mail</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Passwort</Label>
              <div className="flex gap-2">
                <Input id="pw" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" required minLength={8} />
                <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} title="Neu generieren">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(password);
                    toast.success("Passwort kopiert");
                  }}
                  title="Kopieren"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={userRole} onValueChange={(v) => setUserRole(v as "admin" | "member")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Erstellen
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
