import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, ShoppingBag, Search } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type OrderType = Database["public"]["Enums"]["order_type"];

interface SimpleProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string;
}

interface ExtraItem {
  id: string;
  name: string;
  price: number;
  max_quantity: number;
  description: string | null;
  image_url: string | null;
  group_id: string | null;
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
}

interface CartItem {
  uid: string; // unique cart item key
  product: SimpleProduct;
  quantity: number;
  observation: string;
  extras: SelectedExtra[];
}

const WaiterNewOrder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetTable = searchParams.get("table");
  const editOrderId = searchParams.get("edit");

  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [categories, setCategories] = useState<{ slug: string; name: string; icon: string | null }[]>([]);
  const [extraGroups, setExtraGroups] = useState<ExtraGroupData[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"menu" | "checkout">("menu");

  // Extras modal
  const [extrasModal, setExtrasModal] = useState<SimpleProduct | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<SelectedExtra[]>([]);

  // Checkout fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderType>(presetTable ? "dine_in" : "dine_in");
  const [tableNumber, setTableNumber] = useState<number | null>(presetTable ? Number(presetTable) : null);
  const [observation, setObservation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [prodRes, catRes, groupRes, extrasRes] = await Promise.all([
        supabase.from("products").select("id, name, price, image_url, category").eq("is_active", true).order("sort_order"),
        supabase.from("categories").select("slug, name, icon").eq("is_active", true).order("sort_order"),
        supabase.from("extra_groups").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("product_extras").select("*").eq("is_active", true).order("sort_order"),
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (catRes.data) setCategories(catRes.data);

      // Build extra groups with their items
      if (groupRes.data && extrasRes.data) {
        const groups: ExtraGroupData[] = groupRes.data.map((g: any) => ({
          id: g.id,
          name: g.name,
          max_select: g.max_select,
          is_required: g.is_required,
          applies_to_categories: g.applies_to_categories,
          extras: extrasRes.data
            .filter((e: any) => e.group_id === g.id)
            .map((e: any) => ({ id: e.id, name: e.name, price: Number(e.price), image_url: e.image_url, group_id: e.group_id })),
        })).filter((g: ExtraGroupData) => g.extras.length > 0);
        setExtraGroups(groups);
      }

      // If editing, load existing order
      if (editOrderId) {
        const { data: order } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", editOrderId)
          .single();

        if (order) {
          setCustomerName(order.customer_name);
          setCustomerPhone(order.customer_phone || "");
          setOrderType(order.order_type as OrderType);
          setTableNumber(order.table_number || null);
          setObservation(order.observation || "");

          const existingItems: CartItem[] = (order as any).order_items?.map((item: any) => ({
            uid: `${item.id}-${Date.now()}`,
            product: {
              id: item.id,
              name: item.product_name,
              price: Number(item.product_price),
              image_url: null,
              category: "",
            },
            quantity: item.quantity,
            observation: item.observation || "",
            extras: Array.isArray(item.extras) ? item.extras : [],
          })) || [];
          setCart(existingItems);
        }
      }
    };
    fetchData();
  }, [editOrderId]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (activeCategory !== "all") {
      filtered = filtered.filter((p) => p.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [products, activeCategory, search]);

  // Get applicable extra groups for a product
  const getProductExtras = (product: SimpleProduct) => {
    return extraGroups.filter(
      (g) => !g.applies_to_categories || g.applies_to_categories.length === 0 || g.applies_to_categories.includes(product.category)
    );
  };

  const handleProductClick = (product: SimpleProduct) => {
    const productExtras = getProductExtras(product);
    if (productExtras.length > 0) {
      setExtrasModal(product);
      setSelectedExtras([]);
    } else {
      addToCart(product, []);
    }
  };

  const addToCart = (product: SimpleProduct, extras: SelectedExtra[]) => {
    const uid = `${product.id}-${Date.now()}`;
    setCart((prev) => [...prev, { uid, product, quantity: 1, observation: "", extras }]);
    toast.success(`${product.name} adicionado!`);
  };

  const confirmExtras = () => {
    if (extrasModal) {
      addToCart(extrasModal, selectedExtras);
      setExtrasModal(null);
      setSelectedExtras([]);
    }
  };

  const toggleExtra = (extra: ExtraItem, groupId: string) => {
    const group = extraGroups.find(g => g.id === groupId);
    if (!group) return;

    setSelectedExtras(prev => {
      const exists = prev.find(e => e.id === extra.id);
      if (exists) {
        return prev.filter(e => e.id !== extra.id);
      }
      // Check max_select for this group
      const groupCount = prev.filter(e => {
        const ext = extraGroups.flatMap(g => g.extras).find(x => x.id === e.id);
        return ext?.group_id === groupId;
      }).length;
      if (groupCount >= group.max_select) {
        toast.error(`Máximo de ${group.max_select} seleções para ${group.name}`);
        return prev;
      }
      return [...prev, { id: extra.id, name: extra.name, price: extra.price }];
    });
  };

  const updateQty = (uid: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => i.uid === uid ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (uid: string) => {
    setCart((prev) => prev.filter((i) => i.uid !== uid));
  };

  const subtotal = cart.reduce((s, i) => {
    const extrasTotal = i.extras.reduce((es, e) => es + e.price, 0);
    return s + (i.product.price + extrasTotal) * i.quantity;
  }, 0);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }

    setSubmitting(true);
    try {
      if (editOrderId) {
        // Update existing order
        await supabase.from("order_items").delete().eq("order_id", editOrderId);

        const { error: updateError } = await supabase
          .from("orders")
          .update({
            customer_name: customerName,
            customer_phone: customerPhone || "garçom",
            order_type: orderType,
            table_number: orderType === "dine_in" ? tableNumber : null,
            subtotal,
            total: subtotal,
            observation: observation || null,
          })
          .eq("id", editOrderId);

        if (updateError) throw updateError;

        const items = cart.map((i) => ({
          order_id: editOrderId,
          product_name: i.product.name,
          product_price: i.product.price,
          quantity: i.quantity,
          observation: i.observation || null,
          extras: i.extras as any,
        }));

        const { error: itemsError } = await supabase.from("order_items").insert(items);
        if (itemsError) throw itemsError;

        toast.success("Pedido atualizado! 🔥");
      } else {
        // Create new order
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            customer_name: customerName,
            customer_phone: customerPhone || "garçom",
            order_type: orderType,
            table_number: orderType === "dine_in" ? tableNumber : null,
            subtotal,
            delivery_fee: 0,
            total: subtotal,
            observation: observation || null,
            status: "pending",
          })
          .select("id, order_number")
          .single();

        if (orderError) throw orderError;

        const items = cart.map((i) => ({
          order_id: order.id,
          product_name: i.product.name,
          product_price: i.product.price,
          quantity: i.quantity,
          observation: i.observation || null,
          extras: i.extras as any,
        }));

        const { error: itemsError } = await supabase.from("order_items").insert(items);
        if (itemsError) throw itemsError;

        toast.success(`Pedido #${order.order_number} enviado! 🔥`);
      }

      navigate("/waiter");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "checkout") {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-card border-b border-border p-4 flex items-center gap-3">
          <button onClick={() => setStep("menu")} className="text-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-black text-foreground">{editOrderId ? "Editar Pedido" : "Finalizar Pedido"}</h1>
        </div>

        <div className="p-4 space-y-4">
          {/* Cart Summary */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-bold text-foreground text-sm">Itens ({totalItems})</h3>
              {cart.map((item) => (
                <div key={item.uid} className="space-y-0.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">
                      {item.quantity}x {item.product.name}
                    </span>
                    <span className="font-medium text-foreground">
                      R$ {(item.product.price * item.quantity).toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  {item.extras.length > 0 && (
                    <p className="text-xs text-muted-foreground pl-4">
                      + {item.extras.map(e => e.name).join(", ")}
                    </p>
                  )}
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground">
                <span>Total</span>
                <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Customer info */}
          <div className="space-y-3">
            <Input
              placeholder="Nome do cliente *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Input
              placeholder="Telefone (opcional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              type="tel"
            />
          </div>

          {/* Table number for dine-in */}
          {orderType === "dine_in" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Mesa</label>
              <Input
                type="number"
                placeholder="Número da mesa"
                value={tableNumber?.toString() || ""}
                onChange={(e) => setTableNumber(e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          )}

          {/* Observation */}
          <Textarea
            placeholder="Observação geral (opcional)"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={2}
          />

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-14 text-lg font-bold"
          >
            {submitting ? "Enviando..." : `${editOrderId ? "Atualizar" : "Enviar"} Pedido - R$ ${subtotal.toFixed(2).replace(".", ",")}`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border p-4 flex items-center gap-3">
        <button onClick={() => navigate("/waiter")} className="text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-black text-foreground">
          {editOrderId ? "Editar Pedido" : presetTable ? `Mesa ${presetTable} - Novo Pedido` : "Novo Pedido"}
        </h1>
      </div>

      {/* Search */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        <Badge
          variant={activeCategory === "all" ? "default" : "outline"}
          className="cursor-pointer whitespace-nowrap"
          onClick={() => setActiveCategory("all")}
        >
          Todos
        </Badge>
        {categories.map((cat) => (
          <Badge
            key={cat.slug}
            variant={activeCategory === cat.slug ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setActiveCategory(cat.slug)}
          >
            {cat.icon} {cat.name}
          </Badge>
        ))}
      </div>

      {/* Products Grid */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {filteredProducts.map((product) => {
          const inCartCount = cart.filter((i) => i.product.id === product.id).reduce((s, i) => s + i.quantity, 0);
          return (
            <Card
              key={product.id}
              className="border border-border overflow-hidden cursor-pointer active:scale-95 transition-transform"
              onClick={() => handleProductClick(product)}
            >
              {product.image_url && (
                <img src={product.image_url} alt={product.name} className="w-full h-24 object-cover" />
              )}
              <CardContent className="p-3 space-y-1">
                <p className="font-bold text-foreground text-sm leading-tight line-clamp-2">{product.name}</p>
                <p className="text-primary font-bold text-sm">R$ {product.price.toFixed(2).replace(".", ",")}</p>
                {inCartCount > 0 && (
                  <Badge className="text-xs">{inCartCount} no carrinho</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cart items at bottom */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border">
          {/* Mini cart preview */}
          <div className="max-h-32 overflow-y-auto px-4 py-2 space-y-1">
            {cart.map((item) => (
              <div key={item.uid} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button className="w-6 h-6 rounded-full bg-destructive/20 text-destructive flex items-center justify-center" onClick={() => updateQty(item.uid, -1)}>
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                    <button className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center" onClick={() => updateQty(item.uid, 1)}>
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="truncate text-foreground">{item.product.name}</span>
                  {item.extras.length > 0 && <span className="text-xs text-muted-foreground">+{item.extras.length}</span>}
                </div>
                <span className="text-xs font-bold text-foreground ml-2">
                  R$ {((item.product.price + item.extras.reduce((s, e) => s + e.price, 0)) * item.quantity).toFixed(2).replace(".", ",")}
                </span>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4 pt-1">
            <Button
              onClick={() => setStep("checkout")}
              className="w-full h-12 text-base font-bold shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span>{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
              </div>
              <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Extras Modal */}
      <Dialog open={!!extrasModal} onOpenChange={(open) => !open && setExtrasModal(null)}>
        <DialogContent className="max-w-sm mx-auto max-h-[80vh] overflow-y-auto">
          {extrasModal && (
            <>
              <DialogHeader>
                <DialogTitle>{extrasModal.name}</DialogTitle>
              </DialogHeader>
              <p className="text-primary font-bold">R$ {extrasModal.price.toFixed(2).replace(".", ",")}</p>

              {getProductExtras(extrasModal).map((group) => {
                const groupSelectedCount = selectedExtras.filter(se => {
                  const ext = group.extras.find(e => e.id === se.id);
                  return !!ext;
                }).length;

                return (
                  <div key={group.id} className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-foreground text-sm">{group.name}</h3>
                      <div className="flex items-center gap-1">
                        {group.is_required && <Badge variant="destructive" className="text-xs">Obrigatório</Badge>}
                        <Badge variant="outline" className="text-xs">{groupSelectedCount}/{group.max_select}</Badge>
                      </div>
                    </div>
                    {group.extras.map((extra) => {
                      const isSelected = selectedExtras.some(e => e.id === extra.id);
                      return (
                        <div
                          key={extra.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border"}`}
                          onClick={() => toggleExtra(extra, group.id)}
                        >
                          <Checkbox checked={isSelected} />
                          {extra.image_url && (
                            <img src={extra.image_url} alt={extra.name} className="w-10 h-10 rounded object-cover" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{extra.name}</p>
                          </div>
                          {extra.price > 0 && (
                            <span className="text-xs font-bold text-primary">+R$ {extra.price.toFixed(2).replace(".", ",")}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <Button onClick={confirmExtras} className="w-full mt-4">
                Adicionar ao pedido
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WaiterNewOrder;
