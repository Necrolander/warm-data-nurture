import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, Clock, Truck, CheckCircle, MapPin, Phone, User, Volume2, Zap, X, ExternalLink, CreditCard, MessageSquare, Printer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
type DeliveryPerson = Database["public"]["Tables"]["delivery_persons"]["Row"];

interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

// Send bot notification when order status changes
async function notifyCustomerStatus(orderId: string, newStatus: string) {
  try {
    await supabase.functions.invoke("whatsapp-bot", {
      body: { action: "notify_status", order_id: orderId, new_status: newStatus },
    });
  } catch (e) {
    console.error("Failed to send status notification:", e);
  }
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  production: "Em Produção",
  ready: "Pronto",
  out_for_delivery: "Saiu p/ Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  production: "bg-blue-500/20 text-blue-400",
  ready: "bg-green-500/20 text-green-400",
  out_for_delivery: "bg-purple-500/20 text-purple-400",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/20 text-destructive",
};

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  cash: "Dinheiro",
};

const orderTypeLabels: Record<string, string> = {
  delivery: "🛵 Entrega",
  pickup: "🏪 Retirada",
  dine_in: "🍽️ No Salão",
};

const getMapLink = (order: Order) => {
  if (order.delivery_lat && order.delivery_lng) {
    return `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`;
  }
  return null;
};

const printOrderTicket = (order: OrderWithItems) => {
  const mapLink = getMapLink(order);
  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) {
    toast.error("Popup bloqueado! Permita popups para imprimir.");
    return;
  }

  const itemsHtml = order.order_items?.map((item) => {
    const extras = item.extras && Array.isArray(item.extras) && item.extras.length > 0
      ? `<div style="font-size:11px;color:#666;margin-left:12px;">${(item.extras as any[]).map((e: any) => `+ ${e.name || e}`).join(", ")}</div>`
      : "";
    const obs = item.observation ? `<div style="font-size:11px;color:#666;margin-left:12px;font-style:italic;">📝 ${item.observation}</div>` : "";
    return `
      <div style="display:flex;justify-content:space-between;padding:2px 0;">
        <span>${item.quantity}x ${item.product_name}</span>
        <span>R$ ${(item.product_price * item.quantity).toFixed(2).replace(".", ",")}</span>
      </div>
      ${extras}${obs}
    `;
  }).join("") || "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Comanda #${order.order_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 13px; width: 80mm; padding: 8px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; padding: 1px 0; }
        .total { font-size: 16px; font-weight: bold; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin: 4px 0; }
        @media print { body { width: 80mm; } }
      </style>
    </head>
    <body>
      <div class="center">
        <h1>COMANDA #${order.order_number}</h1>
        <p>${new Date(order.created_at || "").toLocaleString("pt-BR")}</p>
      </div>
      <div class="divider"></div>
      
      <div>
        <p class="bold">${order.customer_name}</p>
        <p>📞 ${order.customer_phone}</p>
        <p>📦 ${orderTypeLabels[order.order_type] || order.order_type}</p>
        ${order.payment_method ? `<p>💳 ${paymentLabels[order.payment_method] || order.payment_method}</p>` : ""}
        ${order.reference ? `<p>📍 ${order.reference}</p>` : ""}
        ${mapLink ? `<p>🗺️ <a href="${mapLink}">${mapLink}</a></p>` : ""}
        ${order.table_number ? `<p>🍽️ Mesa: ${order.table_number}</p>` : ""}
        ${order.change_for && order.payment_method === "cash" ? `<p>💵 Troco para: R$ ${Number(order.change_for).toFixed(2).replace(".", ",")}</p>` : ""}
      </div>
      <div class="divider"></div>
      
      <h2>ITENS</h2>
      ${itemsHtml}
      
      <div class="divider"></div>
      ${Number(order.delivery_fee) > 0 ? `<div class="row"><span>Taxa entrega</span><span>R$ ${Number(order.delivery_fee).toFixed(2).replace(".", ",")}</span></div>` : ""}
      <div class="row"><span>Subtotal</span><span>R$ ${Number(order.subtotal).toFixed(2).replace(".", ",")}</span></div>
      <div class="divider"></div>
      <div class="row total"><span>TOTAL</span><span>R$ ${Number(order.total).toFixed(2).replace(".", ",")}</span></div>
      
      ${order.observation ? `<div class="divider"></div><p style="font-style:italic;">OBS: ${order.observation}</p>` : ""}
      
      <div class="divider"></div>
      <p class="center" style="font-size:11px;margin-top:8px;">TrueBox Delivery</p>
      
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

