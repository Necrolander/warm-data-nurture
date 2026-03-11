import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

interface FloatingCartProps {
  onClick: () => void;
}

const FloatingCart = ({ onClick }: FloatingCartProps) => {
  const { totalItems, subtotal } = useCart();

  return (
    <AnimatePresence>
      {totalItems > 0 && (
        <motion.button
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClick}
          className="fixed bottom-4 left-4 right-4 z-40 bg-primary text-primary-foreground font-bold text-lg py-4 px-6 rounded-xl shadow-2xl shadow-primary/40 flex items-center justify-between max-w-lg mx-auto"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="w-6 h-6" />
              <span className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {totalItems}
              </span>
            </div>
            <span>Ver carrinho</span>
          </div>
          <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default FloatingCart;
