import { useState, useCallback, useRef } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  searchSwissLocation,
  identifyParcelAt,
  type SwissGeoSearchResult,
  type SwissParcelInfo,
} from "@/lib/swiss-geo";

// swisstopo WMTS Basiskarte (Pixelkarte farbig), kostenlos, kein API-Key nötig
const SWISSTOPO_STYLE = {
  version: 8 as const,
  sources: {
    swisstopo: {
      type: "raster" as const,
      tiles: [
        "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
      ],
      tileSize: 256,
      attribution: "© swisstopo",
      maxzoom: 18,
    },
  },
  layers: [{ id: "swisstopo-layer", type: "raster" as const, source: "swisstopo" }],
};

const DEFAULT_VIEW = { longitude: 8.2275, latitude: 46.8182, zoom: 7 };

type SwissMapProps = {
  mode: "interactive" | "readonly";
  lat?: number | null;
  lng?: number | null;
  onParcelSelected?: (data: {
    lat: number;
    lng: number;
    address: string | null;
    municipality: string | null;
    canton: string | null;
    parcelNumber: string | null;
    egrid: string | null;
  }) => void;
  className?: string;
  heightClassName?: string;
};

export function SwissMap({
  mode,
  lat,
  lng,
  onParcelSelected,
  className,
  heightClassName = "h-80",
}: SwissMapProps) {
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
        address: fallbackAddress,
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

  return (
    <div className={cn("space-y-2", className)}>
      {mode === "interactive" && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Adresse, Ort oder Parzelle suchen …"
            value={searchQuery}
            onChange={(e) => runSearch(e.target.value)}
            className="pl-9"
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
      )}

      <div className={cn("relative overflow-hidden rounded-md border", heightClassName)}>
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          onClick={handleMapClick}
          mapStyle={SWISSTOPO_STYLE as any}
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
      </div>

      {mode === "interactive" && (
        <p className="text-xs text-muted-foreground">
          {identifying
            ? "Parzelle wird ermittelt …"
            : "Adresse eingeben oder direkt auf die gewünschte Parzelle in der Karte klicken."}
        </p>
      )}
    </div>
  );
}
