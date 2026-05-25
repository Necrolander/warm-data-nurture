import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chrome, Download, CheckCircle2, AlertTriangle, ExternalLink, Activity, RefreshCw, Bot } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-orders-ingest`;
const DOWNLOAD_URL = "/truebox-ifood-extension.zip";

const IfoodExtension = () => {
  const [hb, setHb] = useState<any>(null);
  const [botHb, setBotHb] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    const { data: rows } = await supabase
      .from("bot_heartbeats" as any)
      .select("*")
      .eq("channel", "ifood")
      .order("updated_at", { ascending: false })
      .limit(10);
    const list = (rows as any[]) || [];
    const ext = list.find((r) => r?.meta?.source === "chrome-extension") || null;
    const bot = list.find((r) => r?.meta?.source !== "chrome-extension") || null;
    setHb(ext);
    setBotHb(bot);
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    const i = setInterval(fetchStatus, 10_000);
    return () => clearInterval(i);
  }, []);

  const ageOnline = (ts?: string | null) => {
    if (!ts) return false;
    return (Date.now() - new Date(ts).getTime()) / 1000 < 120;
  };
  const isOnline = ageOnline(hb?.last_polled_at);
  const isBotOnline = ageOnline(botHb?.last_polled_at);

  const download = () => {
    fetch(DOWNLOAD_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Download falhou: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "truebox-ifood-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Extensão baixada!");
      })
      .catch((e) => toast.error(e.message));
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Chrome className="h-5 w-5" /> Extensão Chrome — Leitor de Pedidos iFood
          </h2>
          <p className="text-sm text-muted-foreground">
            Instale no Chrome, faça login no Portal iFood e os pedidos chegam automaticamente.
          </p>
        </div>
        <Button onClick={download} size="lg" className="shrink-0">
          <Download className="h-4 w-4 mr-2" /> Baixar extensão (.zip)
        </Button>
      </div>

      {/* Status ao vivo */}
      <Card className={isOnline ? "border-green-500/50" : "border-red-500/40"}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Status da extensão
            </span>
            <div className="flex items-center gap-2">
              <Badge className={isOnline ? "bg-green-500/20 text-green-700" : "bg-red-500/20 text-red-700"}>
                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                {loading ? "..." : isOnline ? "Ativa (Online)" : "Inativa (Offline)"}
              </Badge>
              <Button size="icon" variant="ghost" onClick={fetchStatus}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {hb ? (
            <>
              <div>Último heartbeat: <strong>{formatDistanceToNow(new Date(hb.last_polled_at), { addSuffix: true, locale: ptBR })}</strong></div>
              <div className="text-muted-foreground text-xs">
                Pedidos capturados: <strong className="text-foreground">{hb.orders_captured_total ?? 0}</strong>
                {" · "}Falhas: <strong className="text-foreground">{hb.failures_total ?? 0}</strong>
              </div>
              {!isOnline && (
                <div className="flex items-start gap-2 mt-2 bg-red-500/10 border border-red-500/30 rounded p-2 text-xs">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>Extensão sem heartbeat há mais de 2min. Verifique se o Chrome está aberto, a aba do Portal iFood ativa e a extensão habilitada (clique no ícone → botão "Ativar/Pausar").</div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded p-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>Nenhum heartbeat recebido ainda. Instale a extensão, configure o token e abra o Portal iFood para começar.</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Instalar no Chrome</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Clique em <strong>Baixar extensão</strong> acima e descompacte o arquivo</li>
            <li>Abra <code>chrome://extensions</code> no Chrome</li>
            <li>Ative o <strong>Modo do desenvolvedor</strong> (canto superior direito)</li>
            <li>Clique em <strong>Carregar sem compactação</strong> e selecione a pasta descompactada</li>
            <li>Fixe o ícone Truebox na barra do Chrome</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. Configurar</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Badge variant="outline" className="mb-1">URL de ingestão</Badge>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted px-2 py-1 rounded text-xs break-all">{INGEST_URL}</code>
              <Button size="sm" variant="outline" onClick={() => copy(INGEST_URL)}>Copiar</Button>
            </div>
          </div>
          <div>
            <Badge variant="outline" className="mb-1">Token do bot</Badge>
            <p className="text-muted-foreground text-xs">
              Use o mesmo valor da secret <code>EXTERNAL_BOT_TOKEN</code> (ou <code>IFOOD_BOT_TOKEN</code>)
              configurada no Lovable Cloud. Cole no campo "Token do bot" da extensão, clique em <strong>Salvar</strong> e depois em <strong>Testar</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">3. Usar</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Abra <a href="https://portal.ifood.com.br/pedidos" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
              portal.ifood.com.br/pedidos <ExternalLink className="h-3 w-3" />
            </a> e faça login</li>
            <li>Um badge vermelho <strong>"Truebox iFood"</strong> aparece no canto inferior direito</li>
            <li>A cada 15s a extensão lê os pedidos visíveis e envia para o painel</li>
            <li>Acompanhe em <a href="/painel/integracoes-externas" className="text-primary hover:underline">Integrações Externas</a></li>
          </ol>
          <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 rounded p-3 text-xs">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <div>Use o botão <strong>Ativar/Pausar</strong> no popup da extensão para controlar a leitura sem desinstalar.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IfoodExtension;
