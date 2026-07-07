import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Zone = {
  code?: string | null;
  name?: string | null;
  max_floors?: number | null;
  max_height_m?: number | null;
  max_facade_height_m?: number | null;
  max_height_valley_m?: number | null;
  utilization_ratio?: number | null;
  building_coverage_ratio?: number | null;
  building_mass_ratio?: number | null;
  open_space_ratio?: number | null;
  setback_small_m?: number | null;
  setback_large_m?: number | null;
  setback_note?: string | null;
  max_building_length_m?: number | null;
  max_building_width_m?: number | null;
  max_facade_length_m?: number | null;
  height_bonus_m?: number | null;
  attic_floor_counted?: boolean | null;
  basement_counted?: boolean | null;
  building_type?: string | null;
  noise_sensitivity?: string | null;
  transit_quality?: string | null;
  play_area_m2_per_apt?: number | null;
  play_area_requirement?: string | null;
  parking_rate?: string | null;
  parking_note?: string | null;
  article_reference?: string | null;
  source_label?: string | null;
};

type Props = {
  zone: Zone;
  municipalityName?: string | null;
  cantonCode?: string | null;
  grundstueckflaeche?: number | null;
};

const CANTONAL_BASIS: Record<string, string> = {
  LU: "SRL 735 – Planungs- und Baugesetz (PBG) – Kanton Luzern",
  ZH: "LS 700.1 – Planungs- und Baugesetz (PBG) – Kanton Zürich",
  BE: "BSG 721.0 – Baugesetz (BauG) – Kanton Bern",
  AG: "SAR 713.100 – Baugesetz (BauG) – Kanton Aargau",
  SG: "sGS 731.1 – Planungs- und Baugesetz (PBG) – Kanton St. Gallen",
};

function fmt(value: unknown, suffix = ""): string {
  if (value == null || value === "") return "–";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  return `${value}${suffix}`;
}

