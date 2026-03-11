import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { STORE_CONFIG } from "@/config/store";
import "leaflet/dist/leaflet.css";

// Fix default marker icon using CDN URLs instead of imports
const DefaultIcon = L.icon({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation: { lat: number; lng: number } | null;
}

function LocationMarker({
  onLocationSelect,
  selectedLocation,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation: { lat: number; lng: number } | null;
}) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return selectedLocation ? (
    <Marker position={[selectedLocation.lat, selectedLocation.lng]} />
  ) : null;
}

const MapPicker = ({ onLocationSelect, selectedLocation }: MapPickerProps) => {
  const [loading, setLoading] = useState(false);

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

      <div className="h-64 rounded-xl overflow-hidden border border-border">
        <MapContainer
          center={[STORE_CONFIG.coordinates.lat, STORE_CONFIG.coordinates.lng]}
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker onLocationSelect={onLocationSelect} selectedLocation={selectedLocation} />
        </MapContainer>
      </div>

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
