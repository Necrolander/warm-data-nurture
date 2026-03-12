import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  total: number;
  payment_method: string | null;
  status: string;
  created_at: string;
  order_type: string;
}

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão Crédito",
  debit_card: "Cartão Débito",
  cash: "Dinheiro",
};

const Invoices = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("all");

  const fetchOrders = async () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, total, payment_method, status, created_at, order_type")
      .gte("created_at", threeMonthsAgo.toISOString())
      .in("status", ["delivered", "ready", "out_for_delivery"])
      .order("created_at", { ascending: false });

    if (data) setOrders(data);
  };

  useEffect(() => { fetchOrders(); }, []);

  const filtered = orders.filter(o => {
    const matchSearch = o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_phone.includes(search) ||
      o.order_number.toString().includes(search);
    if (filterMonth === "all") return matchSearch;
    const orderMonth = new Date(o.created_at).getMonth().toString();
    return matchSearch && orderMonth === filterMonth;
  });

  const totalRevenue = filtered.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Notas Fiscais</h2>
          <Badge variant="secondary">{filtered.length} pedidos</Badge>
        </div>
        <Badge className="bg-primary/20 text-primary text-base px-3 py-1">
          Total: R$ {totalRevenue.toFixed(2).replace(".", ",")}
        </Badge>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone ou #pedido" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos meses</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i} value={i.toString()}>
                {new Date(2026, i).toLocaleString("pt-BR", { month: "long" })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma nota fiscal encontrada</p>
        ) : filtered.map(order => (
          <Card key={order.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">#{order.order_number}</span>
                  <span className="font-medium">{order.customer_name}</span>
                </div>
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <span>{order.customer_phone}</span>
                  <span>{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                  <span>{paymentLabels[order.payment_method || ""] || "-"}</span>
                </div>
              </div>
              <span className="font-bold text-primary">R$ {Number(order.total).toFixed(2).replace(".", ",")}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Invoices;
