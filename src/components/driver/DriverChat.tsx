import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, AlertTriangle, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";

interface DriverChatProps {
  driverId: string;
  driverName: string;
  currentOrderId?: string | null;
  onClose: () => void;
}

interface Message {
  id: string;
  driver_id: string;
  order_id: string | null;
  sender: string;
  message: string;
  is_emergency: boolean;
  read_by_admin: boolean;
  read_by_driver: boolean;
  created_at: string;
}

const DriverChat = ({ driverId, driverName, currentOrderId, onClose }: DriverChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const emergencyIntervalRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState(0);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("driver_messages")
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) {
      setMessages(data as any as Message[]);
      // Mark admin messages as read by driver
      const unreadIds = (data as any[]).filter((m: any) => m.sender === "admin" && !m.read_by_driver).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase.from("driver_messages").update({ read_by_driver: true } as any).in("id", unreadIds);
      }
    }
  };

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel("driver-chat-" + driverId)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "driver_messages",
        filter: `driver_id=eq.${driverId}`,
      }, (payload: any) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        if (msg.sender === "admin") {
          // Mark as read
          supabase.from("driver_messages").update({ read_by_driver: true } as any).eq("id", msg.id);
          // If admin responded, stop emergency
          if (emergencyActive) {
            stopEmergency();
            toast.success("🏪 A loja respondeu!");
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Count unread from admin
  useEffect(() => {
    const cnt = messages.filter(m => m.sender === "admin" && !m.read_by_driver).length;
    setUnread(cnt);
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    setSending(true);
    await supabase.from("driver_messages").insert({
      driver_id: driverId,
      order_id: currentOrderId || null,
      sender: "driver",
      message: text.trim(),
      is_emergency: false,
    } as any);
    setText("");
    setSending(false);
  };

  const startEmergency = async () => {
    setEmergencyActive(true);
    // Send emergency message
    await supabase.from("driver_messages").insert({
      driver_id: driverId,
      order_id: currentOrderId || null,
      sender: "driver",
      message: "🚨 EMERGÊNCIA! Preciso de ajuda urgente! 🚨",
      is_emergency: true,
    } as any);

    toast("🚨 Emergência ativada! Apitando até a loja responder...");

    // Start alarm sound loop
    const playAlarm = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1200;
        osc.type = "square";
        gain.gain.value = 0.6;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = 800;
          osc2.type = "square";
          gain2.gain.value = 0.6;
          osc2.start();
          osc2.stop(ctx.currentTime + 0.3);
        }, 350);
      } catch {}
    };
    playAlarm();
    emergencyIntervalRef.current = setInterval(playAlarm, 3000);
  };

  const stopEmergency = () => {
    setEmergencyActive(false);
    if (emergencyIntervalRef.current) {
      clearInterval(emergencyIntervalRef.current);
      emergencyIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (emergencyIntervalRef.current) clearInterval(emergencyIntervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm text-foreground">Chat com a Loja</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">
              Envie uma mensagem para a loja
            </p>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === "driver" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                msg.is_emergency
                  ? "bg-destructive text-destructive-foreground rounded-br-md animate-pulse"
                  : msg.sender === "driver"
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

      {/* Emergency button */}
      <div className="px-3 pt-2">
        {emergencyActive ? (
          <Button
            variant="outline"
            className="w-full text-sm border-destructive text-destructive animate-pulse"
            onClick={stopEmergency}
          >
            🚨 EMERGÊNCIA ATIVA — Toque para cancelar
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full text-sm border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={startEmergency}
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            🚨 EMERGÊNCIA — Apitar na Loja
          </Button>
        )}
      </div>

      {/* Input */}
      <div className="p-3 flex gap-2">
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Mensagem..."
          onKeyDown={e => e.key === "Enter" && sendMessage()}
        />
        <Button onClick={sendMessage} disabled={sending} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default DriverChat;
