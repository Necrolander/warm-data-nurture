import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Clock, Phone, Package } from "lucide-react";
import logo from "@/assets/logo-truebox-new.png";

interface TrackingData {
  id: string;
  order_id: string;
  current_lat: number | null;
  current_lng: number | null;
  is_active: boolean;
  updated_at: string;
}

interface OrderData {
  order_number: number;
  customer_name: string;
  status: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
}

const statusMap: Record<string, { label: string; icon: string; color: string }> = {
  pending: { label: "Aguardando confirmação", icon: "⏳", color: "text-yellow-500" },
  production: { label: "Em preparo", icon: "🍳", color: "text-orange-500" },
  ready: { label: "Pronto para entrega", icon: "✅", color: "text-green-500" },
  out_for_delivery: { label: "Saiu para entrega", icon: "🛵", color: "text-blue-500" },
  delivered: { label: "Entregue", icon: "📦", color: "text-green-600" },
  cancelled: { label: "Cancelado", icon: "❌", color: "text-red-500" },
};

const DeliveryTracking = () => {
  const { token } = useParams();
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const fetchTracking = async () => {
    if (!token) { setError("Token inválido"); return; }

    const { data: trackingData, error: trackingError } = await supabase
      .from("delivery_tracking")
      .select("*")
      .eq("tracking_token", token)
      .single();

    if (trackingError || !trackingData) {
      setError("Rastreamento não encontrado");
      return;
    }

    setTracking(trackingData as any as TrackingData);

    const { data: orderData } = await supabase
      .from("orders")
      .select("order_number, customer_name, status, delivery_lat, delivery_lng")
      .eq("id", (trackingData as any).order_id)
      .single();

    if (orderData) setOrder(orderData as any as OrderData);
  };

  useEffect(() => { fetchTracking(); }, [token]);

  // Realtime tracking updates
  useEffect(() => {
    if (!tracking) return;

    const channel = supabase
      .channel(`tracking-${tracking.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "delivery_tracking",
        filter: `id=eq.${tracking.id}`,
      }, (payload: any) => {
        setTracking(payload.new as TrackingData);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tracking?.id]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (!tracking?.current_lat || !tracking?.current_lng) return;

    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapRef.current).setView([tracking.current_lat, tracking.current_lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    const deliveryIcon = L.divIcon({
      html: '<div style="font-size:28px">🛵</div>',
      iconSize: [32, 32],
      className: "",
    });

    markerRef.current = L.marker([tracking.current_lat, tracking.current_lng], { icon: deliveryIcon }).addTo(map);

    // Customer location marker
    if (order?.delivery_lat && order?.delivery_lng) {
      const customerIcon = L.divIcon({
        html: '<div style="font-size:28px">📍</div>',
        iconSize: [32, 32],
        className: "",
      });
      L.marker([order.delivery_lat, order.delivery_lng], { icon: customerIcon }).addTo(map);

      // Fit bounds to show both markers
      const bounds = L.latLngBounds(
        [tracking.current_lat, tracking.current_lng],
        [order.delivery_lat, order.delivery_lng]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [tracking?.current_lat, tracking?.current_lng, order]);

  // Update marker position when tracking updates
  useEffect(() => {
    if (markerRef.current && tracking?.current_lat && tracking?.current_lng) {
      markerRef.current.setLatLng([tracking.current_lat, tracking.current_lng]);
    }
  }, [tracking?.current_lat, tracking?.current_lng]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-4xl mb-4">😕</p>
          <p className="text-foreground font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!tracking || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const status = statusMap[order.status] || statusMap.pending;
  const lastUpdate = new Date(tracking.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">
      {/* Leaflet CSS */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" />

      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <img src={logo} alt="Truebox" className="h-8" />
          <div>
            <h1 className="text-sm font-bold text-foreground">Pedido #{order.order_number}</h1>
            <p className="text-xs text-muted-foreground">Rastreamento em tempo real</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{status.icon}</span>
            <div>
              <p className={`font-bold ${status.color}`}>{status.label}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Atualizado às {lastUpdate}
              </p>
            </div>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-sm font-medium mb-3">Progresso do pedido</p>
          <div className="space-y-3">
            {["pending", "production", "ready", "out_for_delivery", "delivered"].map((s, i) => {
              const statusInfo = statusMap[s];
              const steps = ["pending", "production", "ready", "out_for_delivery", "delivered"];
              const currentIdx = steps.indexOf(order.status);
              const isComplete = i <= currentIdx;
              const isCurrent = s === order.status;

              return (
                <div key={s} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    isComplete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  } ${isCurrent ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                    {statusInfo.icon}
                  </div>
                  <span className={`text-sm ${isComplete ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {statusInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Map */}
        {tracking.current_lat && tracking.current_lng && order.status === "out_for_delivery" && (
          <div className="bg-card rounded-2xl overflow-hidden border border-border">
            <div className="p-3 border-b border-border">
              <p className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Localização do entregador
              </p>
            </div>
            <div ref={mapRef} className="h-64 w-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryTracking;
