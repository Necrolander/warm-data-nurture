import { lazy, Suspense, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "@/contexts/CartContext";
import { getDeliveryFeeSync } from "@/utils/delivery";
import { sendWhatsAppOrder } from "@/utils/whatsapp";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStoreSettings } from "@/hooks/usePublicData";
import { useQuery } from "@tanstack/react-query";

const MapPicker = lazy(() => import("@/components/MapPicker"));

const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão na entrega"];

const Checkout = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { data: settings } = useStoreSettings();

  const { data: deliveryFees } = useQuery({
    queryKey: ["public-delivery-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_fees")
        .select("max_km, fee")
        .order("max_km", { ascending: true });
      if (error) throw error;
      return (data || []).map((f) => ({ max_km: Number(f.max_km), fee: Number(f.fee) }));
    },
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [observation, setObservation] = useState("");
  const [payment, setPayment] = useState("");
  const [change, setChange] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const minOrder = settings?.min_order ? parseFloat(settings.min_order) : 10;
  const storeName = settings?.store_name || "Truebox Hamburgueria";
  const storePhone = settings?.whatsapp_phone || "5561996179376";

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-foreground text-lg mb-4">Seu carrinho está vazio 😢</p>
        <button onClick={() => navigate("/")} className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl">
          Ver cardápio
        </button>
      </div>
    );
  }

  const fees = deliveryFees || [];
  const deliveryInfo = location ? getDeliveryFeeSync(location.lat, location.lng, fees) : null;
  const deliveryFee = deliveryInfo?.fee ?? 0;
  const outOfRange = location && !deliveryInfo;
  const total = subtotal + deliveryFee;

  // Change calculation
  const changeVal = parseFloat(change);
  const changeNeeded = payment === "Dinheiro" && !isNaN(changeVal) && changeVal > total
    ? changeVal - total
    : null;

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Informe seu nome"); return; }
    if (!phone.trim()) { toast.error("Informe seu telefone"); return; }
    if (!payment) { toast.error("Escolha a forma de pagamento"); return; }
    if (!location) { toast.error("Marque sua localização no mapa"); return; }
    if (outOfRange) { toast.error("Fora da área de entrega"); return; }
    if (subtotal < minOrder) {
      toast.error(`Pedido mínimo: R$ ${minOrder.toFixed(2).replace(".", ",")}`);
      return;
    }

    setSubmitting(true);

    try {
      // Map payment to DB enum
      const paymentMap: Record<string, string> = {
        "Pix": "pix",
        "Dinheiro": "cash",
        "Cartão na entrega": "credit_card",
      };

      // Generate ID client-side to avoid needing SELECT policy
      const orderId = crypto.randomUUID();

      // Save order to DB
      const { error: orderError } = await supabase
        .from("orders")
        .insert({
          id: orderId,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          reference: reference.trim() || null,
          observation: observation.trim() || null,
          payment_method: paymentMap[payment] as any,
          change_for: payment === "Dinheiro" && !isNaN(changeVal) ? changeVal : null,
          order_type: "delivery" as const,
          subtotal,
          delivery_fee: deliveryFee,
          total,
          delivery_lat: location.lat,
          delivery_lng: location.lng,
          status: "pending" as const,
        });

      if (orderError) throw orderError;

      // Save order items
      const orderItems = items.map((item) => ({
        order_id: orderId,
        product_name: item.product.name,
        product_price: item.product.price,
        quantity: item.quantity,
        extras: item.extras.map((e) => ({ name: e.name, price: e.price })),
        observation: item.observation || null,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // Send WhatsApp
      sendWhatsAppOrder({
        name: name.trim(),
        phone: phone.trim(),
        reference: reference.trim(),
        observation: observation.trim(),
        payment,
        change: payment === "Dinheiro" ? change.trim() : undefined,
        items,
        subtotal,
        deliveryFee,
        total,
        location,
        storeName,
        storePhone,
      });

      clearCart();
      toast.success("Pedido enviado com sucesso! 🎉");
      navigate("/");
    } catch (err) {
      console.error("Order error:", err);
      toast.error("Erro ao salvar pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-20 bg-card border-b border-border p-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-black text-foreground">Finalizar pedido</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-5 space-y-5">
        <div className="bg-card border border-primary/40 rounded-xl p-4 shadow-lg shadow-primary/10">
          <p className="text-primary text-xs font-black uppercase tracking-wide mb-1">Passo final</p>
          <h2 className="text-2xl font-black text-foreground">Finalize seu pedido aqui</h2>
          <p className="text-sm text-muted-foreground mt-1">1) Seus dados • 2) Mapa • 3) Enviar no WhatsApp</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-black text-foreground">Resumo do pedido</h3>
          {items.map((item) => {
            const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
            return (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-foreground">
                  {item.quantity}x {item.product.name}
                </span>
                <span className="text-primary font-black">
                  R$ {((item.product.price + extrasTotal) * item.quantity).toFixed(2).replace(".", ",")}
                </span>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 bg-card rounded-xl border border-border p-4">
          <h3 className="font-black text-foreground">Seus dados</h3>
          <input
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full bg-background border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            placeholder="Telefone (WhatsApp)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            type="tel"
            className="w-full bg-background border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            placeholder="Ponto de referência"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={200}
            className="w-full bg-background border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            placeholder="Observação do pedido"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            maxLength={500}
            className="w-full bg-background border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-3 bg-card rounded-xl border border-border p-4">
          <h3 className="font-black text-foreground">Forma de pagamento</h3>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setPayment(m)}
                className={`py-3 rounded-xl text-sm font-bold border transition-colors ${
                  payment === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {payment === "Dinheiro" && (
            <div className="space-y-2">
              <input
                placeholder="Troco para quanto? (ex: 100)"
                value={change}
                onChange={(e) => setChange(e.target.value)}
                type="number"
                className="w-full bg-background border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {changeNeeded !== null && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-sm">
                  <span className="text-muted-foreground">Troco necessário: </span>
                  <span className="text-primary font-black">R$ {changeNeeded.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              {payment === "Dinheiro" && !isNaN(changeVal) && changeVal > 0 && changeVal <= total && (
                <p className="text-destructive text-xs font-bold">
                  ⚠️ O valor precisa ser maior que R$ {total.toFixed(2).replace(".", ",")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-primary/30 p-4">
          <h3 className="font-black text-foreground mb-3">Marque sua casa no mapa para entrega</h3>
          <Suspense fallback={<div className="h-64 bg-muted rounded-xl flex items-center justify-center text-muted-foreground">Carregando mapa...</div>}>
            <MapPicker onLocationSelect={(lat, lng) => setLocation({ lat, lng })} selectedLocation={location} />
          </Suspense>
        </div>

        {outOfRange && (
          <div className="bg-destructive/10 border border-destructive text-destructive rounded-xl p-4 text-sm font-bold text-center">
            😔 No momento não entregamos nessa região.
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <div className="flex justify-between text-foreground">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
          </div>
          <div className="flex justify-between text-foreground">
            <span>Taxa de entrega</span>
            <span>
              {location ? (deliveryInfo ? `R$ ${deliveryFee.toFixed(2).replace(".", ",")} (${deliveryInfo.distance.toFixed(1)} km)` : "—") : "Marque no mapa"}
            </span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between text-foreground font-black text-xl">
            <span>Total</span>
            <span className="text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={outOfRange === true || submitting}
          className="w-full bg-[hsl(142,71%,45%)] text-white font-black text-lg py-5 rounded-xl shadow-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Enviando..." : "Enviar pedido pelo WhatsApp 📲"}
        </motion.button>
      </div>
    </div>
  );
};

export default Checkout;
