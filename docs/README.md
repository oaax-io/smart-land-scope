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

      feedback.index.tsx       Feedback-Liste mit Autor-Namen
      platform.reglemente.tsx  BZR-Reglemente, Hintergrund-Jobs
      platform.regionen.tsx    Kantone/Gemeinden aktivieren

  components/
    swiss-map.tsx                  MapLibre-Karte, Hover, Baufeld
    quick-analysis-modal.tsx       Analyse-Wizard im Dashboard
    rechtliche-grundlagen-table.tsx Conea-Format Kennzahlentabelle
    oereb-topics-table.tsx         ÖREB-Themen pro EGRID
    easements-panel.tsx            Dienstbarkeiten (manuell + KI)
    analysis-project-tab.tsx       Projektdaten, Geschoss-/Volumenrechner, Uploads
    scenario-comparison.tsx        Varianten-Vergleich
    legal-disclaimer.tsx           Wiederverwendbarer Haftungshinweis
    regulation/municipality-detail-dialog.tsx  Inline-Korrektur mit Verifizierung

  lib/
    swiss-cantons.ts                26 Kantone (Name, Kürzel, BBox, Farbe)
    swiss-geo.ts                    swisstopo Identify, Parzellengeometrie
    oereb.functions.ts              ÖREB-Kataster-Abfrage per EGRID
    easement-extract.functions.ts   KI-Extraktion Grundbuchauszug
    analyze-knowledge.functions.ts  KI-Analyse (DB-first Zone)
    analyze-scenario.functions.ts   Szenario-Berechnung
    regulation-extract.server.ts    BZR-Extraktion (erweitertes ZoneSchema)
    background-jobs.functions.ts    Hintergrund-Job-Queue (pg_cron Tick)
```

## Analyse-Module

- **Machbarkeit / Wohnungspotenzial / Entwicklung / Risiken** — KI-gestützte Auswertung pro Analyse.
- **Varianten** — Szenario-Vergleich mehrerer Bebauungsoptionen (`analysis_scenarios`).
- **ÖREB** — alle Themen des ÖREB-Katasters pro EGRID (Conea-Format).
- **Projekt** — Projektdaten, parametrischer Geschoss-/Volumenrechner (`analysis_floors`, generated `volume_m3`), Wohnungs-Mix (`analysis_units`), Upload-Slots für Architekten-Dokumente (Situation, Grundriss, Schnitt, Fassade).
- **Dienstbarkeiten** — Manuelle Erfassung oder KI-Extraktion aus Grundbuchauszug (Gemini 2.5 Pro).
- **Bericht** — druckbare Machbarkeitsstudie im Conea-Format inkl. Word-Export.

## Reglemente / Wissensdatenbank

- `regulation-extract.server.ts` extrahiert Zonen-Kennzahlen aus BZR-PDFs (Grenzabstände, Überbauungsziffer, BMZ, Lärmempfindlichkeit, Gewässerabstand, Sondervorschriften, Parkplatzpflicht u. v. m.).
- **Hintergrund-Verarbeitung** über `pg_cron`-Tick und `background-jobs.functions.ts` (3 Dokumente/Minute), Live-Progress in `platform.reglemente.tsx`.
- **Inline-Korrektur**: KI-Werte können nachträglich korrigiert werden; Tracking via `verified`, `verified_by`, `verified_at`.
- **Versionierung**: Neue BZR-Uploads erfordern `Gültig ab` und archivieren ältere Versionen automatisch (`active = false`).
- **Regionen-Admin** (`/platform/regionen`): Kantone/Gemeinden aktivieren/deaktivieren.



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
