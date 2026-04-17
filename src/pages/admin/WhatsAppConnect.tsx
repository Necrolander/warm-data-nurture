import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageCircle, RefreshCw, Send, Smartphone, WifiOff } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";
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
  direction: "in" | "out" | string;
  from_phone: string | null;
  to_phone: string | null;
  message: string;
  created_at: string;
  media_type?: string | null;
  media_url?: string | null;
  media_mime?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  ai_analysis?: string | null;
}

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }
> = {
  connected:      { label: "Conectado",     variant: "default",     color: "bg-green-600" },
  qr:             { label: "Aguardando QR", variant: "secondary",   color: "bg-amber-600" },
  authenticating: { label: "Autenticando…", variant: "secondary",   color: "bg-blue-600" },
  disconnected:   { label: "Desconectado",  variant: "outline",     color: "bg-gray-400" },
  failed:         { label: "Falha",         variant: "destructive", color: "bg-red-600" },
};

function formatPhone(phone: string | null) {
  if (!phone) return "—";
  const p = phone.replace(/\D/g, "");
  if (p.length === 13) return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ${p.slice(4, 9)}-${p.slice(9)}`;
  if (p.length === 12) return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ${p.slice(4, 8)}-${p.slice(8)}`;
  if (p.length === 11) return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`;
  return phone;
}

function formatDateLabel(d: Date) {
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd 'de' MMMM", { locale: ptBR });
}

interface ChatThread {
  phone: string;
  lastMessage: WaMessage;
  unread: number;
  total: number;
}

export default function WhatsAppConnect() {
  const [session, setSession] = useState<WaSession | null>(null);
  const [allMessages, setAllMessages] = useState<WaMessage[]>([]);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("wa_last_read") || "{}");
    } catch {
      return {};
    }
  });
  const lastQrRef = useRef<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastNotifiedIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const activePhoneRef = useRef<string | null>(null);

  useEffect(() => {
    activePhoneRef.current = activePhone;
  }, [activePhone]);

  // Pedir permissão de notificação ao montar
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  function playBeep() {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      setTimeout(() => ctx.close().catch(() => {}), 600);
    } catch {}
  }

  function notifyNewMessage(msg: WaMessage) {
    const phone = msg.from_phone || "";
    const name = getContactName(phone) || formatPhone(phone);
    playBeep();
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
        const n = new Notification(`💬 ${name}`, {
          body: msg.message.slice(0, 120),
          tag: `wa-${phone}`,
          icon: "/favicon.ico",
        });
        n.onclick = () => {
          window.focus();
          setActivePhone(phone);
          n.close();
        };
      }
    } catch {}
  }

  function persistRead(next: Record<string, string>) {
    setLastReadAt(next);
    try {
      localStorage.setItem("wa_last_read", JSON.stringify(next));
    } catch {}
  }

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
      .select("id, direction, from_phone, to_phone, message, created_at, media_type, media_url, media_mime, location_lat, location_lng, ai_analysis")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setAllMessages(data as WaMessage[]);
  }

  async function loadContacts() {
    const { data } = await (supabase as any).from("customers").select("phone, name");
    if (data) {
      const map: Record<string, string> = {};
      for (const c of data) {
        if (c.phone && c.name) map[c.phone.replace(/\D/g, "")] = c.name;
      }
      setContactNames(map);
    }
  }

  // Resolve contact name from phone (try variants with/without country code 55)
  function getContactName(phone: string): string | null {
    const clean = phone.replace(/\D/g, "");
    if (contactNames[clean]) return contactNames[clean];
    if (clean.startsWith("55") && contactNames[clean.slice(2)]) return contactNames[clean.slice(2)];
    if (!clean.startsWith("55") && contactNames["55" + clean]) return contactNames["55" + clean];
    return null;
  }

  function getInitials(phone: string): string {
    const name = getContactName(phone);
    if (name) {
      const parts = name.trim().split(/\s+/);
      return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || phone.slice(-2);
    }
    return phone.slice(-2);
  }

  // QR visual
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

  // Realtime
  useEffect(() => {
    (async () => {
      await Promise.all([loadSession(), loadMessages(), loadContacts()]);
      // Marca histórico atual como já notificado
      initializedRef.current = true;
    })();
    const ch = supabase
      .channel("wa-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_sessions" }, () => loadSession())
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_messages" }, (payload: any) => {
        loadMessages();
        if (!initializedRef.current) return;
        const msg = payload?.new as WaMessage | undefined;
        if (!msg || msg.direction !== "in") return;
        if (lastNotifiedIdRef.current === msg.id) return;
        lastNotifiedIdRef.current = msg.id;
        // Não notificar se a conversa ativa já está aberta E a aba está visível
        if (msg.from_phone === activePhoneRef.current && document.visibilityState === "visible") return;
        notifyNewMessage(msg);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => loadContacts())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Threads agrupadas por número (com contagem de não lidas)
  const threads: ChatThread[] = useMemo(() => {
    const map = new Map<string, ChatThread>();
    for (const m of allMessages) {
      const phone = (m.direction === "in" ? m.from_phone : m.to_phone) || "";
      if (!phone) continue;
      const existing = map.get(phone);
      if (!existing) {
        map.set(phone, { phone, lastMessage: m, unread: 0, total: 1 });
      } else {
        existing.total++;
        if (new Date(m.created_at) > new Date(existing.lastMessage.created_at)) {
          existing.lastMessage = m;
        }
      }
    }
    // Calcular não lidas: mensagens recebidas (in) após lastReadAt[phone]
    for (const t of map.values()) {
      const readAt = lastReadAt[t.phone] ? new Date(lastReadAt[t.phone]).getTime() : 0;
      t.unread = allMessages.filter(
        (m) =>
          m.direction === "in" &&
          m.from_phone === t.phone &&
          new Date(m.created_at).getTime() > readAt
      ).length;
    }
    let list = Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) => t.phone.includes(q) || t.lastMessage.message.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allMessages, search, lastReadAt]);

  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + t.unread, 0),
    [threads]
  );

  // Mensagens da conversa ativa (ordem cronológica)
  const activeMessages = useMemo(() => {
    if (!activePhone) return [];
    return allMessages
      .filter((m) => m.from_phone === activePhone || m.to_phone === activePhone)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [allMessages, activePhone]);

  // Marca conversa ativa como lida sempre que houver novas mensagens
  useEffect(() => {
    if (!activePhone) return;
    const lastIn = activeMessages.filter((m) => m.direction === "in").slice(-1)[0];
    if (!lastIn) return;
    const current = lastReadAt[activePhone];
    if (!current || new Date(lastIn.created_at) > new Date(current)) {
      persistRead({ ...lastReadAt, [activePhone]: lastIn.created_at });
    }
  }, [activePhone, activeMessages]);

  // Scroll automático ao final ao trocar/receber mensagem
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeMessages.length, activePhone]);

  // Selecionar primeira conversa por padrão
  useEffect(() => {
    if (!activePhone && threads.length > 0) setActivePhone(threads[0].phone);
  }, [threads, activePhone]);

  async function disconnect() {
    if (!confirm("Desconectar o WhatsApp? Você precisará escanear o QR novamente.")) return;
    await (supabase as any)
      .from("wa_sessions")
      .update({
        status: "disconnected",
        qr_code: null,
        phone_number: null,
        last_event: "manual_disconnect",
      })
      .eq("channel", "whatsapp");
    toast({
      title: "Solicitação enviada",
      description: "Reinicie o worker WA na VPS pra escanear novo QR.",
    });
  }

  async function sendMessage() {
    if (!activePhone || !draft.trim() || sending) return;
    setSending(true);
    const message = draft.trim();
    const { error } = await (supabase as any).from("whatsapp_outbox").insert({
      phone: activePhone,
      message,
      kind: "manual_admin",
      status: "pending",
    });
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      setDraft("");
      toast({ title: "Mensagem enfileirada", description: "Será enviada em ~5s pelo worker." });
    }
    setSending(false);
  }

  const status = session?.status ?? "disconnected";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.disconnected;
  const isConnected = status === "connected";

  // ===== Loading state =====
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ===== Não conectado: mostrar QR / status =====
  if (!isConnected) {
    return (
      <div className="container mx-auto p-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageCircle className="h-7 w-7 text-green-600" />
            WhatsApp
          </h1>
          <p className="text-muted-foreground mt-1">
            Conecte um número de WhatsApp pra responder clientes e enviar mensagens automáticas
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Conexão</CardTitle>
              <Badge variant={badge.variant} className={badge.variant === "default" ? badge.color : ""}>
                {badge.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {qrDataUrl ? (
              <div className="text-center py-4 space-y-4">
                <div className="inline-block p-4 bg-white rounded-lg border">
                  <img src={qrDataUrl} alt="QR Code WhatsApp" className="w-72 h-72" />
                </div>
                <div className="text-sm text-muted-foreground space-y-1 max-w-md mx-auto">
                  <p className="font-semibold text-foreground">Escaneie com o WhatsApp:</p>
                  <p>1. Abra WhatsApp no celular</p>
                  <p>
                    2. Toque em <b>Configurações → Aparelhos conectados</b>
                  </p>
                  <p>
                    3. Toque em <b>Conectar um aparelho</b>
                  </p>
                  <p>4. Aponte a câmera pra este QR Code</p>
                </div>
                {session?.qr_generated_at && (
                  <p className="text-xs text-muted-foreground">
                    Gerado{" "}
                    {format(new Date(session.qr_generated_at), "HH:mm:ss", { locale: ptBR })} —
                    expira em ~60s
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
                <Button variant="outline" size="sm" onClick={loadSession} className="mt-2">
                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== Conectado: interface tipo WhatsApp Web =====
  const activeThread = threads.find((t) => t.phone === activePhone);

  return (
    <div className="flex h-[calc(100vh-7rem)] border rounded-lg overflow-hidden bg-background">
      {/* Sidebar de conversas */}
      <aside className="w-[340px] border-r flex flex-col bg-muted/20">
        {/* Header com info do número conectado */}
        <div className="p-4 border-b bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center text-white">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{session?.display_name || "WhatsApp"}</p>
              <p className="text-xs text-muted-foreground truncate font-mono">
                +{session?.phone_number}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={disconnect} title="Desconectar">
              <WifiOff className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Enviadas</p>
              <p className="text-sm font-bold text-green-600">
                {session?.messages_sent_total ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebidas</p>
              <p className="text-sm font-bold text-blue-600">
                {session?.messages_received_total ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Falhas</p>
              <p className="text-sm font-bold text-red-600">{session?.failures_total ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="p-3 border-b flex items-center gap-2">
          <Input
            placeholder="Buscar conversa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1"
          />
          {totalUnread > 0 && (
            <Badge variant="destructive" className="shrink-0">
              {totalUnread} nova{totalUnread > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Lista de threads */}
        <ScrollArea className="flex-1">
          {threads.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12 px-4">
              Nenhuma conversa ainda.
              <br />
              Aguardando mensagens dos clientes.
            </div>
          ) : (
            <div>
              {threads.map((t) => {
                const isActive = t.phone === activePhone;
                const last = t.lastMessage;
                const hasUnread = t.unread > 0 && !isActive;
                return (
                  <button
                    key={t.phone}
                    onClick={() => setActivePhone(t.phone)}
                    className={`w-full flex items-start gap-3 px-3 py-3 border-b text-left hover:bg-muted/40 transition-colors ${
                      isActive ? "bg-muted/60" : hasUnread ? "bg-green-500/5" : ""
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold shrink-0 text-xs">
                      {getInitials(t.phone)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${hasUnread ? "font-bold" : "font-medium"}`}>
                          {getContactName(t.phone) || formatPhone(t.phone)}
                        </p>
                        <span className={`text-[10px] shrink-0 ${hasUnread ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>
                          {format(new Date(last.created_at), "HH:mm")}
                        </span>
                      </div>
                      {getContactName(t.phone) && (
                        <p className="text-[10px] text-muted-foreground/70 truncate font-mono">
                          {formatPhone(t.phone)}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={`text-xs truncate ${hasUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {last.direction === "out" ? "✓ " : ""}
                          {last.message}
                        </p>
                        {hasUnread && (
                          <span className="shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {t.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* Painel de chat ativo */}
      <section className="flex-1 flex flex-col">
        {activeThread ? (
          <>
            {/* Header da conversa */}
            <header className="h-16 px-4 border-b flex items-center gap-3 bg-muted/40 shrink-0">
              <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-xs">
                {getInitials(activeThread.phone)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {getContactName(activeThread.phone) || formatPhone(activeThread.phone)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {getContactName(activeThread.phone)
                    ? `${formatPhone(activeThread.phone)} · ${activeThread.total} mensagens`
                    : `${activeThread.total} mensagens`}
                </p>
              </div>
            </header>

            {/* Mensagens */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-2 bg-[hsl(var(--muted))]/10"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, hsl(var(--muted)) 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            >
              {activeMessages.map((m, idx) => {
                const prev = activeMessages[idx - 1];
                const showDate =
                  !prev ||
                  format(new Date(prev.created_at), "yyyy-MM-dd") !==
                    format(new Date(m.created_at), "yyyy-MM-dd");
                const isOut = m.direction === "out";
                return (
                  <div key={m.id}>
                    {showDate && (
                      <div className="flex justify-center my-3">
                        <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
                          {formatDateLabel(new Date(m.created_at))}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] px-3 py-2 rounded-lg shadow-sm ${
                          isOut
                            ? "bg-green-600 text-white rounded-br-none"
                            : "bg-card border rounded-bl-none"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                        <p
                          className={`text-[10px] mt-1 text-right ${
                            isOut ? "text-green-100" : "text-muted-foreground"
                          }`}
                        >
                          {format(new Date(m.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input de envio */}
            <div className="border-t p-3 flex gap-2 bg-muted/40 shrink-0">
              <Input
                placeholder="Digite uma mensagem…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={sending}
              />
              <Button onClick={sendMessage} disabled={!draft.trim() || sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <MessageCircle className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Selecione uma conversa</p>
            <p className="text-sm mt-1">
              As mensagens recebidas pelo WhatsApp aparecem aqui em tempo real.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
