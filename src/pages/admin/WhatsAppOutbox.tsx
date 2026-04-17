import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, RefreshCw, CheckCircle2, AlertCircle, Clock, Send } from "lucide-react";
import { toast } from "sonner";

interface OutboxItem {
  id: string;
  phone: string;
  message: string;
  status: string;
  order_id: string | null;
  kind: string | null;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-700", icon: Clock },
  sending: { label: "Enviando", color: "bg-blue-500/20 text-blue-700", icon: Send },
  sent: { label: "Enviado", color: "bg-green-500/20 text-green-700", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "bg-red-500/20 text-red-700", icon: AlertCircle },
};

const WhatsAppOutbox = () => {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_outbox" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setItems(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    const channel = supabase
      .channel("whatsapp-outbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_outbox" }, () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const retry = async (id: string) => {
    await supabase.from("whatsapp_outbox" as any)
      .update({ status: "pending", attempts: 0, last_error: null } as any)
      .eq("id", id);
    toast.success("Reenfileirado!");
  };

  const counts = {
    pending: items.filter(i => i.status === "pending").length,
    sending: items.filter(i => i.status === "sending").length,
    sent: items.filter(i => i.status === "sent").length,
    failed: items.filter(i => i.status === "failed").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Fila de WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">Mensagens automáticas enviadas pelo bot da VPS</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(counts).map(([key, val]) => {
          const cfg = statusConfig[key];
          const Icon = cfg.icon;
          return (
            <Card key={key}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{cfg.label}</span>
                </div>
                <p className="text-2xl font-bold mt-1">{val}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Histórico (últimas 100)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y divide-border">
              {items.map(item => {
                const cfg = statusConfig[item.status] || statusConfig.pending;
                return (
                  <div key={item.id} className="p-3 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                        <span className="text-sm font-medium truncate">{item.phone}</span>
                        {item.kind && <span className="text-xs text-muted-foreground">• {item.kind}</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.attempts > 0 && (
                          <span className="text-xs text-muted-foreground">{item.attempts} tentativa(s)</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                        </span>
                        {item.status === "failed" && (
                          <Button size="sm" variant="ghost" onClick={() => retry(item.id)} className="h-6 text-xs">
                            Reenviar
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 ml-1">
                      {item.message}
                    </p>
                    {item.last_error && (
                      <p className="text-xs text-red-600 mt-1 ml-1">⚠️ {item.last_error}</p>
                    )}
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nenhuma mensagem enviada ainda.<br />
                  Quando um pedido sair pra entrega, a mensagem aparece aqui automaticamente.
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppOutbox;
