import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, AlertTriangle, TrendingDown } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  total_orders: number;
  last_order_at: string | null;
}

const daysSince = (date: string | null) => {
  if (!date) return Infinity;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
};

const Contacts = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("customers").select("*").order("last_order_at", { ascending: true, nullsFirst: true });
      if (data) setCustomers(data as Customer[]);
    };
    fetch();
  }, []);

  const fiveDays = customers.filter(c => {
    const d = daysSince(c.last_order_at);
    return d >= 5 && d < 7;
  });

  const oneWeek = customers.filter(c => {
    const d = daysSince(c.last_order_at);
    return d >= 7 && d < 30;
  });

  const churned = customers.filter(c => {
    const d = daysSince(c.last_order_at);
    return d >= 30 || d === Infinity;
  });

  const Section = ({ title, icon: Icon, items, color }: { title: string; icon: any; items: Customer[]; color: string }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          {title}
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente nesta categoria</p>
        ) : (
          <div className="space-y-1">
            {items.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded border border-border">
                <div>
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">{c.phone}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">{c.total_orders} pedidos</span>
                  <p className="text-xs text-muted-foreground">
                    {c.last_order_at
                      ? `Último: ${new Date(c.last_order_at).toLocaleDateString("pt-BR")}`
                      : "Sem pedidos"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" /> Contatos de Clientes
      </h2>
      <p className="text-sm text-muted-foreground">
        Clientes segmentados por atividade de pedidos. Use para campanhas de reativação.
      </p>

      <div className="space-y-4">
        <Section title="Não pedem há 5 dias" icon={Clock} items={fiveDays} color="text-yellow-400" />
        <Section title="Não pedem há 1 semana+" icon={AlertTriangle} items={oneWeek} color="text-orange-400" />
        <Section title="Clientes que pararam de pedir" icon={TrendingDown} items={churned} color="text-destructive" />
      </div>
    </div>
  );
};

export default Contacts;
