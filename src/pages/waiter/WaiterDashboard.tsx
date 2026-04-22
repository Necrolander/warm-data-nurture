import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, Plus, Clock, CheckCircle, RefreshCw, Edit, Printer, Receipt, Percent, Trash2, XCircle, Split, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão Crédito",
  debit_card: "Cartão Débito",
  cash: "Dinheiro",
};

function generateOrderTicketHtml(order: OrderWithItems) {
  const items = order.order_items || [];
  return `<html><head><style>
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
    ${items.map(i => {
      const extras = Array.isArray(i.extras) ? (i.extras as any[]) : [];
      const extrasText = extras.length > 0 ? `<br/><small style="color:#666; margin-left:12px">+ ${extras.map((e: any) => e.name).join(", ")}</small>` : "";
      return `<div class="item"><span>${i.quantity}x ${i.product_name}${extrasText}</span><span>R$ ${(Number(i.product_price) * i.quantity).toFixed(2)}</span></div>`;
    }).join("")}
    <hr/>
    <div class="item"><span>Subtotal</span><span>R$ ${Number(order.subtotal).toFixed(2)}</span></div>
    ${Number(order.service_charge || 0) > 0 ? `<div class="item"><span>Taxa 10%</span><span>R$ ${Number(order.service_charge).toFixed(2)}</span></div>` : ""}
    <div class="item total"><span>TOTAL</span><span>R$ ${Number(order.total).toFixed(2)}</span></div>
    ${order.observation ? `<p>Obs: ${order.observation}</p>` : ""}
  </body></html>`;
}

function generateBillHtml(order: OrderWithItems, paymentMethod: string, splitInfo?: { type: string; count?: number; selectedItems?: OrderItem[] }) {
  const items = splitInfo?.selectedItems || order.order_items || [];
  const serviceCharge = Number(order.service_charge || 0);
  const now = new Date().toLocaleString("pt-BR");

  let itemRows = "";
  let calcSubtotal = 0;
  items.forEach((item) => {
    const unitPrice = Number(item.product_price);
    const lineTotal = unitPrice * item.quantity;
    calcSubtotal += lineTotal;
    const extras = Array.isArray(item.extras) ? (item.extras as any[]) : [];
    extras.forEach((e: any) => { calcSubtotal += Number(e.price || 0) * (e.quantity || 1); });

    itemRows += `<tr>
      <td style="text-align:left;padding:2px 0;">${item.quantity}x</td>
      <td style="text-align:left;padding:2px 4px;">${item.product_name}</td>
      <td style="text-align:right;padding:2px 0;">R$ ${unitPrice.toFixed(2)}</td>
      <td style="text-align:right;padding:2px 0;">R$ ${lineTotal.toFixed(2)}</td>
    </tr>`;

    extras.forEach((e: any) => {
      itemRows += `<tr>
        <td></td>
        <td style="text-align:left;padding:1px 4px;color:#666;font-size:10px;">+ ${e.name}</td>
        <td style="text-align:right;padding:1px 0;color:#666;font-size:10px;">${Number(e.price) > 0 ? `R$ ${Number(e.price).toFixed(2)}` : ""}</td>
        <td></td>
      </tr>`;
    });
  });

  let splitSubtotal = calcSubtotal;
  let splitService = serviceCharge;
  let splitTotal = Number(order.total);
  let splitLabel = "";

  if (splitInfo?.type === "people" && splitInfo.count && splitInfo.count > 1) {
    splitSubtotal = calcSubtotal / splitInfo.count;
    splitService = serviceCharge / splitInfo.count;
    splitTotal = splitTotal / splitInfo.count;
    splitLabel = `<div style="text-align:center; margin:6px 0; font-size:14px; font-weight:bold; border:2px solid #000; padding:4px;">
      DIVIDIDO POR ${splitInfo.count} PESSOAS<br/>VALOR POR PESSOA
    </div>`;
  } else if (splitInfo?.type === "items") {
    splitService = splitSubtotal > 0 ? Math.round((splitSubtotal / Number(order.subtotal)) * serviceCharge * 100) / 100 : 0;
    splitTotal = splitSubtotal + splitService;
    splitLabel = `<div style="text-align:center; margin:6px 0; font-size:14px; font-weight:bold; border:2px solid #000; padding:4px;">
      CONTA PARCIAL - ITENS SELECIONADOS
    </div>`;
  }

  return `<html><head><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 11px; width: 300px; margin: 0 auto; padding: 10px; }
    h1 { text-align: center; font-size: 16px; margin: 5px 0; }
    .divider { border-top: 2px dashed #000; margin: 8px 0; }
    .double-divider { border-top: 3px double #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    .big-total { text-align: center; font-size: 22px; font-weight: bold; margin: 8px 0; }
    .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #666; }
  </style></head><body>
    <h1>════════════════════</h1>
    <h1>FECHAMENTO DE CONTA</h1>
    <h1>════════════════════</h1>
    <div style="text-align:center; margin:8px 0;">
      <strong>Truebox Hamburgueria</strong><br/>
      ${order.table_number ? `Mesa: ${order.table_number}` : "Sem mesa"}<br/>
      Cliente: ${order.customer_name}<br/>
      Pedido #${order.order_number}
    </div>
    ${splitLabel}
    <div class="divider"></div>
    <table>
      <thead><tr style="border-bottom:1px solid #000;">
        <th style="text-align:left;font-size:10px;">QTD</th>
        <th style="text-align:left;font-size:10px;">ITEM</th>
        <th style="text-align:right;font-size:10px;">UNIT.</th>
        <th style="text-align:right;font-size:10px;">TOTAL</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="double-divider"></div>
    <table>
      <tr><td>Subtotal:</td><td style="text-align:right;">R$ ${splitSubtotal.toFixed(2)}</td></tr>
      ${splitService > 0 ? `<tr><td>Taxa de serviço (10%):</td><td style="text-align:right;">R$ ${splitService.toFixed(2)}</td></tr>` : ""}
    </table>
    <div class="divider"></div>
    <div class="big-total">TOTAL: R$ ${splitTotal.toFixed(2)}</div>
    <div class="divider"></div>
    <div style="text-align:center; margin:6px 0;">
      <strong>Forma de Pagamento:</strong><br/>${paymentLabels[paymentMethod] || paymentMethod}
    </div>
    <div class="double-divider"></div>
    <div class="footer">Emitido em: ${now}<br/>Obrigado pela preferência! 🍔<br/>Truebox Hamburgueria<br/>════════════════════</div>
    <script>window.onload = function() { window.print(); }</script>
  </body></html>`;
}

