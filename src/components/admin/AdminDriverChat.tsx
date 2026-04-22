import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bike, AlertTriangle, User, Package } from "lucide-react";
import { toast } from "sonner";

interface ConversationThread {
  driver_id: string;
  order_id: string | null;
  driver_name: string;
  customer_name: string;
  customer_phone: string;
  order_number: number | null;
  last_message: string;
  last_at: string;
  unread: number;
  has_emergency: boolean;
}

interface Message {
  id: string;
  driver_id: string;
  order_id: string | null;
  sender: string;
  message: string;
  is_emergency: boolean;
  read_by_admin: boolean;
  created_at: string;
}

const AdminDriverChat = () => {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const alarmRef = useRef<any>(null);
  const [emergencyActive, setEmergencyActive] = useState(false);

  const threadKey = (driverId: string, orderId: string | null) => `${driverId}::${orderId || "general"}`;

  const fetchThreads = async () => {
    const { data: msgs } = await supabase
      .from("driver_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!msgs) return;

    // Group by driver_id + order_id
    const groups = new Map<string, any[]>();
    for (const m of msgs as any[]) {
      const key = threadKey(m.driver_id, m.order_id);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }

    // Get unique driver IDs and order IDs
    const driverIds = [...new Set((msgs as any[]).map((m: any) => m.driver_id))];
    const orderIds = [...new Set((msgs as any[]).filter((m: any) => m.order_id).map((m: any) => m.order_id))];

    const { data: drivers } = await supabase
      .from("delivery_persons")
      .select("id, name, phone")
      .in("id", driverIds);

    const { data: orders } = orderIds.length > 0
      ? await supabase.from("orders").select("id, order_number, customer_name, customer_phone").in("id", orderIds)
      : { data: [] };

    const driverMap = new Map((drivers || []).map(d => [d.id, d]));
    const orderMap = new Map((orders || []).map(o => [o.id, o]));

    const threadList: ConversationThread[] = [];
    for (const [key, groupMsgs] of groups) {
      const first = groupMsgs[0];
      const driver = driverMap.get(first.driver_id);
      const order = first.order_id ? orderMap.get(first.order_id) : null;
      const unread = groupMsgs.filter((m: any) => m.sender === "driver" && !m.read_by_admin).length;
      const hasEmergency = groupMsgs.some((m: any) => m.is_emergency && !m.read_by_admin);

      threadList.push({
        driver_id: first.driver_id,
        order_id: first.order_id,
        driver_name: driver?.name || "Entregador",
        customer_name: order?.customer_name || "—",
        customer_phone: order?.customer_phone || "",
        order_number: order?.order_number || null,
        last_message: groupMsgs[0]?.message || "",
        last_at: groupMsgs[0]?.created_at || "",
        unread,
        has_emergency: hasEmergency,
      });
    }

    threadList.sort((a, b) => {
      if (a.has_emergency && !b.has_emergency) return -1;
      if (!a.has_emergency && b.has_emergency) return 1;
      return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
    });

    setThreads(threadList);

    const anyEmergency = threadList.some(t => t.has_emergency);
    if (anyEmergency && !alarmRef.current) startAlarm();
    else if (!anyEmergency && alarmRef.current) {
      clearInterval(alarmRef.current);
      alarmRef.current = null;
      setEmergencyActive(false);
    }
  };

  const fetchMessages = async (driverId: string, orderId: string | null) => {
    let query = supabase
      .from("driver_messages")
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (orderId) {
      query = query.eq("order_id", orderId);
    } else {
      query = query.is("order_id", null);
    }

    const { data } = await query;
    if (data) {
      setMessages(data as any as Message[]);
      const unreadIds = (data as any[]).filter((m: any) => m.sender === "driver" && !m.read_by_admin).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase.from("driver_messages").update({ read_by_admin: true } as any).in("id", unreadIds);
        fetchThreads();
      }
    }
  };

  const startAlarm = () => {
    if (alarmRef.current) return; // já tocando
    setEmergencyActive(true);
    const play = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        [0, 350, 700].forEach(delay => {
          setTimeout(() => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = delay === 350 ? 600 : 900;
            osc.type = "square";
            gain.gain.value = 0.7;
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
          }, delay);
        });
      } catch {}
    };
    play();
    alarmRef.current = setInterval(play, 2500);
  };

  const stopAlarm = async () => {
    setEmergencyActive(false);
    if (alarmRef.current) {
      clearInterval(alarmRef.current);
      alarmRef.current = null;
    }
    // Marca TODAS as mensagens de emergência pendentes como lidas para que
    // o fetchThreads (a cada 5s) não reative o alarme logo em seguida.
    try {
      await supabase
        .from("driver_messages")
        .update({ read_by_admin: true } as any)
        .eq("is_emergency", true)
        .eq("sender", "driver")
        .eq("read_by_admin", false);
      fetchThreads();
    } catch {}
  };

  const selectedKeyRef = useRef<string | null>(null);
  useEffect(() => { selectedKeyRef.current = selectedKey; }, [selectedKey]);

  useEffect(() => {
    fetchThreads();
    const channel = supabase
      .channel("admin-driver-msgs")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "driver_messages",
      }, (payload: any) => {
        const msg = payload.new as Message;
        if (msg.sender === "driver") {
          fetchThreads();
          if (msg.is_emergency) {
            toast.error("🚨 EMERGÊNCIA do entregador!", { duration: 15000 });
          } else {
            toast("💬 Nova mensagem do entregador", { duration: 5000 });
          }
        }
        const msgKey = threadKey(msg.driver_id, msg.order_id);
        if (msgKey === selectedKeyRef.current) {
          setMessages(prev => [...prev, msg]);
          if (msg.sender === "driver") {
            supabase.from("driver_messages").update({ read_by_admin: true } as any).eq("id", msg.id);
          }
        }
      })
      .subscribe();

    // Polling de fallback caso o realtime não esteja habilitado na tabela
    const poll = setInterval(fetchThreads, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      stopAlarm();
    };
  }, []);

  useEffect(() => {
    if (selectedKey) {
      const thread = threads.find(t => threadKey(t.driver_id, t.order_id) === selectedKey);
      if (thread) fetchMessages(thread.driver_id, thread.order_id);
    }
  }, [selectedKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedKey) return;
    const thread = threads.find(t => threadKey(t.driver_id, t.order_id) === selectedKey);
    if (!thread) return;
    setSending(true);
    await supabase.from("driver_messages").insert({
      driver_id: thread.driver_id,
      order_id: thread.order_id,
      sender: "admin",
      message: replyText.trim(),
      is_emergency: false,
      read_by_admin: true,
    } as any);
    setReplyText("");
    setSending(false);
  };

  const selectedThread = threads.find(t => threadKey(t.driver_id, t.order_id) === selectedKey);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Chat Entregadores</h2>
          {threads.some(t => t.has_emergency) && (
            <Badge variant="destructive" className="animate-pulse">🚨 EMERGÊNCIA</Badge>
          )}
          {threads.reduce((a, t) => a + t.unread, 0) > 0 && (
            <Badge variant="secondary">{threads.reduce((a, t) => a + t.unread, 0)} não lidas</Badge>
          )}
        </div>
        {emergencyActive && (
          <Button variant="destructive" size="sm" onClick={stopAlarm}>
            Silenciar Alarme
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: "calc(100vh - 250px)" }}>
        {/* Threads */}
        <Card className="lg:col-span-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Conversas por Pedido</CardTitle>
          </CardHeader>
          <ScrollArea className="h-full">
            <div className="space-y-1 p-2">
              {threads.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa</p>
              )}
              {threads.map(thread => {
                const key = threadKey(thread.driver_id, thread.order_id);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      thread.has_emergency ? "border border-destructive bg-destructive/10 animate-pulse" :
                      selectedKey === key
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {/* Order & client info */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-foreground flex items-center gap-1">
                        {thread.order_number ? (
                          <>
                            <Package className="h-3.5 w-3.5 text-primary" />
                            Pedido #{thread.order_number}
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-3.5 w-3.5" />
                            Geral
                          </>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        {thread.has_emergency && <AlertTriangle className="h-4 w-4 text-destructive" />}
                        {thread.unread > 0 && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-xs">{thread.unread}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Bike className="h-3 w-3" />
                      <span>{thread.driver_name}</span>
                    </div>
                    {thread.customer_name !== "—" && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{thread.customer_name} • {thread.customer_phone}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-1">{thread.last_message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {thread.last_at && new Date(thread.last_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedThread ? (
            <>
              <CardHeader className="py-3 border-b border-border">
                <div className="space-y-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bike className="h-4 w-4" />
                    {selectedThread.driver_name}
                    {selectedThread.order_number && (
                      <Badge variant="outline" className="ml-2">Pedido #{selectedThread.order_number}</Badge>
                    )}
                  </CardTitle>
                  {selectedThread.customer_name !== "—" && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Cliente: {selectedThread.customer_name} — {selectedThread.customer_phone}
                    </p>
                  )}
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                        msg.is_emergency
                          ? "bg-destructive text-destructive-foreground rounded-bl-md"
                          : msg.sender === "admin"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p className="text-xs opacity-60 mt-0.5">
                          {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-border flex gap-2">
                <Input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Responder ao entregador..."
                  onKeyDown={e => e.key === "Enter" && sendReply()}
                />
                <Button onClick={sendReply} disabled={sending} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
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

export default AdminDriverChat;
