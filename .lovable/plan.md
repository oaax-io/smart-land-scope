# SmarTerra Bereinigung & Neustrukturierung

Umsetzung deiner 7 Teile in einer geordneten Reihenfolge, damit der Build zu keiner Zeit bricht (erst Referenzen entfernen, dann Dateien löschen).

## Reihenfolge (wichtig für Build-Stabilität)

1. **DB-Migration** — Tabelle `lu_bzr_import_log` inkl. GRANT/RLS.
2. **Neue Komponente `src/components/analysis-report.tsx`** — Bericht-JSX + Queries aus `analysen.$id.bericht.tsx` auslagern (Word/Print-Export bleibt darin gekapselt).
3. **`analysen.$id.tsx` neu strukturieren** — auf 4 Tabs:
   - Übersicht: KPIs, Karte, LuZonePlanCard, „Was darf gebaut werden?", DevelopmentScoreCard (unten), Risiken, LegalDisclaimer. Entfernt: `AiAnswerCard`, `RegulationComparisonCard`, `ZoneRegulationsPanel`.
   - Rechtliches: `OEREBTabContent` → `EasementsPanel` → `ScenarioComparison` → ZoneOverride (aus altem Potenzial-Tab).
   - Projekt: unverändert.
   - Bericht: `<AnalysisReport analysisId=…>` direkt eingebettet, Print/Word-Buttons oben.
   - `canton={analysis.canton}` an `SwissMap` weitergeben.
4. **`analysen.$id.bericht.tsx`** — auf schlanken Print-Wrapper reduzieren, der `AnalysisReport` rendert (URL bleibt für Vollbild-Druck).
5. **`analyze-knowledge.functions.ts`** — Import auf `regulation-comparison.inline` entfernen; WFS-Block (`queryLuZonePlan`) VOR Prompt-Aufbau einfügen, Werte direkt in `analyses` persistieren, `luZoneInfo` in Prompt injizieren mit „rechtsverbindlich"-Hinweis.
6. **Sidebar** (`app-sidebar.tsx`) — neue 8-Punkte-Navigation, „Berichte" raus, „Wissensdatenbank" → „Gemeinden".
7. **Dashboard** (`dashboard.tsx`) — „Neue Analyse"-Button entfernen (bzw. auf QuickAnalysisModal umlenken), „LU-Reglemente importieren"-Karte (falls vorhanden) entfernen; Rest bleibt.
8. **`lu-bzr-import.server.ts` konsolidieren** — `initImportLog()` + `processNextBatch()` gemäss Spezifikation; Logik aus `lu-fill-tick.server.ts` integrieren; `src/server.ts` Verweis auf `handleLuFillTick` anpassen (auf neuen Batch-Handler oder entfernen).
9. **`platform-admin.functions.ts`** — `initLuImportLog` und `processNextLuBatch` als authentifizierte Server-Fns (Platform-Admin-Check).
10. **`platform.reglemente.tsx`** — „LU Auto-Import"-Panel oben (Init-Button, Batch-Button, `ImportProgress` mit Status-Badges aus `lu_bzr_import_log`).
11. **`swiss-map.tsx`** — `canton`/`luOverlays`-Props, 3 optionale LU-Raster-Layer (Zonen/Baulinien/Gefahren), Toggle-UI nur wenn `canton==="LU"`.
12. **`analysen.karte.tsx`** — falls Kanton aus Auswahl bekannt: `canton`-Prop durchreichen (sonst dynamisch bei Parzellen-Klick).
13. **Dateien löschen** (erst nachdem alle Referenzen entfernt sind):
    - `src/lib/analyze.functions.ts`
    - `src/lib/regulation-comparison.functions.ts`
    - `src/lib/regulation-comparison.inline.ts`
    - `src/lib/lu-fill-tick.server.ts`
    - `src/components/regulation-comparison-card.tsx`
    - `src/components/zone-regulations-panel.tsx`
    - `src/routes/_authenticated/berichte.tsx`
    - `src/routes/_authenticated/analysen.neu.tsx`

## Offene Punkte / Annahmen

- **Bericht als Tab statt Route**: Print-Vollbildroute `/analysen/$id/bericht` bleibt bestehen (nur Wrapper), damit `window.print()` sauber A4 layoutet. Der Tab „Bericht" rendert dieselbe Komponente inline.
- **`AiAnswerCard` entfernen**: bestätigt in deiner Spezifikation.
- **`ZoneOverride`**: Bezeichnung ist unklar — im aktuellen Code ist das die manuelle Zonen-Korrektur (`detected_zone`/`zone_override`). Ich hänge diese Karte an Tab „Rechtliches" unter Szenario-Vergleich.
- **`WissenPage` (`/wissen`)**: nur Label in Sidebar ändern; Route und Inhalt bleiben (heisst weiterhin `wissen.tsx`, Titel & Sidebar-Label werden „Gemeinden").
- **`server.ts` Cron-Handler**: `handleLuFillTick` wird auf `processNextBatch` aus `lu-bzr-import.server.ts` umgestellt (behält den existierenden Cron-Endpoint `/api/cron/lu-tick` — sonst bricht der pg_cron-Job `tick_lu_fill_job`).
- **Dokumentation/Changelog** aktualisiere ich am Ende (v1.5.0-Eintrag).

## Umfang

Rund 20 Dateien betroffen, davon 8 gelöscht, 1 neue DB-Tabelle, 2 neue Komponenten (`analysis-report.tsx`, `ImportProgress` inline), 2 neue Server-Fns.

Soll ich so vorgehen?
