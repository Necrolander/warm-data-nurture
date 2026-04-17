import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertTriangle, MessageSquare, Bot, CheckCircle2, XCircle, Send, Edit2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatMsg {
  id: string;
  order_external_id: string;
  customer_name: string | null;
  direction: string;
  message: string;
  intent: string | null;
  auto_replied: boolean;
  escalated: boolean;
  response_pending: string | null;
  response_sent_at: string | null;
  created_at: string;
}

const intentLabels: Record<string, { label: string; color: string }> = {
  status: { label: "Status", color: "bg-blue-100 text-blue-800" },
  composition: { label: "Composição", color: "bg-purple-100 text-purple-800" },
  complaint: { label: "Reclamação", color: "bg-orange-100 text-orange-800" },
  cancellation: { label: "Cancelamento", color: "bg-red-100 text-red-800" },
  other: { label: "Outro", color: "bg-gray-100 text-gray-800" },
};

export default function IfoodChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [escalateComplaints, setEscalateComplaints] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const loadSettings = async () => {
    const { data } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", ["ifood_chat_auto_reply_enabled", "ifood_chat_escalate_complaints"]);
    data?.forEach((s) => {
      if (s.key === "ifood_chat_auto_reply_enabled") setAutoReply(s.value !== "false");
      if (s.key === "ifood_chat_escalate_complaints") setEscalateComplaints(s.value !== "false");
    });
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from("ifood_chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setMessages((data as ChatMsg[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
    loadMessages();
    const ch = supabase
      .channel("ifood_chat_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ifood_chat_messages" },
        () => loadMessages(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const updateSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from("store_settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) toast.error("Erro ao salvar configuração");
    else toast.success("Configuração salva");
  };

  const approveReply = async (id: string, text: string) => {
    const { error } = await supabase
      .from("ifood_chat_messages")
      .update({ response_pending: text })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao aprovar resposta");
    } else {
      toast.success("Resposta aprovada — bot enviará em segundos");
      setEditingId(null);
    }
  };

  const cancelReply = async (id: string) => {
    const { error } = await supabase
      .from("ifood_chat_messages")
      .update({ response_pending: null, response_sent_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Erro");
    else toast.success("Resposta cancelada");
  };

  const escalated = messages.filter((m) => m.escalated && !m.response_sent_at);
  const pending = messages.filter((m) => m.response_pending && !m.response_sent_at);
  const recent = messages.slice(0, 100);
  const stats = {
    total: messages.length,
    auto: messages.filter((m) => m.auto_replied).length,
    escalated: escalated.length,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-7 w-7" />
          Chat iFood — Atendimento Automático
        </h1>
        <p className="text-muted-foreground">
          Bot lê mensagens dos clientes no chat de cada pedido e responde com IA + contexto do pedido.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Mensagens</div>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Respostas automáticas</div>
            <div className="text-3xl font-bold text-green-600">{stats.auto}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Aguardando humano</div>
            <div className="text-3xl font-bold text-orange-600">{stats.escalated}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Taxa automação</div>
            <div className="text-3xl font-bold">
              {stats.total ? Math.round((stats.auto / stats.total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Resposta automática habilitada</Label>
              <p className="text-sm text-muted-foreground">
                Bot responde com IA Gemini usando contexto do pedido.
              </p>
            </div>
            <Switch
              checked={autoReply}
              onCheckedChange={(v) => {
                setAutoReply(v);
                updateSetting("ifood_chat_auto_reply_enabled", String(v));
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Escalar reclamações para o humano</Label>
              <p className="text-sm text-muted-foreground">
                Cria alerta na cozinha sempre que detectar reclamação.
              </p>
            </div>
            <Switch
              checked={escalateComplaints}
              onCheckedChange={(v) => {
                setEscalateComplaints(v);
                updateSetting("ifood_chat_escalate_complaints", String(v));
              }}
            />
          </div>
          <div className="bg-muted p-3 rounded text-sm">
            <strong>⚠️ Cancelamentos</strong> nunca são respondidos automaticamente — sempre escalados pro admin.
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="escalated">
        <TabsList>
          <TabsTrigger value="escalated">
            🚨 Escaladas ({escalated.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            ⏳ Pendentes envio ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="all">📋 Todas mensagens</TabsTrigger>
        </TabsList>

        <TabsContent value="escalated" className="space-y-3">
          {escalated.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma mensagem escalada. ✅
            </p>
          )}
          {escalated.map((m) => (
            <Card key={m.id} className="border-orange-300">
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{m.customer_name || "Cliente"}</div>
                    <div className="text-xs text-muted-foreground">
                      Pedido #{m.order_external_id} •{" "}
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                  {m.intent && (
                    <Badge className={intentLabels[m.intent]?.color}>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {intentLabels[m.intent]?.label}
                    </Badge>
                  )}
                </div>
                <div className="bg-muted p-3 rounded">{m.message}</div>
                {m.response_pending && (
                  <div className="border-l-4 border-blue-500 pl-3 py-2">
                    <div className="text-xs text-muted-foreground mb-1">
                      🤖 Sugestão da IA:
                    </div>
                    {editingId === m.id ? (
                      <>
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="mb-2"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => approveReply(m.id, editText)}>
                            <Send className="h-4 w-4 mr-1" /> Enviar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>{m.response_pending}</p>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={() => approveReply(m.id, m.response_pending!)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar e enviar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditText(m.response_pending!);
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-1" /> Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => cancelReply(m.id)}>
                            <XCircle className="h-4 w-4 mr-1" /> Não responder
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="pending" className="space-y-3">
          {pending.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma resposta aguardando envio.
            </p>
          )}
          {pending.map((m) => (
            <Card key={m.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="text-sm text-muted-foreground">
                  Pedido #{m.order_external_id} • {m.customer_name}
                </div>
                <div className="bg-muted p-2 rounded text-sm">💬 {m.message}</div>
                <div className="bg-blue-50 p-2 rounded text-sm">
                  <Bot className="h-4 w-4 inline mr-1" />
                  {m.response_pending}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="all" className="space-y-2">
          {loading && <p>Carregando...</p>}
          {recent.map((m) => (
            <Card key={m.id} className={m.direction === "outgoing" ? "bg-blue-50/50" : ""}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">
                      {m.direction === "incoming" ? "👤" : "🤖"} {m.customer_name || "?"} • #
                      {m.order_external_id} •{" "}
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                    </div>
                    <div className="mt-1">{m.message}</div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {m.intent && (
                      <Badge className={intentLabels[m.intent]?.color} variant="secondary">
                        {intentLabels[m.intent]?.label}
                      </Badge>
                    )}
                    {m.auto_replied && (
                      <Badge variant="outline" className="text-xs">
                        🤖 auto
                      </Badge>
                    )}
                    {m.response_sent_at && (
                      <Badge variant="outline" className="text-xs text-green-700">
                        ✓ enviada
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
