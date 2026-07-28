import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, RefreshCw, Webhook, CheckCircle2, XCircle } from "lucide-react";

type WebhookRow = {
  id: string;
  delivery_id: string;
  event: string;
  order_public_id: string | null;
  status: string | null;
  signature_valid: boolean;
  received_at: string;
  payload: any;
};

const ACTIONS: { key: string; label: string; variant?: "default" | "destructive" | "secondary" }[] = [
  { key: "accept", label: "Aceitar" },
  { key: "preparing", label: "Preparo" },
  { key: "ready", label: "Pronto" },
  { key: "dispatch", label: "Despachar" },
  { key: "deliver", label: "Entregue" },
  { key: "cancel", label: "Cancelar", variant: "destructive" },
];

const ActionButtons = ({ orderPublicId }: { orderPublicId: string }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (action: string) => {
    let reason: string | undefined;
    if (action === "cancel") {
      reason = window.prompt("Motivo do cancelamento:") || undefined;
      if (!reason) return;
    }
    setBusy(action);
    const { data, error } = await supabase.functions.invoke("deliverystudio-action", {
      body: { orderPublicId, action, ...(reason ? { reason, notifyCustomer: false } : {}) },
    });
    setBusy(null);
    if (error) {
      toast.error(`Falha: ${error.message}`);
      return;
    }
    if ((data as any)?.error) {
      toast.error(`Erro: ${(data as any).error}`);
      return;
    }
    toast.success(`Ação "${action}" enviada`);
  };
  return (
    <>
      {ACTIONS.map((a) => (
        <Button
          key={a.key}
          size="sm"
          variant={a.variant ?? "outline"}
          disabled={busy !== null}
          onClick={() => run(a.key)}
        >
          {busy === a.key ? "..." : a.label}
        </Button>
      ))}
    </>
  );
};

const DeliveryStudioPage = () => {
  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<WebhookRow | null>(null);

  const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID as string;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/deliverystudio-webhook`;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("deliverystudio_webhooks" as any)
      .select("*")
      .order("received_at", { ascending: false })
      .limit(50);
    setLoading(false);
    if (error) {
      // Table may not exist yet if migration is pending
      console.warn("deliverystudio_webhooks:", error.message);
      return;
    }
    setRows((data as any) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Webhook className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">DeliveryStudio · Integração Webhook</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Configurar no painel do DeliveryStudio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">URL (HTTPS) do endpoint</label>
            <div className="flex gap-2 mt-1">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button onClick={() => copy(webhookUrl, "URL")}>
                <Copy className="w-4 h-4 mr-1" /> Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cole essa URL no campo <b>URL (HTTPS)</b> do painel DeliveryStudio, ative <b>Disparar webhooks</b> e salve.
            </p>
          </div>

          <div className="rounded-md border p-3 bg-muted/40 text-sm space-y-1">
            <div className="font-medium">Segurança (HMAC)</div>
            <div className="text-muted-foreground">
              O segredo HMAC já está salvo aqui como <code>DELIVERYSTUDIO_WEBHOOK_SECRET</code>. Use exatamente o
              mesmo valor no campo de segredo do painel deles. Assinaturas inválidas são rejeitadas com 401.
            </div>
          </div>

          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium mb-1">Eventos suportados</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {["Novo pedido","Confirmado","Em preparo","Pronto","Saiu para entrega","Entregue","Cancelado","Editado","Pagamento recebido"].map((e) => (
                <Badge key={e} variant="secondary">{e}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Deixe vazio no painel para receber <b>todos</b>. Respondemos 2xx em &lt;10s.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">2. Últimos webhooks recebidos</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhum webhook recebido ainda. Assim que o DeliveryStudio disparar um evento, ele aparecerá aqui.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Recebido</th>
                    <th className="p-2">Evento</th>
                    <th className="p-2">Pedido</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Assinatura</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 whitespace-nowrap">{new Date(r.received_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2"><Badge variant="outline">{r.event}</Badge></td>
                      <td className="p-2 font-mono text-xs">{r.order_public_id || "—"}</td>
                      <td className="p-2">{r.status || "—"}</td>
                      <td className="p-2">
                        {r.signature_valid ? (
                          <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="w-4 h-4" /> ok</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4" /> falha</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>Ver</Button>
                          {r.order_public_id && <ActionButtons orderPublicId={r.order_public_id} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Payload · {selected.event}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Fechar</Button>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-96">
{JSON.stringify(selected.payload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DeliveryStudioPage;
