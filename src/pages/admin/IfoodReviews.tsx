import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  ArrowLeft, Star, Sparkles, Send, RefreshCw, MessageSquare, CheckCircle2, Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Review = {
  id: string;
  review_id: string;
  customer_name: string | null;
  rating: number | null;
  comment: string | null;
  response_sent: boolean | null;
  response_text: string | null;
  responded_at: string | null;
  created_at: string;
};

type Mode = "hybrid" | "template" | "ai";

export default function IfoodReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [positiveTpl, setPositiveTpl] = useState("");
  const [negativeTpl, setNegativeTpl] = useState("");
  const [mode, setMode] = useState<Mode>("hybrid");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [reviewsRes, settingsRes] = await Promise.all([
      supabase
        .from("ifood_reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("store_settings")
        .select("key, value")
        .in("key", [
          "ifood_review_positive_reply",
          "ifood_review_negative_reply",
          "ifood_review_mode",
        ]),
    ]);

    if (reviewsRes.data) setReviews(reviewsRes.data as Review[]);
    if (settingsRes.data) {
      const map = Object.fromEntries(settingsRes.data.map((s: any) => [s.key, s.value]));
      setPositiveTpl(map.ifood_review_positive_reply || "");
      setNegativeTpl(map.ifood_review_negative_reply || "");
      setMode((map.ifood_review_mode as Mode) || "hybrid");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const saveTemplates = async () => {
    const { error } = await supabase.functions.invoke("ifood-sync", {
      body: {
        action: "save_settings",
        settings: {
          ifood_review_positive_reply: positiveTpl,
          ifood_review_negative_reply: negativeTpl,
          ifood_review_mode: mode,
        },
      },
    });
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Templates salvos!");
    }
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("ifood-sync", {
      body: { action: "auto_reply_reviews" },
    });
    setRunning(false);
    if (error) {
      toast.error("Falha: " + error.message);
    } else {
      const replied = data?.replied || 0;
      const aiUsed = data?.ai_used || 0;
      toast.success(`✅ ${replied} resposta(s) enviada(s) — ${aiUsed} com IA`);
      fetchAll();
    }
  };

  const pending = reviews.filter((r) => !r.response_sent && r.comment);
  const responded = reviews.filter((r) => r.response_sent);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/ifood-bot">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-6 w-6 text-amber-500" />
              Avaliações iFood — Auto-resposta
            </h1>
            <p className="text-sm text-muted-foreground">
              Templates, modo de resposta e histórico
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={runNow} disabled={running}>
            <Send className={`h-4 w-4 mr-2 ${running ? "animate-pulse" : ""}`} />
            {running ? "Enviando..." : "Responder pendentes agora"}
          </Button>
        </div>
      </div>

      {/* Modo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Modo de resposta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="hybrid" id="m-hybrid" className="mt-1" />
              <Label htmlFor="m-hybrid" className="cursor-pointer flex-1">
                <div className="font-medium">🎯 Híbrido (recomendado)</div>
                <div className="text-sm text-muted-foreground">
                  Positivas (4-5⭐) usam template fixo. Negativas (1-3⭐) são geradas com IA Gemini de forma personalizada.
                </div>
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="template" id="m-template" className="mt-1" />
              <Label htmlFor="m-template" className="cursor-pointer flex-1">
                <div className="font-medium">📝 Sempre template</div>
                <div className="text-sm text-muted-foreground">
                  Usa os textos abaixo pra todas as avaliações. Sem IA, sem custo.
                </div>
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="ai" id="m-ai" className="mt-1" />
              <Label htmlFor="m-ai" className="cursor-pointer flex-1">
                <div className="font-medium">🤖 Sempre IA</div>
                <div className="text-sm text-muted-foreground">
                  Todas as respostas geradas por IA. Mais natural, usa créditos do Lovable AI.
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Templates */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-green-500 fill-green-500" />
              Template positivo (4-5⭐)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={positiveTpl}
              onChange={(e) => setPositiveTpl(e.target.value)}
              rows={5}
              placeholder="Obrigado, {nome}! Ficamos felizes..."
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: <code className="bg-muted px-1 rounded">{"{nome}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{nota}"}</code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-destructive fill-destructive" />
              Template negativo (1-3⭐) — fallback se IA falhar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={negativeTpl}
              onChange={(e) => setNegativeTpl(e.target.value)}
              rows={5}
              placeholder="Sentimos muito, {nome}..."
            />
            <p className="text-xs text-muted-foreground">
              No modo híbrido, este texto só é usado se a IA não responder.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={saveTemplates} variant="default">
          Salvar configurações
        </Button>
      </div>

      {/* Pendentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pendentes ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma avaliação pendente 🎉
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map((r) => (
                <div key={r.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.customer_name || "Anônimo"}</span>
                      <Badge variant={(r.rating || 0) >= 4 ? "default" : "destructive"}>
                        {r.rating}⭐
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground italic">"{r.comment}"</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Respondidas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Respondidas ({responded.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {responded.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma resposta enviada ainda
            </p>
          ) : (
            <div className="space-y-3">
              {responded.slice(0, 20).map((r) => (
                <div key={r.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.customer_name || "Anônimo"}</span>
                      <Badge variant={(r.rating || 0) >= 4 ? "default" : "destructive"}>
                        {r.rating}⭐
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {r.responded_at &&
                        formatDistanceToNow(new Date(r.responded_at), {
                          locale: ptBR,
                          addSuffix: true,
                        })}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-muted-foreground italic">"{r.comment}"</p>
                  )}
                  <div className="flex gap-2 items-start text-sm bg-muted/50 p-2 rounded">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <span>{r.response_text}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
