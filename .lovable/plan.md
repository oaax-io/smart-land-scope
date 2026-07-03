# Präzise Zonenerkennung + Alt/Neu-Reglement-Vergleich

Zwei zusammenhängende Erweiterungen, damit jede Analyse (a) die *tatsächliche* Zone am Punkt liefert und (b) Alt- und Neu-Fassung des BZR nebeneinander stellt.

## Teil 1 — Echte Zonenerkennung (LU zuerst)

Aktuell rät die KI die Zone aus dem Adress-Text → gleiche Strasse ⇒ gleiche Zone. Neu: Geo-Abfrage am Parzellen-Zentroid.

**Datenquellen (in dieser Reihenfolge, erste treffende Antwort gewinnt):**
1. **Kanton LU** — WMS/Feature-Service `geo.lu.ch` Zonenplan (`ID: `Nutzungsplanung: Grundnutzung`), liefert Zonencode wie `W3`, `Gs4`, `K4`, `Ar-15-OH` inklusive Gemeinde.
2. **Fallback** — Bestehende `ch.are.bauzonen` (nur als grobe Kategorie).
3. **Manueller Override** — bleibt wie heute höchste Priorität.

**Ablauf:**
- Neue Server-Funktion `resolveExactZoneAt(lng, lat, cantonCode)` in `src/lib/swiss-geo.ts`.
- Beim Anlegen/Neu-Analysieren wird der Zentroid der Parzellen-Geometrie an diese Funktion übergeben.
- Ergebnis in neuer Spalte `analyses.detected_zone_precise` + `analyses.detected_zone_source` (`'lu-kanton' | 'bund' | 'manual'`).
- Im Analyse-Prompt: wenn `detected_zone_precise` gesetzt → als **verbindliche** Zone übergeben, KI muss diese verwenden (kein Raten mehr).

Andere Kantone: Modul-Struktur vorbereiten (Registry `cantonZoneResolvers`), aber nur `LU` liefern. ZH/AG folgen später.

## Teil 2 — Alt/Neu-Reglement nebeneinander

Bestehendes Modell: `regulation_documents` hat `version`, `valid_from`, `active`. Beim Neu-Upload wird das alte auf `active=false` gesetzt. `knowledge_entries` verweisen auf `source_document`.

**Neu:**
- Analyzer lädt Wissen für **beide** relevanten Fassungen: aktuellste aktive + jüngste inaktive („Vorgänger-Fassung") derselben Gemeinde.
- Jede Zone wird zweimal ausgewertet und in `analysis_results.regulation_comparison` (jsonb) gespeichert:
  ```
  {
    current:  { doc_id, version, valid_from, zone, az, floors, height, ... },
    previous: { doc_id, version, valid_from, zone, az, floors, height, ... },
    diffs:    [{ field: 'utilization_ratio', old: 0.8, new: 0.95, delta_pct: +18.75 }, ...]
  }
  ```
- Ist keine Vorgänger-Fassung vorhanden → `previous: null`, kein Vergleich (statt Fake-Werte).

**UI Übersicht (`analysen.$id.tsx` — Tab „Übersicht"/„Rechtsrahmen"):**
- Neue Karte **„Rechtsstand-Vergleich"** mit zwei Spalten (Aktuell / Vorher) und Delta-Badges (+/-) für die Kennzahlen.
- Selector „Rechtsstand für Berechnung: **Aktuell** / Vorherige Fassung" — steuert, welche Werte die Wohnungspotenzial-Berechnung verwendet (`analyses.regulation_basis`).

**Bericht (`analysen.$id.bericht.tsx`):**
- Neues Kapitel **„Rechtsstand & Änderungen ggü. Vorfassung"** direkt nach „Rechtliche Grundlagen".
- Tabelle Aktuell vs. Vorher pro Zone mit Delta-Spalte.
- Wenn `previous == null`: Hinweiszeile „Keine Vorgänger-Fassung im System hinterlegt."

## Technische Details

### Datenbank-Migration
- `analyses`: Spalten `detected_zone_precise text`, `detected_zone_source text`, `regulation_basis text default 'current'`.
- `analysis_results`: Spalte `regulation_comparison jsonb`.
- Kein neuer Table nötig; Vergleich wird bei jedem Analyse-Run gerechnet.

### Neue/geänderte Dateien
- `src/lib/swiss-geo.ts` — `resolveExactZoneAt()`, `cantonZoneResolvers` Registry.
- `src/lib/canton-zone-lu.server.ts` — LU-spezifische WMS/Feature-Abfrage.
- `src/lib/analyze-knowledge.functions.ts` — beide Fassungen laden, Vergleich berechnen, Prompt-Zone verbindlich setzen.
- `src/components/regulation-comparison-card.tsx` — neue UI-Karte.
- `src/routes/_authenticated/analysen.$id.tsx` — Karte einbinden + Basis-Selector.
- `src/routes/_authenticated/analysen.$id.bericht.tsx` — neues Kapitel.
- `src/components/quick-analysis-modal.tsx` + `analysen.neu.tsx` + `analysen.karte.tsx` — beim Anlegen zusätzlich `detected_zone_precise` schreiben.

### Kompatibilität
- Bestehende Analysen ohne `detected_zone_precise` → Verhalten unverändert (KI-Zuordnung wie bisher, mit Warn-Badge „Zone ungeprüft — neu analysieren empfohlen").
- Vergleich erscheint nur, wenn eine Vorfassung existiert; sonst nur „Aktuell"-Ansicht wie heute.

## Nicht enthalten (bewusst)
- ZH/AG/andere Kantone → Registry ist vorbereitet, Implementierung in Folge-PR.
- Automatische Neuberechnung aller ~150 bestehenden Analysen — stattdessen ein „Neu analysieren"-Button pro Analyse.