function valueOrNote(value: unknown, note?: string | null, suffix = ""): string {
  if (value != null && value !== "") return fmt(value, suffix);
  return note?.trim() || "–";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="w-1/2 py-2 pr-3 text-sm text-muted-foreground">{label}</td>
      <td className="py-2 text-sm font-medium tabular-nums">{value}</td>
    </tr>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{title}</h4>
      <table className="w-full">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function RechtlicheGrundlagenTable({
  zone,
  municipalityName,
  cantonCode,
  grundstueckflaeche,
}: Props) {
  const basis =
    (cantonCode && CANTONAL_BASIS[cantonCode.toUpperCase()]) ||
    "Kantonales Planungs- und Baugesetz";
  const uz = zone.utilization_ratio ?? zone.building_coverage_ratio;
  const uzLabel = zone.utilization_ratio != null ? "AZ" : "ÜZ";
  const maxFlaecheBzr =
    grundstueckflaeche != null && uz != null ? Math.round(grundstueckflaeche * uz) : null;
  const isLu = cantonCode?.toUpperCase() === "LU";
  const luSetbackNote = isLu
    ? "nicht zonenspezifisch im BZR; nach kantonalem PBG und konkreter Gebäudehöhe zu prüfen"
    : null;
  const luTransitNote = isLu ? "nicht zonenspezifisch im BZR geregelt" : null;
  const luParkingNote = isLu ? "projektabhängig nach kommunalen Parkierungsvorgaben" : null;
  const luPlayAreaNote = isLu
    ? "Spiel- und Freizeitflächen gemäss BZR Art. 71; Konzept ab mehr als 20 Wohnungen"
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Rechtliche Grundlagen</CardTitle>
          {municipalityName && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {municipalityName}
              {cantonCode ? ` · Kanton ${cantonCode.toUpperCase()}` : ""}
            </p>
          )}
        </div>
        {(zone.code || zone.name) && (
          <Badge className="shrink-0 bg-primary/10 text-primary hover:bg-primary/10">
            {zone.code ?? zone.name}
            {zone.code && zone.name && zone.code !== zone.name ? ` — ${zone.name}` : ""}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {grundstueckflaeche != null && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div>
                <div className="text-xs text-muted-foreground">GSF</div>
                <div className="font-semibold tabular-nums">
                  {grundstueckflaeche.toLocaleString("de-CH")} m²
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{uzLabel}</div>
                <div className="font-semibold tabular-nums">{uz ?? "–"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Max. Fläche BZR</div>
                <div className="font-semibold tabular-nums">
                  {maxFlaecheBzr != null ? `${maxFlaecheBzr.toLocaleString("de-CH")} m²` : "–"}
                </div>
              </div>
            </div>
          </div>
        )}

        <Group title="Lage">
          <Row
            label="Zone"
            value={
              <span className="text-primary">
                {zone.code ?? zone.name ?? "–"}
                {zone.name && zone.code && zone.name !== zone.code ? ` — ${zone.name}` : ""}
              </span>
            }
          />
          <Row label="Empfindlichkeitsstufe (ES)" value={fmt(zone.noise_sensitivity)} />
          <Row label="Erschliessungsqualität ÖV" value={valueOrNote(zone.transit_quality, luTransitNote)} />
        </Group>

        <Group title="Dichte">
          <Row label="Vollgeschosse" value={fmt(zone.max_floors)} />
          <Row label="Anrechenbares Dachgeschoss" value={fmt(zone.attic_floor_counted)} />
          <Row label="Anrechenbares Untergeschoss" value={fmt(zone.basement_counted)} />
          <Row label="Überbauungsziffer (ÜZ)" value={fmt(zone.building_coverage_ratio)} />
          <Row label="Baumassenziffer (BMZ)" value={fmt(zone.building_mass_ratio)} />
          <Row label="Freiflächenziffer (FFZ)" value={fmt(zone.open_space_ratio)} />
          <Row label="Bauweise" value={fmt(zone.building_type)} />
        </Group>

        <Group title="Masse">
          <Row label="Max. Gesamthöhe" value={fmt(zone.max_height_m, " m")} />
          <Row
            label="Max. Fassadenhöhe"
            value={fmt(zone.max_facade_height_m ?? zone.max_height_valley_m, " m")}
          />
          <Row label="Mehrhöhenzuschlag" value={fmt(zone.height_bonus_m, " m")} />
          <Row label="Max. Gebäudelänge" value={fmt(zone.max_building_length_m, " m")} />
          <Row label="Max. Gebäudebreite" value={fmt(zone.max_building_width_m, " m")} />
          <Row label="Max. Fassadenlänge" value={fmt(zone.max_facade_length_m, " m")} />
        </Group>

        <Group title="Abstände">
          <Row label="Grosser Grundabstand" value={valueOrNote(zone.setback_large_m, zone.setback_note ?? luSetbackNote, " m")} />
          <Row label="Kleiner Grundabstand" value={valueOrNote(zone.setback_small_m, zone.setback_note ?? luSetbackNote, " m")} />
          <Row
            label="Gebäudeabstand"
            value={valueOrNote(
              zone.setback_small_m != null && zone.setback_large_m != null
                ? zone.setback_small_m + zone.setback_large_m
                : null,
              zone.setback_note ?? luSetbackNote,
              " m",
            )}
          />
        </Group>

        <Group title="Freiräume">
          <Row
            label="Spiel- und Ruheflächen"
            value={
              zone.play_area_m2_per_apt != null
                ? `${zone.play_area_m2_per_apt} m² / Wohnung`
                : zone.play_area_requirement ?? luPlayAreaNote ?? "–"
            }
          />
        </Group>

        <Group title="Verkehr">
          <Row label="Parkierung" value={valueOrNote(zone.parking_rate, zone.parking_note ?? luParkingNote)} />
        </Group>

        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Kantonale Grundlage:</span> {basis}
          {zone.article_reference ? ` · ${zone.article_reference}` : ""}
          {zone.source_label ? ` · ${zone.source_label}` : ""}
        </div>
      </CardContent>
    </Card>
  );
}
