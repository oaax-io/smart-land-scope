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

      <OrganizationCard />


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

type OrgForm = {
  name: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  vat_number: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
};

const EMPTY_ORG: OrgForm = {
  name: "", address_line1: "", address_line2: "", postal_code: "", city: "", country: "",
  phone: "", email: "", website: "", vat_number: "",
  contact_name: "", contact_email: "", contact_phone: "",
};

function OrganizationCard() {
  const { user } = useAuth();
  const { currentOrgId, currentOrg } = useOrg();
  const queryClient = useQueryClient();

  const { data: org } = useQuery({
    queryKey: ["organization-detail", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id,name,slug,address_line1,address_line2,postal_code,city,country,phone,email,website,vat_number,contact_name,contact_email,contact_phone")
        .eq("id", currentOrgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: canEdit } = useQuery({
    queryKey: ["org-can-edit", currentOrgId, user?.id],
    enabled: !!currentOrgId && !!user?.id,
    queryFn: async () => {
      const [{ data: isOwner }, { data: isAdmin }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user!.id, _org_id: currentOrgId!, _role: "owner" }),
        supabase.rpc("has_role", { _user_id: user!.id, _org_id: currentOrgId!, _role: "admin" }),
      ]);
      return Boolean(isOwner) || Boolean(isAdmin);
    },
  });

  const [form, setForm] = useState<OrgForm>(EMPTY_ORG);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name ?? "",
        address_line1: org.address_line1 ?? "",
        address_line2: org.address_line2 ?? "",
        postal_code: org.postal_code ?? "",
        city: org.city ?? "",
        country: org.country ?? "",
        phone: org.phone ?? "",
        email: org.email ?? "",
        website: org.website ?? "",
        vat_number: org.vat_number ?? "",
        contact_name: org.contact_name ?? "",
        contact_email: org.contact_email ?? "",
        contact_phone: org.contact_phone ?? "",
      });
    }
  }, [org]);

  const save = useMutation({
    mutationFn: async () => {
      if (!currentOrgId) throw new Error("Keine Organisation aktiv");
      if (!form.name.trim()) throw new Error("Name darf nicht leer sein");
      const t = (s: string) => (s.trim() ? s.trim() : null);
      const { error } = await supabase
        .from("organizations")
        .update({
          name: form.name.trim(),
          address_line1: t(form.address_line1),
          address_line2: t(form.address_line2),
          postal_code: t(form.postal_code),
          city: t(form.city),
          country: t(form.country),
          phone: t(form.phone),
          email: t(form.email),
          website: t(form.website),
          vat_number: t(form.vat_number),
          contact_name: t(form.contact_name),
          contact_email: t(form.contact_email),
          contact_phone: t(form.contact_phone),
        })
        .eq("id", currentOrgId);
      if (error) throw error;


    },
    onSuccess: () => {
      setMsg({ type: "ok", text: "Organisation aktualisiert" });
      queryClient.invalidateQueries({ queryKey: ["organization-detail", currentOrgId] });
      queryClient.invalidateQueries({ queryKey: ["org"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => setMsg({ type: "err", text: e.message }),
  });

  const disabled = !canEdit;
  const set = <K extends keyof OrgForm>(k: K) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Building2 className="h-4 w-4 text-secondary" /> Organisation
        </CardTitle>
        <CardDescription>
          {currentOrg?.name}
          {!canEdit && " — nur Besitzer und Administratoren können diese Angaben bearbeiten"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="org_name">Name der Organisation</Label>
            <Input id="org_name" value={form.name} onChange={set("name")} disabled={disabled} />
          </div>
          <div className="grid gap-2">
            <Label>Slug</Label>
            <Input value={currentOrg?.slug ?? ""} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="org_vat">MwSt-Nummer / UID</Label>
            <Input id="org_vat" value={form.vat_number} onChange={set("vat_number")} disabled={disabled} placeholder="CHE-123.456.789" />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Firmenadresse</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="org_a1">Strasse und Hausnummer</Label>
              <Input id="org_a1" value={form.address_line1} onChange={set("address_line1")} disabled={disabled} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="org_a2">Adresszusatz</Label>
              <Input id="org_a2" value={form.address_line2} onChange={set("address_line2")} disabled={disabled} placeholder="c/o, Stockwerk, Postfach …" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org_plz">PLZ</Label>
              <Input id="org_plz" value={form.postal_code} onChange={set("postal_code")} disabled={disabled} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org_city">Ort</Label>
              <Input id="org_city" value={form.city} onChange={set("city")} disabled={disabled} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="org_country">Land</Label>
              <Input id="org_country" value={form.country} onChange={set("country")} disabled={disabled} placeholder="Schweiz" />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Kontakt</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="org_phone">Telefon</Label>
              <Input id="org_phone" type="tel" value={form.phone} onChange={set("phone")} disabled={disabled} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org_email">E-Mail</Label>
              <Input id="org_email" type="email" value={form.email} onChange={set("email")} disabled={disabled} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="org_web">Webseite</Label>
              <Input id="org_web" type="url" value={form.website} onChange={set("website")} disabled={disabled} placeholder="https://" />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Ansprechperson</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="org_cname">Name</Label>
              <Input id="org_cname" value={form.contact_name} onChange={set("contact_name")} disabled={disabled} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org_cmail">E-Mail</Label>
              <Input id="org_cmail" type="email" value={form.contact_email} onChange={set("contact_email")} disabled={disabled} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org_cphone">Telefon</Label>
              <Input id="org_cphone" type="tel" value={form.contact_phone} onChange={set("contact_phone")} disabled={disabled} />
            </div>
          </div>
        </div>

        {msg && (
          <Alert variant={msg.type === "err" ? "destructive" : "default"}>
            {msg.type === "err" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        )}

        <Button onClick={() => { setMsg(null); save.mutate(); }} disabled={save.isPending || disabled}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Organisation speichern
        </Button>
      </CardContent>
    </Card>
  );
}

