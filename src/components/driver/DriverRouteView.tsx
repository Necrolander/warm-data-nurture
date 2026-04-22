import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MapPin, Navigation, CheckCircle, Phone, Clock,
  AlertTriangle, Route, GlassWater,
} from "lucide-react";
import { toast } from "sonner";

interface RouteStop {
  id: string;
  order_id: string;
  stop_order: number;
  stop_distance_km: number;
  stop_duration_min: number;
  predicted_eta: string | null;
  order: any;
  items: any[];
}

interface DriverRouteViewProps {
  route: any;
  stops: RouteStop[];
  currentStopIndex: number;
  onCompleteRoute: () => void;
  onReportProblem: (orderId: string) => void;
  onConfirmDelivery: (orderId: string, confirmCode: string) => Promise<void>;
}

const DriverRouteView = ({ route, stops, currentStopIndex, onCompleteRoute, onReportProblem, onConfirmDelivery }: DriverRouteViewProps) => {
  const [showVerification, setShowVerification] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentStop = stops[currentStopIndex];
  const completedStops = stops.filter((_, i) => i < currentStopIndex).length;
  const allDelivered = currentStopIndex >= stops.length;

  const openNavigation = (stop: RouteStop) => {
    if (stop.order?.delivery_lat && stop.order?.delivery_lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${stop.order.delivery_lat},${stop.order.delivery_lng}&travelmode=driving`, "_blank");
    } else {
      const address = stop.order?.reference || stop.order?.observation || "";
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
    }
  };

  const openFullRouteNavigation = () => {
    const remainingStops = stops.filter((_, i) => i >= currentStopIndex);
    if (remainingStops.length === 0) return;

    const waypoints = remainingStops
      .filter((s) => s.order?.delivery_lat && s.order?.delivery_lng)
      .map((s) => `${s.order.delivery_lat},${s.order.delivery_lng}`);

    if (waypoints.length === 0) return;

    const destination = waypoints.pop();
    const waypointStr = waypoints.length > 0 ? `&waypoints=${waypoints.join("|")}` : "";
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}${waypointStr}&travelmode=driving`, "_blank");
  };

  const handleVerifyCode = async () => {
    if (!currentStop) return;
    try {
      setLoading(true);
      await onConfirmDelivery(currentStop.order_id, confirmCode.trim());
      setCodeError(false);
      setShowVerification(false);
      setConfirmCode("");
    } catch (error: any) {
      setCodeError(true);
      toast.error(error?.message || "Código incorreto!");
    } finally {
      setLoading(false);
    }
  };

  const getDrinks = (items: any[]) => items.filter(i => /coca|guaraná|suco|água|refrigerante|cerveja|lata|pet|drink|bebida/i.test(i.product_name));

  return (
    <div className="space-y-4">
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" />
              <span className="font-bold text-lg text-foreground">{route.code}</span>
            </div>
            <Badge className="text-sm">{completedStops}/{stops.length} entregas</Badge>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span><MapPin className="w-3 h-3 inline" /> {route.total_distance_km?.toFixed(1)}km</span>
            <span><Clock className="w-3 h-3 inline" /> ~{route.estimated_duration_min}min</span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={openFullRouteNavigation} className="w-full" size="lg" variant="outline">
        <Navigation className="h-5 w-5 mr-2" />
        Navegar Rota Completa (Google Maps)
      </Button>

      <div className="space-y-2">
        {stops.map((stop, i) => {
          const isCompleted = i < currentStopIndex;
          const isCurrent = i === currentStopIndex;
          const drinks = getDrinks(stop.items || []);
          const otherItems = (stop.items || []).filter((it: any) => !drinks.includes(it));

          return (
            <Card key={stop.id} className={`transition-all ${isCurrent ? "border-primary ring-2 ring-primary/30" : isCompleted ? "opacity-50 border-primary" : "opacity-60"}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isCompleted ? "bg-primary text-primary-foreground" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {isCompleted ? "✓" : i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-foreground text-sm">#{stop.order?.order_number} - {stop.order?.customer_name}</p>
                      {isCompleted && <Badge className="text-xs">Entregue</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {stop.order?.reference || stop.order?.observation || "Sem endereço"}
                    </p>
                    {stop.order?.customer_phone && (
                      <a href={`tel:${stop.order.customer_phone}`} className="text-xs text-primary flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" /> {stop.order.customer_phone}
                      </a>
                    )}

                    {isCurrent && (
                      <div className="mt-2 space-y-1 text-xs">
                        {otherItems.map((item: any, idx: number) => <p key={idx} className="text-foreground">{item.quantity}x {item.product_name}</p>)}
                        {drinks.length > 0 && (
                          <div className="pt-1 border-t border-border mt-1">
                            <p className="font-bold text-primary flex items-center gap-1"><GlassWater className="w-3 h-3" /> Bebidas:</p>
                            {drinks.map((item: any, idx: number) => <p key={idx} className="text-foreground">{item.quantity}x {item.product_name}</p>)}
                          </div>
                        )}
                        <p className="text-muted-foreground mt-1">💰 R$ {Number(stop.order?.total || 0).toFixed(2).replace(".", ",")} • {stop.order?.payment_method === "cash" ? "Dinheiro" : stop.order?.payment_method === "pix" ? "PIX" : "Cartão"}</p>
                      </div>
                    )}

                    {isCurrent && !showVerification && (
                      <div className="mt-3 space-y-2">
                        <Button size="sm" variant="outline" className="w-full" onClick={() => openNavigation(stop)}>
                          <Navigation className="w-3 h-3 mr-1" /> Navegar para esta parada
                        </Button>
                        <Button size="sm" className="w-full" onClick={() => setShowVerification(true)}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Entregar
                        </Button>
                        <Button size="sm" variant="destructive" className="w-full" onClick={() => onReportProblem(stop.order_id)}>
                          <AlertTriangle className="w-3 h-3 mr-1" /> Problema
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {isCurrent && showVerification && (
                  <div className="mt-3 p-3 border border-yellow-500 rounded-lg bg-yellow-500/5 space-y-3">
                    <div className="text-center">
                      <AlertTriangle className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                      <p className="text-sm font-bold">Código de confirmação</p>
                    </div>
                    <Input value={confirmCode} onChange={(e) => { setConfirmCode(e.target.value); setCodeError(false); }} placeholder="Código do cliente" className={`text-center text-xl font-bold tracking-widest ${codeError ? "border-destructive" : ""}`} maxLength={4} />
                    {codeError && <p className="text-xs text-destructive text-center">❌ Código incorreto!</p>}
                    <Button onClick={handleVerifyCode} className="w-full" disabled={confirmCode.length < 4 || loading}>
                      <CheckCircle className="w-4 h-4 mr-1" /> {loading ? "Confirmando..." : "Confirmar"}
                    </Button>
                    <Button variant="ghost" className="w-full text-xs" onClick={() => { setShowVerification(false); setConfirmCode(""); setCodeError(false); }}>
                      Voltar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {allDelivered && (
        <Button onClick={onCompleteRoute} className="w-full" size="lg">
          <CheckCircle className="w-5 h-5 mr-2" /> Finalizar Rota
        </Button>
      )}
    </div>
  );
};

export default DriverRouteView;
