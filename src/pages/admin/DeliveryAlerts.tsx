import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, Clock, MapPin, Phone, CheckCircle, Bike,
  MessageSquare, RefreshCw, Send,
} from "lucide-react";
import { toast } from "sonner";

const issueLabels: Record<string, { label: string; icon: string }> = {
  no_answer: { label: "Cliente não respondeu", icon: "📵" },
  wrong_address: { label: "Endereço errado", icon: "📍" },
  cancelled: { label: "Pedido cancelado", icon: "❌" },
  order_problem: { label: "Problema no pedido", icon: "⚠️" },
};

const statusOptions = [
  { value: "pending", label: "Pendente" },
  { value: "production", label: "Em Produção" },
  { value: "ready", label: "Pronto" },
  { value: "out_for_delivery", label: "Saiu p/ Entrega" },
  { value: "delivered", label: "Entregue" },
  { value: "cancelled", label: "Cancelado" },
];

const DeliveryAlerts = () => {
  const [delayAlerts, setDelayAlerts] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [tab, setTab] = useState("delays");
  const [actionIssue, setActionIssue] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [driverMessage, setDriverMessage] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<"customer" | "driver" | "both">("customer");

  const fetchDelayAlerts = async () => {
    const { data } = await supabase
      .from("kitchen_alerts")
      .select("*")
      .ilike("message", "%ATRASO%")
      .order("created_at", { ascending: false })
      .limit(50);
    setDelayAlerts(data || []);
  };

  const fetchIssues = async () => {
    const { data } = await supabase
      .from("delivery_issues")
      .select(`
        *,
        orders:order_id (id, order_number, customer_name, customer_phone, status),
        delivery_persons:delivery_person_id (name, phone)
      `)
      .order("created_at", { ascending: false })
      .limit(50);
    setIssues(data || []);
  };

  useEffect(() => {
    fetchDelayAlerts();
    fetchIssues();
  }, []);

  useEffect(() => {
    const ch1 = supabase
      .channel("admin-delay-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kitchen_alerts" }, () => fetchDelayAlerts())
      .subscribe();

    const ch2 = supabase
      .channel("admin-delivery-issues")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_issues" }, (payload: any) => {
        fetchIssues();
        const issue = payload.new;
        const info = issueLabels[issue?.issue_type] || { label: "Problema", icon: "⚠️" };
        toast.error(`${info.icon} Problema reportado: ${info.label}`, { duration: 10000 });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, []);

  const acknowledgeAlert = async (id: string) => {
    await supabase.from("kitchen_alerts").update({ acknowledged: true } as any).eq("id", id);
    fetchDelayAlerts();
    toast.success("Alerta reconhecido");
  };

  const handleSendReply = async () => {
    if (!actionIssue) return;
    setSending(true);

    const orderId = actionIssue.orders?.id;
    const driverPhone = actionIssue.delivery_persons?.phone;

    // Send message to customer via WhatsApp bot
    if (replyMessage.trim() && actionIssue.orders?.customer_phone) {
      // Create a chat message for the customer
      let { data: session } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("phone", actionIssue.orders.customer_phone)
        .eq("is_active", true)
        .single();

      if (!session) {
        const { data: newSession } = await supabase
          .from("chat_sessions")
          .insert({
            phone: actionIssue.orders.customer_phone,
            customer_name: actionIssue.orders.customer_name,
            state: "greeting",
            order_id: orderId,
          })
          .select()
          .single();
        session = newSession;
      }

      if (session) {
        await supabase.from("chat_messages").insert({
          session_id: session.id,
          direction: "outgoing",
          message: `📋 *Atualização do Pedido #${actionIssue.orders.order_number}*\n\n${replyMessage.trim()}`,
        });
        toast.success("Mensagem enviada ao cliente!");
      }
    }

    // Update order status if changed
    if (newStatus && orderId && newStatus !== actionIssue.orders?.status) {
      await supabase
        .from("orders")
        .update({ status: newStatus as any })
        .eq("id", orderId);

      // Notify customer of status change
      await supabase.functions.invoke("whatsapp-bot", {
        body: { action: "notify_status", order_id: orderId, new_status: newStatus },
      });

      toast.success(`Status alterado para: ${statusOptions.find(s => s.value === newStatus)?.label}`);
    }

    // Save admin response as note on the issue
    if (replyMessage.trim()) {
      await supabase
        .from("delivery_issues")
        .update({ notes: `[Admin] ${replyMessage.trim()}${newStatus ? ` | Status → ${newStatus}` : ""}` } as any)
        .eq("id", actionIssue.id);
    }

    setSending(false);
    setActionIssue(null);
    setReplyMessage("");
    setNewStatus("");
    fetchIssues();
  };

  const pendingDelays = delayAlerts.filter(a => !a.acknowledged);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-bold">Alertas de Entrega</h2>
        {(pendingDelays.length > 0 || issues.length > 0) && (
          <Badge variant="destructive" className="animate-pulse">
            {pendingDelays.length + issues.length} pendentes
          </Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="delays" className="flex-1 gap-1">
            <Clock className="h-4 w-4" />
            Atrasos
            {pendingDelays.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{pendingDelays.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="issues" className="flex-1 gap-1">
            <AlertTriangle className="h-4 w-4" />
            Problemas
            {issues.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{issues.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="delays" className="space-y-3 mt-4">
          {delayAlerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum alerta de atraso</p>
          ) : (
            delayAlerts.map((alert) => (
              <Card key={alert.id} className={!alert.acknowledged ? "border-destructive" : "opacity-60"}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {!alert.acknowledged ? (
                          <span className="text-lg">⏰</span>
                        ) : (
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium text-foreground">{alert.message}</p>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(alert.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!alert.acknowledged && (
                      <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(alert.id)}>
                        OK
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-3 mt-4">
          {issues.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum problema reportado</p>
          ) : (
            issues.map((issue: any) => {
              const info = issueLabels[issue.issue_type] || { label: issue.issue_type, icon: "⚠️" };
              return (
                <Card key={issue.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{info.icon}</span>
                        <p className="font-medium text-foreground">{info.label}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{issue.orders?.order_number || "?"}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {statusOptions.find(s => s.value === issue.orders?.status)?.label || issue.orders?.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {issue.orders?.customer_name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {issue.orders.customer_name}
                        </span>
                      )}
                      {issue.delivery_persons?.name && (
                        <span className="flex items-center gap-1">
                          <Bike className="h-3 w-3" /> {issue.delivery_persons.name}
                        </span>
                      )}
                      {issue.orders?.customer_phone && (
                        <a href={`tel:${issue.orders.customer_phone}`} className="flex items-center gap-1 text-primary">
                          <Phone className="h-3 w-3" /> {issue.orders.customer_phone}
                        </a>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(issue.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {issue.notes && (
                      <p className="text-sm text-foreground bg-muted rounded p-2">{issue.notes}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => {
                        setActionIssue(issue);
                        setNewStatus(issue.orders?.status || "");
                      }}>
                        <MessageSquare className="h-3 w-3" /> Responder
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => {
                        setActionIssue(issue);
                        setNewStatus(issue.orders?.status || "");
                      }}>
                        <RefreshCw className="h-3 w-3" /> Alterar Status
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Action dialog */}
      <Dialog open={!!actionIssue} onOpenChange={(o) => { if (!o) { setActionIssue(null); setReplyMessage(""); setNewStatus(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Responder Problema — Pedido #{actionIssue?.orders?.order_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current info */}
            <div className="bg-muted rounded-xl p-3 space-y-1 text-sm">
              <p><strong>Problema:</strong> {issueLabels[actionIssue?.issue_type]?.icon} {issueLabels[actionIssue?.issue_type]?.label}</p>
              <p><strong>Entregador:</strong> {actionIssue?.delivery_persons?.name || "—"}</p>
              <p><strong>Cliente:</strong> {actionIssue?.orders?.customer_name} ({actionIssue?.orders?.customer_phone})</p>
            </div>

            {/* Change status */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Alterar status do pedido:</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reply message */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Mensagem para o cliente (WhatsApp):</label>
              <Textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Ex: Estamos resolvendo o problema, aguarde um momento..."
                rows={3}
              />
            </div>

            <Button onClick={handleSendReply} disabled={sending || (!replyMessage.trim() && newStatus === actionIssue?.orders?.status)} className="w-full gap-2">
              <Send className="h-4 w-4" />
              {sending ? "Enviando..." : "Enviar Resposta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeliveryAlerts;