const formatWhatsAppLink = (phone: string, message?: string) => {
  const cleaned = phone.replace(/\D/g, "");
  const num = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
  const msg = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${num}${msg}`;
};

const OrderCard = ({
  order,
  onAccept,
  onReject,
  onAdvance,
  onSelectDelivery,
  onMarkDelivered,
  onCancel,
  onPrint,
  isPending,
  deliveryPersons,
}: {
  order: OrderWithItems;
  onAccept: (order: OrderWithItems) => void;
  onReject: (order: OrderWithItems) => void;
  onAdvance: (order: OrderWithItems) => void;
  onSelectDelivery: (order: OrderWithItems) => void;
  onMarkDelivered: (order: OrderWithItems) => void;
  onCancel: (order: OrderWithItems) => void;
  onPrint: (order: OrderWithItems) => void;
  isPending: boolean;
  deliveryPersons: DeliveryPerson[];
}) => {
  const nextStatus: Record<string, string> = {
    production: "ready",
    ready: "out_for_delivery",
  };

  const next = isPending ? null : nextStatus[order.status];
  const mapLink = getMapLink(order);

  return (
    <Card className={`mb-3 ${isPending ? "ring-2 ring-yellow-500 animate-pulse" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-primary">#{order.order_number}</span>
          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPrint(order)} title="Imprimir comanda">
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
          </div>
        </div>

        {/* Order type & payment */}
        <div className="flex items-center gap-2 mb-2 text-xs">
          <Badge variant="outline">{orderTypeLabels[order.order_type] || order.order_type}</Badge>
          {order.payment_method && (
            <Badge variant="outline" className="flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              {paymentLabels[order.payment_method] || order.payment_method}
            </Badge>
          )}
        </div>

        <div className="space-y-1 text-sm mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{order.customer_name}</span>
            </div>
            <a href={formatWhatsAppLink(order.customer_phone, `Olá ${order.customer_name}, sobre seu pedido #${order.order_number}`)} target="_blank" rel="noopener noreferrer" title="WhatsApp cliente">
              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:text-green-400">
                <Phone className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{order.customer_phone}</span>
          </div>
          {order.reference && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{order.reference}</span>
            </div>
          )}
          {mapLink && (
            <a href={mapLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 underline">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Ver no mapa</span>
            </a>
          )}
          {/* Delivery person info */}
          {order.delivery_person_id && (() => {
            const dp = deliveryPersons.find((d) => d.id === order.delivery_person_id);
            if (!dp) return null;
            return (
              <div className="flex items-center justify-between bg-muted/50 rounded p-1.5 mt-1">
                <div className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{dp.name}</span>
                  <span className="text-muted-foreground text-xs">({dp.phone})</span>
                </div>
                <a href={formatWhatsAppLink(dp.phone, `Olá ${dp.name}, sobre o pedido #${order.order_number}`)} target="_blank" rel="noopener noreferrer" title="WhatsApp motoboy">
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:text-green-400">
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            );
          })()}
          {order.observation && (
            <div className="flex items-start gap-1.5 bg-muted/50 rounded p-1.5 mt-1">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              <span className="text-muted-foreground italic">{order.observation}</span>
            </div>
          )}
          {order.change_for && order.payment_method === "cash" && (
            <div className="text-xs text-muted-foreground">💵 Troco para: R$ {Number(order.change_for).toFixed(2).replace(".", ",")}</div>
          )}
          {order.table_number && (
            <div className="text-xs text-muted-foreground">🍽️ Mesa: {order.table_number}</div>
          )}
        </div>

        <div className="border-t border-border pt-2 mb-3">
          {order.order_items?.map((item) => (
            <div key={item.id} className="text-sm py-0.5">
              <div className="flex justify-between">
                <span>{item.quantity}x {item.product_name}</span>
                <span className="text-muted-foreground">R$ {(item.product_price * item.quantity).toFixed(2).replace(".", ",")}</span>
              </div>
              {item.observation && (
                <p className="text-xs text-muted-foreground ml-4 italic">📝 {item.observation}</p>
              )}
            </div>
          ))}
          {Number(order.delivery_fee) > 0 && (
            <div className="flex justify-between text-sm py-0.5 text-muted-foreground">
              <span>🛵 Taxa de entrega</span>
              <span>R$ {Number(order.delivery_fee).toFixed(2).replace(".", ",")}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center border-t border-border pt-2">
          <span className="font-bold">
            R$ {Number(order.total).toFixed(2).replace(".", ",")}
          </span>

          <div className="flex items-center gap-1.5">
            {isPending ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onReject(order)}
                >
                  ❌ Rejeitar
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onAccept(order)}
                >
                  ✅ Aceitar
                </Button>
              </>
            ) : order.status === "out_for_delivery" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel(order)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onMarkDelivered(order)}
                >
                  ✅ Entregue
                </Button>
              </>
            ) : next ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel(order)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (next === "out_for_delivery" && order.order_type === "delivery") {
                      onSelectDelivery(order);
                    } else {
                      onAdvance(order);
                    }
                  }}
                >
                  {next === "out_for_delivery" ? "Enviar" : "Avançar"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="text-xs text-muted-foreground mt-2">
          {order.created_at && new Date(order.created_at).toLocaleString("pt-BR")}
        </div>
      </CardContent>
    </Card>
  );
};

