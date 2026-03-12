import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, DollarSign, ShoppingCart, Users, TrendingUp, Truck, Lock } from "lucide-react";
import { toast } from "sonner";

const Reports = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "items" | "drivers" | "area" | "waiter_fee">("general");

  // Report data
  const [orders, setOrders] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const checkPin = async () => {
    // Simple PIN check - stored in store_settings
    const { data } = await supabase.from("store_settings").select("*").eq("key", "reports_pin").single();
    if (!data) {
      // First time - set default PIN
      await supabase.from("store_settings").upsert({ key: "reports_pin", value: "1234" }, { onConflict: "key" });
      if (pin === "1234") { setIsLocked(false); fetchData(); }
      else toast.error("PIN incorreto");
    } else {
      if (pin === data.value) { setIsLocked(false); fetchData(); }
      else toast.error("PIN incorreto");
    }
  };

  const fetchData = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`)
      .order("created_at", { ascending: false });
    if (data) setOrders(data);
  };

  useEffect(() => { if (!isLocked) fetchData(); }, [dateFrom, dateTo]);

  if (isLocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <Lock className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-xl font-semibold">Relatórios Protegidos</h2>
            <p className="text-sm text-muted-foreground">Digite o PIN de 4 dígitos</p>
            <Input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={e => e.key === "Enter" && checkPin()}
              className="text-center text-2xl tracking-widest"
            />
            <Button onClick={checkPin} className="w-full">Acessar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculations
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const totalOrders = orders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const uniqueCustomers = new Set(orders.map(o => o.customer_phone)).size;

  // Items ranking
  const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
  orders.forEach(o => {
    o.order_items?.forEach((item: any) => {
      if (!itemCounts[item.product_name]) itemCounts[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
      itemCounts[item.product_name].qty += item.quantity;
      itemCounts[item.product_name].revenue += item.product_price * item.quantity;
    });
  });
  const rankedItems = Object.values(itemCounts).sort((a, b) => b.qty - a.qty);

  // Day distribution
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dayCounts = Array(7).fill(0);
  orders.forEach(o => { dayCounts[new Date(o.created_at).getDay()]++; });

  // Delivery driver stats
  const driverStats: Record<string, { count: number; totalFees: number }> = {};
  orders.filter(o => o.delivery_person_id && o.order_type === "delivery").forEach(o => {
    if (!driverStats[o.delivery_person_id]) driverStats[o.delivery_person_id] = { count: 0, totalFees: 0 };
    driverStats[o.delivery_person_id].count++;
    driverStats[o.delivery_person_id].totalFees += Number(o.delivery_fee);
  });

  // Waiter fee total
  const dineInTotal = orders.filter(o => o.order_type === "dine_in").reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        <span className="text-muted-foreground">até</span>
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        <Button variant="outline" size="sm" onClick={fetchData}>Atualizar</Button>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "general", label: "Geral" },
          { key: "items", label: "Itens" },
          { key: "drivers", label: "Entregadores" },
          { key: "area", label: "Área de Entrega" },
          { key: "waiter_fee", label: "Taxa Garçom" },
        ].map(tab => (
          <Button key={tab.key} variant={activeTab === tab.key ? "default" : "outline"} size="sm" onClick={() => setActiveTab(tab.key as any)}>
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "general" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center">
              <DollarSign className="h-6 w-6 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-primary">R$ {totalRevenue.toFixed(2).replace(".", ",")}</p>
              <p className="text-xs text-muted-foreground">Faturamento Total</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <ShoppingCart className="h-6 w-6 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{totalOrders}</p>
              <p className="text-xs text-muted-foreground">Total de Pedidos</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <TrendingUp className="h-6 w-6 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">R$ {avgTicket.toFixed(2).replace(".", ",")}</p>
              <p className="text-xs text-muted-foreground">Ticket Médio</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <Users className="h-6 w-6 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{uniqueCustomers}</p>
              <p className="text-xs text-muted-foreground">Clientes Ativos</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Dias que mais vendem</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {dayNames.map((day, i) => (
                  <div key={day} className="flex-1 text-center">
                    <div className="bg-primary/20 rounded-t" style={{ height: `${Math.max(20, (dayCounts[i] / Math.max(...dayCounts, 1)) * 100)}px` }} />
                    <p className="text-xs mt-1">{day}</p>
                    <p className="text-xs text-muted-foreground">{dayCounts[i]}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "items" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Ranking de Itens</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rankedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
              ) : rankedItems.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3 p-2 rounded border border-border">
                  <Badge variant="secondary" className="w-8 text-center">{i + 1}º</Badge>
                  <span className="flex-1 font-medium text-sm">{item.name}</span>
                  <span className="text-sm">{item.qty}x</span>
                  <span className="text-sm text-primary font-bold">R$ {item.revenue.toFixed(2).replace(".", ",")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "drivers" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Relatório de Entregadores</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(driverStats).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem entregas no período</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(driverStats).map(([id, stats]) => (
                  <div key={id} className="flex items-center justify-between p-2 rounded border border-border">
                    <span className="text-sm font-medium">Entregador {id.slice(0, 8)}</span>
                    <div className="text-right">
                      <p className="text-sm">{stats.count} entregas</p>
                      <p className="text-sm text-primary font-bold">R$ {stats.totalFees.toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "area" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Área de Entrega</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              As entregas estão configuradas com raio máximo de acordo com as faixas de frete definidas na aba "Frete".
              Acesse a aba Frete para ajustar as áreas e valores.
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === "waiter_fee" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Taxa de Garçom</CardTitle></CardHeader>
          <CardContent>
            <div className="text-center space-y-2">
              <p className="text-3xl font-bold text-primary">
                R$ {(dineInTotal * 0.1).toFixed(2).replace(".", ",")}
              </p>
              <p className="text-sm text-muted-foreground">
                Total de taxa de garçom (10%) sobre R$ {dineInTotal.toFixed(2).replace(".", ",")} em consumo no local
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;
