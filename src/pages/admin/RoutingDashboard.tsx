import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Package, Truck, MapPin, Users, AlertTriangle, TrendingUp, Route, Clock,
  RefreshCw, Zap,
} from "lucide-react";
import { getOperationalStats, getDemandForecast, optimizeRoutes, createRoute, autoAssignDriver } from "@/services/routing";
import type { DemandForecast } from "@/services/routing/types";

const RoutingDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [forecast, setForecast] = useState<DemandForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [s, f] = await Promise.all([getOperationalStats(), getDemandForecast(3)]);
    setStats(s);
    setForecast(f);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const candidate = await optimizeRoutes();
      if (!candidate) {
        toast.info("Nenhum pedido elegível para roteirização");
        setOptimizing(false);
        return;
      }
      const routeId = await createRoute(candidate);
      if (routeId) {
        toast.success(`Rota criada com ${candidate.stops.length} parada(s)! Distância: ${candidate.totalDistanceKm}km`);
        loadData();
      } else {
        toast.error("Erro ao criar rota");
      }
    } catch (e) {
      toast.error("Erro na otimização");
    }
    setOptimizing(false);
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Dashboard Logístico</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
          <Button size="sm" onClick={handleOptimize} disabled={optimizing || stats.readyForRouting === 0}>
            <Zap className="w-4 h-4 mr-1" /> {optimizing ? "Otimizando..." : "Roteirizar Agora"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats.readyForRouting}</p>
                <p className="text-xs text-muted-foreground">Aguardando Rota</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Route className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalActiveRoutes}</p>
                <p className="text-xs text-muted-foreground">Rotas Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.drivers.total_online}</p>
                <p className="text-xs text-muted-foreground">Motoboys Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.drivers.available}</p>
                <p className="text-xs text-muted-foreground">Disponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Route Status */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Status das Rotas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Criadas</span>
              <Badge variant="secondary">{stats.routes.created}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Aguardando Entregador</span>
              <Badge variant="outline">{stats.routes.awaiting_driver}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Atribuídas</span>
              <Badge className="bg-blue-500">{stats.routes.assigned}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Em Entrega</span>
              <Badge className="bg-green-500">{stats.routes.in_delivery}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Previsão de Demanda
          </CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {forecast.map((f, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {String(f.hour).padStart(2, "0")}:00
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{f.predictedOrders} pedidos</span>
                  <Badge variant="outline" className="text-xs">
                    {f.suggestedDrivers} motoboy{f.suggestedDrivers > 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {stats.readyForRouting > 3 && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <div>
              <p className="font-medium text-foreground">
                {stats.readyForRouting} pedidos aguardando roteirização!
              </p>
              <p className="text-sm text-muted-foreground">
                Considere roteirizar agora ou adicionar mais entregadores.
              </p>
            </div>
            <Button size="sm" className="ml-auto" onClick={handleOptimize} disabled={optimizing}>
              Roteirizar
            </Button>
          </CardContent>
        </Card>
      )}

      {stats.drivers.available === 0 && stats.drivers.total_online > 0 && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <p className="font-medium text-foreground">
              Nenhum motoboy disponível! Todos em rota.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoutingDashboard;
