import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, ShoppingBag, Search, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type OrderType = Database["public"]["Enums"]["order_type"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

interface SimpleProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string;
}

interface CartItem {
  product: SimpleProduct;
  quantity: number;
  observation: string;
}

interface SalonTable {
  id: string;
  table_number: number;
}

const WaiterNewOrder = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [categories, setCategories] = useState<{ slug: string; name: string; icon: string | null }[]>([]);
  const [tables, setTables] = useState<SalonTable[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"menu" | "checkout">("menu");

  // Checkout fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [observation, setObservation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [prodRes, catRes, tableRes] = await Promise.all([
        supabase.from("products").select("id, name, price, image_url, category").eq("is_active", true).order("sort_order"),
        supabase.from("categories").select("slug, name, icon").eq("is_active", true).order("sort_order"),
        supabase.from("salon_tables").select("id, table_number").eq("is_active", true).order("table_number"),
      ]);
      if (prodRes.data) setProducts(prodRes.data);
      if (catRes.data) setCategories(catRes.data);
      if (tableRes.data) setTables(tableRes.data);
    };
    fetchData();
  }, []);

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

  const addToCart = (product: SimpleProduct) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1, observation: "" }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
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
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerName,
          customer_phone: customerPhone || "garçom",
          order_type: orderType,
          table_number: orderType === "dine_in" ? tableNumber : null,
          payment_method: paymentMethod,
          subtotal,
          delivery_fee: 0,
          total: subtotal,
          observation: observation || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const items = cart.map((i) => ({
        order_id: order.id,
        product_name: i.product.name,
        product_price: i.product.price,
        quantity: i.quantity,
        observation: i.observation || null,
        extras: [] as any,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(items);
      if (itemsError) throw itemsError;

      toast.success(`Pedido #${order.id.slice(0, 4)} enviado para a cozinha! 🔥`);
      navigate("/waiter");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido");
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
          <h1 className="text-lg font-black text-foreground">Finalizar Pedido</h1>
        </div>

        <div className="p-4 space-y-4">
          {/* Cart Summary */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-bold text-foreground text-sm">Itens ({totalItems})</h3>
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="font-medium text-foreground">
                    R$ {(item.product.price * item.quantity).toFixed(2).replace(".", ",")}
                  </span>
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

          {/* Order type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tipo do Pedido</label>
            <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dine_in">🍽️ No Salão</SelectItem>
                <SelectItem value="pickup">🏪 Retirada</SelectItem>
                <SelectItem value="delivery">🛵 Entrega</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table selection for dine-in */}
          {orderType === "dine_in" && tables.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Mesa</label>
              <Select
                value={tableNumber?.toString() || ""}
                onValueChange={(v) => setTableNumber(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a mesa" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.table_number.toString()}>
                      Mesa {t.table_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Payment */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Pagamento</label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="credit_card">Cartão Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão Débito</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
            {submitting ? "Enviando..." : `Enviar Pedido - R$ ${subtotal.toFixed(2).replace(".", ",")}`}
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
        <h1 className="text-lg font-black text-foreground">Novo Pedido</h1>
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
          const inCart = cart.find((i) => i.product.id === product.id);
          return (
            <Card
              key={product.id}
              className="border border-border overflow-hidden cursor-pointer active:scale-95 transition-transform"
              onClick={() => addToCart(product)}
            >
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-24 object-cover"
                />
              )}
              <CardContent className="p-3 space-y-1">
                <p className="font-bold text-foreground text-sm leading-tight line-clamp-2">
                  {product.name}
                </p>
                <p className="text-primary font-bold text-sm">
                  R$ {product.price.toFixed(2).replace(".", ",")}
                </p>
                {inCart && (
                  <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="w-7 h-7 rounded-full bg-destructive/20 text-destructive flex items-center justify-center"
                      onClick={() => updateQty(product.id, -1)}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold text-foreground w-5 text-center">
                      {inCart.quantity}
                    </span>
                    <button
                      className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center"
                      onClick={() => updateQty(product.id, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Floating Cart Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <Button
            onClick={() => setStep("checkout")}
            className="w-full h-14 text-lg font-bold shadow-2xl shadow-primary/40 flex items-center justify-between max-w-lg mx-auto"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
            </div>
            <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default WaiterNewOrder;
