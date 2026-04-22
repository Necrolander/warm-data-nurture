import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, Clock, Truck, CheckCircle, MapPin, Phone, User, Volume2, Zap, X, ExternalLink, CreditCard, MessageSquare, Printer, UtensilsCrossed, RefreshCw, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  onChangeDelivery,
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
  onChangeDelivery: (order: OrderWithItems) => void;
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
    <Card className={`mb-3 bg-white text-gray-900 border-gray-200 ${isPending ? "ring-2 ring-yellow-500 animate-pulse" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-amber-600">#{order.order_number}</span>
          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPrint(order)} title="Imprimir comanda">
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
          </div>
        </div>

        {/* Order type & payment */}
        <div className="flex items-center gap-2 mb-2 text-xs">
           <Badge variant="outline" className="border-gray-300 text-gray-700">{orderTypeLabels[order.order_type] || order.order_type}</Badge>
          {order.payment_method && (
            <Badge variant="outline" className="flex items-center gap-1 border-gray-300 text-gray-700">
              <CreditCard className="h-3 w-3" />
              {paymentLabels[order.payment_method] || order.payment_method}
            </Badge>
          )}
        </div>

        <div className="space-y-1 text-sm mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-gray-500" />
              <span>{order.customer_name}</span>
            </div>
            <a href={formatWhatsAppLink(order.customer_phone, `Olá ${order.customer_name}, sobre seu pedido #${order.order_number}`)} target="_blank" rel="noopener noreferrer" title="WhatsApp cliente">
              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:text-green-400">
                <Phone className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-gray-500" />
            <span>{order.customer_phone}</span>
          </div>
          {order.reference && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gray-500" />
              <span className="truncate">{order.reference}</span>
            </div>
          )}
          {mapLink && (
            <a href={mapLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 underline">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Ver no mapa</span>
            </a>
          )}
          {/* Delivery person info */}
          {order.delivery_person_id && (() => {
            const dp = deliveryPersons.find((d) => d.id === order.delivery_person_id);
            if (!dp) return null;

            // Real-time driver status
            const isOnline = !!(dp as any).is_online;
            const driverStatus = (dp as any).status || "offline";
            const arriving = !!order.arrived_at_destination && order.status === "out_for_delivery";

            const statusMeta: Record<string, { label: string; cls: string; dot: string }> = {
              available: { label: "Disponível", cls: "bg-emerald-100 text-emerald-700 border-emerald-300", dot: "bg-emerald-500" },
              on_route: { label: "Em rota", cls: "bg-blue-100 text-blue-700 border-blue-300", dot: "bg-blue-500" },
              paused: { label: "Pausado", cls: "bg-amber-100 text-amber-700 border-amber-300", dot: "bg-amber-500" },
              offline: { label: "Offline", cls: "bg-gray-200 text-gray-600 border-gray-300", dot: "bg-gray-400" },
            };
            const meta = statusMeta[driverStatus] || statusMeta.offline;
            const effectiveMeta = arriving
              ? { label: "Chegando", cls: "bg-purple-100 text-purple-700 border-purple-300 animate-pulse", dot: "bg-purple-500" }
              : !isOnline
                ? statusMeta.offline
                : meta;

            const lastSeen = (dp as any).location_updated_at
              ? Math.round((Date.now() - new Date((dp as any).location_updated_at).getTime()) / 60000)
              : null;
            const isStale = lastSeen !== null && lastSeen > 3;
            // Trigger only for orders being delivered
            const inDelivery = order.status === "out_for_delivery";
            const inAlert = inDelivery && !arriving && (!isOnline || isStale);
            const alertReason = !isOnline ? "Offline" : `GPS sem sinal há ${lastSeen}m`;

            return (
              <div
                className={`flex items-center justify-between rounded p-1.5 mt-1 border ${
                  inAlert
                    ? "bg-red-50 border-red-300 ring-2 ring-red-400 animate-pulse"
                    : "bg-gray-100 border-transparent"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {inAlert ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  ) : (
                    <Truck className="h-3.5 w-3.5 text-gray-600 shrink-0" />
                  )}
                  <span className={`font-medium truncate ${inAlert ? "text-red-700" : "text-gray-900"}`}>
                    {dp.name}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${effectiveMeta.cls}`}
                    title={
                      lastSeen !== null
                        ? `Localização atualizada há ${lastSeen} min`
                        : "Sem localização recente"
                    }
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${effectiveMeta.dot} ${isOnline && !arriving ? "animate-pulse" : ""}`} />
                    {effectiveMeta.label}
                  </span>
                  {inAlert && (
                    <span className="text-[10px] text-red-700 font-semibold whitespace-nowrap">
                      ⚠ {alertReason}
                    </span>
                  )}
                  {!inAlert && isOnline && lastSeen !== null && (
                    <span className={`text-[10px] ${isStale ? "text-red-600 font-medium" : "text-gray-500"}`}>
                      • {lastSeen === 0 ? "agora" : `${lastSeen}m`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-500 hover:text-amber-600" onClick={(e) => { e.stopPropagation(); onChangeDelivery(order); }} title="Trocar entregador">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <a href={formatWhatsAppLink(dp.phone, `Olá ${dp.name}, sobre o pedido #${order.order_number}`)} target="_blank" rel="noopener noreferrer" title="WhatsApp motoboy">
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:text-green-400">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </div>
            );
          })()}
          {order.observation && (
            <div className="flex items-start gap-1.5 bg-gray-100 rounded p-1.5 mt-1">
              <MessageSquare className="h-3.5 w-3.5 text-gray-500 mt-0.5" />
              <span className="text-gray-500 italic">{order.observation}</span>
            </div>
          )}
          {order.change_for && order.payment_method === "cash" && (
            <div className="text-xs text-gray-600">💵 Troco para: R$ {Number(order.change_for).toFixed(2).replace(".", ",")}</div>
          )}
          {order.table_number && (
            <div className="text-xs text-gray-600">🍽️ Mesa: {order.table_number}</div>
          )}
        </div>

        <div className="border-t border-gray-200 pt-2 mb-3">
          {order.order_items?.map((item) => (
            <div key={item.id} className="text-sm py-0.5">
              <div className="flex justify-between">
                <span>{item.quantity}x {item.product_name}</span>
                <span className="text-gray-500">R$ {(item.product_price * item.quantity).toFixed(2).replace(".", ",")}</span>
              </div>
              {item.observation && (
                <p className="text-xs text-gray-500 ml-4 italic">📝 {item.observation}</p>
              )}
            </div>
          ))}
          {Number(order.delivery_fee) > 0 && (
            <div className="flex justify-between text-sm py-0.5 text-gray-500">
              <span>🛵 Taxa de entrega</span>
              <span>R$ {Number(order.delivery_fee).toFixed(2).replace(".", ",")}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center border-t border-gray-200 pt-2">
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

  // Som distintivo de iFood: sirene grave→aguda 2x (mais marcante)
  const playIfoodAlert = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const playTone = (freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sawtooth") => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(vol, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      // Sirene: sobe-desce 2 vezes
      for (let i = 0; i < 2; i++) {
        const base = i * 0.6;
        playTone(600, base, 0.25, 0.8);
        playTone(900, base + 0.25, 0.25, 0.9);
        playTone(1200, base + 0.5, 0.1, 0.9);
      }
      setTimeout(() => ctx.close().catch(() => {}), 2000);
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

  // --- Driver offline / GPS-stale alert detector ---
  // Plays a short beep + toast when an assigned driver goes offline OR has stale GPS (>3min)
  // for an order currently out_for_delivery. Cooldown of 2 minutes per driver to avoid spam.
  const driverAlertCooldownRef = useRef<Map<string, number>>(new Map());

  const playDriverAlertBeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const playTone = (freq: number, start: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "triangle";
        gain.gain.setValueAtTime(vol, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      // Two descending warning tones
      playTone(880, 0, 0.18, 0.5);
      playTone(540, 0.22, 0.28, 0.6);
      setTimeout(() => ctx.close().catch(() => {}), 800);
    } catch (_) {}
  }, []);

  useEffect(() => {
    const activeDelivery = orders.filter(
      (o) => o.status === "out_for_delivery" && o.delivery_person_id && !o.arrived_at_destination,
    );
    if (activeDelivery.length === 0) return;

    const now = Date.now();
    const COOLDOWN = 2 * 60 * 1000; // 2 min

    for (const order of activeDelivery) {
      const dp = deliveryPersons.find((d) => d.id === order.delivery_person_id);
      if (!dp) continue;

      const isOnline = !!(dp as any).is_online;
      const lastSeenMs = (dp as any).location_updated_at
        ? now - new Date((dp as any).location_updated_at).getTime()
        : null;
      const isStale = lastSeenMs !== null && lastSeenMs > 3 * 60 * 1000;

      if (!isOnline || isStale) {
        const last = driverAlertCooldownRef.current.get(dp.id) || 0;
        if (now - last < COOLDOWN) continue;
        driverAlertCooldownRef.current.set(dp.id, now);

        const reason = !isOnline
          ? "ficou OFFLINE"
          : `está com GPS sem sinal há ${Math.round((lastSeenMs as number) / 60000)} min`;

        playDriverAlertBeep();
        toast.error(`⚠️ Motoboy ${dp.name} ${reason}`, {
          description: `Pedido #${order.order_number} em entrega — verifique com o entregador.`,
          duration: 10000,
        });
      }
    }
  }, [orders, deliveryPersons, playDriverAlertBeep]);

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
        const isIfood = (payload.new as any)?.order_source === "ifood";
        if (isIfood) {
          playIfoodAlert();
          toast.error("🛵 Novo pedido iFood!", {
            description: `Pedido #${(payload.new as any)?.order_number ?? ""} acabou de chegar`,
            duration: 8000,
          });
        } else {
          toast.success("🔔 Novo pedido recebido!");
        }
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

    // Realtime updates for driver status (online/available/on_route/paused/offline + location)
    const driversChannel = supabase
      .channel("orders-drivers-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_persons" },
        () => fetchDeliveryPersons()
      )
      .subscribe();

    // Periodic refresh so "X min ago" stays accurate even without DB events
    const tick = setInterval(() => {
      fetchDeliveryPersons();
    }, 20000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(driversChannel);
      clearInterval(tick);
    };
  }, [autoPrintOrder, playIfoodAlert]);

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
    const order = cancelOrder as any;
    const hasMPPayment = !!order.mercadopago_payment_id;
    const mpApproved = order.payment_status === "approved";

    try {
      if (hasMPPayment && !mpApproved) {
        // Cancel via Mercado Pago (refunds nothing because it isn't approved yet)
        const { data, error } = await supabase.functions.invoke("mercadopago-cancel-payment", {
          body: { order_id: cancelOrder.id },
        });
        if (error || (data as any)?.error) {
          throw new Error((data as any)?.error || error?.message || "Falha ao cancelar no Mercado Pago");
        }
      } else {
        const { error } = await supabase
          .from("orders")
          .update({ status: "cancelled" as any })
          .eq("id", cancelOrder.id);
        if (error) throw error;
      }

      toast.success(`Pedido #${cancelOrder.order_number} cancelado`);
      notifyCustomerStatus(cancelOrder.id, "cancelled");
      setCancelOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cancelar pedido");
    }
  };

  const handleSelectDelivery = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setSelectedDeliveryPerson("");
    setShowDeliveryDialog(true);
  };

  const handleChangeDelivery = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setSelectedDeliveryPerson(order.delivery_person_id || "");
    setShowDeliveryDialog(true);
  };

  const confirmDelivery = async () => {
    if (!selectedOrder || !selectedDeliveryPerson) {
      toast.error("Selecione um entregador");
      return;
    }

    // Check max 3 active orders per driver (excluding current order if reassigning)
    const { data: activeOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("delivery_person_id", selectedDeliveryPerson)
      .in("status", ["ready", "out_for_delivery"]);

    const activeCount = (activeOrders || []).filter(o => o.id !== selectedOrder.id).length;
    if (activeCount >= 3) {
      toast.error("Este entregador já tem 3 pedidos ativos! Máximo permitido: 3");
      return;
    }

    const isReassign = !!selectedOrder.delivery_person_id && selectedOrder.status === "out_for_delivery";

    const updateData: any = { delivery_person_id: selectedDeliveryPerson };
    if (!isReassign) {
      updateData.status = "out_for_delivery";
    }

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", selectedOrder.id);

    if (error) {
      toast.error("Erro ao atualizar pedido");
    } else {
      // Notifica o motoboy via WhatsApp para abrir o app
      const driver = deliveryPersons.find((d) => d.id === selectedDeliveryPerson);
      if (driver?.phone) {
        const msg = isReassign
          ? `🔄 *Pedido #${selectedOrder.order_number} foi transferido para você!*\n\nCliente: ${selectedOrder.customer_name}\nAbra o app de entregador para ver os detalhes.`
          : `🛵 *Novo pedido atribuído: #${selectedOrder.order_number}*\n\nCliente: ${selectedOrder.customer_name}\nTotal: R$ ${Number(selectedOrder.total).toFixed(2).replace(".", ",")}\n\nAbra o app de entregador para iniciar a entrega.`;
        await supabase.from("whatsapp_outbox").insert({
          phone: driver.phone,
          message: msg,
          order_id: selectedOrder.id,
          kind: "driver_assigned",
        });
      }

      toast.success(isReassign
        ? `Entregador do pedido #${selectedOrder.order_number} alterado!`
        : `Pedido #${selectedOrder.order_number} saiu para entrega!`
      );
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

      <Tabs defaultValue="delivery" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="delivery" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Delivery / Retirada
            <Badge variant="secondary" className="ml-1 text-xs">
              {orders.filter(o => o.order_type === "delivery" || o.order_type === "pickup").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="dine_in" className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            Mesa (Salão)
            <Badge variant="secondary" className="ml-1 text-xs">
              {orders.filter(o => o.order_type === "dine_in").length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {["delivery", "dine_in"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {columns.map((col) => {
                const colOrders = orders
                  .filter((o) =>
                    o.status === col.status &&
                    (tab === "delivery" ? (o.order_type === "delivery" || o.order_type === "pickup") : o.order_type === "dine_in")
                  )
                  .sort((a, b) => {
                    // Priority sort: only meaningful for "out_for_delivery" column.
                    // 1) "Chegando" (arrived_at_destination) first
                    // 2) Driver online + most recent GPS update (smaller staleness = higher priority)
                    // 3) Fallback: oldest order first (FIFO)
                    const dpA = deliveryPersons.find((d) => d.id === a.delivery_person_id);
                    const dpB = deliveryPersons.find((d) => d.id === b.delivery_person_id);

                    const arrA = a.status === "out_for_delivery" && !!a.arrived_at_destination ? 1 : 0;
                    const arrB = b.status === "out_for_delivery" && !!b.arrived_at_destination ? 1 : 0;
                    if (arrA !== arrB) return arrB - arrA;

                    const onlineA = dpA && (dpA as any).is_online ? 1 : 0;
                    const onlineB = dpB && (dpB as any).is_online ? 1 : 0;
                    if (onlineA !== onlineB) return onlineB - onlineA;

                    const tsA = dpA && (dpA as any).location_updated_at
                      ? new Date((dpA as any).location_updated_at).getTime()
                      : 0;
                    const tsB = dpB && (dpB as any).location_updated_at
                      ? new Date((dpB as any).location_updated_at).getTime()
                      : 0;
                    if (tsA !== tsB) return tsB - tsA; // most recent first

                    const cA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const cB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return cA - cB; // oldest first as tiebreaker
                  });
                return (
                  <div key={col.status} className={`border-t-2 ${col.color} rounded-lg`}>
                    <div className="flex items-center justify-between p-3">
                      <h3 className="font-semibold text-sm">{col.title}</h3>
                      <Badge variant="secondary">{colOrders.length}</Badge>
                    </div>
                    <div className="px-2 pb-2 max-h-[70vh] overflow-y-auto">
                      {colOrders.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-8">Nenhum pedido</p>
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
                            onChangeDelivery={handleChangeDelivery}
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
          </TabsContent>
        ))}
      </Tabs>

      {/* Delivery person dialog */}
      <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedOrder?.delivery_person_id ? "Trocar Entregador" : "Selecionar Entregador"}
            </DialogTitle>
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
                {[...deliveryPersons]
                  .sort((a, b) => Number(b.is_online ?? false) - Number(a.is_online ?? false))
                  .map((dp) => {
                    const activeCount = orders.filter(o =>
                      o.delivery_person_id === dp.id &&
                      ["ready", "out_for_delivery"].includes(o.status) &&
                      o.id !== selectedOrder?.id
                    ).length;
                    const online = dp.is_online;
                    return (
                      <SelectItem key={dp.id} value={dp.id} disabled={activeCount >= 3}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-muted-foreground/40"}`}
                            aria-hidden
                          />
                          {dp.name} - {dp.phone} ({activeCount}/3) {online ? "• online" : "• offline"}
                        </span>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            <Button onClick={confirmDelivery} className="w-full">
              {selectedOrder?.delivery_person_id ? "Confirmar Troca" : "Confirmar Entrega"}
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
