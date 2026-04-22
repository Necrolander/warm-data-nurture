import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

const CartDrawer = ({ open, onClose }: CartDrawerProps) => {
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const navigate = useNavigate();

  const goToCheckout = () => {
    onClose();
    navigate("/finalizar");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">Seu Pedido 🛒</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>Seu carrinho está vazio</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {items.map((item) => {
                    const extrasTotal = item.extras.reduce((s, e) => s + e.price * (e.quantity || 1), 0);
                    const itemTotal = (item.product.price + extrasTotal) * item.quantity;
                    return (
                      <div key={item.id} className="bg-muted rounded-xl p-4">
                        <div className="flex gap-3">
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-foreground text-sm truncate">{item.product.name}</h4>
                            {item.extras.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate">
                                + {item.extras.map((e) => `${(e.quantity || 1) > 1 ? `${e.quantity}x ` : ""}${e.name}`).join(", ")}
                              </p>
                            )}
                            {item.observation && (
                              <p className="text-xs text-muted-foreground italic truncate">
                                Obs: {item.observation}
                              </p>
                            )}
                            <p className="text-primary font-bold text-sm mt-1">
                              R$ {itemTotal.toFixed(2).replace(".", ",")}
                            </p>
                          </div>
                          <button onClick={() => removeItem(item.id)} className="text-destructive self-start">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-end gap-3 mt-3">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center"
                          >
                            <Minus className="w-4 h-4 text-foreground" />
                          </button>
                          <span className="text-foreground font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border p-5 space-y-3">
                  <div className="flex justify-between text-foreground">
                    <span>Subtotal</span>
                    <span className="font-bold">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={goToCheckout}
                    className="w-full bg-secondary text-secondary-foreground font-bold text-lg py-4 rounded-xl shadow-lg shadow-secondary/30 hover:brightness-110 transition-all"
                  >
                    Finalizar pedido
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
