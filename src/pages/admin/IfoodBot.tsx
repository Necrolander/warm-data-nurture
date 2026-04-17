import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Clock, KeyRound, RefreshCw, ShieldCheck, Camera, Wifi, WifiOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Heartbeat = {
  channel: string;
  status: string;
  last_polled_at: string | null;
  orders_captured_total: number;
  failures_total: number;
  meta: any;
  updated_at: string;
};

type TwoFARequest = {
  id: string;
  status: string;
  reason: string | null;
  requested_at: string;
  expires_at: string;
  provided_at: string | null;
  consumed_at: string | null;
  code: string | null;
};

type Screenshot = {
  id: string;
  screenshot_url: string;
  page_url: string | null;
  note: string | null;
  created_at: string;
};

type Failure = {
  id: string;
  error_message: string;
  screenshot_url: string | null;
  context: any;
  created_at: string;
};

const fmtAgo = (iso?: string | null) =>
  iso ? formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR }) : "—";

const isOnline = (hb?: Heartbeat | null) => {
  if (!hb?.last_polled_at) return false;
  const ageMs = Date.now() - new Date(hb.last_polled_at).getTime();
  return ageMs < 90_000; // 90s
};

export default function IfoodBot() {
  const [hb, setHb] = useState<Heartbeat | null>(null);
  const [pending2fa, setPending2fa] = useState<TwoFARequest | null>(null);
  const [history2fa, setHistory2fa] = useState<TwoFARequest[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderCount, setOrderCount] = useState(0);

  const online = useMemo(() => isOnline(hb), [hb]);

  const loadAll = async () => {
    const [hbRes, twoFaRes, shotRes, failRes, ordersRes] = await Promise.all([
      supabase.from("bot_heartbeats").select("*").eq("channel", "ifood").maybeSingle(),
      supabase
        .from("bot_2fa_requests")
        .select("*")
        .eq("channel", "ifood")
        .order("requested_at", { ascending: false })
        .limit(10),
      supabase
        .from("bot_screenshots")
        .select("*")
        .eq("channel", "ifood")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("bot_failures")
        .select("*")
        .eq("channel", "ifood")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("external_orders")
        .select("id", { count: "exact", head: true })
        .eq("channel", "ifood"),
    ]);

    setHb((hbRes.data as Heartbeat) ?? null);
    const twoFa = (twoFaRes.data as TwoFARequest[]) ?? [];
    setHistory2fa(twoFa);
    setPending2fa(twoFa.find((r) => r.status === "pending" && new Date(r.expires_at) > new Date()) ?? null);
    setScreenshots((shotRes.data as Screenshot[]) ?? []);
    setFailures((failRes.data as Failure[]) ?? []);
    setOrderCount(ordersRes.count ?? 0);
  };

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("ifood-bot-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_heartbeats" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_2fa_requests" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_screenshots" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_failures" }, loadAll)
      .subscribe();
    const interval = setInterval(loadAll, 30_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, []);

  const submit2FA = async () => {
    if (!pending2fa) return;
    const clean = code.replace(/\s/g, "");
    if (clean.length < 4) {
      toast.error("Código inválido");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("bot_2fa_requests")
      .update({ code: clean, status: "provided", provided_at: new Date().toISOString() })
      .eq("id", pending2fa.id);
    setSubmitting(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Código enviado pro bot 🚀");
    setCode("");
    loadAll();
  };

  const expirePending = async () => {
    if (!pending2fa) return;
    await supabase
      .from("bot_2fa_requests")
      .update({ status: "expired" })
      .eq("id", pending2fa.id);
    toast.info("Solicitação descartada");
    loadAll();
  };

  return (
    <div className="space-y-6">
      {/* Header com link pra métricas */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Bot iFood</h1>
          <p className="text-sm text-muted-foreground">Status, 2FA, screenshots e falhas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/admin/ifood-bot/avaliacoes">
            <Button variant="outline" className="gap-2">
              <Activity className="h-4 w-4" />
              Avaliações
            </Button>
          </a>
          <a href="/admin/ifood-bot/metricas">
            <Button variant="default" className="gap-2">
              <Activity className="h-4 w-4" />
              Ver métricas
            </Button>
          </a>
        </div>
      </div>

      {/* 🚨 Banner 2FA pendente */}
      {pending2fa && (
        <Card className="border-2 border-destructive bg-destructive/10 animate-pulse">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              Bot iFood pediu código 2FA — cole abaixo!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {pending2fa.reason || "O Portal iFood pediu verificação. Verifique seu celular (SMS) e cole o código."}
            </p>
            <div className="flex gap-2">
              <Input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="000000"
                maxLength={8}
                className="text-center text-2xl font-mono font-bold tracking-[0.5em]"
                onKeyDown={(e) => e.key === "Enter" && submit2FA()}
              />
              <Button onClick={submit2FA} disabled={submitting || code.length < 4} size="lg">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Enviar
              </Button>
              <Button onClick={expirePending} variant="outline" size="lg">
                Descartar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Solicitado {fmtAgo(pending2fa.requested_at)} • expira {fmtAgo(pending2fa.expires_at)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bot</p>
                <p className="text-2xl font-bold flex items-center gap-2">
                  {online ? (
                    <>
                      <Wifi className="h-5 w-5 text-green-500" />
                      <span className="text-green-500">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-5 w-5 text-red-500" />
                      <span className="text-red-500">Offline</span>
                    </>
                  )}
                </p>
              </div>
              <Activity className={online ? "h-8 w-8 text-green-500" : "h-8 w-8 text-muted-foreground"} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Último ping: {fmtAgo(hb?.last_polled_at)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pedidos capturados</p>
            <p className="text-3xl font-bold">{orderCount}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Sessão atual: {hb?.orders_captured_total ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Falhas</p>
            <p className="text-3xl font-bold text-red-500">{hb?.failures_total ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-2">{failures.length} registros recentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Status interno</p>
            <p className="text-2xl font-bold capitalize">{hb?.status ?? "desconhecido"}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Atualizado {fmtAgo(hb?.updated_at)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Screenshots ao vivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Tela do bot (últimos screenshots)
            <Button variant="ghost" size="sm" className="ml-auto" onClick={loadAll}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {screenshots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum screenshot ainda. O bot envia automaticamente quando algo importante acontece.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {screenshots.map((s) => (
                <a key={s.id} href={s.screenshot_url} target="_blank" rel="noopener noreferrer" className="group">
                  <div className="rounded-lg border overflow-hidden bg-muted">
                    <img
                      src={s.screenshot_url}
                      alt={s.note ?? "Screenshot"}
                      className="w-full aspect-video object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {s.note || s.page_url || "Sem nota"} • {fmtAgo(s.created_at)}
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico 2FA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Histórico de 2FA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history2fa.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem solicitações ainda.</p>
          ) : (
            <div className="space-y-2">
              {history2fa.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-2 rounded border">
                  <Badge
                    variant={
                      r.status === "consumed"
                        ? "default"
                        : r.status === "provided"
                        ? "secondary"
                        : r.status === "pending"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {r.status}
                  </Badge>
                  <div className="flex-1 text-sm">
                    <div>{r.reason || "Verificação 2FA"}</div>
                    <div className="text-xs text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      Pedido {fmtAgo(r.requested_at)}
                      {r.consumed_at && ` • usado ${fmtAgo(r.consumed_at)}`}
                    </div>
                  </div>
                  {r.code && r.status !== "pending" && (
                    <code className="text-xs bg-muted px-2 py-1 rounded">{r.code}</code>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Falhas recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Falhas recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {failures.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma falha registrada 🎉</p>
          ) : (
            <div className="space-y-2">
              {failures.map((f) => (
                <div key={f.id} className="p-3 rounded border border-red-500/20 bg-red-500/5">
                  <div className="text-sm font-medium text-red-700 dark:text-red-400">{f.error_message}</div>
                  <div className="text-xs text-muted-foreground mt-1">{fmtAgo(f.created_at)}</div>
                  {f.screenshot_url && (
                    <a
                      href={f.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-1 inline-block"
                    >
                      Ver screenshot →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
