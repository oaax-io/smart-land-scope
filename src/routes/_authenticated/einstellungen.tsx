import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Building2, User as UserIcon, KeyRound, Upload, Loader2, Camera, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useOrg } from "@/hooks/use-org";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({ meta: [{ title: "Einstellungen — SmarTerra" }] }),
  component: EinstellungenPage,
});

function EinstellungenPage() {
  const { user } = useAuth();
  const { currentOrg, subscription } = useOrg();
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

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
    }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: firstName.trim() || null, last_name: lastName.trim() || null })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setProfileMsg({ type: "ok", text: "Profil gespeichert" });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => setProfileMsg({ type: "err", text: e.message }),
  });

  // Avatar
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profile?.avatar_url) { setAvatarUrl(null); return; }
      const { data } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_url, 3600);
      if (!cancelled) setAvatarUrl(data?.signedUrl ?? null);
    }
    load();
    return () => { cancelled = true; };
  }, [profile?.avatar_url]);

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Nicht angemeldet");
      if (!file.type.startsWith("image/")) throw new Error("Nur Bilder erlaubt");
      if (file.size > 3 * 1024 * 1024) throw new Error("Bild zu gross (max. 3 MB)");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setProfileMsg({ type: "ok", text: "Profilbild aktualisiert" });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => setProfileMsg({ type: "err", text: e.message }),
  });

  // Password
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const changePassword = useMutation({
    mutationFn: async () => {
      if (pw.length < 8) throw new Error("Passwort muss mindestens 8 Zeichen lang sein");
      if (pw !== pw2) throw new Error("Passwörter stimmen nicht überein");
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => {
      setPw(""); setPw2("");
      setPwMsg({ type: "ok", text: "Passwort wurde aktualisiert" });
    },
    onError: (e: Error) => setPwMsg({ type: "err", text: e.message }),
  });

  const sendReset = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("Keine E-Mail-Adresse hinterlegt");
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
    },
    onSuccess: () => setPwMsg({ type: "ok", text: "Reset-Link wurde an Ihre E-Mail gesendet" }),
    onError: (e: Error) => setPwMsg({ type: "err", text: e.message }),
  });

  const initials = ((firstName?.[0] ?? "") + (lastName?.[0] ?? "") || user?.email?.[0] || "U").toUpperCase();

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
          <CardDescription>Name und Profilbild</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Profilbild" />}
              <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar.mutate(f);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadAvatar.isPending}>
                {uploadAvatar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                Profilbild ändern
              </Button>
              <p className="text-xs text-muted-foreground">PNG oder JPG, max. 3 MB</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="first_name">Vorname</Label>
              <Input id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last_name">Nachname</Label>
              <Input id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>E-Mail</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>

          {profileMsg && (
            <Alert variant={profileMsg.type === "err" ? "destructive" : "default"}>
              {profileMsg.type === "err" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertDescription>{profileMsg.text}</AlertDescription>
            </Alert>
          )}

          <Button onClick={() => { setProfileMsg(null); saveProfile.mutate(); }} disabled={saveProfile.isPending}>
            {saveProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <KeyRound className="h-4 w-4 text-secondary" /> Passwort
          </CardTitle>
          <CardDescription>Passwort direkt ändern oder einen Reset-Link per E-Mail anfordern</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pw">Neues Passwort</Label>
              <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pw2">Bestätigen</Label>
              <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </div>
          </div>

          {pwMsg && (
            <Alert variant={pwMsg.type === "err" ? "destructive" : "default"}>
              {pwMsg.type === "err" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertDescription>{pwMsg.text}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setPwMsg(null); changePassword.mutate(); }} disabled={changePassword.isPending || !pw}>
              {changePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Passwort ändern
            </Button>
            <Button variant="outline" onClick={() => { setPwMsg(null); sendReset.mutate(); }} disabled={sendReset.isPending}>
              {sendReset.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Reset-Link per E-Mail
            </Button>
          </div>
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
            <Input defaultValue={currentOrg?.name ?? ""} disabled />
          </div>
          <div className="grid gap-2">
            <Label>Slug</Label>
            <Input value={currentOrg?.slug ?? ""} disabled />
          </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
