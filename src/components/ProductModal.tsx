import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus } from "lucide-react";
import { Product, Extra, EXTRAS } from "@/data/products";
import { useCart } from "@/contexts/CartContext";

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

const ProductModal = ({ product, onClose }: ProductModalProps) => {
  const { addItem } = useCart();
  const [selectedExtras, setSelectedExtras] = useState<Extra[]>([]);
  const [observation, setObservation] = useState("");

  if (!product) return null;

  const availableExtras = product.extras || EXTRAS;

  const toggleExtra = (extra: Extra) => {
    setSelectedExtras((prev) =>
      prev.find((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const extrasTotal = selectedExtras.reduce((s, e) => s + e.price, 0);
  const total = product.price + extrasTotal;

  const handleAdd = () => {
    addItem(product, selectedExtras, observation);
    setSelectedExtras([]);
    setObservation("");
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border"
        >
          {/* Image */}
          <div className="relative h-56">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-background/80 rounded-full p-2"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
            {product.badges && product.badges.length > 0 && (
              <div className="absolute bottom-3 left-3 flex gap-1">
                {product.badges.map((b) => (
                  <span key={b} className="bg-secondary text-secondary-foreground text-xs font-bold px-2 py-1 rounded-full">
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-5">
            <h2 className="text-2xl font-black text-foreground">{product.name}</h2>
            <p className="text-muted-foreground mt-1">{product.description}</p>
            <p className="text-primary font-black text-2xl mt-2">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </p>

            {/* Extras */}
            <div className="mt-5">
              <h3 className="font-bold text-foreground mb-3">Adicionais</h3>
              <div className="space-y-2">
                {availableExtras.map((extra) => {
                  const selected = selectedExtras.find((e) => e.id === extra.id);
                  return (
                    <button
                      key={extra.id}
                      onClick={() => toggleExtra(extra)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <span className="text-foreground">{extra.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-bold text-sm">
                          + R$ {extra.price.toFixed(2).replace(".", ",")}
                        </span>
                        {selected ? (
                          <Minus className="w-4 h-4 text-primary" />
                        ) : (
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Observation */}
            <div className="mt-5">
              <label className="text-sm text-muted-foreground">Alguma observação no lanche?</label>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: sem cebola, molho à parte..."
                className="w-full mt-1 bg-background border border-border rounded-lg p-3 text-foreground placeholder:text-muted-foreground text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Add button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAdd}
              className="w-full mt-5 bg-primary text-primary-foreground font-bold text-lg py-4 rounded-xl shadow-lg shadow-primary/30 hover:brightness-110 transition-all"
            >
              Adicionar ao pedido — R$ {total.toFixed(2).replace(".", ",")}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProductModal;
