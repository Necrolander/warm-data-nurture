import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, User, Bot, Phone, Clock, ShoppingCart, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ChatSession {
  id: string;
  phone: string;
  customer_name: string | null;
  state: string;
  cart: any[];
  is_active: boolean;
  last_message_at: string;
  order_id: string | null;
  created_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  direction: string;
  message: string;
  created_at: string;
}

const stateLabels: Record<string, { label: string; color: string }> = {
  greeting: { label: "Início", color: "bg-blue-500/20 text-blue-400" },
  menu_categories: { label: "Categorias", color: "bg-purple-500/20 text-purple-400" },
  menu_items: { label: "Produtos", color: "bg-indigo-500/20 text-indigo-400" },
  item_quantity: { label: "Quantidade", color: "bg-cyan-500/20 text-cyan-400" },
  cart_review: { label: "Carrinho", color: "bg-orange-500/20 text-orange-400" },
  address: { label: "Endereço", color: "bg-yellow-500/20 text-yellow-400" },
  payment: { label: "Pagamento", color: "bg-green-500/20 text-green-400" },
  confirm: { label: "Confirmação", color: "bg-emerald-500/20 text-emerald-400" },
  human: { label: "Humano", color: "bg-red-500/20 text-red-400" },
};

const BotConversations = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [testPhone, setTestPhone] = useState("5500000000000");
  const [testMessage, setTestMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (data) setSessions(data as any as ChatSession[]);
  };

  const fetchMessages = async (sessionId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as any as ChatMessage[]);
  };

  useEffect(() => { fetchSessions(); }, []);

  useEffect(() => {
    if (selectedSession) fetchMessages(selectedSession);
  }, [selectedSession]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("bot-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload: any) => {
        const msg = payload.new as ChatMessage;
        if (msg.session_id === selectedSession) {
          setMessages(prev => [...prev, msg]);
        }
        fetchSessions();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_sessions" }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedSession) return;
    setSending(true);

    await supabase.from("chat_messages").insert({
      session_id: selectedSession,
      direction: "outgoing",
      message: replyText,
    });

    setReplyText("");
    setSending(false);
  };

  const sendTestMessage = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-bot", {
        body: { phone: testPhone, message: testMessage, customer_name: "Teste" },
      });

      if (error) throw error;

      toast.success("Mensagem processada!");
      setTestMessage("");
      fetchSessions();

      if (data?.session_id) {
        setSelectedSession(data.session_id);
        setTimeout(() => fetchMessages(data.session_id), 500);
      }
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "Falha ao enviar"));
    }

    setTesting(false);
  };

  const selectedSessionData = sessions.find(s => s.id === selectedSession);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Conversas do Bot
          </h2>
          <p className="text-sm text-muted-foreground">{sessions.filter(s => s.is_active).length} conversas ativas</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSessions}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Test Console */}
      <Card className="border-dashed border-primary/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">🧪 Console de Teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="Telefone"
              className="w-40"
            />
            <Input
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              placeholder="Mensagem do cliente..."
              className="flex-1"
              onKeyDown={e => e.key === "Enter" && sendTestMessage()}
            />
            <Button onClick={sendTestMessage} disabled={testing} size="sm">
              <Send className="h-4 w-4 mr-1" /> {testing ? "..." : "Enviar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Simule uma mensagem de cliente para testar o fluxo do bot.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: "calc(100vh - 350px)" }}>
        {/* Sessions List */}
        <Card className="lg:col-span-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Conversas</CardTitle>
          </CardHeader>
          <ScrollArea className="h-full">
            <div className="space-y-1 p-2">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedSession === session.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-foreground truncate">
                      {session.customer_name || session.phone}
                    </span>
                    {session.is_active && (
                      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span className="truncate">{session.phone}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <Badge className={`text-xs ${stateLabels[session.state]?.color || "bg-muted"}`}>
                      {stateLabels[session.state]?.label || session.state}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(session.last_message_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </button>
              ))}
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma conversa ainda.<br />Use o console de teste acima!
                </p>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat View */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedSession ? (
            <>
              <CardHeader className="py-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{selectedSessionData?.customer_name || selectedSessionData?.phone}</CardTitle>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {selectedSessionData?.phone}
                    </p>
                  </div>
                  <Badge className={stateLabels[selectedSessionData?.state || ""]?.color || "bg-muted"}>
                    {stateLabels[selectedSessionData?.state || ""]?.label || selectedSessionData?.state}
                  </Badge>
                </div>
              </CardHeader>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        msg.direction === "outgoing"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {msg.direction === "outgoing" ? (
                            <Bot className="h-3 w-3 opacity-70" />
                          ) : (
                            <User className="h-3 w-3 opacity-70" />
                          )}
                          <span className="text-xs opacity-70">
                            {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Reply input (for human intervention) */}
              <div className="p-3 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Resposta manual (atendimento humano)..."
                    onKeyDown={e => e.key === "Enter" && sendReply()}
                  />
                  <Button onClick={sendReply} disabled={sending} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use para intervir manualmente quando o bot transferir para humano.
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma conversa</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default BotConversations;
