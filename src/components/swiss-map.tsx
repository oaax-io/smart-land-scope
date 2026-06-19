import { useState, useCallback, useRef } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, Search, Loader2, Maximize2, Locate } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  searchSwissLocation,
  identifyParcelAt,
  type SwissGeoSearchResult,
  type SwissParcelInfo,
} from "@/lib/swiss-geo";

// swisstopo WMTS — Kartenstile
function buildMapStyle(base: "cadastral" | "aerial") {
  const baseTiles =
    base === "aerial"
      ? "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg"
      : "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg";
  return {
    version: 8 as const,
    sources: {
      "swisstopo-base": {
        type: "raster" as const,
        tiles: [baseTiles],
        tileSize: 256,
        attribution: "© swisstopo",
        maxzoom: 18,
      },
      "swisstopo-cadastral": {
        type: "raster" as const,
        tiles: [
          "https://wmts.geo.admin.ch/1.0.0/ch.kantone.cadastralwebmap-farbe/default/current/3857/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© swisstopo / Kantone (Amtliche Vermessung)",
        maxzoom: 19,
      },
    },
    layers: [
      { id: "base-layer", type: "raster" as const, source: "swisstopo-base" },
      { id: "cadastral-layer", type: "raster" as const, source: "swisstopo-cadastral" },
    ],
  };
}


const DEFAULT_VIEW = { longitude: 8.2275, latitude: 46.8182, zoom: 7 };

type SwissMapProps = {
  mode: "interactive" | "readonly";
  lat?: number | null;
  lng?: number | null;
  onParcelSelected?: (data: {
    lat: number;
    lng: number;
    address: string | null;
    postalCode: string | null;
    municipality: string | null;
    canton: string | null;
    parcelNumber: string | null;
    egrid: string | null;
  }) => void;
  className?: string;
  heightClassName?: string;
  allowExpand?: boolean;
  floatingSearch?: boolean;
};

export function SwissMap({
  mode,
  lat,
  lng,
  onParcelSelected,
  className,
  heightClassName = "h-80",
  allowExpand = true,
  floatingSearch = false,
}: SwissMapProps) {
  const [expanded, setExpanded] = useState(false);
  const [baseLayer, setBaseLayer] = useState<"cadastral" | "aerial">("cadastral");
  const mapRef = useRef<MapRef | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SwissGeoSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    lat != null && lng != null ? { lat, lng } : null,
  );

  const [viewState, setViewState] = useState(
    lat != null && lng != null
      ? { longitude: lng, latitude: lat, zoom: 16 }
      : DEFAULT_VIEW,
  );

  const runSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchSwissLocation(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  async function resolveParcelAt(
    lat: number,
    lng: number,
    fallbackAddress: string | null,
  ) {
    setIdentifying(true);
    try {
      const parcel: SwissParcelInfo | null = await identifyParcelAt(lng, lat);
      onParcelSelected?.({
        lat,
        lng,
        address: parcel?.address ?? fallbackAddress,
        postalCode: parcel?.postalCode ?? null,
        municipality: parcel?.municipality ?? null,
        canton: parcel?.canton ?? null,
        parcelNumber: parcel?.parcelNumber ?? null,
        egrid: parcel?.egrid ?? null,
      });
    } catch {
      onParcelSelected?.({
        lat,
        lng,
        address: fallbackAddress,
        postalCode: null,
        municipality: null,
        canton: null,
        parcelNumber: null,
        egrid: null,
      });
    } finally {
      setIdentifying(false);
    }
  }

  async function selectSearchResult(r: SwissGeoSearchResult) {
    const cleanLabel = r.label.replace(/<[^>]+>/g, "");
    setSearchResults([]);
    setSearchQuery(cleanLabel);
    setMarker({ lat: r.lat, lng: r.lng });
    setViewState({ longitude: r.lng, latitude: r.lat, zoom: 17 });
    await resolveParcelAt(r.lat, r.lng, cleanLabel);
  }

  async function handleMapClick(e: { lngLat: { lng: number; lat: number } }) {
    if (mode !== "interactive") return;
    const { lng, lat } = e.lngLat;
    setMarker({ lat, lng });
    await resolveParcelAt(lat, lng, null);
  }

  const searchBox = mode === "interactive" && (
    <div className={cn("relative", floatingSearch && "w-full max-w-md")}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Adresse, Ort oder Parzelle suchen …"
        value={searchQuery}
        onChange={(e) => runSearch(e.target.value)}
        className={cn("pl-9", floatingSearch && "h-11 bg-background/95 shadow-lg backdrop-blur")}
      />
      {searching && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {searchResults.length > 0 && (
        <Card className="absolute z-20 mt-1 max-h-72 w-full overflow-auto p-1 shadow-lg">
          {searchResults.map((r, i) => (
            <button
              key={`${r.featureId ?? i}-${i}`}
              type="button"
              className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => selectSearchResult(r)}
              dangerouslySetInnerHTML={{ __html: r.label }}
            />
          ))}
        </Card>
      )}
    </div>
  );

  return (
    <div className={cn(floatingSearch ? "relative" : "space-y-2", className)}>
      {!floatingSearch && searchBox}

      <div className={cn("relative overflow-hidden border", !floatingSearch && "rounded-md", heightClassName)}>
        {floatingSearch && searchBox && (
          <div className="absolute left-1/2 top-3 z-20 w-[min(90%,28rem)] -translate-x-1/2">
            {searchBox}
          </div>
        )}
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          onClick={handleMapClick}
          mapStyle={buildMapStyle(baseLayer) as any}
          cursor={mode === "interactive" ? "crosshair" : "default"}
          attributionControl={{ compact: true }}
          style={{ width: "100%", height: "100%" }}
        >
          <NavigationControl position="top-right" showCompass={false} />
          {marker && (
            <Marker longitude={marker.lng} latitude={marker.lat} anchor="bottom">
              <MapPin className="h-7 w-7 fill-primary text-primary-foreground drop-shadow" />
            </Marker>
          )}
        </Map>

        {/* Layer-Umschalter */}
        <div className="absolute left-2 top-2 z-10 flex overflow-hidden rounded-md border bg-background/95 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setBaseLayer("cadastral")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium transition-colors",
              baseLayer === "cadastral" ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            Parzellen
          </button>
          <button
            type="button"
            onClick={() => setBaseLayer("aerial")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium transition-colors border-l",
              baseLayer === "aerial" ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            Luftbild
          </button>
        </div>

        {/* Aktionen rechts oben (unter NavigationControl) */}
        {allowExpand && (
          <div className="absolute right-2 bottom-8 z-10 flex flex-col gap-1">
            <Dialog open={expanded} onOpenChange={setExpanded}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 shadow-sm"
                  title="Karte vergrössern"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-6xl p-4">
                <DialogHeader>
                  <DialogTitle>Karte — swisstopo</DialogTitle>
                </DialogHeader>
                <SwissMap
                  mode={mode}
                  lat={marker?.lat ?? lat}
                  lng={marker?.lng ?? lng}
                  onParcelSelected={(d) => {
                    setMarker({ lat: d.lat, lng: d.lng });
                    setViewState((v) => ({ ...v, longitude: d.lng, latitude: d.lat }));
                    onParcelSelected?.(d);
                  }}
                  heightClassName="h-[75vh]"
                  allowExpand={false}
                />
              </DialogContent>
            </Dialog>
            {marker && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8 shadow-sm"
                title="Auf Markierung zentrieren"
                onClick={() =>
                  setViewState((v) => ({
                    ...v,
                    longitude: marker.lng,
                    latitude: marker.lat,
                    zoom: Math.max(v.zoom, 17),
                  }))
                }
              >
                <Locate className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {mode === "interactive" && (
        <p className="text-xs text-muted-foreground">
          {identifying
            ? "Parzelle wird ermittelt …"
            : "Adresse suchen — Parzelle, Gemeinde und Kanton werden automatisch erkannt. Sie können auch direkt in die Karte klicken."}
        </p>
      )}
    </div>
  );
}
