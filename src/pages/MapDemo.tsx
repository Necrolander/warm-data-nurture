import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STORE_CONFIG } from "@/config/store";
import { supabase } from "@/integrations/supabase/client";

const STORE = STORE_CONFIG.coordinates;

// Simulated drivers moving around the store
const MOCK_DRIVERS = [
  { id: "1", name: "Carlos Motoboy", status: "on_route", lat: -16.010, lng: -48.055, color: "#3b82f6" },
  { id: "2", name: "Ana Entregadora", status: "available", lat: -16.018, lng: -48.063, color: "#22c55e" },
  { id: "3", name: "Marcos Rápido", status: "on_route", lat: -16.008, lng: -48.050, color: "#3b82f6" },
];

const MOCK_ORDERS = [
  { id: "o1", order_number: 142, customer_name: "João Silva", lat: -16.005, lng: -48.045 },
  { id: "o2", order_number: 143, customer_name: "Maria Santos", lat: -16.020, lng: -48.070 },
  { id: "o3", order_number: 145, customer_name: "Pedro Lima", lat: -16.025, lng: -48.055 },
];

const MOCK_ROUTE_LINES = [
  { points: [[STORE.lat, STORE.lng], [-16.010, -48.055], [-16.005, -48.045]], color: "#3b82f6" },
  { points: [[STORE.lat, STORE.lng], [-16.008, -48.050], [-16.025, -48.055]], color: "#8b5cf6" },
];

const MapDemo = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const polylinesRef = useRef<L.Layer[]>([]);
  const [useReal, setUseReal] = useState(false);
  const [realDrivers, setRealDrivers] = useState<any[]>([]);
  const [realOrders, setRealOrders] = useState<any[]>([]);
  const [realRoutes, setRealRoutes] = useState<any[]>([]);

  const loadRealData = async () => {
    const [{ data: d }, { data: r }, { data: o }] = await Promise.all([
      supabase.from("delivery_persons").select("*").eq("is_active", true).eq("is_online", true),
      supabase.from("routes").select("*").in("status", ["created", "assigned", "in_delivery"]),
      supabase.from("orders").select("*").eq("status", "ready").is("route_id", null).eq("order_type", "delivery"),
    ]);
    setRealDrivers(d || []);
    setRealRoutes(r || []);
    setRealOrders(o || []);
  };

  useEffect(() => {
    loadRealData();
  }, []);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([STORE.lat, STORE.lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);
    mapInstanceRef.current = map;

    setTimeout(() => map.invalidateSize(), 300);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    polylinesRef.current.forEach(p => p.remove());
    markersRef.current = [];
    polylinesRef.current = [];

    // Store marker
    const storeIcon = L.divIcon({
      html: '<div style="background:#ef4444;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.4)">🏪</div>',
      iconSize: [36, 36],
      className: "",
    });
    markersRef.current.push(
      L.marker([STORE.lat, STORE.lng], { icon: storeIcon }).addTo(map).bindPopup("<b>Truebox Hamburgueria</b><br>Base de operações")
    );

    if (useReal) {
      // Real data
      realDrivers.forEach(d => {
        if (!d.current_lat || !d.current_lng) return;
        const color = d.status === "on_route" ? "#3b82f6" : "#22c55e";
        const icon = L.divIcon({
          html: `<div style="background:${color};color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">🏍️</div>`,
          iconSize: [30, 30], className: "",
        });
        markersRef.current.push(L.marker([d.current_lat, d.current_lng], { icon }).addTo(map).bindPopup(`<b>${d.name}</b><br>${d.status}`));
      });
      realOrders.forEach(o => {
        if (!o.delivery_lat || !o.delivery_lng) return;
        const icon = L.divIcon({
          html: '<div style="background:#f59e0b;color:white;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">📦</div>',
          iconSize: [26, 26], className: "",
        });
        markersRef.current.push(L.marker([o.delivery_lat, o.delivery_lng], { icon }).addTo(map).bindPopup(`<b>#${o.order_number}</b><br>${o.customer_name}`));
      });
    } else {
      // Simulated data
      MOCK_DRIVERS.forEach(d => {
        const icon = L.divIcon({
          html: `<div style="background:${d.color};color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">🏍️</div>`,
          iconSize: [30, 30], className: "",
        });
        markersRef.current.push(L.marker([d.lat, d.lng], { icon }).addTo(map).bindPopup(`<b>${d.name}</b><br>Status: ${d.status === "on_route" ? "Em rota" : "Disponível"}`));
      });

      MOCK_ORDERS.forEach(o => {
        const icon = L.divIcon({
          html: '<div style="background:#f59e0b;color:white;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">📦</div>',
          iconSize: [26, 26], className: "",
        });
        markersRef.current.push(L.marker([o.lat, o.lng], { icon }).addTo(map).bindPopup(`<b>#${o.order_number}</b><br>${o.customer_name}<br>Aguardando rota`));
      });

      // Route lines
      MOCK_ROUTE_LINES.forEach(r => {
        const polyline = L.polyline(r.points as L.LatLngExpression[], {
          color: r.color, weight: 3, opacity: 0.7, dashArray: "8, 6",
        }).addTo(map);
        polylinesRef.current.push(polyline);
      });
    }

    // Fit all markers
    if (markersRef.current.length > 1) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.15));
    }
  }, [useReal, realDrivers, realOrders, realRoutes]);

  const driverCount = useReal ? realDrivers.length : MOCK_DRIVERS.length;
  const orderCount = useReal ? realOrders.length : MOCK_ORDERS.length;
  const routeCount = useReal ? realRoutes.length : MOCK_ROUTE_LINES.length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">🗺️ Mapa Operacional</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <Badge variant="outline" className="gap-1">📦 {orderCount} aguardando</Badge>
          <Badge variant="outline" className="gap-1">🏍️ {driverCount} online</Badge>
          <Badge variant="outline" className="gap-1">🛣️ {routeCount} rotas</Badge>
          <Button
            size="sm"
            variant={useReal ? "default" : "outline"}
            onClick={() => setUseReal(!useReal)}
          >
            {useReal ? "Dados Reais" : "Simulação"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg">
          <div ref={mapRef} style={{ width: "100%", height: "70vh", minHeight: "500px" }} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">🏪 Loja</span>
        <span className="flex items-center gap-1">📦 Pedido Aguardando</span>
        <span className="flex items-center gap-1">🟢 Motoboy Disponível</span>
        <span className="flex items-center gap-1">🔵 Motoboy Em Rota</span>
        <span className="flex items-center gap-1">--- Rota de Entrega</span>
      </div>
    </div>
  );
};

export default MapDemo;
