import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, RefreshCw, ExternalLink, Camera, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-600",
  CONFIRMED: "bg-blue-500/20 text-blue-600",
  PREPARING: "bg-orange-500/20 text-orange-600",
  READY: "bg-purple-500/20 text-purple-600",
  OUT_FOR_DELIVERY: "bg-indigo-500/20 text-indigo-600",
  DELIVERED: "bg-green-500/20 text-green-600",
  CANCELLED: "bg-red-500/20 text-red-600",
  UNKNOWN: "bg-gray-500/20 text-gray-600",
};

const ExternalIntegrations = () => {
  const [heartbeats, setHeartbeats] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [failures, setFailures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  const fetchAll = async () => {
    const [hb, ord, fl] = await Promise.all([
      supabase.from("bot_heartbeats" as any).select("*").order("updated_at", { ascending: false }),
      supabase.from("external_orders" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("bot_failures" as any).select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setHeartbeats((hb.data as any[]) || []);
    setOrders((ord.data as any[]) || []);
    setFailures((fl.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const i = setInterval(fetchAll, 15000);
    return () => clearInterval(i);
  }, []);

  const reprocess = async (id: string) => {
    setReprocessing(id);
    try {
      const { data, error } = await supabase.functions.invoke("external-orders-ingest", {
        body: { action: "reprocess", externalOrderId: id },
      });
      if (error) throw error;
      toast.success("Pedido reprocessado!");
      fetchAll();
    } catch (e: any) {
      toast.error("Falha: " + e.message);
    }
    setReprocessing(null);
  };

  const isOnline = (hb: any) => {
    if (!hb.last_polled_at) return false;
    const ageS = (Date.now() - new Date(hb.last_polled_at).getTime()) / 1000;
    return ageS < 90; // online se polling há menos de 90s
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" /> Integrações Externas (Bots)
        </h2>
        <p className="text-sm text-muted-foreground">
          Monitoramento dos bots Playwright (iFood / 99Food) hospedados na sua VPS.
        </p>
      </div>

      {/* Heartbeats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {heartbeats.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground text-center">
              Nenhum bot conectado ainda. Configure seu bot na VPS para enviar <code>heartbeat</code>.
            </CardContent>
          </Card>
        )}
        {heartbeats.map((hb) => (
          <Card key={hb.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="capitalize">{hb.channel}</span>
                <Badge className={isOnline(hb) ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}>
                  {isOnline(hb) ? "● Online" : "● Offline"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1 text-muted-foreground">
              <div>Último polling: {hb.last_polled_at ? formatDistanceToNow(new Date(hb.last_polled_at), { addSuffix: true, locale: ptBR }) : "—"}</div>
              <div>Pedidos capturados: <span className="font-semibold text-foreground">{hb.orders_captured_total}</span></div>
              <div>Falhas: <span className="font-semibold text-foreground">{hb.failures_total}</span></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Pedidos Externos ({orders.length})</TabsTrigger>
          <TabsTrigger value="failures">Falhas Recentes ({failures.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">Últimos 100 pedidos</CardTitle>
              <Button size="sm" variant="outline" onClick={fetchAll}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <ScrollArea className="h-[500px]">
              <CardContent className="space-y-2">
                {orders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido recebido ainda.</p>
                )}
                {orders.map((o) => (
                  <div key={o.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="capitalize">{o.channel}</Badge>
                          <Badge className={STATUS_COLORS[o.normalized_status] || ""}>{o.normalized_status}</Badge>
                          <span className="text-xs text-muted-foreground">#{o.external_order_id}</span>
                          {o.internal_order_id && (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> No PDV
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium mt-1">
                          {o.normalized_payload?.customer?.name || "Cliente"} — R$ {Number(o.normalized_payload?.totals?.total || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(o.created_at), { addSuffix: true, locale: ptBR })}
                          {o.raw_status && <> · raw: <code>{o.raw_status}</code></>}
                        </p>
                      </div>
                      {!o.internal_order_id && (
                        <Button size="sm" variant="outline" onClick={() => reprocess(o.id)} disabled={reprocessing === o.id}>
                          {reprocessing === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reprocessar"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="failures" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" /> Últimas 50 falhas
              </CardTitle>
            </CardHeader>
            <ScrollArea className="h-[500px]">
              <CardContent className="space-y-2">
                {failures.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma falha registrada. 🎉</p>
                )}
                {failures.map((f) => (
                  <div key={f.id} className="border border-destructive/30 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">{f.channel}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm font-mono text-destructive">{f.error_message}</p>
                    <div className="flex gap-2 text-xs">
                      {f.screenshot_url && (
                        <a href={f.screenshot_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Camera className="h-3 w-3" /> Screenshot
                        </a>
                      )}
                      {f.html_snapshot_url && (
                        <a href={f.html_snapshot_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> HTML snapshot
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExternalIntegrations;
