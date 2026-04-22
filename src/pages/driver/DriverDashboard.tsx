import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bike, MapPin, Phone, Package, Navigation, CheckCircle,
  AlertTriangle, Clock, LogOut, History, DollarSign, X, MessageSquare, Route, Bell
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import logo from "@/assets/logo-truebox-new.png";
import DriverOrderView from "@/components/driver/DriverOrderView";
import DriverRouteView from "@/components/driver/DriverRouteView";
import DriverHistory from "@/components/driver/DriverHistory";
import DriverProblemDialog from "@/components/driver/DriverProblemDialog";
import DriverChecklist from "@/components/driver/DriverChecklist";
import DriverChat from "@/components/driver/DriverChat";
import { invokeDriverApp, clearDriverSession } from "@/lib/driverApp";

const MAX_ACTIVE_ORDERS = 3;

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DriverDashboard = () => {
  const navigate = useNavigate();
  const driverId = localStorage.getItem("driver_id");
  const driverName = localStorage.getItem("driver_name");

  const [isOnline, setIsOnline] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [currentOrders, setCurrentOrders] = useState<any[]>([]);
  const [currentOrderItems, setCurrentOrderItems] = useState<Record<string, any[]>>({});
  const [selectedOrderIndex, setSelectedOrderIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showProblem, setShowProblem] = useState(false);
  const [problemOrderId, setProblemOrderId] = useState<string | null>(null);
  const [showPendingOrder, setShowPendingOrder] = useState<any>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [pendingChecklistItems, setPendingChecklistItems] = useState<any[]>([]);

  // Histórico das últimas atribuições recebidas (persistido localmente)
  type AssignmentEntry = { id: string; orderNumber: number; receivedAt: string; address?: string | null };
  const ASSIGN_HISTORY_KEY = `driver_assignments_${driverId ?? "anon"}`;
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentEntry[]>(() => {
    try {
      const raw = localStorage.getItem(`driver_assignments_${localStorage.getItem("driver_id") ?? "anon"}`);
      return raw ? (JSON.parse(raw) as AssignmentEntry[]) : [];
    } catch { return []; }
  });

  const pushAssignmentEntry = useCallback((entry: AssignmentEntry) => {
    setAssignmentHistory((prev) => {
      if (prev.some((e) => e.id === entry.id)) return prev;
      const next = [entry, ...prev].slice(0, 20);
      try { localStorage.setItem(ASSIGN_HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [ASSIGN_HISTORY_KEY]);

  // Route state
  const [activeRoute, setActiveRoute] = useState<any>(null);
  const [routeStops, setRouteStops] = useState<any[]>([]);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"orders" | "route">("orders");

  const locationIntervalRef = useRef<any>(null);
  const arrivedNotifiedRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  const activeOrder = currentOrders[selectedOrderIndex] || null;

  useEffect(() => {
    if (!driverId) { navigate("/entregador/login"); return; }
    loadCurrentOrders();
    loadDriverStatus();
    loadActiveRoute();

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Registra o Service Worker do entregador para notificações em background.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/driver-sw.js")
        .then((reg) => {
          swRegRef.current = reg;
        })
        .catch(() => {});
    }

    // Desbloqueia o áudio na primeira interação (necessário em mobile).
    const unlockAudio = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current?.state === "suspended") {
          audioCtxRef.current.resume();
        }
      } catch {}
      window.removeEventListener("touchstart", unlockAudio);
      window.removeEventListener("click", unlockAudio);
    };
    window.addEventListener("touchstart", unlockAudio, { once: true });
    window.addEventListener("click", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("touchstart", unlockAudio);
      window.removeEventListener("click", unlockAudio);
    };
  }, [driverId]);

  const sendPushNotification = useCallback((title: string, body: string) => {
    // 1) Notificação visual: prioriza Service Worker (funciona com app em segundo plano),
    //    cai para Notification API quando o SW ainda não está pronto.
    const payload = { title, body, tag: "new-order" };
    const sw = swRegRef.current || (navigator.serviceWorker && (navigator.serviceWorker as any).controller);
    if (swRegRef.current && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "NEW_ORDER_NOTIFICATION",
        payload,
      });
    } else if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "new-order",
          renotify: true,
        } as NotificationOptions);
        notification.onclick = () => { window.focus(); notification.close(); };
      } catch {
        navigator.serviceWorker?.ready
          ?.then((reg) => {
            reg.showNotification(title, {
              body,
              icon: "/favicon.ico",
              tag: "new-order",
              renotify: true,
              requireInteraction: true,
              vibrate: [300, 150, 300, 150, 300],
            } as NotificationOptions);
          })
          .catch(() => {});
      }
    }

    // 2) Vibração no celular (funciona mesmo com tela bloqueada em alguns devices).
    try {
      if ("vibrate" in navigator) navigator.vibrate([300, 150, 300, 150, 300]);
    } catch {}

    // 3) Som alto e repetido por ~3s para alertar mesmo com app em segunda instância.
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const playBeep = (offset: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.setValueAtTime(950, ctx.currentTime + offset);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.4);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.45);
      };

      // 5 beeps espaçados (~2.5s no total).
      for (let i = 0; i < 5; i++) playBeep(i * 0.55);
    } catch {}
  }, []);

  // Realtime listeners
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel("driver-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `delivery_person_id=eq.${driverId}` },
        () => { loadCurrentOrders(); })
      .subscribe();

    const routeChannel = supabase
      .channel("driver-routes")
      .on("postgres_changes", { event: "*", schema: "public", table: "routes" },
        (payload: any) => {
          const row = payload.new;
          if (row?.driver_id === driverId) {
            loadActiveRoute();
            if (payload.eventType === "UPDATE" && row.status === "assigned") {
              sendPushNotification("🛣️ Nova Rota Atribuída!", `Rota ${row.code} com entrega(s) para você`);
              toast("🛣️ Nova rota atribuída!", { duration: 8000 });
            }
          }
        })
      .subscribe();

    const availChannel = supabase
      .channel("available-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" },
        (payload: any) => {
          if (isOnline) {
            loadAvailableOrders();
            const newRow = payload.new;
            // Som/push APENAS quando o pedido é atribuído a este motoboy.
            // Pedidos meramente "disponíveis" não disparam mais alerta sonoro
            // para evitar notificações duplicadas para todos os entregadores.
            if (
              newRow?.delivery_person_id === driverId &&
              (payload.eventType === "INSERT" || payload.old?.delivery_person_id !== driverId)
            ) {
              if (!notifiedOrderIdsRef.current.has(`assigned-${newRow.id}`)) {
                notifiedOrderIdsRef.current.add(`assigned-${newRow.id}`);
                sendPushNotification(
                  "🛵 Novo pedido atribuído a você!",
                  `Pedido #${newRow.order_number}`,
                );
                toast("🛵 Novo pedido atribuído!", { duration: 10000 });
                pushAssignmentEntry({
                  id: newRow.id,
                  orderNumber: newRow.order_number,
                  receivedAt: new Date().toISOString(),
                  address: newRow.observation || newRow.reference || null,
                });
              }
            }
          }
        })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(routeChannel);
      supabase.removeChannel(availChannel);
    };
  }, [driverId, isOnline, sendPushNotification]);

  const loadDriverStatus = async () => {
    const { data } = await supabase.from("delivery_persons").select("is_online").eq("id", driverId!).single();
    if (data) setIsOnline(data.is_online ?? false);
  };

  const loadActiveRoute = async () => {
    // Check for assigned/in_delivery route for this driver
    const { data: routes } = await supabase
      .from("routes")
      .select("*")
      .eq("driver_id", driverId!)
      .in("status", ["assigned", "in_delivery"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (routes && routes.length > 0) {
      const route = routes[0];
      setActiveRoute(route);

      // Load stops with order data and items
      const { data: stops } = await supabase
        .from("route_orders")
        .select("*")
        .eq("route_id", route.id)
        .order("stop_order");

      if (stops && stops.length > 0) {
        const orderIds = stops.map((s: any) => s.order_id);
        const [{ data: orders }, { data: items }] = await Promise.all([
          supabase.from("orders").select("*").in("id", orderIds),
          supabase.from("order_items").select("*").in("order_id", orderIds),
        ]);

        const enrichedStops = stops.map((s: any) => ({
          ...s,
          order: (orders || []).find((o: any) => o.id === s.order_id),
          items: (items || []).filter((i: any) => i.order_id === s.order_id),
        }));

        setRouteStops(enrichedStops);

        // Determine current stop index (first non-delivered)
        const firstPending = enrichedStops.findIndex((s: any) => s.order?.status !== "delivered");
        setCurrentStopIndex(firstPending >= 0 ? firstPending : enrichedStops.length);
      }

      // Só força o modo "route" no primeiro carregamento (quando ainda não há pedidos avulsos carregados).
      // Se o motoboy tem pedidos avulsos atribuídos manualmente, deixamos ele escolher entre as duas abas.
      setViewMode((prev) => (prev === "orders" ? "orders" : "route"));
    } else {
      setActiveRoute(null);
      setRouteStops([]);
      setViewMode("orders");
    }
  };

  const loadCurrentOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("delivery_person_id", driverId!)
      .in("status", ["ready", "out_for_delivery"])
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      setCurrentOrders(data);
      const itemsMap: Record<string, any[]> = {};
      await Promise.all(data.map(async (order) => {
        const { data: items } = await supabase.from("order_items").select("*").eq("order_id", order.id);
        itemsMap[order.id] = items || [];
      }));
      setCurrentOrderItems(itemsMap);
      setSelectedOrderIndex(prev => prev >= data.length ? 0 : prev);
    } else {
      setCurrentOrders([]);
      setCurrentOrderItems({});
      setSelectedOrderIndex(0);
      if (isOnline) loadAvailableOrders();
    }
  };

  const loadAvailableOrders = async () => {
    const { data } = await supabase
      .from("orders").select("*")
      .eq("status", "ready").is("delivery_person_id", null)
      .eq("order_type", "delivery").order("created_at", { ascending: true });
    setAvailableOrders(data || []);
  };

  const toggleOnline = async (online: boolean) => {
    await supabase.from("delivery_persons").update({
      is_online: online,
      status: online ? "available" : "offline",
    } as any).eq("id", driverId!);
    setIsOnline(online);

    if (online) {
      loadAvailableOrders();
      loadActiveRoute();
      startLocationSharing();
      toast.success("Você está ONLINE!");
    } else {
      stopLocationSharing();
      setAvailableOrders([]);
      toast("Você está OFFLINE");
    }
  };

  const startLocationSharing = () => {
    if (locationIntervalRef.current) return;
    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;

          // Update delivery_persons position
          await supabase.from("delivery_persons").update({
            current_lat: latitude,
            current_lng: longitude,
            location_updated_at: new Date().toISOString(),
          }).eq("id", driverId!);

          // Save to driver_locations history
          await supabase.from("driver_locations").insert({
            driver_id: driverId!,
            latitude,
            longitude,
          } as any);

          // Update delivery_tracking for active orders
          for (const order of currentOrders) {
            if (order.status === "out_for_delivery") {
              await supabase.from("delivery_tracking").update({
                current_lat: latitude, current_lng: longitude,
              }).eq("order_id", order.id).eq("is_active", true);

              // GPS arrival detection
              if (order.delivery_lat && order.delivery_lng && !arrivedNotifiedRef.current.has(order.id)) {
                const dist = distanceMeters(latitude, longitude, order.delivery_lat, order.delivery_lng);
                if (dist <= 50) {
                  arrivedNotifiedRef.current.add(order.id);
                  await supabase.from("orders").update({ arrived_at_destination: true } as any).eq("id", order.id);
                  await supabase.functions.invoke("whatsapp-bot", {
                    body: { action: "notify_status", order_id: order.id, new_status: "arrived" },
                  });
                  toast.success(`📍 Chegada detectada - Pedido #${order.order_number}!`);
                }
              }
            }
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    };
    sendLocation();
    locationIntervalRef.current = setInterval(sendLocation, 10000);
  };

  const stopLocationSharing = () => {
    if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null; }
  };

  useEffect(() => {
    if (isOnline) startLocationSharing();
    return () => stopLocationSharing();
  }, [isOnline, currentOrders.length]);

  // --- Route handlers (server-side via edge function) ---
  const handleStopDelivered = async (stopIndex: number, code: string) => {
    const stop = routeStops[stopIndex];
    if (!stop) throw new Error("Parada não encontrada");

    await invokeDriverApp("complete_delivery", {
      orderId: stop.order_id,
      confirmCode: code,
    });

    toast.success(`Entrega #${stop.order?.order_number} finalizada! 🎉`);
    setCurrentStopIndex(stopIndex + 1);
    await loadActiveRoute();
    await loadCurrentOrders();
  };

  const handleCompleteRoute = async () => {
    if (!activeRoute) return;
    try {
      await invokeDriverApp("complete_route", { routeId: activeRoute.id });
      toast.success("Rota finalizada! 🏁");
      setActiveRoute(null);
      setRouteStops([]);
      setViewMode("orders");
      await loadCurrentOrders();
      await loadAvailableOrders();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao finalizar rota");
    }
  };

  const handleRouteReportProblem = (orderId: string) => {
    setProblemOrderId(orderId);
    setShowProblem(true);
  };

  // --- Legacy order handlers ---
  const acceptOrder = async (order: any) => {
    if (currentOrders.length >= MAX_ACTIVE_ORDERS) {
      toast.error(`Máximo de ${MAX_ACTIVE_ORDERS} pedidos ativos!`);
      return;
    }
    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", order.id);
    setShowPendingOrder(order);
    setPendingChecklistItems(items || []);
    setShowChecklist(true);
  };

  const handleChecklistConfirmed = async () => {
    const order = showPendingOrder;
    if (!order) return;
    setShowChecklist(false);

    await supabase.from("orders").update({
      delivery_person_id: driverId,
      status: "out_for_delivery" as const,
      checklist_confirmed: true,
    } as any).eq("id", order.id);

    await supabase.from("delivery_tracking").insert({
      order_id: order.id, delivery_person_id: driverId, is_active: true,
    });

    const code = String(Math.floor(1000 + Math.random() * 9000));
    await supabase.from("orders").update({ delivery_code: code } as any).eq("id", order.id);

    await supabase.functions.invoke("whatsapp-bot", {
      body: { action: "notify_status", order_id: order.id, new_status: "out_for_delivery" },
    });
    await supabase.functions.invoke("whatsapp-bot", {
      body: { action: "notify_status", order_id: order.id, new_status: "delivery_code", delivery_code: code },
    });

    setShowPendingOrder(null);
    setPendingChecklistItems([]);
    toast.success("Entrega aceita! 🛵");
    loadCurrentOrders();
  };

  const rejectOrder = () => {
    setShowPendingOrder(null); setShowChecklist(false); setPendingChecklistItems([]);
    toast("Entrega recusada");
  };

  const completeActiveOrder = async (code: string) => {
    if (!activeOrder) throw new Error("Nenhum pedido ativo");
    await invokeDriverApp("complete_delivery", {
      orderId: activeOrder.id,
      confirmCode: code,
    });
    toast.success("Entrega finalizada! 🎉");
    await loadCurrentOrders();
    await loadAvailableOrders();
  };

  const openNavigation = () => {
    if (!activeOrder?.delivery_lat || !activeOrder?.delivery_lng) {
      const address = activeOrder?.observation || activeOrder?.reference || "";
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
      return;
    }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.delivery_lat},${activeOrder.delivery_lng}&travelmode=driving`, "_blank");
  };

  const handleLogout = () => {
    stopLocationSharing();
    clearDriverSession();
    navigate("/entregador/login");
  };

  if (!driverId) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-3 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Truebox" className="h-7" />
            <div>
              <p className="text-sm font-bold text-foreground">{driverName}</p>
              <p className="text-xs text-muted-foreground">Entregador</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${isOnline ? "text-green-500" : "text-muted-foreground"}`}>
                {isOnline ? "ONLINE" : "OFFLINE"}
              </span>
              <Switch checked={isOnline} onCheckedChange={toggleOnline} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowChat(true)} className="relative">
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowHistory(true)}>
              <History className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* View mode toggle when both route and legacy orders exist */}
      {activeRoute && currentOrders.length > 0 && (
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="flex gap-2">
            <Button size="sm" variant={viewMode === "route" ? "default" : "outline"} onClick={() => setViewMode("route")} className="flex-1">
              <Route className="w-4 h-4 mr-1" /> Rota {activeRoute.code}
            </Button>
            <Button size="sm" variant={viewMode === "orders" ? "default" : "outline"} onClick={() => setViewMode("orders")} className="flex-1">
              <Package className="w-4 h-4 mr-1" /> Pedidos ({currentOrders.length})
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {showChecklist && showPendingOrder ? (
          <DriverChecklist
            order={showPendingOrder}
            items={pendingChecklistItems}
            onConfirmed={handleChecklistConfirmed}
            onCancel={rejectOrder}
          />
        ) : viewMode === "route" && activeRoute ? (
          /* Route View */
          <DriverRouteView
            route={activeRoute}
            stops={routeStops}
            currentStopIndex={currentStopIndex}
            onCompleteRoute={handleCompleteRoute}
            onReportProblem={handleRouteReportProblem}
            onConfirmDelivery={async (orderId, code) => {
              const idx = routeStops.findIndex((s) => s.order_id === orderId);
              if (idx < 0) throw new Error("Parada não encontrada");
              await handleStopDelivered(idx, code);
            }}
          />
        ) : currentOrders.length > 0 && viewMode === "orders" ? (
          <>
            {currentOrders.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {currentOrders.map((order, idx) => (
                  <Button key={order.id} size="sm" variant={idx === selectedOrderIndex ? "default" : "outline"} onClick={() => setSelectedOrderIndex(idx)} className="shrink-0">
                    #{order.order_number}
                    {order.status === "out_for_delivery" && " 🛵"}
                    {order.status === "ready" && " 📦"}
                  </Button>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground text-center">
              {currentOrders.length}/{MAX_ACTIVE_ORDERS} pedidos ativos
            </div>
            {activeOrder && (
              <DriverOrderView
                order={activeOrder}
                items={currentOrderItems[activeOrder.id] || []}
                orderStatus={activeOrder.status}
                onOpenNavigation={openNavigation}
                onReportProblem={() => { setProblemOrderId(activeOrder.id); setShowProblem(true); }}
                onConfirmDelivery={async (code) => {
                  await completeActiveOrder(code);
                }}
              />
            )}
          </>
        ) : isOnline ? (
          <>
            {availableOrders.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Bike className="h-16 w-16 mx-auto text-muted-foreground animate-pulse" />
                <p className="text-lg font-medium text-foreground">Aguardando pedidos...</p>
                <p className="text-sm text-muted-foreground">Novos pedidos e rotas aparecerão automaticamente</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Pedidos disponíveis ({availableOrders.length})
                </h2>
                {availableOrders.map((order) => (
                  <Card key={order.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => acceptOrder(order)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-foreground">Pedido #{order.order_number}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {order.observation || order.reference || "Sem endereço"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">R$ {Number(order.delivery_fee).toFixed(2).replace(".", ",")}</p>
                          <Badge variant="outline" className="text-xs">
                            {order.payment_method === "cash" ? "Dinheiro" : order.payment_method === "pix" ? "PIX" : "Cartão"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 space-y-3">
            <Bike className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
            <p className="text-lg font-medium text-foreground">Você está offline</p>
            <p className="text-sm text-muted-foreground">Ative o botão ONLINE para receber pedidos</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico de Entregas</DialogTitle></DialogHeader>
          <DriverHistory driverId={driverId!} />
        </DialogContent>
      </Dialog>

      <Dialog open={showChat} onOpenChange={setShowChat}>
        <DialogContent className="max-w-sm h-[80vh] p-0 flex flex-col">
          <DriverChat
            driverId={driverId!}
            driverName={driverName || "Entregador"}
            currentOrderId={activeOrder?.id || routeStops[currentStopIndex]?.order_id}
            customerPhone={activeOrder?.customer_phone || routeStops[currentStopIndex]?.order?.customer_phone}
            customerName={activeOrder?.customer_name || routeStops[currentStopIndex]?.order?.customer_name}
            onClose={() => setShowChat(false)}
          />
        </DialogContent>
      </Dialog>

      <DriverProblemDialog
        open={showProblem}
        onOpenChange={setShowProblem}
        orderId={problemOrderId || activeOrder?.id}
        driverId={driverId!}
        onSubmitted={() => { setShowProblem(false); toast.success("Problema reportado"); }}
      />
    </div>
  );
};

export default DriverDashboard;
