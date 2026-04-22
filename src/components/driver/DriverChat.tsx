import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, AlertTriangle, MessageSquare, X, Phone } from "lucide-react";
import { toast } from "sonner";
import { invokeDriverApp } from "@/lib/driverApp";

interface DriverChatProps {
  driverId: string;
  driverName: string;
  currentOrderId?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
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

const DriverChat = ({ currentOrderId, customerPhone, customerName, onClose }: DriverChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const emergencyActiveRef = useRef(false);
  const emergencyIntervalRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const data = await invokeDriverApp<{ messages: Message[] }>("chat_list", { orderId: currentOrderId || null });
    setMessages(data.messages || []);
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [currentOrderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (message: string, isEmergency = false) => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await invokeDriverApp("chat_send", {
        orderId: currentOrderId || null,
        message: message.trim(),
        isEmergency,
      });
      setText("");
      await fetchMessages();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const startEmergency = async () => {
    setEmergencyActive(true);
    emergencyActiveRef.current = true;
    await sendMessage("🚨 EMERGÊNCIA! Preciso de ajuda urgente! 🚨", true);
    toast("🚨 Emergência ativada! Apitando até a loja responder...");

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
      } catch {}
    };

    playAlarm();
    emergencyIntervalRef.current = setInterval(playAlarm, 3000);
  };

  const stopEmergency = () => {
    setEmergencyActive(false);
    emergencyActiveRef.current = false;
    if (emergencyIntervalRef.current) {
      clearInterval(emergencyIntervalRef.current);
      emergencyIntervalRef.current = null;
    }
  };

  useEffect(() => {
    const lastAdminMessage = [...messages].reverse().find((msg) => msg.sender === "admin");
    if (lastAdminMessage && emergencyActiveRef.current) {
      stopEmergency();
      toast.success("🏪 A loja respondeu!");
    }
  }, [messages]);

  useEffect(() => () => emergencyIntervalRef.current && clearInterval(emergencyIntervalRef.current), []);

  const openWhatsApp = () => {
    if (!customerPhone) return;
    const phone = customerPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <span className="font-bold text-sm text-foreground">Chat com a Loja</span>
            {customerName && <p className="text-xs text-muted-foreground">Cliente: {customerName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {customerPhone && (
            <Button variant="ghost" size="sm" onClick={openWhatsApp} className="gap-1">
              <Phone className="h-4 w-4" />
              <span className="text-xs">WhatsApp</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {messages.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Envie uma mensagem para a loja</p>}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === "driver" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${msg.is_emergency ? "bg-destructive text-destructive-foreground rounded-br-md animate-pulse" : msg.sender === "driver" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                <p className="text-xs opacity-60 mt-0.5">{new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="px-3 pt-2">
        {emergencyActive ? (
          <Button variant="outline" className="w-full text-sm border-destructive text-destructive animate-pulse" onClick={stopEmergency}>
            🚨 EMERGÊNCIA ATIVA — Toque para cancelar
          </Button>
        ) : (
          <Button variant="outline" className="w-full text-sm border-destructive/50 text-destructive" onClick={startEmergency}>
            <AlertTriangle className="h-4 w-4 mr-1" /> 🚨 EMERGÊNCIA — Apitar na Loja
          </Button>
        )}
      </div>

      <div className="p-3 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem..." onKeyDown={(e) => e.key === "Enter" && sendMessage(text)} />
        <Button onClick={() => sendMessage(text)} disabled={sending} size="icon"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

export default DriverChat;
