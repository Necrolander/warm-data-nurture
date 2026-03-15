import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Settings, Star, MessageSquare, ShoppingCart, Loader2, CheckCircle, XCircle, Store } from "lucide-react";
import { toast } from "sonner";

const IfoodIntegration = () => {
  const [merchantId, setMerchantId] = useState("");
  const [positiveReply, setPositiveReply] = useState("Obrigado pela avaliação, {nome}! 😊 Ficamos felizes que gostou. Esperamos você novamente!");
  const [negativeReply, setNegativeReply] = useState("Sentimos muito pela sua experiência, {nome}. Vamos melhorar! Entre em contato conosco para resolvermos.");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncingReviews, setSyncingReviews] = useState(false);
  const [replyingReviews, setReplyingReviews] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loadingMerchants, setLoadingMerchants] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    const { data } = await supabase.from("store_settings").select("key, value");
    const map: Record<string, string> = {};
    data?.forEach(r => { map[r.key] = r.value; });
    if (map.ifood_merchant_id) setMerchantId(map.ifood_merchant_id);
    if (map.ifood_review_positive_reply) setPositiveReply(map.ifood_review_positive_reply);
    if (map.ifood_review_negative_reply) setNegativeReply(map.ifood_review_negative_reply);
    if (map.ifood_auto_reply === "true") setAutoReplyEnabled(true);
    if (map.ifood_last_sync) setLastSync(map.ifood_last_sync);
  };

  const fetchReviews = async () => {
    const { data } = await supabase
      .from("ifood_reviews" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setReviews(data as any[]);
  };

  useEffect(() => { fetchSettings(); fetchReviews(); }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await supabase.functions.invoke("ifood-sync", {
        body: {
          action: "save_settings",
          settings: {
            ifood_merchant_id: merchantId,
            ifood_review_positive_reply: positiveReply,
            ifood_review_negative_reply: negativeReply,
            ifood_auto_reply: String(autoReplyEnabled),
          },
        },
      });
      toast.success("Configurações salvas!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    }
    setSaving(false);
  };

  const syncOrders = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ifood-sync", {
        body: { action: "poll_orders" },
      });
      if (error) throw error;
      toast.success(`Sincronizado! ${data.orders_created || 0} novos pedidos importados.`);
      // Update last sync
      await supabase.from("store_settings").upsert(
        { key: "ifood_last_sync", value: new Date().toISOString() },
        { onConflict: "key" }
      );
      setLastSync(new Date().toISOString());
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "Falha na sincronização"));
    }
    setSyncing(false);
  };

  const syncReviews = async () => {
    setSyncingReviews(true);
    try {
      const { data, error } = await supabase.functions.invoke("ifood-sync", {
        body: { action: "poll_reviews" },
      });
      if (error) throw error;
      toast.success(`${data.message}`);
      fetchReviews();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setSyncingReviews(false);
  };

  const autoReply = async () => {
    setReplyingReviews(true);
    try {
      const { data, error } = await supabase.functions.invoke("ifood-sync", {
        body: { action: "auto_reply_reviews" },
      });
      if (error) throw error;
      toast.success(`Respondidas: ${data.replied} avaliações`);
      fetchReviews();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setReplyingReviews(false);
  };

  const loadMerchants = async () => {
    setLoadingMerchants(true);
    try {
      const { data, error } = await supabase.functions.invoke("ifood-sync", {
        body: { action: "get_merchants" },
      });
      if (error) throw error;
      setMerchants(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 0) toast.info("Nenhuma loja encontrada");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setLoadingMerchants(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">🟥</span> Integração iFood
          </h2>
          <p className="text-sm text-muted-foreground">
            Sincronize pedidos e gerencie avaliações automaticamente
          </p>
        </div>
        {lastSync && (
          <Badge variant="outline" className="text-xs">
            Última sync: {new Date(lastSync).toLocaleString("pt-BR")}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config"><Settings className="h-4 w-4 mr-1" /> Configuração</TabsTrigger>
          <TabsTrigger value="orders"><ShoppingCart className="h-4 w-4 mr-1" /> Pedidos</TabsTrigger>
          <TabsTrigger value="reviews"><Star className="h-4 w-4 mr-1" /> Avaliações</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4 mt-4">
          {/* Merchant ID */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Store className="h-4 w-4" /> Merchant ID (Loja iFood)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={merchantId}
                  onChange={e => setMerchantId(e.target.value)}
                  placeholder="Ex: caabfbc7-b31c-482a-b130-90de2b540d81"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={loadMerchants} disabled={loadingMerchants}>
                  {loadingMerchants ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar Lojas"}
                </Button>
              </div>
              {merchants.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Suas lojas:</p>
                  {merchants.map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => { setMerchantId(m.id); toast.success(`Loja selecionada: ${m.name}`); }}
                      className={`w-full text-left p-2 rounded text-sm hover:bg-muted/50 transition-colors ${merchantId === m.id ? "bg-primary/10 border border-primary/30" : "border border-border"}`}
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{m.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto Reply Config */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Resposta Automática de Avaliações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={autoReplyEnabled} onCheckedChange={setAutoReplyEnabled} />
                <Label>Responder automaticamente</Label>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Resposta para ⭐ 4-5 estrelas (use {"{nome}"} e {"{nota}"} como variáveis)</Label>
                <Textarea
                  value={positiveReply}
                  onChange={e => setPositiveReply(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Resposta para ⭐ 1-3 estrelas</Label>
                <Textarea
                  value={negativeReply}
                  onChange={e => setNegativeReply(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>

              <Button onClick={saveSettings} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Sincronizar Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Busca novos pedidos no iFood e importa automaticamente para o sistema. 
                Os pedidos aparecerão em "Meus Pedidos" com a tag 🟥 iFood.
              </p>
              <Button onClick={syncOrders} disabled={syncing} className="w-full">
                {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                {syncing ? "Sincronizando..." : "Sincronizar Agora"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                💡 Configure um cron job para sincronizar automaticamente a cada minuto.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4" /> Avaliações ({reviews.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={syncReviews} disabled={syncingReviews}>
                  {syncingReviews ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button size="sm" onClick={autoReply} disabled={replyingReviews}>
                  {replyingReviews ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MessageSquare className="h-4 w-4 mr-1" />}
                  Responder Pendentes
                </Button>
              </div>
            </CardHeader>
            <ScrollArea className="h-96">
              <CardContent className="space-y-3">
                {reviews.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma avaliação importada. Clique em sincronizar!
                  </p>
                )}
                {reviews.map((review: any) => (
                  <div key={review.id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{review.customer_name || "Cliente"}</span>
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < (review.rating || 0) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                      </div>
                      {review.response_sent ? (
                        <Badge className="bg-green-500/20 text-green-400 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" /> Respondida
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                          <XCircle className="h-3 w-3 mr-1" /> Pendente
                        </Badge>
                      )}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    )}
                    {review.response_text && (
                      <div className="bg-muted/30 rounded p-2 text-xs text-muted-foreground">
                        <span className="font-medium">Sua resposta:</span> {review.response_text}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ))}
              </CardContent>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IfoodIntegration;
