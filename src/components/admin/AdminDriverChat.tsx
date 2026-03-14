import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bike, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

interface DriverThread {
  driver_id: string;
  driver_name: string;
  driver_phone: string;
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
  const [threads, setThreads] = useState<DriverThread[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const alarmRef = useRef<any>(null);
  const [emergencyActive, setEmergencyActive] = useState(false);

  const fetchThreads = async () => {
    // Get all driver_messages grouped by driver_id
    const { data: msgs } = await supabase
      .from("driver_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!msgs) return;

    // Get unique drivers
    const driverIds = [...new Set((msgs as any[]).map((m: any) => m.driver_id))];

    // Fetch driver info
    const { data: drivers } = await supabase
      .from("delivery_persons")
      .select("id, name, phone")
      .in("id", driverIds);

    const driverMap = new Map((drivers || []).map(d => [d.id, d]));

    const threadList: DriverThread[] = driverIds.map(did => {
      const driverMsgs = (msgs as any[]).filter((m: any) => m.driver_id === did);
      const driver = driverMap.get(did);
      const unread = driverMsgs.filter((m: any) => m.sender === "driver" && !m.read_by_admin).length;
      const hasEmergency = driverMsgs.some((m: any) => m.is_emergency && !m.read_by_admin);
      return {
        driver_id: did,
        driver_name: driver?.name || "Entregador",
        driver_phone: driver?.phone || "",
        last_message: driverMsgs[0]?.message || "",
        last_at: driverMsgs[0]?.created_at || "",
        unread,
        has_emergency: hasEmergency,
      };
    });

    // Sort: emergency first, then by last message time
    threadList.sort((a, b) => {
      if (a.has_emergency && !b.has_emergency) return -1;
      if (!a.has_emergency && b.has_emergency) return 1;
      return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
    });

    setThreads(threadList);

    // Check for active emergencies
    const anyEmergency = threadList.some(t => t.has_emergency);
    if (anyEmergency && !emergencyActive) {
      startAlarm();
    } else if (!anyEmergency && emergencyActive) {
      stopAlarm();
    }
  };

  const fetchMessages = async (driverId: string) => {
    const { data } = await supabase
      .from("driver_messages")
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) {
      setMessages(data as any as Message[]);
      // Mark as read by admin
      const unreadIds = (data as any[]).filter((m: any) => m.sender === "driver" && !m.read_by_admin).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase.from("driver_messages").update({ read_by_admin: true } as any).in("id", unreadIds);
        fetchThreads();
      }
    }
  };

  const startAlarm = () => {
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

  const stopAlarm = () => {
    setEmergencyActive(false);
    if (alarmRef.current) {
      clearInterval(alarmRef.current);
      alarmRef.current = null;
    }
  };

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
        if (msg.driver_id === selectedDriver) {
          setMessages(prev => [...prev, msg]);
          if (msg.sender === "driver") {
            supabase.from("driver_messages").update({ read_by_admin: true } as any).eq("id", msg.id);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopAlarm();
    };
  }, [selectedDriver]);

  useEffect(() => {
    if (selectedDriver) fetchMessages(selectedDriver);
  }, [selectedDriver]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedDriver) return;
    setSending(true);
    await supabase.from("driver_messages").insert({
      driver_id: selectedDriver,
      sender: "admin",
      message: replyText.trim(),
      is_emergency: false,
      read_by_admin: true,
    } as any);
    setReplyText("");
    setSending(false);
  };

  const selectedThread = threads.find(t => t.driver_id === selectedDriver);

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
            <CardTitle className="text-sm">Conversas</CardTitle>
          </CardHeader>
          <ScrollArea className="h-full">
            <div className="space-y-1 p-2">
              {threads.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa</p>
              )}
              {threads.map(thread => (
                <button
                  key={thread.driver_id}
                  onClick={() => setSelectedDriver(thread.driver_id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    thread.has_emergency ? "border border-destructive bg-destructive/10 animate-pulse" :
                    selectedDriver === thread.driver_id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-foreground flex items-center gap-1">
                      <Bike className="h-3.5 w-3.5" />
                      {thread.driver_name}
                    </span>
                    <div className="flex items-center gap-1">
                      {thread.has_emergency && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {thread.unread > 0 && (
                        <Badge variant="destructive" className="h-5 px-1.5 text-xs">{thread.unread}</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{thread.last_message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {thread.last_at && new Date(thread.last_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedDriver ? (
            <>
              <CardHeader className="py-3 border-b border-border">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bike className="h-4 w-4" />
                  {selectedThread?.driver_name} — {selectedThread?.driver_phone}
                </CardTitle>
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
