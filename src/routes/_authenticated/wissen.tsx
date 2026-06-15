import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen, Search, MapPin, FileText, Layers, X, ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";

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

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
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
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
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
                        <span className="text-xs text-muted-foreground tabular-nums">
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

function highlight(text: string, needle: string) {
  if (!needle.trim()) return text;
  const re = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function MunicipalityWiki(props: {
  municipalityId: string;
  q: string;
  onSearch: (q: string) => void;
}) {
  const { municipalityId, q, onSearch } = props;

  // Debounced local input for instant feel without thrashing URL
  const [localQ, setLocalQ] = useState(q);
  useEffect(() => setLocalQ(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (localQ !== q) onSearch(localQ);
    }, 150);
    return () => clearTimeout(t);
  }, [localQ, q, onSearch]);

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

  const docMap = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);

  const filtered = useMemo(() => {
    if (!localQ.trim()) return entries;
    const needle = localQ.toLowerCase();
    return entries.filter((e) =>
      [e.category, e.key, e.value ?? "", e.source_article ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [entries, localQ]);

  // Group by key (zone or "ALLGEMEIN")
  const groups = useMemo(() => {
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

  const groupKeys = useMemo(() => groups.map(([k]) => k), [groups]);
  const [openItems, setOpenItems] = useState<string[]>([]);

  // When searching, auto-expand all matching groups
  useEffect(() => {
    if (localQ.trim()) setOpenItems(groupKeys);
  }, [localQ, groupKeys]);

  const allOpen = openItems.length === groupKeys.length && groupKeys.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{muni?.name ?? "—"}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                {muni?.canton && (
                  <Badge variant="outline">
                    {(muni.canton as { code?: string }).code} —{" "}
                    {(muni.canton as { name?: string }).name}
                  </Badge>
                )}
                <span>
                  {entries.length} Einträge · {docs.length} Dokument(e)
                  {localQ.trim() && (
                    <span className="ml-1 text-foreground">· {filtered.length} Treffer</span>
                  )}
                </span>
              </CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={localQ}
                onChange={(e) => setLocalQ(e.target.value)}
                placeholder="Im Reglement suchen…"
                className="pl-8 pr-8"
              />
              {localQ && (
                <button
                  type="button"
                  onClick={() => setLocalQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
                  aria-label="Suche löschen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
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
            Keine Treffer für „{localQ}".
          </CardContent>
        </Card>
      )}

      {!isLoading && groups.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {groups.length} {groups.length === 1 ? "Bereich" : "Bereiche"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenItems(allOpen ? [] : groupKeys)}
              className="gap-1.5 text-xs"
            >
              {allOpen ? (
                <>
                  <ChevronsDownUp className="h-3.5 w-3.5" /> Alle schliessen
                </>
              ) : (
                <>
                  <ChevronsUpDown className="h-3.5 w-3.5" /> Alle öffnen
                </>
              )}
            </Button>
          </div>

          <Accordion
            type="multiple"
            value={openItems}
            onValueChange={setOpenItems}
            className="space-y-2"
          >
            {groups.map(([zoneKey, list]) => (
              <AccordionItem
                key={zoneKey}
                value={zoneKey}
                className="rounded-lg border bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-3 pr-2">
                    <span className="flex items-center gap-2 text-left font-medium">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      {highlight(zoneKey, localQ)}
                    </span>
                    <Badge variant="outline" className="shrink-0 tabular-nums">
                      {list.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <dl className="divide-y divide-border/60 text-sm">
                    {list.map((e) => (
                      <div
                        key={e.id}
                        className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-3"
                      >
                        <dt className="font-medium text-muted-foreground">
                          {highlight(e.category, localQ)}
                        </dt>
                        <dd>
                          <div className="whitespace-pre-wrap">
                            {highlight(e.value ?? "—", localQ)}
                          </div>
                          {(e.source_article || e.source_document) && (
                            <div className="mt-1 text-xs text-muted-foreground">
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
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      )}
    </div>
  );
}
