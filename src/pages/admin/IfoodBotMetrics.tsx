import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Activity, AlertTriangle, Clock, TrendingUp, RefreshCw, Wifi,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

type Period = "today" | "7d" | "30d";

type OrderRow = {
  id: string;
  order_source: string | null;
  created_at: string;
};

type Heartbeat = {
  channel: string;
  status: string;
  last_polled_at: string | null;
  orders_captured_total: number;
  failures_total: number;
  updated_at: string;
};

type ExternalRow = {
  id: string;
  channel: string;
  first_seen_at: string;
  sent_to_menu_at: string | null;
};

const periodToHours = (p: Period) => (p === "today" ? 24 : p === "7d" ? 24 * 7 : 24 * 30);

const SOURCE_COLORS: Record<string, string> = {
  ifood: "hsl(var(--destructive))",
  site: "hsl(var(--primary))",
  whatsapp: "hsl(142 71% 45%)",
  pdv_admin: "hsl(var(--muted-foreground))",
  "99food": "hsl(280 70% 55%)",
};

const SOURCE_LABEL: Record<string, string> = {
  ifood: "iFood",
  site: "Site",
  whatsapp: "WhatsApp",
  pdv_admin: "PDV",
  "99food": "99Food",
};

export default function IfoodBotMetrics() {
  const [period, setPeriod] = useState<Period>("today");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
  const [externals, setExternals] = useState<ExternalRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const sinceIso = new Date(Date.now() - periodToHours(period) * 3600_000).toISOString();

    const [ordersRes, hbRes, extRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_source, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true }),
      supabase
        .from("bot_heartbeats")
        .select("*")
        .eq("channel", "ifood")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("external_orders")
        .select("id, channel, first_seen_at, sent_to_menu_at")
        .eq("channel", "ifood")
        .gte("first_seen_at", sinceIso)
        .order("first_seen_at", { ascending: false }),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data as OrderRow[]);
    if (hbRes.data) setHeartbeat(hbRes.data as Heartbeat);
    if (extRes.data) setExternals(extRes.data as ExternalRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // Pedidos por hora (bucket por hora local)
  const ordersByHour = useMemo(() => {
    const buckets = new Map<string, { hour: string; ifood: number; site: number; whatsapp: number; pdv: number; outros: number }>();
    const totalHours = periodToHours(period);
    const showAsDay = totalHours > 24;

    orders.forEach((o) => {
      const d = new Date(o.created_at);
      const key = showAsDay
        ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        : `${d.getHours().toString().padStart(2, "0")}h`;
      if (!buckets.has(key)) {
        buckets.set(key, { hour: key, ifood: 0, site: 0, whatsapp: 0, pdv: 0, outros: 0 });
      }
      const b = buckets.get(key)!;
      const src = o.order_source || "site";
      if (src === "ifood") b.ifood++;
      else if (src === "site") b.site++;
      else if (src === "whatsapp") b.whatsapp++;
      else if (src === "pdv_admin") b.pdv++;
      else b.outros++;
    });

    return Array.from(buckets.values());
  }, [orders, period]);

  // Distribuição por canal (pizza)
  const sourceDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const src = o.order_source || "site";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: SOURCE_LABEL[name] || name,
      value,
      color: SOURCE_COLORS[name] || "hsl(var(--muted-foreground))",
    }));
  }, [orders]);

  // Tempo médio bot → admin (segundos entre first_seen_at e sent_to_menu_at)
  const avgBotToAdmin = useMemo(() => {
    const valid = externals.filter((e) => e.sent_to_menu_at);
    if (!valid.length) return null;
    const totalSec = valid.reduce((acc, e) => {
      const diff = (new Date(e.sent_to_menu_at!).getTime() - new Date(e.first_seen_at).getTime()) / 1000;
      return acc + diff;
    }, 0);
    return totalSec / valid.length;
  }, [externals]);

  // Taxa de sucesso = capturados / (capturados + falhas) baseado em heartbeat
  const successRate = useMemo(() => {
    if (!heartbeat) return null;
    const captured = heartbeat.orders_captured_total || 0;
    const failures = heartbeat.failures_total || 0;
    const total = captured + failures;
    if (total === 0) return null;
    return (captured / total) * 100;
  }, [heartbeat]);

  // Uptime: % do tempo nas últimas 24h com heartbeat válido
  const uptimePct = useMemo(() => {
    if (!heartbeat?.last_polled_at) return 0;
    const ageMs = Date.now() - new Date(heartbeat.last_polled_at).getTime();
    // Se último ping < 90s = online (100%). Senão diminui proporcionalmente até 24h.
    if (ageMs < 90_000) return 100;
    const dayMs = 24 * 3600_000;
    return Math.max(0, 100 - (ageMs / dayMs) * 100);
  }, [heartbeat]);

  const ifoodOrdersCount = orders.filter((o) => o.order_source === "ifood").length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/painel/ifood-bot">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Métricas do Bot iFood
            </h1>
            <p className="text-sm text-muted-foreground">
              Dashboard de performance e captura de pedidos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border bg-card">
            {(["today", "7d", "30d"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "today" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos iFood
            </CardTitle>
            <Activity className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{ifoodOrdersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {period === "today" ? "Hoje" : period === "7d" ? "Últimos 7 dias" : "Últimos 30 dias"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Sucesso
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {successRate !== null ? `${successRate.toFixed(1)}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {heartbeat
                ? `${heartbeat.orders_captured_total} ok / ${heartbeat.failures_total} falhas`
                : "Sem dados"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo Bot → Admin
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {avgBotToAdmin !== null ? `${avgBotToAdmin.toFixed(1)}s` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Média de {externals.filter((e) => e.sent_to_menu_at).length} pedido(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Uptime do Bot
            </CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{uptimePct.toFixed(0)}%</div>
            <div className="mt-1">
              <Badge variant={uptimePct > 90 ? "default" : "destructive"} className="text-xs">
                {uptimePct > 90 ? "Online" : "Degradado"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pedidos por hora */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos por {periodToHours(period) > 24 ? "dia" : "hora"} — comparativo por canal</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersByHour.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
              Sem pedidos no período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ordersByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="ifood" name="iFood" fill={SOURCE_COLORS.ifood} stackId="a" />
                <Bar dataKey="site" name="Site" fill={SOURCE_COLORS.site} stackId="a" />
                <Bar dataKey="whatsapp" name="WhatsApp" fill={SOURCE_COLORS.whatsapp} stackId="a" />
                <Bar dataKey="pdv" name="PDV" fill={SOURCE_COLORS.pdv_admin} stackId="a" />
                <Bar dataKey="outros" name="Outros" fill="hsl(var(--muted))" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pizza de canais */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por canal</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceDistribution.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                Sem dados
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sourceDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {sourceDistribution.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Latência captura → admin */}
        <Card>
          <CardHeader>
            <CardTitle>Tempo de captura por pedido (últimos)</CardTitle>
          </CardHeader>
          <CardContent>
            {externals.filter((e) => e.sent_to_menu_at).length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                Sem capturas registradas
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={externals
                    .filter((e) => e.sent_to_menu_at)
                    .slice(0, 30)
                    .reverse()
                    .map((e, i) => ({
                      idx: `#${i + 1}`,
                      seconds:
                        (new Date(e.sent_to_menu_at!).getTime() -
                          new Date(e.first_seen_at).getTime()) /
                        1000,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="idx" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    label={{ value: "seg", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(v: number) => `${v.toFixed(1)}s`}
                  />
                  <Line
                    type="monotone"
                    dataKey="seconds"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