const Orders = () => {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [selectedDeliveryPerson, setSelectedDeliveryPerson] = useState("");
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [cancelOrder, setCancelOrder] = useState<OrderWithItems | null>(null);
  const [autoAccept, setAutoAccept] = useState(() => {
    return localStorage.getItem("truebox_auto_accept") === "true";
  });

  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopSound = useCallback(() => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const playBurst = useCallback(() => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const playTone = (freq: number, start: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "square";
        gain.gain.setValueAtTime(vol, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      for (let i = 0; i < 3; i++) {
        playTone(1200, i * 0.35, 0.15, 0.9);
        playTone(1500, i * 0.35 + 0.15, 0.12, 0.9);
      }
    } catch (_) {}
  }, []);

  const startLoopingSound = useCallback(() => {
    if (soundIntervalRef.current) return;
    playBurst();
    soundIntervalRef.current = setInterval(() => {
      playBurst();
    }, 3000);
  }, [playBurst]);

  useEffect(() => {
    const hasPending = orders.some((o) => o.status === "pending");
    if (hasPending && !autoAccept) {
      startLoopingSound();
    } else {
      stopSound();
    }
  }, [orders, autoAccept, startLoopingSound, stopSound]);

  useEffect(() => {
    return () => stopSound();
  }, [stopSound]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("status", ["pending", "production", "ready", "out_for_delivery"])
      .order("created_at", { ascending: true });

    if (!error && data) setOrders(data as OrderWithItems[]);
  };

  const fetchDeliveryPersons = async () => {
    const { data } = await supabase
      .from("delivery_persons")
      .select("*")
      .eq("is_active", true);

    if (data) setDeliveryPersons(data);
  };

  const autoAcceptRef = useRef(autoAccept);
  useEffect(() => {
    autoAcceptRef.current = autoAccept;
  }, [autoAccept]);

  // Auto-print helper: fetch full order with items then print
  const autoPrintOrder = useCallback(async (orderId: string) => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();
    if (data) {
      printOrderTicket(data as OrderWithItems);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchDeliveryPersons();

    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        toast.success("🔔 Novo pedido recebido!");
        fetchOrders();

        if (autoAcceptRef.current && payload.new && (payload.new as any).id) {
          supabase
            .from("orders")
            .update({ status: "production" as any })
            .eq("id", (payload.new as any).id)
            .then(({ error }) => {
              if (!error) {
                toast.success(`Pedido #${(payload.new as any).order_number} aceito automaticamente!`);
                fetchOrders();
                // Auto-print on auto-accept
                autoPrintOrder((payload.new as any).id);
              }
            });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [autoPrintOrder]);

  const acceptOrder = async (order: OrderWithItems) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "production" as any })
      .eq("id", order.id);

    if (error) {
      toast.error("Erro ao aceitar pedido");
    } else {
      toast.success(`Pedido #${order.order_number} aceito! → Em Produção`);
      notifyCustomerStatus(order.id, "production");
      printOrderTicket(order);
      fetchOrders();
    }
  };

  const rejectOrder = async (order: OrderWithItems) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" as any })
      .eq("id", order.id);

    if (error) {
      toast.error("Erro ao rejeitar pedido");
    } else {
      toast.success(`Pedido #${order.order_number} rejeitado`);
      notifyCustomerStatus(order.id, "cancelled");
      fetchOrders();
    }
  };

  const advanceOrder = async (order: OrderWithItems) => {
    const nextStatus: Record<string, string> = {
      production: "ready",
      ready: "out_for_delivery",
    };

    const newStatus = nextStatus[order.status];
    if (!newStatus) return;

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus as any })
      .eq("id", order.id);

    if (error) {
      toast.error("Erro ao atualizar pedido");
    } else {
      toast.success(`Pedido #${order.order_number} → ${statusLabels[newStatus]}`);
      notifyCustomerStatus(order.id, newStatus);
      fetchOrders();
    }
  };

  const markDelivered = async (order: OrderWithItems) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered" as any })
      .eq("id", order.id);

    if (error) {
      toast.error("Erro ao finalizar pedido");
    } else {
      toast.success(`Pedido #${order.order_number} entregue! ✅`);
      notifyCustomerStatus(order.id, "delivered");
      fetchOrders();
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrder) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" as any })
      .eq("id", cancelOrder.id);

    if (error) {
      toast.error("Erro ao cancelar pedido");
    } else {
      toast.success(`Pedido #${cancelOrder.order_number} cancelado`);
      notifyCustomerStatus(cancelOrder.id, "cancelled");
      setCancelOrder(null);
      fetchOrders();
    }
  };

  const handleSelectDelivery = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setShowDeliveryDialog(true);
  };

  const confirmDelivery = async () => {
    if (!selectedOrder || !selectedDeliveryPerson) {
      toast.error("Selecione um entregador");
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        status: "out_for_delivery" as any,
        delivery_person_id: selectedDeliveryPerson,
      })
      .eq("id", selectedOrder.id);

    if (error) {
      toast.error("Erro ao atualizar pedido");
    } else {
      toast.success(`Pedido #${selectedOrder.order_number} saiu para entrega!`);
      setShowDeliveryDialog(false);
      setSelectedOrder(null);
      setSelectedDeliveryPerson("");
      fetchOrders();
    }
  };

  const handleAutoAcceptToggle = (checked: boolean) => {
    setAutoAccept(checked);
    localStorage.setItem("truebox_auto_accept", String(checked));
    toast.success(checked ? "⚡ Aceitar automaticamente ATIVADO" : "🔔 Aceitar automaticamente DESATIVADO");
  };

  const columns = [
    { title: "🕐 Pendente", icon: Clock, status: "pending", color: "border-yellow-500/50" },
    { title: "🔥 Em Produção", icon: Clock, status: "production", color: "border-blue-500/50" },
    { title: "✅ Pronto", icon: CheckCircle, status: "ready", color: "border-green-500/50" },
    { title: "🛵 Saiu p/ Entrega", icon: Truck, status: "out_for_delivery", color: "border-purple-500/50" },
  ];

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
        <div className="flex items-center gap-2">
          {pendingCount > 0 && !autoAccept && (
            <div className="flex items-center gap-2 text-yellow-400">
              <Volume2 className="h-5 w-5 animate-bounce" />
              <span className="text-sm font-medium">{pendingCount} pedido(s) aguardando aceite</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${autoAccept ? "text-green-400" : "text-muted-foreground"}`} />
            <span className="text-sm font-medium">Aceitar automaticamente</span>
            <Switch checked={autoAccept} onCheckedChange={handleAutoAcceptToggle} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className={`border-t-2 ${col.color} rounded-lg`}>
              <div className="flex items-center justify-between p-3">
                <h3 className="font-semibold text-sm">{col.title}</h3>
                <Badge variant="secondary">{colOrders.length}</Badge>
              </div>
              <div className="px-2 pb-2 max-h-[70vh] overflow-y-auto">
                {colOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    Nenhum pedido
                  </p>
                ) : (
                  colOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAccept={acceptOrder}
                      onReject={rejectOrder}
                      onAdvance={advanceOrder}
                      onSelectDelivery={handleSelectDelivery}
                      onMarkDelivered={markDelivered}
                      onCancel={(o) => setCancelOrder(o)}
                      onPrint={printOrderTicket}
                      isPending={order.status === "pending"}
                      deliveryPersons={deliveryPersons}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery person dialog */}
      <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar Entregador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pedido #{selectedOrder?.order_number} - {selectedOrder?.customer_name}
            </p>
            <Select value={selectedDeliveryPerson} onValueChange={setSelectedDeliveryPerson}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o entregador" />
              </SelectTrigger>
              <SelectContent>
                {deliveryPersons.map((dp) => (
                  <SelectItem key={dp.id} value={dp.id}>
                    {dp.name} - {dp.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={confirmDelivery} className="w-full">
              Confirmar Entrega
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!cancelOrder} onOpenChange={(open) => !open && setCancelOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pedido #{cancelOrder?.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O pedido de {cancelOrder?.customer_name} será cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Orders;
