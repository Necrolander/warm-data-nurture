import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { STORE_CONFIG } from "@/config/store";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, RefreshCw } from "lucide-react";

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

type MapState = "idle" | "loading" | "ready" | "error";

const MapPicker = ({ onLocationSelect, selectedLocation }: MapPickerProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<MapState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const onLocationSelectRef = useRef(onLocationSelect);
  onLocationSelectRef.current = onLocationSelect;

  const initMap = useCallback((lat: number, lng: number) => {
    if (!containerRef.current) return;

    // Clean up existing map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }

    const map = L.map(containerRef.current).setView([lat, lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add marker at user location
    markerRef.current = L.marker([lat, lng], { icon: DefaultIcon }).addTo(map);
    onLocationSelectRef.current(lat, lng);

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([e.latlng.lat, e.latlng.lng], { icon: DefaultIcon }).addTo(map);
      onLocationSelectRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    setMapState("ready");

    // Fix map rendering after container becomes visible
    setTimeout(() => map.invalidateSize(), 200);
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMsg("Seu navegador não suporta geolocalização.");
      setMapState("error");
      return;
    }

    setMapState("loading");
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        initMap(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.error("Geolocation error:", err);
        if (err.code === 1) {
          setErrorMsg("Permissão de localização negada. Ative o GPS e permita o acesso.");
        } else if (err.code === 2) {
          setErrorMsg("Não foi possível obter sua localização. Verifique se o GPS está ligado.");
        } else {
          setErrorMsg("Tempo esgotado ao buscar localização. Tente novamente.");
        }
        setMapState("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [initMap]);

  const openWithDefault = useCallback(() => {
    initMap(STORE_CONFIG.coordinates.lat, STORE_CONFIG.coordinates.lng);
  }, [initMap]);

  // Update marker when selectedLocation changes from outside
  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([selectedLocation.lat, selectedLocation.lng], { icon: DefaultIcon }).addTo(mapRef.current);
    mapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 15);
  }, [selectedLocation]);

  return (
    <div className="space-y-3">
      {mapState === "idle" && (
        <div className="flex flex-col items-center gap-4 py-8">
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
          <button
            type="button"
            onClick={openWithDefault}
            className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
          >
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
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-destructive" />
          </div>
          <p className="text-destructive font-bold text-center text-sm">{errorMsg}</p>
          <button
            type="button"
            onClick={requestLocation}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground font-bold px-6 py-3 rounded-xl shadow-lg hover:brightness-110 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={openWithDefault}
            className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
          >
            Marcar no mapa manualmente
          </button>
        </div>
      )}

      {mapState === "ready" && (
        <>
          <p className="text-xs text-muted-foreground">
            Toque no mapa para ajustar o ponto de entrega
          </p>
          <div
            ref={containerRef}
            className="h-72 rounded-xl overflow-hidden border border-border"
            style={{ zIndex: 0 }}
          />
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

      {/* Hidden container for map when not in ready state yet */}
      {mapState !== "ready" && (
        <div ref={containerRef} className="hidden" />
      )}
    </div>
  );
};

export default MapPicker;
