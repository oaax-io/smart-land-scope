# SmarTerra — Dokumentation

KI-gestützte Schweizer Grundstücksanalyse-Plattform (Multi-Tenant SaaS).

## Stack

- **Frontend**: TanStack Start v1, React 19, TypeScript, Tailwind v4, shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — Postgres mit RLS, Auth, Server-Funktionen
- **Karten**: MapLibre GL + swisstopo WMTS/Identify-API
- **Server-Logik**: ausschliesslich via `createServerFn` mit `requireSupabaseAuth`

## Projektstruktur

```text
src/
  routes/                    File-based routing (TanStack)
    __root.tsx               Root-Layout (Head, Outlet)
    index.tsx                Landing
    auth.tsx                 Login / Registrierung
    _authenticated/          Geschützter Bereich
      dashboard.tsx          KPIs, letzte Analysen, Quick-Analysis-Modal
      analysen.tsx           Liste + Eingabe
      analysen.$id.tsx       Detailansicht einer Analyse
      analysen.karte.tsx     Interaktive Karte mit Kanton-Filter
      projekte.tsx           Projektübersicht
      berichte.tsx           Berichte
      team.tsx               Mitglieder & Einladungen
      einstellungen.tsx      Profil, Org, Abo

  components/
    swiss-map.tsx            MapLibre-Karte, Hover, Kanton-Highlight
    quick-analysis-modal.tsx Analyse-Wizard im Dashboard

  lib/
    swiss-cantons.ts         26 Kantone (Name, Kürzel, BBox, Farbe)
    swiss-geo.ts             swisstopo Identify (Adresse, Parzelle, Outline)
```

## Karten-Modul (`/analysen/karte`)

### Datenquellen (swisstopo, lizenzfrei)
- `ch.kantone.cadastralwebmap-farbe` — amtliche Vermessung (Parzellen, Gemeinden, Kantone)
- `ch.are.bauzonen` — harmonisierte Bauzonen (Bauzonentyp wie W2, K, …)
- WMTS-Hintergrund: `ch.swisstopo.pixelkarte-farbe`

### Funktionen
- **Kantons-Layer**: alle 26 Kantone immer farbig; Filter unten links zoomt und hebt nur den gewählten Kanton hervor (andere bleiben sichtbar, leicht abgedunkelt).
- **Parzellen-Hover** (ab Zoom ≥ 16.5): debounced 110 ms; gelber Polygonumriss + Tooltip mit Parzelle, Kanton, Fläche, Gemeinde, Bauzone, E-GRID.
- **Klick auf Parzelle**: Info-Karte oben (unter den Zoom-Buttons) mit Aktion "Analyse starten".

### Hinweis
Geschosse (Geschossigkeit) und Ausnützungsziffer kommen nicht aus den Bundes-Layern — sie werden im Analyse-Schritt aus den kommunalen Bau- und Zonenordnungen ermittelt.

## Dashboard

Schnellanalyse: Klick auf eine Adresskarte öffnet das `QuickAnalysisModal`. Die Analyse-Schritte (Adresse verifizieren, Parzelle bestätigen, Zone prüfen, Optionen wählen) laufen im Modal. Erst nach Abschluss aller Schritte erfolgt die Weiterleitung auf `/analysen/$id`.

## Daten- und Sicherheitsmodell

- Rollen in separater Tabelle `user_roles` (kein Privilege-Escalation-Risiko).
- `has_role(user, org, role)` als SECURITY DEFINER → keine rekursiven RLS-Policies.
- Jede public-Tabelle: `GRANT` für `authenticated` + `service_role`, RLS aktiv.
- Server-Funktionen mit `requireSupabaseAuth`; `attachSupabaseAuth` global in `src/start.ts` registriert.

Weitere Details siehe `.lovable/plan.md` und `CHANGELOG.md`.
