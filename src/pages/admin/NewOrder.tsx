import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface Extra {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  extras: Extra[];
  observation: string;
}

const NewOrder = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<"delivery" | "pickup" | "dine_in">("delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reference, setReference] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [observation, setObservation] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [p, e] = await Promise.all([
        supabase.from("products").select("id, name, price, category").eq("is_active", true).order("sort_order"),
        supabase.from("product_extras").select("id, name, price").eq("is_active", true).order("sort_order"),
      ]);
      if (p.data) setProducts(p.data);
      if (e.data) setExtras(e.data);
    };
    fetch();
  }, []);

  const addToCart = (product: Product) => {
    const existing = cart.find(c => c.product.id === product.id);
    if (existing) {
      setCart(cart.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { product, quantity: 1, extras: [], observation: "" }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.product.id !== productId) return c;
      const newQty = c.quantity + delta;
      return newQty > 0 ? { ...c, quantity: newQty } : c;
    }).filter(c => c.quantity > 0));
  };

  const removeItem = (productId: string) => setCart(cart.filter(c => c.product.id !== productId));

  const toggleExtra = (productId: string, extra: Extra) => {
    setCart(cart.map(c => {
      if (c.product.id !== productId) return c;
      const has = c.extras.find(e => e.id === extra.id);
      return { ...c, extras: has ? c.extras.filter(e => e.id !== extra.id) : [...c.extras, extra] };
    }));
  };

  const subtotal = cart.reduce((sum, c) => {
    const extrasTotal = c.extras.reduce((s, e) => s + e.price, 0);
    return sum + (c.product.price + extrasTotal) * c.quantity;
  }, 0);

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

    toast.success(`Pedido #${order.order_number} criado!`);
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setReference("");
    setObservation("");
    setTableNumber("");
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Products list */}
      <div className="lg:col-span-2 space-y-3">
        <h2 className="text-lg font-semibold">Selecione os Itens</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {products.map(product => (
            <Card
              key={product.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-3 text-center">
                <p className="font-medium text-sm truncate">{product.name}</p>
                <p className="text-primary font-bold text-sm">R$ {Number(product.price).toFixed(2).replace(".", ",")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Order summary */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={orderType} onValueChange={v => setOrderType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">🛵 Delivery</SelectItem>
                <SelectItem value="pickup">🏠 Retirada</SelectItem>
                <SelectItem value="dine_in">🍽️ Mesa</SelectItem>
              </SelectContent>
            </Select>

            <Input placeholder="Nome do cliente *" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            <Input placeholder="Telefone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />

            {orderType === "delivery" && (
              <Input placeholder="Referência/Endereço" value={reference} onChange={e => setReference(e.target.value)} />
            )}
            {orderType === "dine_in" && (
              <Input placeholder="Número da mesa" type="number" value={tableNumber} onChange={e => setTableNumber(e.target.value)} />
            )}

            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="credit_card">Cartão Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão Débito</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
              </SelectContent>
            </Select>

            <Textarea placeholder="Observação" value={observation} onChange={e => setObservation(e.target.value)} rows={2} />

            {/* Cart items */}
            <div className="border-t border-border pt-2 space-y-2">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item</p>
              ) : cart.map(item => (
                <div key={item.product.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.product.name}</span>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="text-sm w-5 text-center">{item.quantity}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(item.product.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </div>
                  {/* Extras */}
                  <div className="flex gap-1 flex-wrap pl-2">
                    {extras.map(extra => (
                      <Badge
                        key={extra.id}
                        variant={item.extras.find(e => e.id === extra.id) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleExtra(item.product.id, extra)}
                      >
                        {extra.name} +R${Number(extra.price).toFixed(0)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
            </div>

            <Button onClick={placeOrder} disabled={loading || cart.length === 0} className="w-full">
              {loading ? "Criando..." : "Criar Pedido"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewOrder;
