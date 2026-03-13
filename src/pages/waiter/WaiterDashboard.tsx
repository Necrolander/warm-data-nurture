import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, Plus, Clock, ChefHat, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

const statusLabels: Record<string, string> = {
  pending: "⏳ Pendente",
  production: "🔥 Em Produção",
  ready: "✅ Pronto",
  out_for_delivery: "🛵 Saiu p/ Entrega",
  delivered: "📦 Entregue",
  cancelled: "❌ Cancelado",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  production: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  ready: "bg-green-500/20 text-green-600 border-green-500/30",
  out_for_delivery: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  delivered: "bg-muted text-muted-foreground border-muted",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

const WaiterDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [waiterName, setWaiterName] = useState("");

  const fetchOrders = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data as OrderWithItems[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Get waiter name
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", data.user.id)
          .single()
          .then(({ data: profile }) => {
            setWaiterName(profile?.display_name || data.user?.email || "Garçom");
          });
      }
    });

    fetchOrders();

    // Real-time subscription
    const channel = supabase
      .channel("waiter-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/waiter/login");
  };

  const activeOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status));
  const completedOrders = orders.filter(o => ["delivered", "cancelled"].includes(o.status));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-foreground">🍽️ App Garçom</h1>
          <p className="text-xs text-muted-foreground">Olá, {waiterName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={fetchOrders}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* New Order Button */}
      <div className="p-4">
        <Button
          onClick={() => navigate("/waiter/new-order")}
          className="w-full h-14 text-lg font-bold gap-2"
        >
          <Plus className="w-6 h-6" />
          Novo Pedido
        </Button>
      </div>

      {/* Active Orders */}
      <div className="px-4 pb-2">
        <h2 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1">
          <Clock className="w-4 h-4" />
          Pedidos Ativos ({activeOrders.length})
        </h2>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : activeOrders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum pedido ativo</p>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>

      {/* Completed Orders */}
      {completedOrders.length > 0 && (
        <div className="px-4 pb-4 mt-4">
          <h2 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Finalizados Hoje ({completedOrders.length})
          </h2>
          <div className="space-y-3 opacity-60">
            {completedOrders.slice(0, 5).map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const OrderCard = ({ order }: { order: OrderWithItems }) => {
  const items = order.order_items || [];

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-foreground">#{order.order_number}</span>
            {order.order_type === "dine_in" && order.table_number && (
              <Badge variant="outline">Mesa {order.table_number}</Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {order.order_type === "delivery" ? "🛵 Entrega" : order.order_type === "pickup" ? "🏪 Retirada" : "🍽️ Salão"}
            </Badge>
          </div>
          <Badge className={`${statusColors[order.status]} border text-xs`}>
            {statusLabels[order.status]}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground font-medium">{order.customer_name}</p>

        <div className="text-xs text-muted-foreground space-y-0.5">
          {items.map((item) => (
            <p key={item.id}>
              {item.quantity}x {item.product_name}
            </p>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {new Date(order.created_at!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="font-bold text-foreground">
            R$ {Number(order.total).toFixed(2).replace(".", ",")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default WaiterDashboard;
