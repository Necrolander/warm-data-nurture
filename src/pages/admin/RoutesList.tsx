import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Route, User, Clock, MapPin, Play, Ban, RefreshCw, UserPlus } from "lucide-react";
import { manualAssignDriver, autoAssignDriver, updateRouteStatus } from "@/services/routing";

const statusLabels: Record<string, { label: string; color: string }> = {
  created: { label: "Criada", color: "bg-gray-500" },
  awaiting_driver: { label: "Aguardando", color: "bg-yellow-500" },
  assigned: { label: "Atribuída", color: "bg-blue-500" },
  in_delivery: { label: "Em Entrega", color: "bg-green-500" },
  completed: { label: "Finalizada", color: "bg-emerald-600" },
  cancelled: { label: "Cancelada", color: "bg-red-500" },
};

const RoutesList = () => {
  const [routes, setRoutes] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignRouteId, setAssignRouteId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [{ data: routesData }, { data: driversData }] = await Promise.all([
      supabase.from("routes").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("delivery_persons").select("*").eq("is_active", true),
    ]);

    // Fetch route orders for each route
    const routeIds = (routesData || []).map((r: any) => r.id);
    const { data: routeOrders } = routeIds.length > 0
      ? await supabase.from("route_orders").select("*, orders:order_id(id, order_number, customer_name, status)").in("route_id", routeIds).order("stop_order")
      : { data: [] };

    const routesWithStops = (routesData || []).map((r: any) => ({
      ...r,
      stops: (routeOrders || []).filter((ro: any) => ro.route_id === r.id),
      driver: (driversData || []).find((d: any) => d.id === r.driver_id),
    }));

    setRoutes(routesWithStops);
    setDrivers(driversData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const channel = supabase.channel("routes-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "routes" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAutoAssign = async (routeId: string) => {
    const driverId = await autoAssignDriver(routeId);
    if (driverId) {
      toast.success("Motoboy atribuído automaticamente!");
      loadData();
    } else {
      toast.error("Nenhum motoboy disponível");
    }
  };

  const handleManualAssign = async (routeId: string, driverId: string) => {
    const ok = await manualAssignDriver(routeId, driverId);
    if (ok) {
      toast.success("Motoboy atribuído!");
      setAssignRouteId(null);
      loadData();
    } else {
      toast.error("Erro ao atribuir");
    }
  };

  const handleStatusChange = async (routeId: string, status: string) => {
    await updateRouteStatus(routeId, status);
    toast.success(`Rota ${statusLabels[status]?.label || status}`);
    loadData();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Rotas</h2>
        <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="w-4 h-4 mr-1" /> Atualizar</Button>
      </div>

      {routes.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma rota criada ainda.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => {
            const st = statusLabels[route.status] || { label: route.status, color: "bg-gray-500" };
            return (
              <Card key={route.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Route className="w-4 h-4 text-primary" />
                        <span className="font-bold text-foreground">{route.code}</span>
                        <Badge className={`${st.color} text-white text-xs`}>{st.label}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span><MapPin className="w-3 h-3 inline" /> {route.total_distance_km?.toFixed(1)}km</span>
                        <span><Clock className="w-3 h-3 inline" /> {route.estimated_duration_min}min</span>
                        <span>{route.stops?.length || 0} parada(s)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {route.driver ? (
                        <Badge variant="outline" className="gap-1">
                          <User className="w-3 h-3" /> {route.driver.name}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 text-xs">Sem motoboy</Badge>
                      )}
                    </div>
                  </div>

                  {/* Stops */}
                  <div className="mt-3 space-y-1">
                    {(route.stops || []).map((stop: any, i: number) => (
                      <div key={stop.id} className="flex items-center gap-2 text-sm pl-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</span>
                        <span className="text-foreground">
                          #{stop.orders?.order_number} - {stop.orders?.customer_name}
                        </span>
                        <Badge variant="outline" className="text-xs ml-auto">{stop.orders?.status}</Badge>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!route.driver_id && (route.status === "created" || route.status === "awaiting_driver") && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleAutoAssign(route.id)}>
                          <UserPlus className="w-3 h-3 mr-1" /> Auto-atribuir
                        </Button>
                        <Dialog open={assignRouteId === route.id} onOpenChange={(o) => setAssignRouteId(o ? route.id : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline"><User className="w-3 h-3 mr-1" /> Escolher Motoboy</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Escolher Motoboy</DialogTitle></DialogHeader>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {drivers.filter(d => d.is_online).map(d => (
                                <Button key={d.id} variant="outline" className="w-full justify-start gap-2" onClick={() => handleManualAssign(route.id, d.id)}>
                                  <User className="w-4 h-4" />
                                  <span className="font-medium">{d.name}</span>
                                  <Badge variant="outline" className="ml-auto text-xs">{(d as any).status || "disponível"}</Badge>
                                </Button>
                              ))}
                              {drivers.filter(d => d.is_online).length === 0 && (
                                <p className="text-center text-muted-foreground text-sm py-4">Nenhum motoboy online</p>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                    {route.status === "assigned" && (
                      <Button size="sm" onClick={() => handleStatusChange(route.id, "in_delivery")}>
                        <Play className="w-3 h-3 mr-1" /> Iniciar Entrega
                      </Button>
                    )}
                    {route.status === "in_delivery" && (
                      <Button size="sm" variant="default" onClick={() => handleStatusChange(route.id, "completed")}>
                        ✓ Finalizar
                      </Button>
                    )}
                    {!["completed", "cancelled"].includes(route.status) && (
                      <Button size="sm" variant="destructive" onClick={() => handleStatusChange(route.id, "cancelled")}>
                        <Ban className="w-3 h-3 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RoutesList;
