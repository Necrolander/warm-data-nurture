import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getStoreCoords } from "@/services/routing/distanceUtils";
import { getDriverPresence } from "@/lib/driverPresence";

const OperationalMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const polylinesRef = useRef<L.Layer[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  // Filtro: por padrão só exibe motoboys efetivamente online (GPS recente).
  const [onlyOnline, setOnlyOnline] = useState<boolean>(() => {
    const saved = localStorage.getItem("op_map_only_online");
    return saved === null ? true : saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("op_map_only_online", String(onlyOnline));
  }, [onlyOnline]);

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
    // Auto-refresh a cada 15s para refletir GPS/status do motoboy.
    // Pausa quando a aba está oculta e dispara um refresh imediato ao voltar ao foco.
    let interval = window.setInterval(() => {
      if (document.visibilityState === "visible") loadData();
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    const channel = supabase.channel("op-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_persons" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "routes" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadData)
      .subscribe();

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const store = getStoreCoords();

    const map = L.map(mapRef.current).setView([store.lat, store.lng], 13);
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

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

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
      const presence = getDriverPresence(d);
      // Quando o filtro está ativo, oculta motoboys com GPS parado/offline.
      if (onlyOnline && !presence.isEffectivelyOnline) return;
      const color = presence.state === "on_route"
        ? "hsl(var(--primary))"
        : presence.state === "stale"
          ? "hsl(var(--warning))"
          : presence.state === "paused"
            ? "hsl(var(--muted-foreground))"
            : "hsl(var(--success))";
      const icon = L.divIcon({
        html: `<div style="background:${color};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">🏍️</div>`,
        iconSize: [28, 28],
        className: "",
      });
      markersRef.current.push(
        L.marker([d.current_lat, d.current_lng], { icon })
          .addTo(map)
          .bindPopup(`${d.name}<br>Status: ${presence.label}${presence.lastSeenMin !== null ? `<br>Último GPS: ${presence.lastSeenMin === 0 ? "agora" : `${presence.lastSeenMin}m`}` : ""}`)
      );
    });

    // Fit bounds to show all markers
    if (markersRef.current.length > 1) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }, [drivers, pendingOrders, routes, onlyOnline]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground">Mapa Operacional</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-card">
            <Switch id="only-online" checked={onlyOnline} onCheckedChange={setOnlyOnline} />
            <Label htmlFor="only-online" className="text-xs cursor-pointer">
              Somente online (GPS recente)
            </Label>
          </div>
          <Badge variant="outline" className="gap-1">📦 {pendingOrders.length} aguardando</Badge>
          <Badge variant="outline" className="gap-1">🏍️ {drivers.filter((driver) => getDriverPresence(driver).isEffectivelyOnline).length} online</Badge>
          {!onlyOnline && (
            <Badge variant="outline" className="gap-1">🟠 {drivers.filter((driver) => getDriverPresence(driver).state === "stale").length} GPS parado</Badge>
          )}
          <Badge variant="outline" className="gap-1">🛣️ {routes.length} rotas ativas</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div ref={mapRef} className="w-full h-[600px] rounded-lg" />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">🏪 Loja</span>
        <span className="flex items-center gap-1">📦 Pedido Aguardando</span>
        <span className="flex items-center gap-1 text-green-500">🏍️ Disponível</span>
        <span className="flex items-center gap-1 text-blue-500">🏍️ Em Rota</span>
        <span className="flex items-center gap-1 text-amber-500">🏍️ GPS parado</span>
      </div>
    </div>
  );
};

export default OperationalMap;
