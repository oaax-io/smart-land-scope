import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BookOpen, Search, MapPin, FileText, Layers } from "lucide-react";

type RouteSearch = { m: string; q: string };

export const Route = createFileRoute("/_authenticated/wissen")({
  validateSearch: (s: Record<string, unknown>): RouteSearch => ({
    m: typeof s.m === "string" ? s.m : "",
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: WissenPage,
});

type Muni = {
  id: string;
  name: string;
  canton: { code: string; name: string } | null;
  entry_count: number;
};

function useMunicipalities() {
  return useQuery({
    queryKey: ["wissen-munis"],
    queryFn: async (): Promise<Muni[]> => {
      const { data: munis, error } = await supabase
        .from("municipalities")
        .select("id, name, canton:cantons(code, name)")
        .order("name");
      if (error) throw error;
      const { data: counts } = await supabase
        .from("knowledge_entries")
        .select("municipality_id");
      const map = new Map<string, number>();
      (counts ?? []).forEach((r) => {
        map.set(r.municipality_id, (map.get(r.municipality_id) ?? 0) + 1);
      });
      return (munis ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        canton: (m.canton as { code: string; name: string } | null) ?? null,
        entry_count: map.get(m.id) ?? 0,
      }));
    },
  });
}

function WissenPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: munis = [], isLoading } = useMunicipalities();

  const [muniFilter, setMuniFilter] = useState("");
  const filteredMunis = useMemo(
    () =>
      munis.filter((m) => {
        if (!muniFilter.trim()) return true;
        const q = muniFilter.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.canton?.code ?? "").toLowerCase().includes(q) ||
          (m.canton?.name ?? "").toLowerCase().includes(q)
        );
      }),
    [munis, muniFilter],
  );

  const selectedId = search.m || munis[0]?.id || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-7 w-7" /> Wissensdatenbank
        </h1>
        <p className="text-muted-foreground">
          Durchsuche alle erfassten Schweizer Bau- und Zonenreglemente nach Gemeinde, Zone oder Stichwort.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Gemeinden</CardTitle>
            <CardDescription>{munis.length} erfasst</CardDescription>
            <div className="relative pt-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={muniFilter}
                onChange={(e) => setMuniFilter(e.target.value)}
                placeholder="Gemeinde / Kanton…"
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[70vh] overflow-y-auto p-2">
            {isLoading && <p className="p-2 text-sm text-muted-foreground">Lade…</p>}
            {!isLoading && filteredMunis.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">Keine Gemeinden.</p>
            )}
            <ul className="space-y-1">
              {filteredMunis.map((m) => {
                const active = m.id === selectedId;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate({ search: (prev: RouteSearch) => ({ ...prev, m: m.id }) })
                      }
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                        active ? "bg-accent font-medium" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{m.name}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {m.canton && (
                          <Badge variant="outline" className="text-[10px]">
                            {m.canton.code}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {m.entry_count}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <div>
          {selectedId ? (
            <MunicipalityWiki
              municipalityId={selectedId}
              q={search.q}
              onSearch={(q) =>
                navigate({ search: (prev: RouteSearch) => ({ ...prev, q }) })
              }
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Noch keine Gemeinde erfasst. Lege im Admin-Bereich ein Reglement an.
                <div className="mt-4">
                  <Link to="/admin/reglemente" className="text-primary underline">
                    Zum Reglemente-Modul
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Per-Municipality Wiki
// ============================================================

type Entry = {
  id: string;
  category: string;
  key: string;
  value: string | null;
  source_article: string | null;
  source_document: string | null;
};

type Doc = { id: string; title: string; doc_type: string; version: string | null };

function MunicipalityWiki(props: {
  municipalityId: string;
  q: string;
  onSearch: (q: string) => void;
}) {
  const { municipalityId, q, onSearch } = props;

  const { data: muni } = useQuery({
    queryKey: ["wissen-muni", municipalityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("id, name, canton:cantons(code, name)")
        .eq("id", municipalityId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["wissen-docs", municipalityId],
    queryFn: async (): Promise<Doc[]> => {
      const { data, error } = await supabase
        .from("regulation_documents")
        .select("id, title, doc_type, version")
        .eq("municipality_id", municipalityId)
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["wissen-entries", municipalityId],
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from("knowledge_entries")
        .select("id, category, key, value, source_article, source_document")
        .eq("municipality_id", municipalityId)
        .order("category")
        .order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  const docMap = useMemo(
    () => new Map(docs.map((d) => [d.id, d])),
    [docs],
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return entries;
    const needle = q.toLowerCase();
    return entries.filter((e) =>
      [e.category, e.key, e.value ?? "", e.source_article ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [entries, q]);

  // Group by zone-key when category is per-zone, else by category
  const byZone = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of filtered) {
      const k = e.key && e.key !== "ALLGEMEIN" ? e.key : "ALLGEMEIN";
      const arr = m.get(k) ?? [];
      arr.push(e);
      m.set(k, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => {
      if (a === "ALLGEMEIN") return 1;
      if (b === "ALLGEMEIN") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{muni?.name ?? "—"}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                {muni?.canton && (
                  <Badge variant="outline">
                    {(muni.canton as { code?: string }).code} —{" "}
                    {(muni.canton as { name?: string }).name}
                  </Badge>
                )}
                <span>{entries.length} Einträge · {docs.length} Dokument(e)</span>
              </CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Im Reglement suchen…"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        {docs.length > 0 && (
          <CardContent className="flex flex-wrap gap-2">
            {docs.map((d) => (
              <Badge key={d.id} variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" />
                {d.doc_type} — {d.title}
                {d.version ? ` (${d.version})` : ""}
              </Badge>
            ))}
          </CardContent>
        )}
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Lade Einträge…</CardContent>
        </Card>
      )}

      {!isLoading && entries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Für diese Gemeinde wurden noch keine Wissenseinträge extrahiert.
            <div className="mt-4">
              <Link to="/admin/reglemente" className="text-primary underline">
                Reglement im Admin erneut analysieren
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && entries.length > 0 && filtered.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Keine Treffer für „{q}".
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {byZone.map(([zoneKey, list]) => (
          <Card key={zoneKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                {zoneKey}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {list.map((e) => (
                  <div
                    key={e.id}
                    className="grid grid-cols-[140px_1fr] gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                  >
                    <dt className="font-medium text-muted-foreground">
                      {e.category}
                    </dt>
                    <dd>
                      <div>{e.value}</div>
                      {(e.source_article || e.source_document) && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {e.source_article ? `Art. ${e.source_article}` : ""}
                          {e.source_document && docMap.get(e.source_document)
                            ? `${e.source_article ? " · " : ""}${docMap.get(e.source_document)!.doc_type}`
                            : ""}
                        </div>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
