# Changelog

Alle nennenswerten Änderungen an SmarTerra werden hier dokumentiert.
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

## [1.5.0] – 2026-07-03 — Bereinigung, LU-Fokus & Karten-Overlays

### Hinzugefügt
- **Neue Analyse-Detailseite** (`analysen.$id.tsx`) mit 4 Tabs: Übersicht, Rechtliches, Projekt, Bericht. Rohdaten- und Debug-Panels entfernt; Bericht in `src/components/analysis-report.tsx` konsolidiert.
- **Sidebar-Neustrukturierung** (`src/components/app-sidebar.tsx`): 8 Hauptpunkte, „Wissensdatenbank" → **Gemeinden**.
- **Automatischer LU-BZR-Import**: neue Tabelle `lu_bzr_import_log`, serverseitiger Batch-Prozessor `processNextLuImportBatch` und `initLuImportLog` in `src/lib/lu-bzr-import.server.ts`, Admin-Panel `LuAutoImportPanel` in `/platform/reglemente`. Endpunkt in `src/server.ts` löst den alten `/api/cron/lu-tick` ab.
- **Karten-Overlays Luzern** (`src/components/swiss-map.tsx`): Zonenplan (`ZPGNDNTZ_V1_PY`), Baulinien (`ZPBAULIN_V1_LI`) und Naturgefahren (`ZPNATGEF_V1_PY`) via offiziellem LU-WMS-Endpunkt (`ZONPLANX_COL_V3_MP/MapServer/WMSServer`, EPSG:3857).

### Geändert
- **MapLibre-Style** wird nun via `useMemo` erzeugt; alle Sources/Layers (Kantone, ausgewählte Parzelle, Baufeld, LU-Overlays) sind direkt Teil des Style-Objekts. Layer-Toggles reagieren dadurch sofort.
- **WFS-Injektion**: rechtsverbindliche LU-Zonenplan-Daten fliessen konsequent in den KI-Prompt (`analyze-knowledge.functions.ts`).
- **Neue Analyse**-Buttons unter `/analysen` verweisen jetzt auf die Schnellsuche im Dashboard.

### Entfernt
- `src/lib/analyze.functions.ts`, `src/lib/regulation-comparison.functions.ts`, `src/lib/regulation-comparison.inline.ts`, `src/lib/lu-fill-tick.server.ts`
- `src/components/regulation-comparison-card.tsx`, `src/components/zone-regulations-panel.tsx`
- Routen `src/routes/_authenticated/berichte.tsx`, `src/routes/_authenticated/analysen.neu.tsx`

### Behoben
- Layer-Toggles auf `/analysen/karte` blieben wirkungslos, weil `react-map-gl`-`<Source>`/`<Layer>` unter React 19 die Style-Diffs blockierten — jetzt behoben durch direkte Style-Komposition.
- LU-WMS-Layer verwendeten fehlerhafte Layer-Namen; über GetCapabilities verifizierte numerische Indizes ersetzt.

## [1.4.0] – 2026-07-03

### Hinzugefügt
- **Luzerner Zonenplan-Integration (GEO-1)**: offizieller LU-Geodatendienst (ESRI MapServer Identify) via `queryLuZonePlan` (`src/lib/swiss-geo.ts`). `loadLuZonePlanForAnalysis` (`src/lib/lu-zoneplan.functions.ts`) persistiert Zonenname, AZ, ÜZ, Gebäude-/Gesamthöhe und Geschosszahl auf der Analyse. Werte fliessen in den KI-Prompt (`analyze-knowledge.functions.ts`) ein. Neuer WMS-Overlay-Toggle (`ZPGNDNTZ_V1_PY`) auf der Karte, gesteuert über die neue `canton`-Prop von `swiss-map.tsx`.
- **BZR-Versionsvergleich**: `regulation_snapshots`-Tabelle plus `RegulationComparisonCard` zeigt altes vs. neues Reglement in Analyse-Detail und Bericht.
- **GEO-2 Erweiterungen**:
  - Dashboard-Schnellsuche zeigt bei LU-Parzellen sofort eine Live-Zonenvorschau (`quick-analysis-modal.tsx`).
  - Analyse-Detail: Button **„Zonenplan aktualisieren"** lädt LU-WFS-Daten neu und triggert eine Re-Analyse.
  - Platform-Admin (`/platform/reglemente`): Coverage-Kachel „LU Zonenplan" und Moderations-Tabelle `PendingZoneRegulations` für Community-Beiträge.
  - Präzise WMS-Overlay-Steuerung (kanton-abhängig sichtbar), verbesserte Layer-Darstellung.
  - **Community-Grenzabstände**: neue Tabelle `zone_regulations` + `ZoneRegulationsPanel` — Nutzer erfassen und verifizieren Grenzabstände/Parkplatzwerte pro Zone; verifizierte Werte werden dem KI-Prompt beigelegt.
