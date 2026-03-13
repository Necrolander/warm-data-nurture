import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { LogOut, Plus, Clock, CheckCircle, RefreshCw, Edit, Printer, Receipt, Percent } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["orders"]["Row"] & { service_charge?: number };
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

interface SalonTable {
  id: string;
  table_number: number;
  seats: number | null;
}

const statusLabels: Record<string, string> = {
  pending: "⏳ Pendente",
  production: "🔥 Produção",
  ready: "✅ Pronto",
  out_for_delivery: "🛵 Saiu",
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
  const [tables, setTables] = useState<SalonTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [waiterName, setWaiterName] = useState("");
  const [view, setView] = useState<"tables" | "orders">("tables");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [closingBill, setClosingBill] = useState(false);

  const fetchData = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [ordersRes, tablesRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("salon_tables")
        .select("id, table_number, seats")
        .eq("is_active", true)
        .order("table_number"),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data as OrderWithItems[]);
    if (tablesRes.data) setTables(tablesRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
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

    fetchData();

    const channel = supabase
      .channel("waiter-orders-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/waiter/login");
  };

  // Determine which tables are occupied (have active dine_in orders)
  const activeOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status));
  const occupiedTableNumbers = new Set(
    activeOrders.filter(o => o.order_type === "dine_in" && o.table_number).map(o => o.table_number!)
  );

  const getTableOrder = (tableNum: number) =>
    activeOrders.find(o => o.order_type === "dine_in" && o.table_number === tableNum);

  const toggleServiceCharge = async (order: OrderWithItems) => {
    const currentCharge = Number(order.service_charge || 0);
    const subtotal = Number(order.subtotal);
    const newCharge = currentCharge > 0 ? 0 : Math.round(subtotal * 0.1 * 100) / 100;
    const newTotal = subtotal + Number(order.delivery_fee) + newCharge;

    const { error } = await supabase
      .from("orders")
      .update({ service_charge: newCharge, total: newTotal } as any)
      .eq("id", order.id);

    if (error) {
      toast.error("Erro ao atualizar taxa");
    } else {
      toast.success(newCharge > 0 ? "Taxa de 10% adicionada" : "Taxa de 10% removida");
      fetchData();
      setSelectedOrder(null);
    }
  };

  const handlePrintOrder = (order: OrderWithItems) => {
    const items = order.order_items || [];
    const printContent = `
      <html><head><style>
        body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; }
        h2 { text-align: center; margin: 5px 0; }
        hr { border: 1px dashed #000; }
        .item { display: flex; justify-content: space-between; }
        .total { font-weight: bold; font-size: 14px; }
      </style></head><body>
        <h2>🍽️ COMANDA #${order.order_number}</h2>
        <p>Mesa: ${order.table_number || "-"} | ${order.customer_name}</p>
        <p>${new Date(order.created_at!).toLocaleString("pt-BR")}</p>
        <hr/>
        ${items.map(i => `<div class="item"><span>${i.quantity}x ${i.product_name}</span><span>R$ ${(Number(i.product_price) * i.quantity).toFixed(2)}</span></div>`).join("")}
        <hr/>
        <div class="item"><span>Subtotal</span><span>R$ ${Number(order.subtotal).toFixed(2)}</span></div>
        ${Number(order.service_charge || 0) > 0 ? `<div class="item"><span>Taxa 10%</span><span>R$ ${Number(order.service_charge).toFixed(2)}</span></div>` : ""}
        <div class="item total"><span>TOTAL</span><span>R$ ${Number(order.total).toFixed(2)}</span></div>
        ${order.observation ? `<p>Obs: ${order.observation}</p>` : ""}
      </body></html>
    `;
    const win = window.open("", "_blank", "width=320,height=600");
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.print();
    }
  };

  const handleCloseBill = async (order: OrderWithItems, paymentMethod: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered" as any, payment_method: paymentMethod as any })
      .eq("id", order.id);

    if (error) {
      toast.error("Erro ao fechar conta");
    } else {
      toast.success("Conta fechada! Imprimindo...");
      handlePrintOrder(order);
      setSelectedOrder(null);
      setClosingBill(false);
      fetchData();
    }
  };

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
          <Button size="icon" variant="ghost" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex p-4 gap-2">
        <Button
          variant={view === "tables" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setView("tables")}
        >
          🪑 Mesas
        </Button>
        <Button
          variant={view === "orders" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setView("orders")}
        >
          📋 Pedidos ({activeOrders.length})
        </Button>
      </div>

      {/* Tables View */}
      {view === "tables" && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">Mapa de Mesas</h2>
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Livre</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Ocupada</span>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : tables.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma mesa cadastrada</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {tables.map((table) => {
                const occupied = occupiedTableNumbers.has(table.table_number);
                const tableOrder = getTableOrder(table.table_number);
                return (
                  <Card
                    key={table.id}
                    className={`border-2 cursor-pointer active:scale-95 transition-all ${
                      occupied
                        ? "border-red-500 bg-red-500/10"
                        : "border-green-500 bg-green-500/10"
                    }`}
                    onClick={() => {
                      if (occupied && tableOrder) {
                        setSelectedOrder(tableOrder);
                      } else {
                        navigate(`/waiter/new-order?table=${table.table_number}`);
                      }
                    }}
                  >
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-black text-foreground">{table.table_number}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {occupied ? "Ocupada" : "Livre"}
                      </p>
                      {occupied && tableOrder && (
                        <p className="text-xs font-bold text-primary mt-1">
                          R$ {Number(tableOrder.total).toFixed(2).replace(".", ",")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* New Order Button (no table) */}
          <Button
            onClick={() => navigate("/waiter/new-order")}
            variant="outline"
            className="w-full mt-4 h-12 font-bold gap-2"
          >
            <Plus className="w-5 h-5" />
            Pedido sem mesa (Retirada / Entrega)
          </Button>
        </div>
      )}

      {/* Orders View */}
      {view === "orders" && (
        <div className="px-4 pb-4">
          {activeOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum pedido ativo</p>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onTap={() => setSelectedOrder(order)}
                />
              ))}
            </div>
          )}

          {completedOrders.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Finalizados ({completedOrders.length})
              </h2>
              <div className="space-y-3 opacity-50">
                {completedOrders.slice(0, 5).map((order) => (
                  <OrderCard key={order.id} order={order} onTap={() => setSelectedOrder(order)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder && !closingBill} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Pedido #{selectedOrder.order_number}
                  {selectedOrder.table_number && <Badge variant="outline">Mesa {selectedOrder.table_number}</Badge>}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{selectedOrder.customer_name}</span>
                  <Badge className={`${statusColors[selectedOrder.status]} border text-xs`}>
                    {statusLabels[selectedOrder.status]}
                  </Badge>
                </div>

                {/* Items */}
                <div className="space-y-1 border-t border-border pt-2">
                  {(selectedOrder.order_items || []).map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.product_name}</span>
                      <span className="font-medium">R$ {(Number(item.product_price) * item.quantity).toFixed(2).replace(".", ",")}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t border-border pt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>R$ {Number(selectedOrder.subtotal).toFixed(2).replace(".", ",")}</span>
                  </div>
                  {Number(selectedOrder.service_charge || 0) > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Taxa 10%</span>
                      <span>R$ {Number(selectedOrder.service_charge).toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-foreground text-base">
                    <span>Total</span>
                    <span>R$ {Number(selectedOrder.total).toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>

                {/* Actions */}
                {!["delivered", "cancelled"].includes(selectedOrder.status) && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => navigate(`/waiter/new-order?edit=${selectedOrder.id}`)}
                    >
                      <Edit className="w-4 h-4" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handlePrintOrder(selectedOrder)}
                    >
                      <Printer className="w-4 h-4" /> Imprimir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => toggleServiceCharge(selectedOrder)}
                    >
                      <Percent className="w-4 h-4" />
                      {Number(selectedOrder.service_charge || 0) > 0 ? "Tirar 10%" : "Add 10%"}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => setClosingBill(true)}
                    >
                      <Receipt className="w-4 h-4" /> Fechar Conta
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Close Bill Dialog */}
      <Dialog open={closingBill} onOpenChange={(open) => !open && setClosingBill(false)}>
        <DialogContent className="max-w-sm mx-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>💰 Fechar Conta - Mesa {selectedOrder.table_number}</DialogTitle>
              </DialogHeader>
              <p className="text-2xl font-black text-center text-foreground py-4">
                R$ {Number(selectedOrder.total).toFixed(2).replace(".", ",")}
              </p>
              <p className="text-sm text-center text-muted-foreground mb-4">Selecione a forma de pagamento:</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "pix", label: "💠 PIX" },
                  { value: "credit_card", label: "💳 Crédito" },
                  { value: "debit_card", label: "💳 Débito" },
                  { value: "cash", label: "💵 Dinheiro" },
                ].map((pm) => (
                  <Button
                    key={pm.value}
                    variant="outline"
                    className="h-14 text-base font-bold"
                    onClick={() => handleCloseBill(selectedOrder, pm.value)}
                  >
                    {pm.label}
                  </Button>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const OrderCard = ({ order, onTap }: { order: OrderWithItems; onTap: () => void }) => {
  const items = order.order_items || [];

  return (
    <Card className="border border-border cursor-pointer active:scale-[0.98] transition-transform" onClick={onTap}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-foreground">#{order.order_number}</span>
            {order.order_type === "dine_in" && order.table_number && (
              <Badge variant="outline">Mesa {order.table_number}</Badge>
            )}
          </div>
          <Badge className={`${statusColors[order.status]} border text-xs`}>
            {statusLabels[order.status]}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground font-medium">{order.customer_name}</p>

        <div className="text-xs text-muted-foreground space-y-0.5">
          {items.slice(0, 3).map((item) => (
            <p key={item.id}>{item.quantity}x {item.product_name}</p>
          ))}
          {items.length > 3 && <p className="text-primary">+{items.length - 3} itens...</p>}
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
