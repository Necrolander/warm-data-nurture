import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "@/contexts/CartContext";
import { getDeliveryFee } from "@/utils/delivery";
import { sendWhatsAppOrder } from "@/utils/whatsapp";
import { toast } from "sonner";
import { STORE_CONFIG } from "@/config/store";

const MapPicker = lazy(() => import("@/components/MapPicker"));

const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão na entrega"];

const Checkout = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [observation, setObservation] = useState("");
  const [payment, setPayment] = useState("");
  const [change, setChange] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-foreground text-lg mb-4">Seu carrinho está vazio 😢</p>
        <button
          onClick={() => navigate("/")}
          className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl"
        >
          Ver cardápio
        </button>
      </div>
    );
  }

  const deliveryInfo = location ? getDeliveryFee(location.lat, location.lng) : null;
  const deliveryFee = deliveryInfo?.fee ?? 0;
  const outOfRange = location && !deliveryInfo;
  const total = subtotal + deliveryFee;

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Informe seu nome"); return; }
    if (!phone.trim()) { toast.error("Informe seu telefone"); return; }
    if (!payment) { toast.error("Escolha a forma de pagamento"); return; }
    if (!location) { toast.error("Marque sua localização no mapa"); return; }
    if (outOfRange) { toast.error("Fora da área de entrega"); return; }
    if (subtotal < STORE_CONFIG.minOrder) {
      toast.error(`Pedido mínimo: R$ ${STORE_CONFIG.minOrder.toFixed(2).replace(".", ",")}`);
      return;
    }

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
    });

    clearCart();
    toast.success("Pedido enviado com sucesso! 🎉");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border p-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Finalizar pedido</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-6 space-y-6">
        {/* Order summary */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-bold text-foreground">Resumo do pedido</h3>
          {items.map((item) => {
            const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
            return (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-foreground">
                  {item.quantity}x {item.product.name}
                </span>
                <span className="text-primary font-bold">
                  R$ {((item.product.price + extrasTotal) * item.quantity).toFixed(2).replace(".", ",")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Personal info */}
        <div className="space-y-3">
          <h3 className="font-bold text-foreground">Seus dados</h3>
          <input
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full bg-card border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            placeholder="Telefone (WhatsApp)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            type="tel"
            className="w-full bg-card border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            placeholder="Ponto de referência"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={200}
            className="w-full bg-card border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            placeholder="Observação do pedido"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            maxLength={500}
            className="w-full bg-card border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Payment */}
        <div className="space-y-3">
          <h3 className="font-bold text-foreground">Forma de pagamento</h3>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setPayment(m)}
                className={`py-3 rounded-xl text-sm font-bold border transition-colors ${
                  payment === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {payment === "Dinheiro" && (
            <input
              placeholder="Troco para quanto?"
              value={change}
              onChange={(e) => setChange(e.target.value)}
              className="w-full bg-card border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </div>

        {/* Map */}
        <div>
          <h3 className="font-bold text-foreground mb-3">Localização da entrega</h3>
          <Suspense fallback={<div className="h-64 bg-muted rounded-xl flex items-center justify-center text-muted-foreground">Carregando mapa...</div>}>
            <MapPicker onLocationSelect={(lat, lng) => setLocation({ lat, lng })} selectedLocation={location} />
          </Suspense>
        </div>

        {outOfRange && (
          <div className="bg-destructive/10 border border-destructive text-destructive rounded-xl p-4 text-sm font-bold text-center">
            😔 No momento não entregamos nessa região.
          </div>
        )}

        {/* Totals */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <div className="flex justify-between text-foreground">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
          </div>
          <div className="flex justify-between text-foreground">
            <span>Taxa de entrega</span>
            <span>
              {location
                ? deliveryInfo
                  ? `R$ ${deliveryFee.toFixed(2).replace(".", ",")} (${deliveryInfo.distance.toFixed(1)} km)`
                  : "—"
                : "Marque no mapa"}
            </span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between text-foreground font-black text-lg">
            <span>Total</span>
            <span className="text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>

        {/* Submit */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={outOfRange === true}
          className="w-full bg-success text-success-foreground font-bold text-lg py-4 rounded-xl shadow-lg shadow-success/30 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enviar pedido pelo WhatsApp 📲
        </motion.button>
      </div>
    </div>
  );
};

export default Checkout;