- **Dienstbarkeiten-Modul** (`/analysen/$id` → Tab "Dienstbarkeiten"): manuelle Erfassung von Dienstbarkeiten, Grundlasten und Pfandrechten **oder** Upload eines Grundbuchauszugs (PDF/Scan) mit automatischer KI-Extraktion via `easement-extract.functions.ts` (Gemini 2.5 Pro). Erfasste Lasten erscheinen als neues Kapitel 3 "Dienstbarkeiten & Lasten" im Bericht.
- **Machbarkeitsstudie-Workflow**: Projektdaten (Projektnummer, Auftraggeber, Projektleiter), parametrischer Geschoss-/Volumenrechner (`analysis_floors`, generated `volume_m3`), Wohnungs-Mix (`analysis_units`), Upload-Slots für Architekten-Zeichnungen (Situation, Grundriss, Schnitt, Fassade) — alle Daten fliessen in den Bericht ein.
- **Professioneller Bericht** (`/analysen/$id/bericht`): druckbare Machbarkeitsstudie im Conea-Format mit Titelseite, Inhaltsverzeichnis, Executive Summary, Kapiteln 1–9 (Rechtliche Grundlagen, ÖREB, Dienstbarkeiten, Lage, Wohnungen, Volumen, Baurecht, Potenzial, Risiken), KI-Empfehlung und Beilagen; Word-Export inkl. Projektnummer im Dateinamen.
- **ÖREB-Kataster-Integration** (`oereb.functions.ts`): automatische Abfrage aller Themen per EGRID aus dem offiziellen schweizerischen ÖREB-Kataster, eigener "ÖREB"-Tab und Bericht-Kapitel.
- **Rechtliche-Grundlagen-Tabelle** mit gruppierter Darstellung (Lage, Dichte, Masse, Abstände, Freiräume, Verkehr) und erweitertem `ZoneSchema` (BMZ, Pflichtparkplätze, Attika-Regeln, u. a.).
- **Szenario-Vergleich** (Tab "Varianten"): mehrere Bebauungsvarianten parallel rechnen (`analysis_scenarios`).
- **Hintergrund-Jobsystem** für BZR-Extraktion (`background-jobs.functions.ts` + `pg_cron`-Tick): Reglemente werden im Hintergrund verarbeitet (3 Dokumente/Minute), Live-Progress über `LuJobButton`.
- **Regionen-Admin** (`/platform/regionen`): Kantone und Gemeinden aktiv/inaktiv schalten — inaktive Regionen erscheinen nicht in der Wissensdatenbank.
- **Indikatives Baufeld**: auf der Analyse-Detailseite wird das Baufeld auf Basis der amtlichen Parzellengeometrie und der Grenzabstände eingezeichnet (`@turf/turf`).
- **Bauzonen-Override** (`detected_zone` / `zone_override`): manuelle Zonen-Korrektur mit anschliessender Re-Analyse.
- **Inline-Korrektur** für KI-extrahierte Reglemente-Werte mit Verifizierungs-Tracking (`verified`, `verified_by`, `verified_at`).
- **Haftungshinweis** (`legal-disclaimer.tsx`) im Feasibility-Tab und Bericht.
- **Quick-Analysis-Modal** im Dashboard inkl. Parzellen-Verifikation.
- **Interaktive Schweizer Karte** (`/analysen/karte`): Kanton-Filter, Parzellen-Hover mit Tooltip (Parzelle, Fläche, Gemeinde, Bauzone Bund, E-GRID).
- **Erweiterte Organisations-Stammdaten** (Adresse, Telefon, E-Mail, Ansprechperson) inkl. UI in den Einstellungen.

### Geändert
- **Zonenermittlung DB-first**: KI-Prompt nutzt primär die in `knowledge_entries` gespeicherten kommunalen Zonen; swisstopo `ch.are.bauzonen` ist Fallback/Hinweis. Map-Tooltip heisst nun "Bauzone (Bund)".
- **BZR-Uploads**: `Gültig ab` ist Pflichtfeld; neue Versionen archivieren ältere automatisch (`active = false`).
- **Reglemente-Extraktion** (`regulation-extract.server.ts`): `ZoneSchema` um 11 Kennzahlen erweitert (Grenzabstände, Überbauungsziffer, Sondervorschriften, Lärmempfindlichkeitsstufe, Gewässerabstand, BMZ, Parkplatzpflicht, Attika-Regeln u. a.), striktes Error-Handling, automatischer Rebuild fehlender Wissenseinträge.
- **Topbar**: zeigt Vor-/Nachname aus `profiles` statt E-Mail; Feedback-Link im User-Dropdown.
- **Dashboard**: persönliche Begrüssung, prominenter Schnellanalyse-Hero mit Immobilien-Hintergrund und transparentem Suchfeld; Suchvorschläge `z-[9999]`.
- **Feedback**: Fehler werden im Modal angezeigt (nicht als Toast); Screenshots via Drag & Drop / Paste; Autor-Name sichtbar (RLS-Policy "Platform admins can view all profiles").
- **Karten-Hover**: Kantons-Fill blendet zwischen Zoom 11–14 aus, damit beim Heranzoomen nur die Parzelle hervorgehoben wird.
- **Sidebar**: Logo skaliert korrekt im kollabierten Zustand.

### Technisch
- Neue Tabellen: `analysis_easements`, `analysis_floors` (mit generated `volume_m3`), `analysis_units`, `analysis_scenarios`, `regulation_snapshots`, `zone_regulations`; erweiterter Enum `analysis_document_kind`.
- Neue Server-Funktionen: `easement-extract.functions.ts`, `oereb.functions.ts`, `analyze-scenario.functions.ts`, `background-jobs.functions.ts`, `lu-zoneplan.functions.ts`.
- `swiss-map.tsx` unterstützt neue `canton`-Prop für kanton-spezifische WMS-Overlays.
- `getParcelOutlineAt()` persistiert `parcel_geometry`; harmonisierte Bauzonen-Kategorie über swisstopo extrahiert.



## [0.1.0] — Grundstruktur

Initiale Plattform-Grundlage gemäss `.lovable/plan.md`:
- Multi-Tenant-Datenmodell (organizations, profiles, members, teams, projects, parcels, analyses, reports, subscriptions, invitations, audit_log) mit RLS und `has_role()` SECURITY DEFINER.
- Auth (E-Mail/Passwort + Google vorbereitet), geschützter `_authenticated`-Bereich.
- Sidebar-Shell + Modul-Routen: Dashboard, Analysen, Projekte, Berichte, Team, Einstellungen.
- Design-System (Deep Forest / Sage) auf Tailwind v4 + shadcn/ui.
