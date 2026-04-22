import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, RefreshCw, Search, TrendingDown, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { mpErrorLabel } from "@/lib/mpErrors";

interface PaymentFailure {
  id: string;
  order_id: string | null;
  method: string;
  amount: number | null;
  mp_payment_id: string | null;
  status: string | null;
  status_detail: string | null;
  error_code: string | null;
  error_message: string | null;
  payment_method_id: string | null;
  installments: number | null;
  raw_response: any;
  created_at: string;
}

const labelFor = (code: string | null) => mpErrorLabel(code);

const PERIOD_OPTIONS = [
  { v: "1", label: "Últimas 24h" },
  { v: "7", label: "Últimos 7 dias" },
  { v: "30", label: "Últimos 30 dias" },
  { v: "90", label: "Últimos 90 dias" },
  { v: "all", label: "Todos" },
];

const PaymentFailures = () => {
  const [rows, setRows] = useState<PaymentFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<PaymentFailure | null>(null);

  const fetchData = async () => {
    setLoading(true);
    let q = supabase
      .from("payment_failures" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (period !== "all") {
      const since = new Date();
      since.setDate(since.getDate() - Number(period));
      q = q.gte("created_at", since.toISOString());
    }
    const { data, error } = await q;
    if (error) {
      toast.error("Erro ao carregar falhas");
      setRows([]);
    } else {
      setRows((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.status_detail, r.error_code, r.error_message, r.mp_payment_id, r.order_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    );
  }, [rows, search]);

  const aggregated = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      const k = r.status_detail || r.error_code || "desconhecido";
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([code, count]) => ({ code, count, label: labelFor(code) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filtered]);

  const total = filtered.length;
  const cardCount = filtered.filter((r) => r.method === "card").length;
  const pixCount = filtered.filter((r) => r.method === "pix").length;

  // Alertas: motivos com 5+ ocorrências na última hora
  const ALERT_THRESHOLD = 5;
  const ALERT_WINDOW_MIN = 60;
  const spikeAlerts = useMemo(() => {
    const cutoff = Date.now() - ALERT_WINDOW_MIN * 60 * 1000;
    const map = new Map<string, number>();
    for (const r of rows) {
      if (new Date(r.created_at).getTime() < cutoff) continue;
      const k = r.status_detail || r.error_code || "desconhecido";
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries())
      .filter(([, c]) => c >= ALERT_THRESHOLD)
      .map(([code, count]) => ({ code, count, label: labelFor(code) }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-destructive" />
            Falhas de Pagamento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auditoria de recusas e erros do Mercado Pago para reduzir falhas recorrentes.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Alerta de pico de recusas */}
      {spikeAlerts.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {spikeAlerts.length === 1
              ? "Pico de recusas detectado na última hora"
              : `${spikeAlerts.length} motivos com pico de recusas na última hora`}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {spikeAlerts.map((a) => (
                <li key={a.code} className="flex items-center gap-2">
                  <Badge variant="destructive" className="font-mono">
                    {a.count}×
                  </Badge>
                  <span className="font-medium">{a.label}</span>
                  <span className="text-xs opacity-70 font-mono">({a.code})</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs opacity-80">
              Limite: {ALERT_THRESHOLD}+ ocorrências do mesmo motivo em {ALERT_WINDOW_MIN} min.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total no período</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cartão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{cardCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">PIX</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pixCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top causas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="w-4 h-4" />
            Principais motivos de recusa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aggregated.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="space-y-2">
              {aggregated.map((a) => {
                const pct = total ? (a.count / total) * 100 : 0;
                return (
                  <div key={a.code}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{a.label}</span>
                      <span className="text-muted-foreground">
                        {a.count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-destructive rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.v} value={o.v}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, mensagem ou ID do pedido…"
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma falha registrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(r.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.method === "card" ? "default" : "secondary"}>
                          {r.method === "card" ? "Cartão" : "PIX"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate">
                        {labelFor(r.status_detail || r.error_code)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {r.status_detail || r.error_code || "—"}
                      </TableCell>
                      <TableCell>{r.installments ?? "—"}</TableCell>
                      <TableCell>
                        {r.amount != null ? `R$ ${Number(r.amount).toFixed(2).replace(".", ",")}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {r.order_id ? r.order_id.slice(0, 8) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da falha</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground">Quando</p>
                  <p>{format(new Date(detail.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Método</p>
                  <p>{detail.method}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p>{detail.status || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">status_detail</p>
                  <p className="font-mono text-xs">{detail.status_detail || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Código</p>
                  <p className="font-mono text-xs">{detail.error_code || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Parcelas</p>
                  <p>{detail.installments ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p>
                    {detail.amount != null
                      ? `R$ ${Number(detail.amount).toFixed(2).replace(".", ",")}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">MP Payment ID</p>
                  <p className="font-mono text-xs">{detail.mp_payment_id || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Mensagem</p>
                <p className="bg-muted rounded p-2 text-sm">{detail.error_message || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Resposta completa</p>
                <pre className="bg-muted rounded p-2 text-xs overflow-x-auto max-h-60">
                  {JSON.stringify(detail.raw_response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentFailures;
