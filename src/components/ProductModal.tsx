import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, ShoppingCart, Check, ChevronDown } from "lucide-react";
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const extraGroups = product?.extraGroups || [];
  const hasGroups = extraGroups.length > 0;

  useEffect(() => {
    if (!product) {
      setExpandedGroups({});
      return;
    }

    const initialExpanded: Record<string, boolean> = {};
    extraGroups.forEach((group, index) => {
      initialExpanded[group.id] = index === 0;
    });
    setExpandedGroups(initialExpanded);
  }, [product?.id]);

  if (!product) return null;

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isExtraSelected = (extraId: string) => !!selectedExtras.find((e) => e.id === extraId);

  const getExtraQuantity = (extraId: string) => {
    const found = selectedExtras.find((e) => e.id === extraId);
    return found?.quantity || 0;
  };

  const getGroupSelectedCount = (groupId: string) => {
    const group = extraGroups.find((g) => g.id === groupId);
    if (!group) return 0;
    return selectedExtras
      .filter((se) => group.extras.some((ge) => ge.id === se.id))
      .reduce((sum, se) => sum + (se.quantity || 1), 0);
  };

  const canSelectInGroup = (groupId: string) => {
    const group = extraGroups.find((g) => g.id === groupId);
    if (!group) return false;
    return getGroupSelectedCount(groupId) < group.max_select;
  };

  const handleChangeExtraQty = (groupId: string, extra: { id: string; name: string; price: number; max_quantity: number }, delta: number) => {
    const currentQty = getExtraQuantity(extra.id);
    const newQty = currentQty + delta;
    const maxPerItem = extra.max_quantity || 99;

    if (newQty <= 0) {
      setSelectedExtras((prev) => prev.filter((e) => e.id !== extra.id));
      return;
    }

    if (newQty > maxPerItem) return;

    if (delta > 0 && !canSelectInGroup(groupId)) return;

    if (currentQty === 0) {
      setSelectedExtras((prev) => [...prev, { id: extra.id, name: extra.name, price: extra.price, quantity: 1 }]);
    } else {
      setSelectedExtras((prev) =>
        prev.map((e) => (e.id === extra.id ? { ...e, quantity: newQty } : e))
      );
    }
  };

  const extrasTotal = selectedExtras.reduce((s, e) => s + e.price * (e.quantity || 1), 0);
  const unitTotal = product.price + extrasTotal;
  const total = unitTotal * quantity;

  const hasUnmetRequirements = extraGroups.some(
    (g) => g.is_required && getGroupSelectedCount(g.id) < g.max_select
  );

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(product, selectedExtras, observation);
    }
    setSelectedExtras([]);
    setObservation("");
    setQuantity(1);
    setExpandedGroups({});
    onClose();
  };

  const handleClose = () => {
    setSelectedExtras([]);
    setObservation("");
    setQuantity(1);
    setExpandedGroups({});
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
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
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
                  <span key={b} className="bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
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
                <span className="text-xl font-black text-foreground w-8 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="bg-primary text-primary-foreground rounded-full p-2 hover:brightness-110 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Grouped Extras */}
            {hasGroups && (
              <div className="mb-4 space-y-3">
                {extraGroups.map((group) => {
                  const isExpanded = !!expandedGroups[group.id];
                  const selectedCount = getGroupSelectedCount(group.id);
                  const isFull = selectedCount >= group.max_select;

                  return (
                    <div key={group.id} className="border border-border rounded-xl overflow-hidden">
                      {/* Group header */}
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground">{group.name}</h3>
                            {group.is_required && (
                              <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full font-bold">
                                Obrigatório
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {group.description || `Escolha até ${group.max_select} ${group.max_select === 1 ? 'item' : 'itens'}`}
                            {selectedCount > 0 && (
                              <span className="text-primary font-bold ml-1">
                                ({selectedCount}/{group.max_select})
                              </span>
                            )}
                          </p>
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>

                      {/* Group items */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="divide-y divide-border">
                              {group.extras.map((extra) => {
                                const selected = isExtraSelected(extra.id);
                                const disabled = !selected && isFull;

                                return (
                                  <button
                                    key={extra.id}
                                    onClick={() => handleToggleGroupExtra(group.id, extra)}
                                    disabled={disabled}
                                    className={`w-full flex items-center justify-between p-3.5 transition-all ${
                                      selected
                                        ? "bg-primary/10"
                                        : disabled
                                        ? "opacity-50 cursor-not-allowed bg-background"
                                        : "hover:bg-muted/30 bg-background"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 text-left">
                                      {extra.image_url && (
                                        <img
                                          src={extra.image_url}
                                          alt={extra.name}
                                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                        />
                                      )}
                                      {!extra.image_url && (
                                        <div
                                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                            selected ? "bg-primary border-primary" : "border-muted-foreground"
                                          }`}
                                        >
                                          {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                                        </div>
                                      )}
                                      <div>
                                        <span className="text-foreground font-medium text-sm">{extra.name}</span>
                                        {extra.description && (
                                          <p className="text-xs text-muted-foreground">{extra.description}</p>
                                        )}
                                      </div>
                                    </div>
                                    {extra.price > 0 && (
                                      <span className="text-primary font-bold text-sm flex-shrink-0 ml-2">
                                        R$ {extra.price.toFixed(2).replace(".", ",")}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Observation */}
            <div className="mb-5">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                📝 Observações
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
              <Button onClick={handleAdd} className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/30 gap-2" size="lg">
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
