import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, RefreshCw, Smartphone, WifiOff } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WaSession {
  status: string;
  qr_code: string | null;
  qr_generated_at: string | null;
  phone_number: string | null;
  display_name: string | null;
  last_event: string | null;
  last_seen_at: string | null;
  messages_sent_total: number;
  messages_received_total: number;
  failures_total: number;
  updated_at: string;
}

interface WaMessage {
  id: string;
  direction: string;
  from_phone: string | null;
  to_phone: string | null;
  message: string;
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  connected:      { label: "Conectado",        variant: "default",     color: "bg-green-600" },
  qr:             { label: "Aguardando QR",    variant: "secondary",   color: "bg-amber-600" },
  authenticating: { label: "Autenticando…",    variant: "secondary",   color: "bg-blue-600" },
  disconnected:   { label: "Desconectado",     variant: "outline",     color: "bg-gray-400" },
  failed:         { label: "Falha",            variant: "destructive", color: "bg-red-600" },
};

export default function WhatsAppConnect() {
  const [session, setSession] = useState<WaSession | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastQrRef = useRef<string | null>(null);

  async function loadSession() {
    const { data } = await (supabase as any)
      .from("wa_sessions")
      .select("*")
      .eq("channel", "whatsapp")
      .maybeSingle();
    if (data) setSession(data as WaSession);
    setLoading(false);
  }

  async function loadMessages() {
    const { data } = await (supabase as any)
      .from("wa_messages")
      .select("id, direction, from_phone, to_phone, message, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setMessages(data as WaMessage[]);
  }

  // Gera QR Code visual quando string muda
  useEffect(() => {
    if (!session?.qr_code) {
      setQrDataUrl(null);
      lastQrRef.current = null;
      return;
    }
    if (lastQrRef.current === session.qr_code) return;
    lastQrRef.current = session.qr_code;
    QRCode.toDataURL(session.qr_code, { width: 320, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [session?.qr_code]);

  // Realtime subscription
  useEffect(() => {
    loadSession();
    loadMessages();

    const ch = supabase
      .channel("wa-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_sessions" }, () => loadSession())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_messages" }, () => loadMessages())
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function disconnect() {
    if (!confirm("Desconectar o WhatsApp? Você precisará escanear o QR novamente.")) return;
    await (supabase as any)
      .from("wa_sessions")
      .update({ status: "disconnected", qr_code: null, phone_number: null, last_event: "manual_disconnect" })
      .eq("channel", "whatsapp");
    toast({ title: "Solicitação enviada", description: "Reinicie o worker WA na VPS pra escanear novo QR." });
  }

  const status = session?.status ?? "disconnected";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.disconnected;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageCircle className="h-7 w-7 text-green-600" />
            WhatsApp Connect
          </h1>
          <p className="text-muted-foreground mt-1">
            Conecte um número de WhatsApp pra responder clientes e enviar mensagens automáticas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSession}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* QR Code / Status */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Conexão</CardTitle>
              <Badge variant={badge.variant} className={badge.variant === "default" ? badge.color : ""}>
                {badge.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : status === "connected" ? (
              <div className="text-center py-8 space-y-3">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                  <Smartphone className="h-10 w-10 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{session?.display_name || "WhatsApp"}</p>
                  <p className="text-muted-foreground font-mono">+{session?.phone_number}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Conectado desde {session?.last_seen_at && format(new Date(session.last_seen_at), "dd/MM HH:mm", { locale: ptBR })}
                </p>
                <Button variant="destructive" size="sm" onClick={disconnect} className="mt-4">
                  <WifiOff className="h-4 w-4 mr-2" /> Desconectar
                </Button>
              </div>
            ) : qrDataUrl ? (
              <div className="text-center py-4 space-y-4">
                <div className="inline-block p-4 bg-white rounded-lg border">
                  <img src={qrDataUrl} alt="QR Code WhatsApp" className="w-72 h-72" />
                </div>
                <div className="text-sm text-muted-foreground space-y-1 max-w-md mx-auto">
                  <p className="font-semibold text-foreground">Escaneie com o WhatsApp:</p>
                  <p>1. Abra WhatsApp no celular</p>
                  <p>2. Toque em <b>Configurações → Aparelhos conectados</b></p>
                  <p>3. Toque em <b>Conectar um aparelho</b></p>
                  <p>4. Aponte a câmera pra este QR Code</p>
                </div>
                {session?.qr_generated_at && (
                  <p className="text-xs text-muted-foreground">
                    Gerado {format(new Date(session.qr_generated_at), "HH:mm:ss", { locale: ptBR })} — expira em ~60s
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-12 space-y-3">
                <WifiOff className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  {status === "failed"
                    ? "Falha na conexão. Verifique os logs do worker WA na VPS."
                    : "Aguardando worker do WhatsApp na VPS gerar o QR Code…"}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  Comando: <code>docker compose up -d truebox-bot</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <Card>
          <CardHeader>
            <CardTitle>Estatísticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Stat label="Mensagens enviadas" value={session?.messages_sent_total ?? 0} color="text-green-600" />
            <Stat label="Mensagens recebidas" value={session?.messages_received_total ?? 0} color="text-blue-600" />
            <Stat label="Falhas" value={session?.failures_total ?? 0} color="text-red-600" />
            {session?.last_event && (
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">Último evento</p>
                <p className="text-sm font-mono break-all">{session.last_event}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mensagens recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Mensagens recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma mensagem ainda</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg border text-sm flex items-start gap-3 ${
                    m.direction === "in" ? "bg-blue-50 border-blue-100" : "bg-green-50 border-green-100"
                  }`}
                >
                  <Badge variant="outline" className="shrink-0">
                    {m.direction === "in" ? "📥 IN" : "📤 OUT"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">
                      {m.direction === "in" ? m.from_phone : m.to_phone}
                    </p>
                    <p className="break-words">{m.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}
