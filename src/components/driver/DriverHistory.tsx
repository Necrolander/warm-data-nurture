import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, Clock } from "lucide-react";
import { invokeDriverApp } from "@/lib/driverApp";

interface DriverHistoryProps {
  driverId: string;
}

const DriverHistory = ({ driverId }: DriverHistoryProps) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState({ count: 0, total: 0 });

  useEffect(() => {
    loadHistory();
  }, [driverId]);

  const loadHistory = async () => {
    const data = await invokeDriverApp<{ orders: any[] }>("history");
    const list = data.orders || [];
    setOrders(list);
    setTodayStats({
      count: list.length,
      total: list.reduce((s, o) => s + Number(o.delivery_fee), 0),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted rounded-xl p-3 text-center">
          <Package className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{todayStats.count}</p>
          <p className="text-xs text-muted-foreground">Entregas hoje</p>
        </div>
        <div className="bg-muted rounded-xl p-3 text-center">
          <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-bold text-foreground">
            R$ {todayStats.total.toFixed(2).replace(".", ",")}
          </p>
          <p className="text-xs text-muted-foreground">Ganho hoje</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">Nenhuma entrega hoje</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <p className="text-sm font-medium">#{o.order_number}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <Badge variant="outline">
                R$ {Number(o.delivery_fee).toFixed(2).replace(".", ",")}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverHistory;
