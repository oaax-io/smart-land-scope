# SmarTerra — Grundstruktur Plan

KI-gestützte Schweizer Grundstücksanalyse-Plattform als Multi-Tenant SaaS. Diese Phase legt nur das Fundament an (DB, Auth, Rollen, Navigation, leere Modul-Seiten) — keine externen APIs, keine echte Analyse-Logik, keine Stripe-Aktivierung.

## 1. Backend aktivieren (Lovable Cloud)
Aktiviert Datenbank, Auth und Server-Funktionen. Stripe wird nur strukturell vorbereitet (Tabellen + Felder), nicht verbunden.

## 2. Datenmodell (Multi-Tenant)

```text
organizations            (Tenant-Wurzel)
  id, name, slug, plan, trial_ends_at, stripe_customer_id, created_at

profiles                 (1:1 zu auth.users)
  id (=auth.users.id), full_name, avatar_url, default_org_id

organization_members     (User ↔ Org, viele zu viele)
  org_id, user_id, role (enum: admin | owner | member), invited_at, joined_at

app_role (enum)          admin, owner, member
has_role(user, org, role) SECURITY DEFINER  (keine Rekursion in RLS)

teams                    (Untergruppen je Org)
  id, org_id, name, created_by

team_members             team_id, user_id

projects                 id, org_id, team_id?, name, description, status, created_by
project_members          project_id, user_id, role

parcels                  (Stamm einer Analyse)
  id, org_id, address, parcel_number, canton, municipality,
  egrid, lat, lng, area_m2, zone_code, created_by, created_at

analyses                 (eine Auswertung zu einem Grundstück)
  id, org_id, parcel_id, project_id?, status,
  ausnuetzungsziffer, geschossigkeit, gebaeudehoehe_m,
  nutzungsmoeglichkeiten jsonb, einschraenkungen jsonb,
  entwicklungspotenzial jsonb, raw_data jsonb,
  created_by, created_at

favorites                user_id, org_id, analysis_id
reports                  id, org_id, project_id?, title, content jsonb, created_by

subscriptions            (Stripe vorbereitet, noch inaktiv)
  id, org_id, plan (free|trial|starter|pro|enterprise),
  status, current_period_end, stripe_subscription_id

invitations              id, org_id, email, role, token, expires_at
audit_log                id, org_id, user_id, action, entity, entity_id, meta jsonb
```

Alle Tabellen: RLS aktiv, GRANTs für `authenticated` + `service_role`. Zugriff über `has_role(auth.uid(), org_id, ...)`-Funktion → keine rekursiven Policies. Trigger legt bei Signup `profile` + persönliche Default-`organization` + `organization_members`(role=owner) an.

## 3. Auth & Rollen
- E-Mail/Passwort + Google (vorbereitet via Lovable Auth-Broker)
- Passwort-Reset Flow mit `/reset-password` Route
- Rollen: `admin` (Plattform), `owner` (Org-Inhaber), `member` (Team-User)
- Geschützte Routen unter `_authenticated/` (Lovable-managed Layout)
- Org-Switcher in der Topbar (aktive Org in Context + localStorage)

## 4. Seitenstruktur (TanStack Router)

```text
/                              Landing (Marketing-Hero, CTA → Sign up)
/auth                          Login + Registrierung (Tabs)
/reset-password                Passwort neu setzen
/_authenticated/
  dashboard                    KPIs, letzte Analysen, Favoriten, Statistiken
  analysen                     Liste + Eingabefeld (Adresse/Parzelle, mock)
  analysen/$id                 Detailansicht (leere Sektionen + Skeleton)
  projekte                     Projektübersicht
  projekte/$id                 Projekt-Detail (Analysen, Mitglieder)
  berichte                     Berichtsliste
  team                         Mitglieder, Einladungen, Rollen
  einstellungen                Profil, Organisation, Abo, Billing-Stub
```

## 5. Navigation & Layout
- Linke `Sidebar` (collapsible, Icon-Mini-Variante): Dashboard · Analysen · Projekte · Berichte · Team · Einstellungen
- Topbar: Org-Switcher, Suchfeld, Benutzer-Menü (Profil, Abmelden), Trial-Badge
- Responsive: Sidebar → Sheet auf Mobile

## 6. Design-System
Tailwind v4 Tokens in `src/styles.css` (`@theme inline`):
- `--primary: #324642` (Deep Forest)
- `--secondary: #6A9387` (Sage)
- `--background: #F8F9FA`
- Akzent-/Chart-/Sidebar-Tokens davon abgeleitet (oklch)
- Schriften: Inter (Body) + ein hochwertiger Display-Font (z. B. Plus Jakarta Sans) via `<link>` im Root-Head
- shadcn/ui Komponenten, abgerundet, ruhige Schatten, viel Weissraum

## 7. Dashboard-Layout
- 4 KPI-Karten: Analysen gesamt, diesen Monat, aktive Projekte, Team-Mitglieder
- Sektion „Letzte Analysen" (Tabelle, 5 Einträge)
- Sektion „Favoriten" (Kartenraster)
- Sektion „Aktivität" (einfache Recharts-Vorschau, mock)

## 8. SaaS-Funktionen (Stub)
- Org-Erstellung beim Signup + Einladungs-Flow (Token-Tabelle, UI vorhanden, E-Mail-Versand TODO)
- Subscription-Tabelle mit `plan='trial'`, `trial_ends_at = now()+14d`
- Stripe-Felder vorhanden, aber **kein** `enable_stripe_payments`-Aufruf in dieser Phase
- Settings → Billing zeigt Plan + „Upgrade (bald verfügbar)"

## 9. Was NICHT in dieser Phase
- Keine echte Grundstücks-API (GIS, ZEFIX, swisstopo)
- Keine KI-Auswertung
- Keine Stripe-Aktivierung, keine E-Mail-Provider
- Keine PDF-Berichts-Generierung

## Technische Hinweise
- Stack: TanStack Start + React 19 + TS + Tailwind v4 + shadcn/ui + Lovable Cloud (Supabase)
- Server-Logik nur via `createServerFn` mit `requireSupabaseAuth`
- RLS-Pattern: `has_role(uuid, uuid, app_role)` SECURITY DEFINER, alle Policies darüber
- `_authenticated/route.tsx` wird von der Integration verwaltet — nicht selbst schreiben
- `profiles`/`organizations`/`organization_members` Auto-Anlage via `on_auth_user_created` Trigger

Nach Freigabe baue ich Migrations, Auth-Seiten, Sidebar-Shell und alle Modul-Routen als funktionierende, aber leere Hüllen.