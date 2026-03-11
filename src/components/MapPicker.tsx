import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { STORE_CONFIG } from "@/config/store";
import "leaflet/dist/leaflet.css";

// Fix default marker icon using CDN
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

const MapPicker = ({ onLocationSelect, selectedLocation }: MapPickerProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(
      [STORE_CONFIG.coordinates.lat, STORE_CONFIG.coordinates.lng],
      13
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update marker when selectedLocation changes
  useEffect(() => {
    if (!mapRef.current) return;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (selectedLocation) {
      markerRef.current = L.marker(
        [selectedLocation.lat, selectedLocation.lng],
        { icon: DefaultIcon }
      ).addTo(mapRef.current);
      mapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 15);
    }
  }, [selectedLocation]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationSelect(pos.coords.latitude, pos.coords.longitude);
        setLoading(false);
      },
      () => setLoading(false),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Marque sua casa no mapa para entrega 📍
      </p>
      <p className="text-xs text-muted-foreground">
        Seu endereço pode não aparecer corretamente no mapa. Marque sua casa no mapa para garantir a entrega.
      </p>

      <div
        ref={containerRef}
        className="h-64 rounded-xl overflow-hidden border border-border"
        style={{ zIndex: 0 }}
      />

      <button
        type="button"
        onClick={useMyLocation}
        disabled={loading}
        className="w-full bg-muted text-foreground font-bold py-3 rounded-xl hover:bg-muted/80 transition-colors text-sm"
      >
        {loading ? "Obtendo localização..." : "📍 Usar minha localização"}
      </button>

      {selectedLocation && (
        <p className="text-success text-sm font-bold text-center">
          ✅ Localização marcada com sucesso
        </p>
      )}
    </div>
  );
};

export default MapPicker;
