import type { OEREBTopic } from "@/lib/swiss-geo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function OEREBTopicsTable({
  topics,
  note,
}: {
  topics: OEREBTopic[];
  note?: string | null;
}) {
  if (!topics.length) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {note ?? "ÖREB-Daten konnten nicht geladen werden. Koordinaten oder EGRID fehlen."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">ÖREB-Thema</TableHead>
              <TableHead>Typ / Beschreibung</TableHead>
              <TableHead className="w-[15%]">Anteil / Fläche</TableHead>
              <TableHead className="w-[25%]">Zuständige Stelle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map((t, i) => (
              <TableRow key={`${t.theme}-${i}`}>
                <TableCell className="font-medium">{t.theme}</TableCell>
                <TableCell>
                  <span>{t.type ?? "—"}</span>
                  {t.legal_basis && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t.legal_basis}
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {t.area_m2 != null
                    ? `${t.area_m2.toLocaleString("de-CH")} m²`
                    : t.coverage ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.authority ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Quelle: Schweizerischer ÖREB-Kataster (api3.geo.admin.ch) — Abruf automatisch.
        Für rechtsverbindliche Auszüge: <code>map.geo.admin.ch</code> oder kantonaler ÖREB-Kataster.
      </p>
    </div>
  );
}
