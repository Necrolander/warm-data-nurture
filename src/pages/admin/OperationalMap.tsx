import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStoreCoords } from "@/services/routing/distanceUtils";

const OperationalMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  const loadData = async () => {
    const [{ data: d }, { data: r }, { data: o }] = await Promise.all([
      supabase.from("delivery_persons").select("*").eq("is_active", true).eq("is_online", true),
      supabase.from("routes").select("*").in("status", ["created", "assigned", "in_delivery"]),
      supabase.from("orders").select("*").eq("status", "ready").is("route_id", null).eq("order_type", "delivery"),
    ]);
    setDrivers(d || []);
    setRoutes(r || []);
    setPendingOrders(o || []);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    const channel = supabase.channel("op-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_persons" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "routes" }, loadData)
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const store = getStoreCoords();
    const L = (window as any).L;
    if (!L) return;
    
    const map = L.map(mapRef.current).setView([store.lat, store.lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);
    mapInstanceRef.current = map;
    
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    polylinesRef.current.forEach(p => p.remove());
    markersRef.current = [];
    polylinesRef.current = [];

    const store = getStoreCoords();

    // Store marker
    const storeIcon = L.divIcon({
      html: '<div style="background:#ef4444;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">🏪</div>',
      iconSize: [32, 32],
      className: "",
    });
    markersRef.current.push(L.marker([store.lat, store.lng], { icon: storeIcon }).addTo(map).bindPopup("Truebox Hamburgueria"));

    // Pending orders
    pendingOrders.forEach(o => {
      if (!o.delivery_lat || !o.delivery_lng) return;
      const icon = L.divIcon({
        html: '<div style="background:#f59e0b;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3)">📦</div>',
        iconSize: [24, 24],
        className: "",
      });
      markersRef.current.push(
        L.marker([o.delivery_lat, o.delivery_lng], { icon })
          .addTo(map)
          .bindPopup(`#${o.order_number} - ${o.customer_name}<br>Aguardando rota`)
      );
    });

    // Drivers
    drivers.forEach(d => {
      if (!d.current_lat || !d.current_lng) return;
      const color = (d as any).status === "on_route" ? "#3b82f6" : "#22c55e";
      const icon = L.divIcon({
        html: `<div style="background:${color};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">🏍️</div>`,
        iconSize: [28, 28],
        className: "",
      });
      markersRef.current.push(
        L.marker([d.current_lat, d.current_lng], { icon })
          .addTo(map)
          .bindPopup(`${d.name}<br>Status: ${(d as any).status || "online"}`)
      );
    });

  }, [drivers, pendingOrders, routes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Mapa Operacional</h2>
        <div className="flex gap-3">
          <Badge variant="outline" className="gap-1">📦 {pendingOrders.length} aguardando</Badge>
          <Badge variant="outline" className="gap-1">🏍️ {drivers.length} online</Badge>
          <Badge variant="outline" className="gap-1">🛣️ {routes.length} rotas ativas</Badge>
        </div>
      </div>
      


      
      <Card>
        <CardContent className="p-0">
          <div ref={mapRef} className="w-full h-[600px] rounded-lg" />
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">🏪 Loja</span>
        <span className="flex items-center gap-1">📦 Pedido Aguardando</span>
        <span className="flex items-center gap-1">🏍️ Motoboy</span>
      </div>
    </div>
  );
};

export default OperationalMap;
