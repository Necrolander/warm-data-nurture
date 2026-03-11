import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { STORE_CONFIG } from "@/config/store";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, RefreshCw, Search, Link2 } from "lucide-react";

const DefaultIcon = L.icon({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation: { lat: number; lng: number } | null;
}

type MapState = "idle" | "loading" | "show_map" | "error";

const extractCoordinatesFromText = (value: string): { lat: number; lng: number } | null => {
  const text = decodeURIComponent(value.trim());

  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // Google Maps @lat,lng
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // q=lat,lng
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // ll=lat,lng
    /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, // plain lat,lng
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const lat = Number(match[1]);
    const lng = Number(match[2]);

    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
};

const MapPicker = ({ onLocationSelect, selectedLocation }: MapPickerProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<MapState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [mapsLink, setMapsLink] = useState("");
  const [searching, setSearching] = useState(false);
  const [manualError, setManualError] = useState("");
  const pendingLocation = useRef<{ lat: number; lng: number } | null>(null);
  const onLocationSelectRef = useRef(onLocationSelect);
  onLocationSelectRef.current = onLocationSelect;

  useEffect(() => {
    if (mapState !== "show_map") return;
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const loc = pendingLocation.current || {
      lat: STORE_CONFIG.coordinates.lat,
      lng: STORE_CONFIG.coordinates.lng,
    };

    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      const map = L.map(containerRef.current).setView([loc.lat, loc.lng], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      markerRef.current = L.marker([loc.lat, loc.lng], { icon: DefaultIcon }).addTo(map);
      onLocationSelectRef.current(loc.lat, loc.lng);

      map.on("click", (e: L.LeafletMouseEvent) => {
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = L.marker([e.latlng.lat, e.latlng.lng], { icon: DefaultIcon }).addTo(map);
        onLocationSelectRef.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 300);
    }, 100);

    return () => clearTimeout(timer);
  }, [mapState]);

  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([selectedLocation.lat, selectedLocation.lng], { icon: DefaultIcon }).addTo(mapRef.current);
    mapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 15);
  }, [selectedLocation]);

  const cleanupMap = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }
  }, []);

  const showMapAt = useCallback(
    (lat: number, lng: number) => {
      pendingLocation.current = { lat, lng };
      cleanupMap();
      setMapState("show_map");
      setManualError("");
      setErrorMsg("");
    },
    [cleanupMap]
  );

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMsg("Seu navegador não suporta geolocalização. Use busca por endereço ou link do Google Maps.");
      setMapState("error");
      return;
    }

    setMapState("loading");
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        showMapAt(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        if (err.code === 1) {
          setErrorMsg("Permissão negada. Use busca por endereço ou cole o link da sua localização.");
        } else if (err.code === 2) {
          setErrorMsg("Não foi possível obter sua localização. Tente novamente ou use link do Google Maps.");
        } else {
          setErrorMsg("Tempo esgotado. Tente novamente ou use busca manual.");
        }
        setMapState("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [showMapAt]);

  const searchAddress = useCallback(async () => {
    if (!addressQuery.trim()) return;

    setSearching(true);
    setManualError("");

    try {
      const hasDfContext = /(bras[ií]lia|distrito federal|\bdf\b)/i.test(addressQuery);
      const enrichedQuery = hasDfContext ? addressQuery.trim() : `${addressQuery.trim()}, Brasília, Distrito Federal, Brasil`;
      const q = encodeURIComponent(enrichedQuery);

      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${q}`);
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        showMapAt(lat, lng);
      } else {
        setManualError("Endereço não encontrado. Tente com quadra/bloco/número ou cole o link do Google Maps.");
        if (mapState !== "show_map") setMapState("error");
      }
    } catch {
      setManualError("Erro ao buscar endereço. Verifique a conexão e tente novamente.");
      if (mapState !== "show_map") setMapState("error");
    } finally {
      setSearching(false);
    }
  }, [addressQuery, mapState, showMapAt]);

  const useMapsLink = useCallback(() => {
    if (!mapsLink.trim()) return;

    const coords = extractCoordinatesFromText(mapsLink);
    if (!coords) {
      setManualError("Não consegui ler o link. No Google Maps, toque em compartilhar e cole o link completo aqui.");
      return;
    }

    showMapAt(coords.lat, coords.lng);
  }, [mapsLink, showMapAt]);

  const ManualLocationTools = () => (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-bold">📍 Buscar por endereço (com contexto de Brasília):</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchAddress()}
            placeholder="Ex: SQN 210 Bloco C, Asa Norte"
            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={searchAddress}
            disabled={searching || !addressQuery.trim()}
            className="bg-primary text-primary-foreground font-bold px-4 py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
          >
            {searching ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-bold">🔗 Ou cole o link da sua localização do Google Maps:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={mapsLink}
            onChange={(e) => setMapsLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && useMapsLink()}
            placeholder="https://maps.google.com/..."
            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={useMapsLink}
            disabled={!mapsLink.trim()}
            className="bg-secondary text-secondary-foreground font-bold px-4 py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
          >
            <Link2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {manualError && <p className="text-destructive text-xs font-bold">{manualError}</p>}
    </div>
  );

  return (
    <div className="space-y-3">
      {mapState === "idle" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-sm text-muted-foreground text-center">Para encontrar você, precisamos da sua localização 📍</p>
          <button
            type="button"
            onClick={requestLocation}
            className="relative group w-full bg-gradient-to-r from-primary via-primary to-accent text-primary-foreground font-black text-lg py-5 rounded-xl shadow-xl shadow-primary/40 hover:shadow-primary/60 transition-all overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative flex items-center justify-center gap-3">
              <Navigation className="w-6 h-6" />
              Ativar minha localização
            </span>
          </button>
        </div>
      )}

      {mapState === "loading" && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-foreground font-bold">Buscando sua localização...</p>
          <p className="text-xs text-muted-foreground">Aceite a permissão no seu celular</p>
        </div>
      )}

      {mapState === "error" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-destructive" />
          </div>
          <p className="text-destructive font-bold text-center text-sm">{errorMsg}</p>

          <div className="w-full">
            <ManualLocationTools />
          </div>

          <button
            type="button"
            onClick={requestLocation}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground font-bold px-6 py-3 rounded-xl shadow-lg hover:brightness-110 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Tentar GPS novamente
          </button>
          <button
            type="button"
            onClick={() => showMapAt(STORE_CONFIG.coordinates.lat, STORE_CONFIG.coordinates.lng)}
            className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
          >
            Marcar no mapa manualmente
          </button>
        </div>
      )}

      {mapState === "show_map" && (
        <>
          <p className="text-xs text-muted-foreground">Toque no mapa para ajustar o ponto de entrega</p>
          <div ref={containerRef} style={{ height: "288px", width: "100%", zIndex: 0 }} className="rounded-xl overflow-hidden border border-border" />

          <ManualLocationTools />

          <button
            type="button"
            onClick={requestLocation}
            className="w-full flex items-center justify-center gap-2 bg-muted text-foreground font-bold py-3 rounded-xl hover:bg-muted/80 transition-colors text-sm"
          >
            <Navigation className="w-4 h-4" />
            Atualizar minha localização
          </button>
          {selectedLocation && <p className="text-success text-sm font-bold text-center">✅ Localização marcada com sucesso</p>}
        </>
      )}
    </div>
  );
};

export default MapPicker;