async function sendToPrintQueue(content: string, type: string, orderId: string) {
  const { error } = await supabase.from("print_queue" as any).insert({ type, order_id: orderId, content } as any);
  if (error) { console.error("Print queue error:", error); toast.error("Erro ao enviar para impressão"); return false; }
  toast.success("📠 Enviado para impressão no painel!");
  return true;
}

const WaiterDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [tables, setTables] = useState<SalonTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [waiterName, setWaiterName] = useState("");
  const [view, setView] = useState<"tables" | "orders">("tables");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [closingBill, setClosingBill] = useState(false);
  const [splitMode, setSplitMode] = useState<null | "people" | "items">(null);
  const [splitCount, setSplitCount] = useState(2);
  const [selectedSplitItems, setSelectedSplitItems] = useState<Set<string>>(new Set());
  const [managingItems, setManagingItems] = useState(false);
  const [urgencyConfirm, setUrgencyConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [ordersRes, tablesRes] = await Promise.all([
      supabase.from("orders").select("*, order_items(*)").gte("created_at", today.toISOString()).order("created_at", { ascending: false }),
      supabase.from("salon_tables").select("id, table_number, seats").eq("is_active", true).order("table_number"),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data as OrderWithItems[]);
    if (tablesRes.data) setTables(tablesRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from("profiles").select("display_name").eq("user_id", data.user.id).single()
          .then(({ data: profile }) => { setWaiterName(profile?.display_name || data.user?.email || "Garçom"); });
      }
    });
    fetchData();
    const channel = supabase.channel("waiter-orders-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/garcom/login"); };

  const activeOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status));
  const occupiedTableNumbers = new Set(activeOrders.filter(o => o.order_type === "dine_in" && o.table_number).map(o => o.table_number!));
  const getTableOrder = (tableNum: number) => activeOrders.find(o => o.order_type === "dine_in" && o.table_number === tableNum);

  const recalcOrderTotals = async (orderId: string) => {
    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    if (!items) return;
    let subtotal = 0;
    items.forEach(item => {
      const extras = Array.isArray(item.extras) ? (item.extras as any[]) : [];
      const extrasTotal = extras.reduce((s: number, e: any) => s + Number(e.price || 0) * (e.quantity || 1), 0);
      subtotal += (Number(item.product_price) + extrasTotal) * item.quantity;
    });
    const order = orders.find(o => o.id === orderId);
    const serviceCharge = Number(order?.service_charge || 0) > 0 ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
    const total = subtotal + Number(order?.delivery_fee || 0) + serviceCharge;
    await supabase.from("orders").update({ subtotal, service_charge: serviceCharge, total } as any).eq("id", orderId);
    fetchData();
  };

  const handleRemoveItem = async (item: OrderItem) => {
    const { error } = await supabase.from("order_items").delete().eq("id", item.id);
    if (error) { toast.error("Erro ao remover item"); return; }
    toast.success(`Item "${item.product_name}" removido`);
    await recalcOrderTotals(item.order_id);
    setSelectedOrder(null);
    setManagingItems(false);
  };

  const handleCancelItem = async (item: OrderItem) => {
    // Cancel = remove + log (same as remove for now but with different toast)
    const { error } = await supabase.from("order_items").delete().eq("id", item.id);
    if (error) { toast.error("Erro ao cancelar item"); return; }
    toast.success(`Item "${item.product_name}" cancelado`);
    await recalcOrderTotals(item.order_id);
    setSelectedOrder(null);
    setManagingItems(false);
  };

  const toggleServiceCharge = async (order: OrderWithItems) => {
    const currentCharge = Number(order.service_charge || 0);
    const subtotal = Number(order.subtotal);
    const newCharge = currentCharge > 0 ? 0 : Math.round(subtotal * 0.1 * 100) / 100;
    const newTotal = subtotal + Number(order.delivery_fee) + newCharge;
    const { error } = await supabase.from("orders").update({ service_charge: newCharge, total: newTotal } as any).eq("id", order.id);
    if (error) { toast.error("Erro ao atualizar taxa"); } else { toast.success(newCharge > 0 ? "Taxa de 10% adicionada" : "Taxa de 10% removida"); fetchData(); setSelectedOrder(null); }
  };

  const handlePrintOrder = async (order: OrderWithItems) => { await sendToPrintQueue(generateOrderTicketHtml(order), "order", order.id); };

  const handleCloseBill = async (order: OrderWithItems, paymentMethod: string) => {
    let splitInfo: any = undefined;
    if (splitMode === "people") {
      splitInfo = { type: "people", count: splitCount };
    } else if (splitMode === "items" && selectedSplitItems.size > 0) {
      const selectedItems = (order.order_items || []).filter(i => selectedSplitItems.has(i.id));
      splitInfo = { type: "items", selectedItems };
    }

    if (!splitInfo) {
      // Full bill close
      const { error } = await supabase.from("orders").update({ status: "delivered" as any, payment_method: paymentMethod as any }).eq("id", order.id);
      if (error) { toast.error("Erro ao fechar conta"); return; }
    }

    const billHtml = generateBillHtml(order, paymentMethod, splitInfo);
    await sendToPrintQueue(billHtml, "bill", order.id);
    toast.success(splitInfo ? "Conta dividida enviada para impressão!" : "Conta fechada! Enviado para impressão.");
    setSelectedOrder(null);
    setClosingBill(false);
    setSplitMode(null);
    setSelectedSplitItems(new Set());
    fetchData();
  };

  const handleUrgency = async () => {
    if (!selectedOrder) return;
    const { error } = await supabase.from("kitchen_alerts" as any).insert({
      table_number: selectedOrder.table_number,
      order_id: selectedOrder.id,
      waiter_name: waiterName,
      message: `URGÊNCIA! Mesa ${selectedOrder.table_number || "?"} - Pedido #${selectedOrder.order_number}`,
    } as any);
    if (error) { toast.error("Erro ao enviar alerta"); } else { toast.success("🚨 Alerta de urgência enviado para a cozinha!"); }
    setUrgencyConfirm(false);
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
          <Button size="icon" variant="ghost" onClick={fetchData}><RefreshCw className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" onClick={handleLogout}><LogOut className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex p-4 gap-2">
        <Button variant={view === "tables" ? "default" : "outline"} className="flex-1" onClick={() => setView("tables")}>🪑 Mesas</Button>
        <Button variant={view === "orders" ? "default" : "outline"} className="flex-1" onClick={() => setView("orders")}>📋 Pedidos ({activeOrders.length})</Button>
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
                  <Card key={table.id} className={`border-2 cursor-pointer active:scale-95 transition-all ${occupied ? "border-red-500 bg-red-500/10" : "border-green-500 bg-green-500/10"}`}
                    onClick={() => { if (occupied && tableOrder) { setSelectedOrder(tableOrder); } else { navigate(`/garcom/novo-pedido?table=${table.table_number}`); } }}>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-black text-foreground">{table.table_number}</p>
                      <p className="text-xs text-muted-foreground mt-1">{occupied ? "Ocupada" : "Livre"}</p>
                      {occupied && tableOrder && (
                        <p className="text-xs font-bold text-primary mt-1">R$ {Number(tableOrder.total).toFixed(2).replace(".", ",")}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <Button onClick={() => navigate("/garcom/novo-pedido")} variant="outline" className="w-full mt-4 h-12 font-bold gap-2">
            <Plus className="w-5 h-5" /> Pedido sem mesa (Retirada / Entrega)
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
                <OrderCard key={order.id} order={order} onTap={() => setSelectedOrder(order)} />
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
      <Dialog open={!!selectedOrder && !closingBill && !managingItems && !urgencyConfirm} onOpenChange={(open) => !open && setSelectedOrder(null)}>
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
                  <Badge className={`${statusColors[selectedOrder.status]} border text-xs`}>{statusLabels[selectedOrder.status]}</Badge>
                </div>
                <div className="space-y-1 border-t border-border pt-2">
                  {(selectedOrder.order_items || []).map((item) => {
                    const extras = Array.isArray(item.extras) ? (item.extras as any[]) : [];
                    return (
                      <div key={item.id}>
                        <div className="flex justify-between text-sm">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span className="font-medium">R$ {(Number(item.product_price) * item.quantity).toFixed(2).replace(".", ",")}</span>
                        </div>
                        {extras.length > 0 && <p className="text-xs text-muted-foreground pl-4">+ {extras.map((e: any) => e.name).join(", ")}</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-border pt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>R$ {Number(selectedOrder.subtotal).toFixed(2).replace(".", ",")}</span></div>
                  {Number(selectedOrder.service_charge || 0) > 0 && (
                    <div className="flex justify-between text-primary"><span>Taxa 10%</span><span>R$ {Number(selectedOrder.service_charge).toFixed(2).replace(".", ",")}</span></div>
                  )}
                  <div className="flex justify-between font-bold text-foreground text-base"><span>Total</span><span>R$ {Number(selectedOrder.total).toFixed(2).replace(".", ",")}</span></div>
                </div>

                {!["delivered", "cancelled"].includes(selectedOrder.status) && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setSelectedOrder(null); navigate(`/garcom/novo-pedido?edit=${selectedOrder.id}`); }}>
                      <Edit className="w-4 h-4" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setManagingItems(true)}>
                      <Trash2 className="w-4 h-4" /> Gerenciar Itens
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => handlePrintOrder(selectedOrder)}>
                      <Printer className="w-4 h-4" /> Reimprimir
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => toggleServiceCharge(selectedOrder)}>
                      <Percent className="w-4 h-4" /> {Number(selectedOrder.service_charge || 0) > 0 ? "Tirar 10%" : "Add 10%"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setSplitMode(null); setClosingBill(true); }}>
                      <Receipt className="w-4 h-4" /> Fechar Conta
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setSplitMode("people"); setClosingBill(true); }}>
                      <Split className="w-4 h-4" /> Dividir Conta
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1 col-span-2" onClick={() => setUrgencyConfirm(true)}>
                      <AlertTriangle className="w-4 h-4" /> 🚨 Urgência Cozinha
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Items Dialog */}
      <Dialog open={managingItems} onOpenChange={(open) => { if (!open) { setManagingItems(false); } }}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>Gerenciar Itens - #{selectedOrder.order_number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {(selectedOrder.order_items || []).map((item) => {
                  const extras = Array.isArray(item.extras) ? (item.extras as any[]) : [];
                  return (
                    <div key={item.id} className="bg-muted rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground">{item.quantity}x {item.product_name}</p>
                          {extras.length > 0 && <p className="text-xs text-muted-foreground">+ {extras.map((e: any) => e.name).join(", ")}</p>}
                          <p className="text-xs font-bold text-primary mt-1">R$ {(Number(item.product_price) * item.quantity).toFixed(2).replace(".", ",")}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-8 px-2 gap-1 text-xs" onClick={() => handleRemoveItem(item)}>
                            <Trash2 className="w-3 h-3" /> Remover
                          </Button>
                          <Button size="sm" variant="destructive" className="h-8 px-2 gap-1 text-xs" onClick={() => handleCancelItem(item)}>
                            <XCircle className="w-3 h-3" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(selectedOrder.order_items || []).length === 0 && (
                  <p className="text-center text-muted-foreground py-4">Nenhum item no pedido</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Urgency Confirm Dialog */}
      <Dialog open={urgencyConfirm} onOpenChange={(open) => !open && setUrgencyConfirm(false)}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">🚨 Enviar Alerta de Urgência?</DialogTitle>
          </DialogHeader>
          <p className="text-center text-muted-foreground text-sm">
            Isso vai enviar um alerta sonoro para o painel da cozinha/admin sobre o pedido #{selectedOrder?.order_number}
            {selectedOrder?.table_number ? ` (Mesa ${selectedOrder.table_number})` : ""}.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setUrgencyConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1 gap-1" onClick={handleUrgency}>
              <AlertTriangle className="w-4 h-4" /> Enviar Urgência
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Bill Dialog with Split options */}
      <Dialog open={closingBill} onOpenChange={(open) => { if (!open) { setClosingBill(false); setSplitMode(null); setSelectedSplitItems(new Set()); } }}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>
                  💰 {splitMode ? "Dividir Conta" : "Fechar Conta"} {selectedOrder.table_number ? `- Mesa ${selectedOrder.table_number}` : ""}
                </DialogTitle>
              </DialogHeader>

              {/* Split type selector */}
              {!splitMode && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">Deseja dividir a conta?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-14 flex-col" onClick={() => setSplitMode("people")}>
                      <span className="text-lg">👥</span>
                      <span className="text-xs">Por pessoas</span>
                    </Button>
                    <Button variant="outline" className="h-14 flex-col" onClick={() => setSplitMode("items")}>
                      <span className="text-lg">📋</span>
                      <span className="text-xs">Por itens</span>
                    </Button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">ou</span></div>
                  </div>
                </div>
              )}

              {/* Split by people */}
              {splitMode === "people" && (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">Dividir por quantas pessoas?</p>
                  <div className="flex items-center justify-center gap-4">
                    <Button size="icon" variant="outline" onClick={() => setSplitCount(Math.max(2, splitCount - 1))}>-</Button>
                    <span className="text-3xl font-black text-foreground w-12 text-center">{splitCount}</span>
                    <Button size="icon" variant="outline" onClick={() => setSplitCount(splitCount + 1)}>+</Button>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">Valor por pessoa:</p>
                    <p className="text-2xl font-black text-primary">
                      R$ {(Number(selectedOrder.total) / splitCount).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
              )}

              {/* Split by items */}
              {splitMode === "items" && (
                <div className="space-y-2">
                  <p className="text-sm text-center text-muted-foreground">Selecione os itens desta conta:</p>
                  {(selectedOrder.order_items || []).map((item) => {
                    const selected = selectedSplitItems.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg cursor-pointer border-2 transition-colors ${selected ? "border-primary bg-primary/10" : "border-border bg-muted/50"}`}
                        onClick={() => {
                          const next = new Set(selectedSplitItems);
                          if (selected) next.delete(item.id); else next.add(item.id);
                          setSelectedSplitItems(next);
                        }}
                      >
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{item.quantity}x {item.product_name}</span>
                          <span className="font-bold">R$ {(Number(item.product_price) * item.quantity).toFixed(2).replace(".", ",")}</span>
                        </div>
                      </div>
                    );
                  })}
                  {selectedSplitItems.size > 0 && (
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-sm text-muted-foreground">Total selecionado:</p>
                      <p className="text-2xl font-black text-primary">
                        R$ {(selectedOrder.order_items || [])
                          .filter(i => selectedSplitItems.has(i.id))
                          .reduce((s, i) => s + Number(i.product_price) * i.quantity, 0)
                          .toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Bill preview (when no split or after split config) */}
              {!splitMode && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                  {(selectedOrder.order_items || []).map((item) => {
                    const extras = Array.isArray(item.extras) ? (item.extras as any[]) : [];
                    return (
                      <div key={item.id}>
                        <div className="flex justify-between">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span>R$ {(Number(item.product_price) * item.quantity).toFixed(2).replace(".", ",")}</span>
                        </div>
                        {extras.map((e: any, idx: number) => (
                          <p key={idx} className="text-xs text-muted-foreground pl-4">+ {e.name} {Number(e.price) > 0 ? `R$ ${Number(e.price).toFixed(2)}` : ""}</p>
                        ))}
                      </div>
                    );
                  })}
                  <div className="border-t border-border pt-1 mt-2">
                    <div className="flex justify-between"><span>Subtotal</span><span>R$ {Number(selectedOrder.subtotal).toFixed(2).replace(".", ",")}</span></div>
                    {Number(selectedOrder.service_charge || 0) > 0 && (
                      <div className="flex justify-between text-primary"><span>Taxa 10%</span><span>R$ {Number(selectedOrder.service_charge).toFixed(2).replace(".", ",")}</span></div>
                    )}
                  </div>
                </div>
              )}

              {(!splitMode || splitMode === "people" || (splitMode === "items" && selectedSplitItems.size > 0)) && (
                <>
                  <p className="text-2xl font-black text-center text-foreground py-2">
                    R$ {(splitMode === "people"
                      ? Number(selectedOrder.total) / splitCount
                      : splitMode === "items"
                        ? (selectedOrder.order_items || []).filter(i => selectedSplitItems.has(i.id)).reduce((s, i) => s + Number(i.product_price) * i.quantity, 0)
                        : Number(selectedOrder.total)
                    ).toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-sm text-center text-muted-foreground mb-2">Forma de pagamento:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: "pix", label: "💠 PIX" },
                      { value: "credit_card", label: "💳 Crédito" },
                      { value: "debit_card", label: "💳 Débito" },
                      { value: "cash", label: "💵 Dinheiro" },
                    ].map((pm) => (
                      <Button key={pm.value} variant="outline" className="h-14 text-base font-bold" onClick={() => handleCloseBill(selectedOrder, pm.value)}>
                        {pm.label}
                      </Button>
                    ))}
                  </div>
                </>
              )}
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
            {order.order_type === "dine_in" && order.table_number && <Badge variant="outline">Mesa {order.table_number}</Badge>}
          </div>
          <Badge className={`${statusColors[order.status]} border text-xs`}>{statusLabels[order.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground font-medium">{order.customer_name}</p>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {items.slice(0, 3).map((item) => (<p key={item.id}>{item.quantity}x {item.product_name}</p>))}
          {items.length > 3 && <p className="text-primary">+{items.length - 3} itens...</p>}
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground">{new Date(order.created_at!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="font-bold text-foreground">R$ {Number(order.total).toFixed(2).replace(".", ",")}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default WaiterDashboard;
