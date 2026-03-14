import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bike, MapPin, Phone, Package, Navigation, CheckCircle,
  AlertTriangle, Clock, LogOut, History, DollarSign, X
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import logo from "@/assets/logo-truebox-new.png";
import DriverOrderView from "@/components/driver/DriverOrderView";
import DriverHistory from "@/components/driver/DriverHistory";
import DriverProblemDialog from "@/components/driver/DriverProblemDialog";
import DriverChecklist from "@/components/driver/DriverChecklist";
import DriverChat from "@/components/driver/DriverChat";

// Haversine distance in meters
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
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [currentOrderItems, setCurrentOrderItems] = useState<any[]>([]);
  const [orderStatus, setOrderStatus] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [showProblem, setShowProblem] = useState(false);
  const [showPendingOrder, setShowPendingOrder] = useState<any>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const locationIntervalRef = useRef<any>(null);
  const arrivedNotifiedRef = useRef<Set<string>>(new Set());

  // Request notification permission on mount
  useEffect(() => {
    if (!driverId) { navigate("/driver/login"); return; }
    loadCurrentOrder();
    loadDriverStatus();

    // Ask for notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [driverId]);

  const sendPushNotification = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "new-order",
          renotify: true,
        } as NotificationOptions);
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch {
        // Fallback for mobile: use registration if available
        navigator.serviceWorker?.ready?.then((reg) => {
          reg.showNotification(title, { body, icon: "/favicon.ico", tag: "new-order", renotify: true } as NotificationOptions);
        }).catch(() => {});
      }
    }
    // Also play a sound
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = "sine";
      gain.gain.value = 0.4;
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  // Realtime listeners
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel("driver-orders")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `delivery_person_id=eq.${driverId}`,
      }, () => { loadCurrentOrder(); })
      .subscribe();

    const availChannel = supabase
      .channel("available-orders")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orders",
      }, (payload: any) => {
        if (isOnline) {
          loadAvailableOrders();
          // Notify if order just became "ready" with no driver assigned
          const newRow = payload.new;
          if (newRow?.status === "ready" && !newRow?.delivery_person_id && newRow?.order_type === "delivery") {
            sendPushNotification(
              "🛵 Novo Pedido Disponível!",
              `Pedido #${newRow.order_number} • R$ ${Number(newRow.delivery_fee || 0).toFixed(2).replace(".", ",")}`
            );
            toast("🛵 Novo pedido disponível!", { duration: 8000 });
          }
        }
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "orders",
      }, (payload: any) => {
        if (isOnline) {
          loadAvailableOrders();
          const newRow = payload.new;
          if (newRow?.status === "ready" && !newRow?.delivery_person_id && newRow?.order_type === "delivery") {
            sendPushNotification(
              "🛵 Novo Pedido Disponível!",
              `Pedido #${newRow.order_number} • R$ ${Number(newRow.delivery_fee || 0).toFixed(2).replace(".", ",")}`
            );
            toast("🛵 Novo pedido disponível!", { duration: 8000 });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(availChannel);
    };
  }, [driverId, isOnline, sendPushNotification]);

  const loadDriverStatus = async () => {
    const { data } = await supabase
      .from("delivery_persons")
      .select("is_online")
      .eq("id", driverId!)
      .single();
    if (data) setIsOnline(data.is_online ?? false);
  };

  const loadCurrentOrder = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("delivery_person_id", driverId!)
      .in("status", ["ready", "out_for_delivery"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setCurrentOrder(data);
      setOrderStatus(data.status);
      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", data.id);
      setCurrentOrderItems(items || []);
    } else {
      setCurrentOrder(null);
      setCurrentOrderItems([]);
      setOrderStatus("");
      if (isOnline) loadAvailableOrders();
    }
  };

  const loadAvailableOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "ready")
      .is("delivery_person_id", null)
      .eq("order_type", "delivery")
      .order("created_at", { ascending: true });
    setAvailableOrders(data || []);
  };

  const toggleOnline = async (online: boolean) => {
    await supabase
      .from("delivery_persons")
      .update({ is_online: online })
      .eq("id", driverId!);
    setIsOnline(online);

    if (online) {
      loadAvailableOrders();
      startLocationSharing();
      toast.success("Você está ONLINE! Aguardando pedidos...");
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

          await supabase
            .from("delivery_persons")
            .update({
              current_lat: latitude,
              current_lng: longitude,
              location_updated_at: new Date().toISOString(),
            })
            .eq("id", driverId!);

          // Update delivery_tracking if active
          if (currentOrder) {
            await supabase
              .from("delivery_tracking")
              .update({ current_lat: latitude, current_lng: longitude })
              .eq("order_id", currentOrder.id)
              .eq("is_active", true);

            // GPS arrival detection: check if within 50m of destination
            if (
              currentOrder.delivery_lat &&
              currentOrder.delivery_lng &&
              currentOrder.status === "out_for_delivery" &&
              !arrivedNotifiedRef.current.has(currentOrder.id)
            ) {
              const dist = distanceMeters(latitude, longitude, currentOrder.delivery_lat, currentOrder.delivery_lng);
              if (dist <= 50) {
                arrivedNotifiedRef.current.add(currentOrder.id);
                // Auto-update arrived status
                await supabase
                  .from("orders")
                  .update({ arrived_at_destination: true } as any)
                  .eq("id", currentOrder.id);

                // Notify customer
                await supabase.functions.invoke("whatsapp-bot", {
                  body: {
                    action: "notify_status",
                    order_id: currentOrder.id,
                    new_status: "arrived",
                  },
                });

                toast.success("📍 Chegada detectada automaticamente!");
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
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (isOnline) startLocationSharing();
    return () => stopLocationSharing();
  }, [isOnline, currentOrder?.id]);

  const acceptOrder = async (order: any) => {
    // Show checklist first - load items
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    setShowPendingOrder(order);
    setCurrentOrderItems(items || []);
    setShowChecklist(true);
  };

  const handleChecklistConfirmed = async () => {
    const order = showPendingOrder;
    if (!order) return;

    setShowChecklist(false);

    await supabase
      .from("orders")
      .update({
        delivery_person_id: driverId,
        status: "out_for_delivery" as const,
        checklist_confirmed: true,
      } as any)
      .eq("id", order.id);

    // Create tracking record
    await supabase.from("delivery_tracking").insert({
      order_id: order.id,
      delivery_person_id: driverId,
      is_active: true,
    });

    // Generate delivery confirmation code
    const code = String(Math.floor(1000 + Math.random() * 9000));
    await supabase.from("orders").update({ delivery_code: code } as any).eq("id", order.id);

    // Notify customer
    await supabase.functions.invoke("whatsapp-bot", {
      body: { action: "notify_status", order_id: order.id, new_status: "out_for_delivery" },
    });

    // Send delivery code
    await supabase.functions.invoke("whatsapp-bot", {
      body: {
        action: "notify_status",
        order_id: order.id,
        new_status: "delivery_code",
        delivery_code: code,
      },
    });

    setShowPendingOrder(null);
    toast.success("Entrega aceita! Boa corrida! 🛵");
    loadCurrentOrder();
  };

  const rejectOrder = () => {
    setShowPendingOrder(null);
    setShowChecklist(false);
    toast("Entrega recusada");
  };

  const updateDeliveryStatus = async (newStatus: string) => {
    if (!currentOrder) return;
    await supabase
      .from("orders")
      .update({ status: newStatus as any })
      .eq("id", currentOrder.id);

    await supabase.functions.invoke("whatsapp-bot", {
      body: { action: "notify_status", order_id: currentOrder.id, new_status: newStatus },
    });

    if (newStatus === "delivered") {
      await supabase
        .from("delivery_tracking")
        .update({ is_active: false })
        .eq("order_id", currentOrder.id);
      toast.success("Entrega finalizada! 🎉");
      setCurrentOrder(null);
      setCurrentOrderItems([]);
      loadAvailableOrders();
    } else {
      setOrderStatus(newStatus);
      toast.success("Status atualizado!");
    }
  };

  const openNavigation = () => {
    if (!currentOrder?.delivery_lat || !currentOrder?.delivery_lng) {
      const address = currentOrder?.observation || currentOrder?.reference || "";
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
      return;
    }
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${currentOrder.delivery_lat},${currentOrder.delivery_lng}&travelmode=driving`,
      "_blank"
    );
  };

  const handleLogout = () => {
    stopLocationSharing();
    localStorage.removeItem("driver_id");
    localStorage.removeItem("driver_name");
    localStorage.removeItem("driver_phone");
    navigate("/driver/login");
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

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Checklist before departure */}
        {showChecklist && showPendingOrder ? (
          <DriverChecklist
            order={showPendingOrder}
            items={currentOrderItems}
            onConfirmed={handleChecklistConfirmed}
            onCancel={rejectOrder}
          />
        ) : currentOrder ? (
          <DriverOrderView
            order={currentOrder}
            items={currentOrderItems}
            orderStatus={orderStatus}
            onUpdateStatus={updateDeliveryStatus}
            onOpenNavigation={openNavigation}
            onReportProblem={() => setShowProblem(true)}
            driverId={driverId!}
          />
        ) : isOnline ? (
          <>
            {availableOrders.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Bike className="h-16 w-16 mx-auto text-muted-foreground animate-pulse" />
                <p className="text-lg font-medium text-foreground">Aguardando pedidos...</p>
                <p className="text-sm text-muted-foreground">
                  Novos pedidos aparecerão aqui automaticamente
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Pedidos disponíveis ({availableOrders.length})
                </h2>
                {availableOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => acceptOrder(order)}
                  >
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
                          <p className="font-bold text-primary">
                            R$ {Number(order.delivery_fee).toFixed(2).replace(".", ",")}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {order.payment_method === "cash" ? "Dinheiro" :
                             order.payment_method === "pix" ? "PIX" : "Cartão"}
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
            <p className="text-sm text-muted-foreground">
              Ative o botão ONLINE para receber pedidos
            </p>
          </div>
        )}
      </div>

      {/* History dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Entregas</DialogTitle>
          </DialogHeader>
          <DriverHistory driverId={driverId!} />
        </DialogContent>
      </Dialog>

      {/* Problem dialog */}
      <DriverProblemDialog
        open={showProblem}
        onOpenChange={setShowProblem}
        orderId={currentOrder?.id}
        driverId={driverId!}
        onSubmitted={() => {
          setShowProblem(false);
          toast.success("Problema reportado ao restaurante");
        }}
      />
    </div>
  );
};

export default DriverDashboard;
