import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chrome, Download, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-orders-ingest`;

const IfoodExtension = () => {
  const download = () => {
    fetch("/truebox-ifood-extension.zip")
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
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Chrome className="h-5 w-5" /> Extensão Chrome — Leitor de Pedidos iFood
        </h2>
        <p className="text-sm text-muted-foreground">
          Instale a extensão no Chrome, faça login no Portal iFood normalmente, e os pedidos aparecem
          automaticamente em <strong>Integrações Externas</strong> e no <strong>painel de pedidos</strong>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> 1. Baixar extensão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={download} size="lg">
            <Download className="h-4 w-4 mr-2" /> Baixar truebox-ifood-extension.zip
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Instalar no Chrome</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Descompacte o arquivo <code>truebox-ifood-extension.zip</code></li>
            <li>Abra <code>chrome://extensions</code> no Chrome</li>
            <li>Ative o <strong>Modo do desenvolvedor</strong> (canto superior direito)</li>
            <li>Clique em <strong>Carregar sem compactação</strong> e selecione a pasta descompactada</li>
            <li>Fixe o ícone Truebox na barra do Chrome</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Configurar a extensão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Clique no ícone da extensão e preencha:
          </p>
          <div className="space-y-2">
            <div>
              <Badge variant="outline" className="mb-1">URL de ingestão (já preenchida)</Badge>
              <div className="flex gap-2">
                <code className="flex-1 bg-muted px-2 py-1 rounded text-xs break-all">{INGEST_URL}</code>
                <Button size="sm" variant="outline" onClick={() => copy(INGEST_URL)}>Copiar</Button>
              </div>
            </div>
            <div>
              <Badge variant="outline" className="mb-1">Token do bot</Badge>
              <p className="text-muted-foreground text-xs">
                Use o mesmo valor da secret <code>EXTERNAL_BOT_TOKEN</code> (ou <code>IFOOD_BOT_TOKEN</code>)
                já configurada no Lovable Cloud. Cole no campo "Token do bot" da extensão e clique em <strong>Salvar</strong>,
                depois em <strong>Testar</strong> para validar a conexão.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">4. Usar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Abra <a href="https://portal.ifood.com.br/pedidos" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
              portal.ifood.com.br/pedidos <ExternalLink className="h-3 w-3" />
            </a> e faça login normalmente</li>
            <li>Um badge vermelho <strong>"Truebox iFood"</strong> aparece no canto inferior direito da tela</li>
            <li>A cada 15s a extensão lê os pedidos visíveis e envia para o painel</li>
            <li>Acompanhe em <a href="/painel/integracoes-externas" className="text-primary hover:underline">Integrações Externas</a></li>
          </ol>
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded p-3 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              Mantenha a aba do Portal iFood aberta para que a extensão continue lendo.
              Você pode minimizar a janela, mas não feche a aba.
            </div>
          </div>
          <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 rounded p-3 text-xs">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <div>
              Vantagem vs bot na VPS: usa seu próprio navegador logado, sem Cloudflare bloqueando,
              sem 2FA recorrente, sem custo de servidor.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IfoodExtension;
