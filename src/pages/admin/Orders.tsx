import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Clock, Truck, CheckCircle, MapPin, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
type DeliveryPerson = Database["public"]["Tables"]["delivery_persons"]["Row"];

interface OrderWithItems extends Order {
  order_items: OrderItem[];
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

const OrderCard = ({
  order,
  onAdvance,
  onSelectDelivery,
}: {
  order: OrderWithItems;
  onAdvance: (order: OrderWithItems) => void;
  onSelectDelivery: (order: OrderWithItems) => void;
}) => {
  const nextStatus: Record<string, string> = {
    pending: "production",
    production: "ready",
    ready: "out_for_delivery",
  };

  const next = nextStatus[order.status];

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-primary">#{order.order_number}</span>
          <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
        </div>

        <div className="space-y-1 text-sm mb-3">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{order.customer_name}</span>
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
        </div>

        <div className="border-t border-border pt-2 mb-3">
          {order.order_items?.map((item) => (
            <div key={item.id} className="flex justify-between text-sm py-0.5">
              <span>
                {item.quantity}x {item.product_name}
              </span>
              <span className="text-muted-foreground">
                R$ {(item.product_price * item.quantity).toFixed(2).replace(".", ",")}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t border-border pt-2">
          <span className="font-bold">
            R$ {Number(order.total).toFixed(2).replace(".", ",")}
          </span>

          {next && (
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
          )}
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

  // iFood-style loud notification sound
  const playSound = () => {
    try {
      const ctx = new AudioContext();
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
      // 3 loud bursts like iFood
      for (let i = 0; i < 3; i++) {
        playTone(1200, i * 0.35, 0.15, 0.8);
        playTone(1500, i * 0.35 + 0.15, 0.12, 0.8);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchOrders();
    fetchDeliveryPersons();

    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        playSound();
        toast.success("🔔 Novo pedido recebido!");
        fetchOrders();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const advanceOrder = async (order: OrderWithItems) => {
    const nextStatus: Record<string, string> = {
      pending: "production",
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

  const columns = [
    {
      title: "🕐 Pendente",
      icon: Clock,
      status: "pending",
      color: "border-yellow-500/50",
    },
    {
      title: "🔥 Em Produção",
      icon: Clock,
      status: "production",
      color: "border-blue-500/50",
    },
    {
      title: "✅ Pronto",
      icon: CheckCircle,
      status: "ready",
      color: "border-green-500/50",
    },
    {
      title: "🛵 Saiu p/ Entrega",
      icon: Truck,
      status: "out_for_delivery",
      color: "border-purple-500/50",
    },
  ];

  return (
    <div className="space-y-4">
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
                      onAdvance={advanceOrder}
                      onSelectDelivery={handleSelectDelivery}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
};

export default Orders;
