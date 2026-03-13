import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Minus, ShoppingCart, Trash2, Search, X, Check } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  description: string | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
}

interface ExtraItem {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  max_quantity: number;
  description: string | null;
}

interface ExtraGroupData {
  id: string;
  name: string;
  max_select: number;
  is_required: boolean;
  applies_to_categories: string[] | null;
  extras: ExtraItem[];
}

interface SelectedExtra {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartItem {
  uid: string;
  product: Product;
  quantity: number;
  extras: SelectedExtra[];
  observation: string;
}

const fallbackImage = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop";

const NewOrder = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [extraGroups, setExtraGroups] = useState<ExtraGroupData[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<"delivery" | "pickup" | "dine_in">("delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reference, setReference] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [observation, setObservation] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expandedCartItem, setExpandedCartItem] = useState<string | null>(null);

  // Extras modal
  const [extrasModal, setExtrasModal] = useState<Product | null>(null);
  const [modalExtras, setModalExtras] = useState<SelectedExtra[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [p, groupRes, extrasRes, c] = await Promise.all([
        supabase.from("products").select("id, name, price, category, image_url, description").eq("is_active", true).order("sort_order"),
        supabase.from("extra_groups").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("product_extras").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("categories").select("id, slug, name, icon").eq("is_active", true).order("sort_order"),
      ]);
      if (p.data) setProducts(p.data);
      if (c.data) setCategories(c.data);

      if (groupRes.data && extrasRes.data) {
        const groups: ExtraGroupData[] = groupRes.data.map((g: any) => ({
          id: g.id,
          name: g.name,
          max_select: g.max_select,
          is_required: g.is_required,
          applies_to_categories: g.applies_to_categories,
          extras: extrasRes.data
            .filter((e: any) => e.group_id === g.id)
            .map((e: any) => ({ id: e.id, name: e.name, price: Number(e.price), max_quantity: e.max_quantity || 4, description: e.description || null, image_url: e.image_url, group_id: e.group_id })),
        })).filter((g: ExtraGroupData) => g.extras.length > 0);
        setExtraGroups(groups);
      }
    };
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    }
    if (activeCategory !== "all") {
      result = result.filter(p => p.category === activeCategory);
    }
    return result;
  }, [products, search, activeCategory]);

  const getProductExtras = (product: Product) => {
    return extraGroups.filter(
      g => !g.applies_to_categories || g.applies_to_categories.length === 0 || g.applies_to_categories.includes(product.category)
    );
  };

  const handleProductClick = (product: Product) => {
    const productExtras = getProductExtras(product);
    if (productExtras.length > 0) {
      setExtrasModal(product);
      setModalExtras([]);
    } else {
      const uid = `${product.id}-${Date.now()}`;
      setCart(prev => [...prev, { uid, product, quantity: 1, extras: [], observation: "" }]);
      toast.success(`${product.name} adicionado!`, { duration: 1500 });
    }
  };

  const confirmModalExtras = () => {
    if (extrasModal) {
      const uid = `${extrasModal.id}-${Date.now()}`;
      setCart(prev => [...prev, { uid, product: extrasModal, quantity: 1, extras: modalExtras, observation: "" }]);
      toast.success(`${extrasModal.name} adicionado!`, { duration: 1500 });
      setExtrasModal(null);
      setModalExtras([]);
    }
  };

  const getModalExtraQty = (extraId: string) => {
    const found = modalExtras.find(e => e.id === extraId);
    return found?.quantity || 0;
  };

  const getModalGroupCount = (groupId: string) => {
    const group = extraGroups.find(g => g.id === groupId);
    if (!group) return 0;
    return modalExtras
      .filter(se => group.extras.some(e => e.id === se.id))
      .reduce((sum, se) => sum + se.quantity, 0);
  };

  const changeModalExtraQty = (extra: ExtraItem, groupId: string, delta: number) => {
    const group = extraGroups.find(g => g.id === groupId);
    if (!group) return;
    const currentQty = getModalExtraQty(extra.id);
    const newQty = currentQty + delta;
    const maxPerItem = extra.max_quantity || 99;

    if (newQty <= 0) {
      setModalExtras(prev => prev.filter(e => e.id !== extra.id));
      return;
    }
    if (newQty > maxPerItem) return;

    if (delta > 0 && getModalGroupCount(groupId) >= group.max_select) {
      toast.error(`Máximo de ${group.max_select} para ${group.name}`);
      return;
    }

    if (currentQty === 0) {
      setModalExtras(prev => [...prev, { id: extra.id, name: extra.name, price: extra.price, quantity: 1 }]);
    } else {
      setModalExtras(prev => prev.map(e => e.id === extra.id ? { ...e, quantity: newQty } : e));
    }
  };

  const hasModalUnmetRequirements = extrasModal ? getProductExtras(extrasModal).some(
    g => g.is_required && getModalGroupCount(g.id) < g.max_select
  ) : false;

  const updateQuantity = (uid: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.uid !== uid) return c;
      const newQty = c.quantity + delta;
      return newQty > 0 ? { ...c, quantity: newQty } : c;
    }).filter(c => c.quantity > 0));
  };

  const removeItem = (uid: string) => {
    setCart(cart.filter(c => c.uid !== uid));
    if (expandedCartItem === uid) setExpandedCartItem(null);
  };

  const updateItemObservation = (uid: string, obs: string) => {
    setCart(cart.map(c => c.uid === uid ? { ...c, observation: obs } : c));
  };

  const subtotal = cart.reduce((sum, c) => {
    const extrasTotal = c.extras.reduce((s, e) => s + Number(e.price) * (e.quantity || 1), 0);
    return sum + (Number(c.product.price) + extrasTotal) * c.quantity;
  }, 0);

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

  const placeOrder = async () => {
    if (!customerName.trim()) { toast.error("Preencha o nome do cliente"); return; }
    if (cart.length === 0) { toast.error("Adicione itens ao pedido"); return; }
    setLoading(true);

    const { data: order, error } = await supabase.from("orders").insert({
      customer_name: customerName,
      customer_phone: customerPhone,
      order_type: orderType,
      payment_method: paymentMethod as any,
      subtotal,
      delivery_fee: 0,
      total: subtotal,
      reference,
      observation,
      table_number: orderType === "dine_in" ? parseInt(tableNumber) || null : null,
      status: "production" as any,
    }).select().single();

    if (error || !order) {
      toast.error("Erro ao criar pedido");
      setLoading(false);
      return;
    }

    const items = cart.map(c => ({
      order_id: order.id,
      product_name: c.product.name,
      product_price: c.product.price,
      quantity: c.quantity,
      extras: c.extras.map(e => ({ name: e.name, price: e.price })),
      observation: c.observation,
    }));

    await supabase.from("order_items").insert(items);

    toast.success(`Pedido #${order.order_number} criado com sucesso! 🎉`);
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setReference("");
    setObservation("");
    setTableNumber("");
    setExpandedCartItem(null);
    setLoading(false);
  };

  const getCartItemTotal = (item: CartItem) => {
    const extrasTotal = item.extras.reduce((s, e) => s + Number(e.price) * (e.quantity || 1), 0);
    return (Number(item.product.price) + extrasTotal) * item.quantity;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(100vh-120px)]">
      {/* Products panel - 3 cols */}
      <div className="lg:col-span-3 flex flex-col min-h-0">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-10 pr-10" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide shrink-0">
          <button
            onClick={() => setActiveCategory("all")}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeCategory === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.slug)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeCategory === cat.slug ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map(product => {
                const inCartCount = cart.filter(c => c.product.id === product.id).reduce((s, c) => s + c.quantity, 0);
                return (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card
                      className={`cursor-pointer overflow-hidden transition-all hover:shadow-md group relative ${
                        inCartCount > 0 ? "ring-2 ring-primary" : "hover:border-primary/50"
                      }`}
                      onClick={() => handleProductClick(product)}
                    >
                      <div className="relative h-24 sm:h-28 overflow-hidden bg-muted">
                        <img
                          src={product.image_url || fallbackImage}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                        {inCartCount > 0 && (
                          <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
                            {inCartCount}
                          </div>
                        )}
                        <div className="absolute bottom-1.5 right-1.5">
                          <span className="bg-primary/90 backdrop-blur-sm text-primary-foreground font-bold text-xs px-2 py-0.5 rounded-md">
                            R$ {Number(product.price).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      </div>
                      <CardContent className="p-2">
                        <p className="font-semibold text-xs sm:text-sm truncate text-foreground">{product.name}</p>
                        {product.description && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{product.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-muted-foreground text-sm">Nenhum produto encontrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Order panel - 2 cols */}
      <div className="lg:col-span-2 flex flex-col min-h-0">
        <Card className="flex flex-col flex-1 min-h-0">
          <CardContent className="p-4 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Novo Pedido
                {totalItems > 0 && <Badge variant="secondary" className="text-xs">{totalItems}</Badge>}
              </h3>
            </div>

            {/* Order type */}
            <div className="grid grid-cols-3 gap-1.5 mb-3 shrink-0">
              {[
                { value: "delivery", label: "🛵 Delivery" },
                { value: "pickup", label: "🏪 Retirada" },
                { value: "dine_in", label: "🍽️ Mesa" },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setOrderType(t.value as any)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    orderType === t.value ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Customer info */}
            <div className="space-y-2 mb-3 shrink-0">
              <Input placeholder="Nome do cliente *" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-9 text-sm" />
              <Input placeholder="Telefone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-9 text-sm" />
              {orderType === "delivery" && <Input placeholder="Endereço / Referência" value={reference} onChange={e => setReference(e.target.value)} className="h-9 text-sm" />}
              {orderType === "dine_in" && <Input placeholder="Nº da mesa" type="number" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="h-9 text-sm" />}
            </div>

            {/* Payment */}
            <div className="grid grid-cols-4 gap-1 mb-3 shrink-0">
              {[
                { value: "pix", label: "PIX" },
                { value: "credit_card", label: "Crédito" },
                { value: "debit_card", label: "Débito" },
                { value: "cash", label: "Dinheiro" },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => setPaymentMethod(p.value)}
                  className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    paymentMethod === p.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto min-h-0 border-t border-border pt-2 space-y-1.5">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Toque nos produtos para adicionar</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.uid} className="bg-muted/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2">
                      <img src={item.product.image_url || fallbackImage} alt={item.product.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{item.product.name}</p>
                        <p className="text-xs text-primary font-bold">R$ {getCartItemTotal(item).toFixed(2).replace(".", ",")}</p>
                        {item.extras.length > 0 && (
                          <p className="text-[10px] text-muted-foreground truncate">+ {item.extras.map(e => e.name).join(", ")}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.uid, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.uid, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(item.uid)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedCartItem(expandedCartItem === item.uid ? null : item.uid)}
                      className="text-[10px] text-muted-foreground hover:text-foreground mt-1 underline"
                    >
                      {expandedCartItem === item.uid ? "Fechar" : "Observação"}
                    </button>

                    <AnimatePresence>
                      {expandedCartItem === item.uid && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <Input
                            placeholder="Observação do item..."
                            value={item.observation}
                            onChange={e => updateItemObservation(item.uid, e.target.value)}
                            className="h-7 text-xs mt-2"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>

            <Textarea placeholder="Observação geral do pedido..." value={observation} onChange={e => setObservation(e.target.value)} rows={2} className="text-sm mt-2 shrink-0" />

            <div className="border-t border-border pt-3 mt-3 shrink-0">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-foreground">Total</span>
                <span className="text-xl font-black text-primary">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              <Button onClick={placeOrder} disabled={loading || cart.length === 0} className="w-full h-12 text-base font-bold gap-2" size="lg">
                <ShoppingCart className="h-5 w-5" />
                {loading ? "Criando..." : `Criar Pedido (${totalItems} itens)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Extras Modal */}
      <Dialog open={!!extrasModal} onOpenChange={(open) => !open && setExtrasModal(null)}>
        <DialogContent className="max-w-md mx-auto max-h-[80vh] overflow-y-auto">
          {extrasModal && (
            <>
              <DialogHeader>
                <DialogTitle>{extrasModal.name}</DialogTitle>
              </DialogHeader>
              <p className="text-primary font-bold">R$ {Number(extrasModal.price).toFixed(2).replace(".", ",")}</p>

              {getProductExtras(extrasModal).map(group => {
                const groupSelectedCount = getModalGroupCount(group.id);
                const isFull = groupSelectedCount >= group.max_select;
                return (
                  <div key={group.id} className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-foreground text-sm">{group.name}</h3>
                      <div className="flex items-center gap-1">
                        {group.is_required && <Badge variant="destructive" className="text-xs">Obrigatório</Badge>}
                        <Badge variant="outline" className="text-xs">{groupSelectedCount}/{group.max_select}</Badge>
                      </div>
                    </div>
                    {group.extras.map(extra => {
                      const qty = getModalExtraQty(extra.id);
                      const maxPerItem = extra.max_quantity || 99;
                      return (
                        <div
                          key={extra.id}
                          className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${qty > 0 ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          {extra.image_url && <img src={extra.image_url} alt={extra.name} className="w-10 h-10 rounded object-cover" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{extra.name}</p>
                            {extra.description && <p className="text-xs text-muted-foreground">{extra.description}</p>}
                            {extra.price > 0 && <p className="text-xs font-bold text-primary">R$ {extra.price.toFixed(2).replace(".", ",")}</p>}
                            <p className="text-[10px] text-muted-foreground">Máx {maxPerItem}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {qty > 0 && (
                              <button onClick={() => changeModalExtraQty(extra, group.id, -1)} className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center">
                                <Minus className="h-3 w-3" />
                              </button>
                            )}
                            {qty > 0 && <span className="text-sm font-bold w-5 text-center">{qty}</span>}
                            <button
                              onClick={() => changeModalExtraQty(extra, group.id, 1)}
                              disabled={isFull || qty >= maxPerItem}
                              className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <Button onClick={confirmModalExtras} disabled={hasModalUnmetRequirements} className="w-full mt-4">
                Adicionar ao pedido
              </Button>
              {hasModalUnmetRequirements && (
                <p className="text-xs text-destructive text-center mt-1">Selecione os itens obrigatórios</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewOrder;
