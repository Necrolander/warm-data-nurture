import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, ShoppingCart, Check } from "lucide-react";
import { Product, Extra } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { Button } from "./ui/button";

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

const ProductModal = ({ product, onClose }: ProductModalProps) => {
  const { addItem } = useCart();
  const [selectedExtras, setSelectedExtras] = useState<Extra[]>([]);
  const [observation, setObservation] = useState("");
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const availableExtras = product.extras || [];

  const toggleExtra = (extra: Extra) => {
    setSelectedExtras((prev) =>
      prev.find((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const extrasTotal = selectedExtras.reduce((s, e) => s + e.price, 0);
  const unitTotal = product.price + extrasTotal;
  const total = unitTotal * quantity;

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(product, selectedExtras, observation);
    }
    setSelectedExtras([]);
    setObservation("");
    setQuantity(1);
    onClose();
  };

  const handleClose = () => {
    setSelectedExtras([]);
    setObservation("");
    setQuantity(1);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl"
        >
          {/* Image */}
          <div className="relative h-64 sm:h-72">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-background transition-colors"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
            {product.badges && product.badges.length > 0 && (
              <div className="absolute top-4 left-4 flex gap-1.5">
                {product.badges.map((b) => (
                  <span
                    key={b}
                    className="bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-sm"
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 -mt-8 relative">
            {/* Product info */}
            <div className="bg-card rounded-2xl p-4 border border-border shadow-sm mb-4">
              <h2 className="text-2xl font-black text-foreground">{product.name}</h2>
              <p className="text-muted-foreground mt-1 leading-relaxed">{product.description}</p>
              <p className="text-primary font-black text-2xl mt-3">
                R$ {product.price.toFixed(2).replace(".", ",")}
              </p>
            </div>

            {/* Quantity selector */}
            <div className="flex items-center justify-between bg-muted/50 rounded-xl p-4 mb-4">
              <span className="font-bold text-foreground">Quantidade</span>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="bg-background border border-border rounded-full p-2 hover:bg-muted transition-colors disabled:opacity-50"
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4 text-foreground" />
                </button>
                <span className="text-xl font-black text-foreground w-8 text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="bg-primary text-primary-foreground rounded-full p-2 hover:brightness-110 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Extras */}
            {availableExtras.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  🧀 Adicionais
                  <span className="text-xs font-normal text-muted-foreground">Opcional</span>
                </h3>
                <div className="space-y-2">
                  {availableExtras.map((extra) => {
                    const selected = selectedExtras.find((e) => e.id === extra.id);
                    return (
                      <motion.button
                        key={extra.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleExtra(extra)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all duration-200 ${
                          selected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border hover:border-muted-foreground bg-background"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              selected
                                ? "bg-primary border-primary"
                                : "border-muted-foreground"
                            }`}
                          >
                            {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <span className="text-foreground font-medium">{extra.name}</span>
                        </div>
                        <span className="text-primary font-bold text-sm">
                          + R$ {extra.price.toFixed(2).replace(".", ",")}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Observation */}
            <div className="mb-5">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                📝 Alguma observação?
              </label>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: sem cebola, molho à parte..."
                className="w-full bg-background border border-border rounded-xl p-3.5 text-foreground placeholder:text-muted-foreground text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            {/* Add to cart button */}
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                onClick={handleAdd}
                className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/30 gap-2"
                size="lg"
              >
                <ShoppingCart className="w-5 h-5" />
                Adicionar {quantity > 1 ? `(${quantity})` : ""} — R$ {total.toFixed(2).replace(".", ",")}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProductModal;
