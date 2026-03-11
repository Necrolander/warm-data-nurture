import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { STORE_CONFIG } from "@/config/store";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, RefreshCw, Search } from "lucide-react";

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

const MapPicker = ({ onLocationSelect, selectedLocation }: MapPickerProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<MapState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const pendingLocation = useRef<{ lat: number; lng: number } | null>(null);
  const onLocationSelectRef = useRef(onLocationSelect);
  onLocationSelectRef.current = onLocationSelect;

  // Initialize map once the container is visible
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

  // Update marker when selectedLocation changes externally
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

  const showMapAt = useCallback((lat: number, lng: number) => {
    pendingLocation.current = { lat, lng };
    cleanupMap();
    setMapState("show_map");
  }, [cleanupMap]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMsg("Seu navegador não suporta geolocalização. Use a busca por endereço abaixo.");
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
          setErrorMsg("Permissão negada. Use a busca por endereço abaixo ou abra no navegador do celular.");
        } else if (err.code === 2) {
          setErrorMsg("Não foi possível obter sua localização. Use a busca por endereço abaixo.");
        } else {
          setErrorMsg("Tempo esgotado. Use a busca por endereço ou tente novamente.");
        }
        setMapState("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [showMapAt]);

  const searchAddress = useCallback(async () => {
    if (!addressQuery.trim()) return;
    setSearching(true);
    try {
      const q = encodeURIComponent(addressQuery.trim());
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=br`
      );
      const data = await res.json();
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        showMapAt(lat, lng);
      } else {
        setErrorMsg("Endereço não encontrado. Tente ser mais específico (ex: Rua X, 123, Gama-DF).");
        if (mapState !== "show_map") setMapState("error");
      }
    } catch {
      setErrorMsg("Erro ao buscar endereço. Verifique sua conexão.");
      if (mapState !== "show_map") setMapState("error");
    } finally {
      setSearching(false);
    }
  }, [addressQuery, showMapAt, mapState]);

  const AddressSearch = () => (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-bold">📍 Ou busque seu endereço:</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={addressQuery}
          onChange={(e) => setAddressQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchAddress()}
          placeholder="Ex: Rua 5, Setor Sul, Gama-DF"
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
  );

  return (
    <div className="space-y-3">
      {mapState === "idle" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-sm text-muted-foreground text-center">
            Para encontrar você, precisamos da sua localização 📍
          </p>
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

          <div className="w-full border-t border-border pt-4">
            <AddressSearch />
          </div>

          <button type="button" onClick={() => showMapAt(STORE_CONFIG.coordinates.lat, STORE_CONFIG.coordinates.lng)} className="text-sm text-muted-foreground underline hover:text-foreground transition-colors">
            Marcar no mapa manualmente
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
            <AddressSearch />
          </div>

          <button
            type="button"
            onClick={requestLocation}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground font-bold px-6 py-3 rounded-xl shadow-lg hover:brightness-110 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Tentar GPS novamente
          </button>
          <button type="button" onClick={() => showMapAt(STORE_CONFIG.coordinates.lat, STORE_CONFIG.coordinates.lng)} className="text-sm text-muted-foreground underline hover:text-foreground transition-colors">
            Marcar no mapa manualmente
          </button>
        </div>
      )}

      {mapState === "show_map" && (
        <>
          <p className="text-xs text-muted-foreground">
            Toque no mapa para ajustar o ponto de entrega
          </p>
          <div
            ref={containerRef}
            style={{ height: "288px", width: "100%", zIndex: 0 }}
            className="rounded-xl overflow-hidden border border-border"
          />
          <AddressSearch />
          <button
            type="button"
            onClick={requestLocation}
            className="w-full flex items-center justify-center gap-2 bg-muted text-foreground font-bold py-3 rounded-xl hover:bg-muted/80 transition-colors text-sm"
          >
            <Navigation className="w-4 h-4" />
            Atualizar minha localização
          </button>
          {selectedLocation && (
            <p className="text-success text-sm font-bold text-center">✅ Localização marcada com sucesso</p>
          )}
        </>
      )}
    </div>
  );
};

export default MapPicker;
