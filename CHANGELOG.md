# Changelog

Alle nennenswerten Änderungen an SmarTerra werden hier dokumentiert.
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

## [1.7.0] – 2026-07-08 — KI-BZR-Fallback & Residualwert-Skala

### Hinzugefügt
- **KI-BZR-Vorschlag Stadt Luzern**: `src/lib/lu-bzr-suggest.server.ts` gruppiert die extrahierten `knowledge_entries` (alt + neu) zu strukturierten `BzrCandidate`s (Code, Zone, ÜZ, AZ, Vollgeschosse, Fassadenhöhe, Bauweise, Länge, …), filtert per WFS-Attributen (Fassadenhöhe, Bauweise, Zonenkategorie wie `WO18x`) und lässt Gemini 2.5 Flash über `ai-gateway.server.ts` den passenden BZR-Code inkl. Confidence auswählen. Adresse und Gemeinde werden dafür in `lu-zoneplan.functions.ts` mitgeladen.
- **Automatischer Fallback in der Analyse-Pipeline**: `analyze-knowledge.functions.ts` ruft die BZR-Suggestion, wenn die offizielle LU-WFS-Antwort weder AZ noch ÜZ liefert. Ergebnis fliesst in `utilization_ratio`, `building_coverage_ratio`, `max_floors`, `max_height`, `zone`, `detected_zone_precise` und `special_provisions` und wird in `analysen.$id.tsx` sowie im Bericht als KI-Herleitung mit Confidence angezeigt.

### Geändert
- **Residualwert-Skala umgekehrt** (`analysis-project-tab.tsx`, `analysis-report.tsx`): Der Farbbalken für den effektiven Angebotspreis gegenüber dem Residualwert stellt jetzt rot = günstiger als Residualwert (attraktiv) und grün = über Residualwert (unattraktiv) dar.
- **Rechtliche-Grundlagen-Anzeige**: `zoneMetric`/`getLuBzrSuggestion` fallen auf KI-BZR-Werte zurück, wenn die offizielle Quelle leer ist; die offizielle Quelle bleibt vorrangig.

### Behoben
- **AZ/ÜZ wurden auf `0` gesetzt** für LU-Zonen ohne diese Werte (z. B. Zone 1501 „Wohnzone Fassadenhöhe"): `analyze-knowledge.functions.ts` schreibt AZ, ÜZ, Geschosszahl und Gesamthöhe nur noch, wenn tatsächlich Werte vorliegen; leere WFS-Attribute überschreiben keine KI/BZR-Werte mehr.
- **BZR alt/neu Stadt Luzern** wurden trotz DB-Import in der Analyse nicht sichtbar — die Anzeige greift jetzt auf die neu integrierten BZR-Kandidaten zurück (u. a. Lindenhausstrasse 15c, Parzelle 1791).



## [1.6.0] – 2026-07-03 — Automatisierung, Datenqualität & Karten-Legende

### Hinzugefügt
- **Wöchentlicher BZR-Update-Check**: `checkAndUpdateBzr` in `src/lib/lu-bzr-import.server.ts` erkennt PDF-Änderungen auf geoshop.lu.ch via ETag / Content-Length und triggert Re-Import + Re-Extraktion. Öffentlicher Endpunkt `src/routes/api/public/hooks/bzr-check.ts`, per pg_cron als `bzr-check-weekly` (Mo 03:00) eingeplant. Manueller Trigger-Button in `/platform/reglemente`.
- **Planungszonen-Warnhinweis**: `hasPlanungszone` in `src/lib/oereb.functions.ts`; Warnbanner in `src/routes/_authenticated/analysen.$id.tsx` auf den Tabs Übersicht und Rechtliches, wenn ÖREB eine aktive Ortsplanungsrevision meldet.
- **Kartenlegende Luzern**: aufklappbares Dropdown unter der Karte mit nativ nachgebauten Farb-Swatches für Zonenplan, Baulinien und Naturgefahren — nebeneinander in Spalten.
- **Zonen-Kachel mit Farbe**: `zoneCategoryColor` + `ZoneKpiCard` in `analysen.$id.tsx` färben die Zone-Kachel nach Kategorie (Wohn, Zentrum, Kern/Dorf, Arbeit, Grün, ...).
- **Bulk-Löschen von Analysen**: Mehrfachauswahl mit Checkboxen, `AlertDialog`-Bestätigung und Supabase-Bulk-Delete in `src/routes/_authenticated/analysen.index.tsx`.

### Geändert
- **AZ und ÜZ werden immer nebeneinander angezeigt** (5-Spalten-KPI-Grid); Tooltip erklärt, wenn eine Kennzahl in der Zone nicht existiert (typisch Alt- vs. Neu-PBG).
- **Zonen-Overlay automatisch aktiv** bei LU-Analysen; die vergrösserte Kartenansicht übernimmt Kanton und alle Layer-Toggles.
- **Kartenperformance**: `sessionStorage`-Cache für Kantons-GeoJSON, optimierte MapLibre-Props (`fadeDuration`, `maxTileCacheSize`, `reuseMaps`). Layer-Toggles unten links über dem Kanton-Filter statt hinter dem Suchfeld.
- **Adress-Suche** in `src/lib/swiss-geo.ts` parst swisstopo-Labels für exakte Koordinaten, GWR-Toleranz von 25 → 5px, Analyse-Karte zoomt auf 18.
- **LU-Zonenplan-Parser** liest lokalisierte deutsche Attribute (Alt-PBG vs. Neu-PBG); UI zeigt beide Ebenen separat.

### Behoben
- **Analyseergebnisse verschwanden** nach wenigen Sekunden — der LU-Zonenplan-Loader (`analyze-knowledge.functions.ts` + `lu-zoneplan.functions.ts`) überschrieb KI-Werte mit `null`. Patch-Logik füllt jetzt ausschliesslich tatsächlich vorhandene Felder.
- **AZ vs. ÜZ** vertauscht für Neu-PBG-Zonen ohne AZ (z. B. Zentrumszone Rüsstal Lindenstrasse 29) — LU-Wert wird nun der korrekten Kennzahl zugeordnet.



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
