import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Truck, UtensilsCrossed, Phone, MapPin, User, CreditCard,
  MessageSquare, ExternalLink, Search, ChevronDown, ChevronUp,
  Package, Bike, ShieldCheck, ShieldX, Globe, CalendarIcon, Filter, X
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type DeliveryPerson = Database["public"]["Tables"]["delivery_persons"]["Row"];
type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

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
  delivered: "bg-green-600/20 text-green-500",
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

const sourceLabels: Record<string, string> = {
  site: "🌐 Site",
  whatsapp_bot: "📱 WhatsApp Bot",
  ifood: "🟥 iFood",
  pdv_admin: "💻 PDV Admin",
  app_garcom: "🍽️ App Garçom",
};

const HistoryOrderCard = ({ order, deliveryPersons }: { order: OrderWithItems; deliveryPersons: DeliveryPerson[] }) => {
  const [expanded, setExpanded] = useState(false);

  const mapLink = order.delivery_lat && order.delivery_lng
    ? `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`
    : null;

  return (
    <Card className="mb-2">
      <CardContent className="p-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-primary text-sm">#{order.order_number}</span>
            <Badge className={`text-xs ${statusColors[order.status]}`}>{statusLabels[order.status]}</Badge>
            <Badge variant="outline" className="text-xs">{orderTypeLabels[order.order_type] || order.order_type}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">R$ {Number(order.total).toFixed(2).replace(".", ",")}</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{order.created_at && new Date(order.created_at).toLocaleString("pt-BR")}</span>
          <span>•</span>
          <span className="flex items-center gap-1"><User className="h-3 w-3" />{order.customer_name}</span>
        </div>

        {expanded && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{order.customer_name}</span></div>
              <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span>{order.customer_phone}</span></div>
              {order.payment_method && (
                <div className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{paymentLabels[order.payment_method] || order.payment_method}</span>
                  {order.change_for && order.payment_method === "cash" && (
                    <span className="text-muted-foreground">(Troco p/ R$ {Number(order.change_for).toFixed(2).replace(".", ",")})</span>
                  )}
                </div>
              )}
              {order.reference && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><span>{order.reference}</span></div>}
              {mapLink && (
                <a href={mapLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 underline text-xs">
                  <ExternalLink className="h-3 w-3" />Ver no mapa
                </a>
              )}
              {order.table_number && <div className="text-xs text-muted-foreground">🍽️ Mesa: {order.table_number}</div>}
              {order.observation && (
                <div className="flex items-start gap-1.5 bg-muted/50 rounded p-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground italic text-xs">{order.observation}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-2 space-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Origem:</span>
                <Badge variant="outline" className="text-xs">
                  {sourceLabels[(order as any).order_source] || "🌐 Site"}
                </Badge>
              </div>

              {order.delivery_person_id && (() => {
                const dp = deliveryPersons.find(d => d.id === order.delivery_person_id);
                return (
                  <div className="flex items-center gap-1.5">
                    <Bike className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Motoboy:</span>
                    <span className="font-medium">{dp?.name || "Desconhecido"}</span>
                    {dp?.phone && <span className="text-xs text-muted-foreground">({dp.phone})</span>}
                  </div>
                );
              })()}

              {order.order_type === "delivery" && (
                <div className="flex items-center gap-1.5">
                  {order.delivery_code && order.status === "delivered" ? (
                    <><ShieldCheck className="h-3.5 w-3.5 text-green-500" /><span className="text-green-500 text-xs font-medium">✅ Confirmado com código ({order.delivery_code})</span></>
                  ) : order.status === "delivered" ? (
                    <><ShieldX className="h-3.5 w-3.5 text-yellow-500" /><span className="text-yellow-500 text-xs font-medium">⚠️ Entregue sem código de confirmação</span></>
                  ) : null}
                </div>
              )}

              {order.delivery_person_id && (
                <div className="flex items-center gap-1.5 text-xs">
                  {order.checklist_confirmed
                    ? <span className="text-green-500">✅ Checklist conferido</span>
                    : <span className="text-yellow-500">⚠️ Checklist não conferido</span>}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-2">
              <p className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1"><Package className="h-3 w-3" /> ITENS</p>
              {order.order_items?.map((item) => (
                <div key={item.id} className="text-sm py-0.5">
                  <div className="flex justify-between">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span className="text-muted-foreground">R$ {(item.product_price * item.quantity).toFixed(2).replace(".", ",")}</span>
                  </div>
                  {item.extras && Array.isArray(item.extras) && (item.extras as any[]).length > 0 && (
                    <p className="text-xs text-muted-foreground ml-4">{(item.extras as any[]).map((e: any) => `+ ${e.name || e}`).join(", ")}</p>
                  )}
                  {item.observation && <p className="text-xs text-muted-foreground ml-4 italic">📝 {item.observation}</p>}
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-2 space-y-0.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>R$ {Number(order.subtotal).toFixed(2).replace(".", ",")}</span></div>
              {Number(order.delivery_fee) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxa de entrega</span><span>R$ {Number(order.delivery_fee).toFixed(2).replace(".", ",")}</span></div>}
              {Number(order.service_charge) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxa de serviço</span><span>R$ {Number(order.service_charge).toFixed(2).replace(".", ",")}</span></div>}
              <div className="flex justify-between font-bold"><span>Total</span><span>R$ {Number(order.total).toFixed(2).replace(".", ",")}</span></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const OrderHistory = () => {
  const [historyOrders, setHistoryOrders] = useState<OrderWithItems[]>([]);
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchHistory();
    fetchDeliveryPersons();
  }, []);

  const fetchDeliveryPersons = async () => {
    const { data } = await supabase.from("delivery_persons").select("*");
    if (data) setDeliveryPersons(data);
  };

  const fetchHistory = async () => {
    setLoading(true);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .gte("created_at", sixtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (!error && data) setHistoryOrders(data as OrderWithItems[]);
    setLoading(false);
  };

  const activeFilterCount = [
    dateFrom, dateTo,
    statusFilter !== "all" ? statusFilter : null,
    sourceFilter !== "all" ? sourceFilter : null,
    paymentFilter !== "all" ? paymentFilter : null,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatusFilter("all");
    setSourceFilter("all");
    setPaymentFilter("all");
    setSearch("");
  };

  const filteredOrders = historyOrders.filter((o) => {
    // Text search
    if (search) {
      const q = search.toLowerCase();
      const matches = String(o.order_number).includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q);
      if (!matches) return false;
    }

    // Date from
    if (dateFrom && o.created_at) {
      const orderDate = new Date(o.created_at);
      const fromStart = new Date(dateFrom);
      fromStart.setHours(0, 0, 0, 0);
      if (orderDate < fromStart) return false;
    }

    // Date to
    if (dateTo && o.created_at) {
      const orderDate = new Date(o.created_at);
      const toEnd = new Date(dateTo);
      toEnd.setHours(23, 59, 59, 999);
      if (orderDate > toEnd) return false;
    }

    // Status
    if (statusFilter !== "all" && o.status !== statusFilter) return false;

    // Source
    if (sourceFilter !== "all" && (o as any).order_source !== sourceFilter) return false;

    // Payment
    if (paymentFilter !== "all" && o.payment_method !== paymentFilter) return false;

    return true;
  });

  const deliveryOrders = filteredOrders.filter(o => o.order_type === "delivery" || o.order_type === "pickup");
  const dineInOrders = filteredOrders.filter(o => o.order_type === "dine_in");

  const totalDelivery = deliveryOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const totalDineIn = dineInOrders.reduce((sum, o) => sum + Number(o.total), 0);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando histórico...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por número, nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-20"
        />
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 gap-1"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filtros avançados</span>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1 h-7">
                  <X className="h-3 w-3" /> Limpar filtros
                </Button>
              )}
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal text-xs h-9", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal text-xs h-9", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Quick date buttons */}
            <div className="flex flex-wrap gap-1">
              {[
                { label: "Hoje", fn: () => { const d = new Date(); setDateFrom(d); setDateTo(d); } },
                { label: "Ontem", fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); setDateFrom(d); setDateTo(d); } },
                { label: "Últimos 7 dias", fn: () => { const from = new Date(); from.setDate(from.getDate() - 7); setDateFrom(from); setDateTo(new Date()); } },
                { label: "Últimos 30 dias", fn: () => { const from = new Date(); from.setDate(from.getDate() - 30); setDateFrom(from); setDateTo(new Date()); } },
                { label: "Este mês", fn: () => { const now = new Date(); setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1)); setDateTo(now); } },
              ].map((btn) => (
                <Button key={btn.label} variant="outline" size="sm" className="text-xs h-7" onClick={btn.fn}>
                  {btn.label}
                </Button>
              ))}
            </div>

            {/* Selects row */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Origem</label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Object.entries(sourceLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Pagamento</label>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(paymentLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results summary */}
      {activeFilterCount > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {filteredOrders.length} pedido(s) encontrado(s) com {activeFilterCount} filtro(s) ativo(s)
        </div>
      )}

      <Tabs defaultValue="delivery" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="delivery" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />Delivery
            <Badge variant="secondary" className="ml-1 text-xs">{deliveryOrders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="dine_in" className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />Mesa
            <Badge variant="secondary" className="ml-1 text-xs">{dineInOrders.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="delivery">
          <div className="bg-card border border-border rounded-lg p-3 mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{deliveryOrders.length} pedidos</span>
            <span className="text-sm font-bold">Total: R$ {totalDelivery.toFixed(2).replace(".", ",")}</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-0">
            {deliveryOrders.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Nenhum pedido encontrado</p>
            ) : (
              deliveryOrders.map((order) => <HistoryOrderCard key={order.id} order={order} deliveryPersons={deliveryPersons} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="dine_in">
          <div className="bg-card border border-border rounded-lg p-3 mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{dineInOrders.length} pedidos</span>
            <span className="text-sm font-bold">Total: R$ {totalDineIn.toFixed(2).replace(".", ",")}</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-0">
            {dineInOrders.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Nenhum pedido encontrado</p>
            ) : (
              dineInOrders.map((order) => <HistoryOrderCard key={order.id} order={order} deliveryPersons={deliveryPersons} />)
            )}
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-center text-muted-foreground">Exibindo pedidos dos últimos 60 dias</p>
    </div>
  );
};

export default OrderHistory;
