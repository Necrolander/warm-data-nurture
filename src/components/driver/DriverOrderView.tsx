import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MapPin, Navigation, Package, Phone, AlertTriangle,
  CheckCircle, Truck, GlassWater
} from "lucide-react";
import { toast } from "sonner";

interface DriverOrderViewProps {
  order: any;
  items: any[];
  orderStatus: string;
  onUpdateStatus: (status: string) => void;
  onOpenNavigation: () => void;
  onReportProblem: () => void;
  driverId: string;
}

const DriverOrderView = ({
  order, items, orderStatus, onUpdateStatus, onOpenNavigation, onReportProblem, driverId
}: DriverOrderViewProps) => {
  const [showVerification, setShowVerification] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  // Separate drinks from other items
  const drinks = items.filter(i =>
    /coca|guaraná|suco|água|refrigerante|cerveja|lata|pet|drink|bebida/i.test(i.product_name)
  );
  const otherItems = items.filter(i => !drinks.includes(i));

  const handleVerifyCode = async () => {
    // Fetch fresh order to get the code
    const { data: freshOrder } = await supabase
      .from("orders")
      .select("delivery_code")
      .eq("id", order.id)
      .single();

    if (freshOrder?.delivery_code === confirmCode.trim()) {
      setCodeError(false);
      setShowVerification(false);
      setConfirmCode("");
      onUpdateStatus("delivered");
    } else {
      setCodeError(true);
      toast.error("Código incorreto! Peça o código correto ao cliente.");
    }
  };

  const statusSteps = [
    { key: "ready", label: "Retirar Pedido", icon: Package, action: "out_for_delivery" },
    { key: "out_for_delivery", label: "Cheguei ao Destino", icon: MapPin, action: "arrived" },
  ];

  return (
    <div className="space-y-4">
      {/* Order header */}
      <Card className="border-primary">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">PEDIDO ATIVO</p>
              <p className="text-2xl font-bold text-foreground">#{order.order_number}</p>
            </div>
            <Badge className="text-sm px-3 py-1">
              {orderStatus === "ready" && "📦 Retirar"}
              {orderStatus === "out_for_delivery" && "🛵 Em entrega"}
            </Badge>
          </div>

          <div className="space-y-2">
            <p className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {order.observation || order.reference || "Sem endereço"}
            </p>
            {order.customer_phone && (
              <a href={`tel:${order.customer_phone}`} className="text-sm flex items-center gap-2 text-primary">
                <Phone className="h-4 w-4" />
                {order.customer_phone}
              </a>
            )}
            <p className="text-sm flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Total: R$ {Number(order.total).toFixed(2).replace(".", ",")} •{" "}
              {order.payment_method === "cash" ? "Dinheiro" :
               order.payment_method === "pix" ? "PIX" : "Cartão"}
              {order.change_for ? ` (Troco p/ R$ ${Number(order.change_for).toFixed(2).replace(".", ",")})` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation button */}
      <Button onClick={onOpenNavigation} className="w-full" size="lg" variant="outline">
        <Navigation className="h-5 w-5 mr-2" />
        Abrir Navegação (Google Maps)
      </Button>

      {/* Verification screen before deliver */}
      {showVerification ? (
        <Card className="border-2 border-yellow-500">
          <CardContent className="p-4 space-y-4">
            <div className="bg-yellow-500/10 rounded-xl p-4 text-center">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="font-bold text-foreground">ATENÇÃO</p>
              <p className="text-sm text-muted-foreground mt-1">
                VERIFIQUE A COMANDA ANTES DE FINALIZAR A ENTREGA.
              </p>
              <p className="text-sm text-muted-foreground font-medium">
                CONFIRA COM O CLIENTE SE TODOS OS ITENS FORAM ENTREGUES.
              </p>
            </div>

            {/* Order items list */}
            <div className="space-y-2">
              <p className="font-bold text-sm">Pedido #{order.order_number}</p>
              {otherItems.map((item, i) => (
                <p key={i} className="text-sm text-foreground">
                  {item.quantity}x {item.product_name}
                </p>
              ))}

              {drinks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="font-bold text-sm flex items-center gap-1 text-blue-500">
                    <GlassWater className="h-4 w-4" /> BEBIDAS NO PEDIDO:
                  </p>
                  {drinks.map((item, i) => (
                    <p key={i} className="text-sm text-foreground mt-1">
                      {item.quantity}x {item.product_name}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Confirmation code input */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Código de confirmação da entrega:
              </p>
              <Input
                value={confirmCode}
                onChange={(e) => { setConfirmCode(e.target.value); setCodeError(false); }}
                placeholder="Digite o código do cliente"
                className={`text-center text-2xl font-bold tracking-widest ${
                  codeError ? "border-destructive" : ""
                }`}
                maxLength={4}
              />
              {codeError && (
                <p className="text-sm text-destructive text-center">
                  ❌ Código incorreto! Peça o código correto ao cliente.
                </p>
              )}
              <Button onClick={handleVerifyCode} className="w-full" size="lg" disabled={confirmCode.length < 4}>
                <CheckCircle className="h-5 w-5 mr-2" />
                Confirmar Entrega
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => { setShowVerification(false); setConfirmCode(""); setCodeError(false); }}
              >
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Action buttons based on status */
        <div className="space-y-2">
          {orderStatus === "out_for_delivery" && (
            <Button
              onClick={() => setShowVerification(true)}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Entregar Pedido
            </Button>
          )}

          <Button variant="destructive" onClick={onReportProblem} className="w-full" size="lg">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Problema na Entrega
          </Button>
        </div>
      )}
    </div>
  );
};

export default DriverOrderView;
