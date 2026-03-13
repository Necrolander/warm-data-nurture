import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Image, ChevronDown, ChevronRight, Search, X, Package, Eye, Clock, Layers } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  badges: string[];
  is_active: boolean;
  sort_order: number;
  visibility_channels: string[] | null;
  available_days: number[] | null;
  available_start_time: string | null;
  available_end_time: string | null;
  is_combo: boolean | null;
  combo_items: any | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Extra {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  sort_order: number;
}

const CHANNELS = [
  { value: "delivery", label: "🛵 Delivery Online" },
  { value: "dine_in", label: "🍽️ Salão" },
  { value: "pickup", label: "🏪 Retirada" },
  { value: "qrcode", label: "📱 QR Code Mesa" },
  { value: "waiter_app", label: "👨‍🍳 App Garçom" },
];

const DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const fallbackImage = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop";

const emptyProduct: Partial<Product> = {
  name: "", description: "", price: 0, image_url: "", category: "",
  badges: [], is_active: true, sort_order: 0,
  visibility_channels: ["delivery", "dine_in", "pickup", "qrcode", "waiter_app"],
  available_days: [0, 1, 2, 3, 4, 5, 6],
  available_start_time: null, available_end_time: null,
  is_combo: false, combo_items: null,
};

const MenuManager = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "categories" | "extras">("products");
  const [search, setSearch] = useState("");
  const [badgeInput, setBadgeInput] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<Partial<Extra> | null>(null);
  const [isExtraDialogOpen, setIsExtraDialogOpen] = useState(false);
  const [productDialogTab, setProductDialogTab] = useState<"info" | "visibility" | "combo">("info");

  const fetchAll = async () => {
    const [p, c, e] = await Promise.all([
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("product_extras").select("*").order("sort_order"),
    ]);
    if (p.data) setProducts(p.data as Product[]);
    if (c.data) setCategories(c.data as Category[]);
    if (e.data) setExtras(e.data as Extra[]);
  };

  useEffect(() => { fetchAll(); }, []);

  // Product CRUD
  const saveProduct = async () => {
    if (!editingProduct?.name || !editingProduct?.category) {
      toast.error("Preencha nome e categoria"); return;
    }
    const data = {
      name: editingProduct.name,
      description: editingProduct.description || "",
      price: editingProduct.price || 0,
      image_url: editingProduct.image_url || "",
      category: editingProduct.category,
      badges: editingProduct.badges || [],
      is_active: editingProduct.is_active ?? true,
      sort_order: editingProduct.sort_order || 0,
      visibility_channels: editingProduct.visibility_channels || ["delivery", "dine_in", "pickup", "qrcode", "waiter_app"],
      available_days: editingProduct.available_days || [0, 1, 2, 3, 4, 5, 6],
      available_start_time: editingProduct.available_start_time || null,
      available_end_time: editingProduct.available_end_time || null,
      is_combo: editingProduct.is_combo || false,
      combo_items: editingProduct.combo_items || null,
    };

    if (editingProduct.id) {
      const { error } = await supabase.from("products").update(data).eq("id", editingProduct.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Produto atualizado!");
    } else {
      const { error } = await supabase.from("products").insert(data);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Produto criado!");
    }
    setIsDialogOpen(false);
    setEditingProduct(null);
    setProductDialogTab("info");
    fetchAll();
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Produto excluído"); fetchAll(); }
  };

  const toggleProduct = async (id: string, active: boolean) => {
    await supabase.from("products").update({ is_active: active }).eq("id", id);
    fetchAll();
  };

  // Category CRUD
  const saveCategory = async () => {
    if (!editingCategory?.name || !editingCategory?.slug) { toast.error("Preencha nome e slug"); return; }
    const data = { name: editingCategory.name, slug: editingCategory.slug, icon: editingCategory.icon || "", sort_order: editingCategory.sort_order || 0, is_active: editingCategory.is_active ?? true };
    if (editingCategory.id) {
      await supabase.from("categories").update(data).eq("id", editingCategory.id);
      toast.success("Categoria atualizada!");
    } else {
      await supabase.from("categories").insert(data);
      toast.success("Categoria criada!");
    }
    setIsCatDialogOpen(false);
    fetchAll();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("categories").delete().eq("id", id);
    toast.success("Categoria excluída"); fetchAll();
  };

  // Extras CRUD
  const saveExtra = async () => {
    if (!editingExtra?.name) { toast.error("Preencha o nome"); return; }
    const data = { name: editingExtra.name, price: editingExtra.price || 0, is_active: editingExtra.is_active ?? true, sort_order: editingExtra.sort_order || 0 };
    if (editingExtra.id) {
      await supabase.from("product_extras").update(data).eq("id", editingExtra.id);
      toast.success("Extra atualizado!");
    } else {
      await supabase.from("product_extras").insert(data);
      toast.success("Extra criado!");
    }
    setIsExtraDialogOpen(false);
    fetchAll();
  };

  const deleteExtra = async (id: string) => {
    await supabase.from("product_extras").delete().eq("id", id);
    toast.success("Extra excluído"); fetchAll();
  };

  const addBadge = () => {
    if (!badgeInput.trim() || !editingProduct) return;
    setEditingProduct({ ...editingProduct, badges: [...(editingProduct.badges || []), badgeInput.trim()] });
    setBadgeInput("");
  };

  const removeBadge = (index: number) => {
    if (!editingProduct) return;
    const badges = [...(editingProduct.badges || [])];
    badges.splice(index, 1);
    setEditingProduct({ ...editingProduct, badges });
  };

  const toggleChannel = (channel: string) => {
    if (!editingProduct) return;
    const channels = editingProduct.visibility_channels || [];
    const updated = channels.includes(channel)
      ? channels.filter(c => c !== channel)
      : [...channels, channel];
    setEditingProduct({ ...editingProduct, visibility_channels: updated });
  };

  const toggleDay = (day: number) => {
    if (!editingProduct) return;
    const days = editingProduct.available_days || [];
    const updated = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day].sort();
    setEditingProduct({ ...editingProduct, available_days: updated });
  };

  const toggleComboItem = (productId: string) => {
    if (!editingProduct) return;
    const items: string[] = editingProduct.combo_items || [];
    const updated = items.includes(productId)
      ? items.filter(id => id !== productId)
      : [...items, productId];
    setEditingProduct({ ...editingProduct, combo_items: updated });
  };

  const toggleCategoryCollapse = (slug: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const filteredProducts = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  // Group products by category
  const productsByCategory = categories.map(cat => ({
    ...cat,
    products: filteredProducts.filter(p => p.category === cat.slug),
  })).filter(c => c.products.length > 0);

  // Uncategorized
  const uncategorized = filteredProducts.filter(
    p => !categories.some(c => c.slug === p.category)
  );

  const tabs = [
    { key: "products" as const, label: "📦 Produtos", count: products.length },
    { key: "categories" as const, label: "📂 Categorias", count: categories.length },
    { key: "extras" as const, label: "🧀 Adicionais", count: extras.length },
  ];

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <Badge variant="secondary" className="text-[10px] h-5">{tab.count}</Badge>
          </button>
        ))}
      </div>

      {/* ===== PRODUCTS TAB ===== */}
      {activeTab === "products" && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-10 pr-10" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={() => { setEditingProduct({ ...emptyProduct }); setProductDialogTab("info"); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Produto
            </Button>
          </div>

          {/* Products grouped by category */}
          <div className="space-y-4">
            {productsByCategory.map(cat => {
              const isCollapsed = collapsedCategories.has(cat.slug);
              return (
                <div key={cat.slug} className="border border-border rounded-xl overflow-hidden">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategoryCollapse(cat.slug)}
                    className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span className="text-lg">{cat.icon}</span>
                      <span className="font-bold text-foreground">{cat.name}</span>
                      <Badge variant="secondary" className="text-xs">{cat.products.length}</Badge>
                    </div>
                  </button>

                  {/* Products list */}
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="divide-y divide-border">
                          {cat.products.map(product => (
                            <ProductRow
                              key={product.id}
                              product={product}
                              onEdit={() => { setEditingProduct(product); setProductDialogTab("info"); setIsDialogOpen(true); }}
                              onDelete={() => deleteProduct(product.id)}
                              onToggle={(v) => toggleProduct(product.id, v)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {uncategorized.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="p-3 bg-muted/50">
                  <span className="font-bold text-foreground">❓ Sem categoria</span>
                  <Badge variant="secondary" className="text-xs ml-2">{uncategorized.length}</Badge>
                </div>
                <div className="divide-y divide-border">
                  {uncategorized.map(product => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      onEdit={() => { setEditingProduct(product); setProductDialogTab("info"); setIsDialogOpen(true); }}
                      onDelete={() => deleteProduct(product.id)}
                      onToggle={(v) => toggleProduct(product.id, v)}
                    />
                  ))}
                </div>
              </div>
            )}

            {productsByCategory.length === 0 && uncategorized.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>{search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}</p>
              </div>
            )}
          </div>

          {/* Product edit dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct?.id ? "Editar Produto" : "Novo Produto"}</DialogTitle>
              </DialogHeader>

              {/* Dialog tabs */}
              <div className="flex gap-1 mb-4">
                {[
                  { key: "info" as const, label: "Informações", icon: Package },
                  { key: "visibility" as const, label: "Visibilidade", icon: Eye },
                  { key: "combo" as const, label: "Combo", icon: Layers },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setProductDialogTab(t.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      productDialogTab === t.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* INFO TAB */}
              {productDialogTab === "info" && (
                <div className="space-y-3">
                  <Input placeholder="Nome do produto" value={editingProduct?.name || ""} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />
                  <Textarea placeholder="Descrição" value={editingProduct?.description || ""} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" step="0.01" placeholder="Preço" value={editingProduct?.price || ""} onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} />
                    <Input type="number" placeholder="Ordem" value={editingProduct?.sort_order || 0} onChange={e => setEditingProduct({ ...editingProduct, sort_order: parseInt(e.target.value) || 0 })} />
                  </div>
                  <Input placeholder="URL da imagem" value={editingProduct?.image_url || ""} onChange={e => setEditingProduct({ ...editingProduct, image_url: e.target.value })} />
                  {editingProduct?.image_url && (
                    <img src={editingProduct.image_url} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                  )}
                  <Select value={editingProduct?.category || ""} onValueChange={v => setEditingProduct({ ...editingProduct, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.slug}>{c.icon} {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Badges / Etiquetas</label>
                    <div className="flex gap-1 flex-wrap mb-1">
                      {editingProduct?.badges?.map((b, i) => (
                        <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeBadge(i)}>{b} ✕</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Ex: 🔥 Mais pedido" value={badgeInput} onChange={e => setBadgeInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addBadge())} />
                      <Button type="button" size="sm" onClick={addBadge}>+</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* VISIBILITY TAB */}
              {productDialogTab === "visibility" && (
                <div className="space-y-5">
                  {/* Channels */}
                  <div>
                    <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                      <Eye className="h-4 w-4" /> Onde exibir
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">Selecione onde este produto deve aparecer</p>
                    <div className="space-y-2">
                      {CHANNELS.map(ch => {
                        const checked = (editingProduct?.visibility_channels || []).includes(ch.value);
                        return (
                          <label key={ch.value} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}>
                            <Checkbox checked={checked} onCheckedChange={() => toggleChannel(ch.value)} />
                            <span className="font-medium text-sm">{ch.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Dias e horários
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">Deixe em branco para exibir sempre</p>

                    <div className="flex gap-1 flex-wrap mb-3">
                      {DAYS.map(day => {
                        const checked = (editingProduct?.available_days || []).includes(day.value);
                        return (
                          <button
                            key={day.value}
                            onClick={() => toggleDay(day.value)}
                            className={`w-10 h-10 rounded-lg text-xs font-bold transition-all ${
                              checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Horário início</label>
                        <Input type="time" value={editingProduct?.available_start_time || ""} onChange={e => setEditingProduct({ ...editingProduct, available_start_time: e.target.value || null })} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Horário fim</label>
                        <Input type="time" value={editingProduct?.available_end_time || ""} onChange={e => setEditingProduct({ ...editingProduct, available_end_time: e.target.value || null })} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COMBO TAB */}
              {productDialogTab === "combo" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <Switch
                      checked={editingProduct?.is_combo || false}
                      onCheckedChange={v => setEditingProduct({ ...editingProduct, is_combo: v })}
                    />
                    <div>
                      <span className="font-bold text-foreground">É um combo?</span>
                      <p className="text-xs text-muted-foreground">Combos agrupam vários produtos em um único item</p>
                    </div>
                  </div>

                  {editingProduct?.is_combo && (
                    <div>
                      <h4 className="font-bold text-foreground mb-2">Produtos do combo</h4>
                      <p className="text-xs text-muted-foreground mb-3">Selecione os produtos que fazem parte deste combo</p>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {products
                          .filter(p => p.id !== editingProduct?.id)
                          .map(p => {
                            const checked = ((editingProduct?.combo_items as string[]) || []).includes(p.id);
                            return (
                              <label key={p.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}>
                                <Checkbox checked={checked} onCheckedChange={() => toggleComboItem(p.id)} />
                                <img src={p.image_url || fallbackImage} alt={p.name} className="w-8 h-8 rounded object-cover" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium truncate block">{p.name}</span>
                                </div>
                                <span className="text-xs text-primary font-bold">R$ {Number(p.price).toFixed(2).replace(".", ",")}</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={saveProduct} className="w-full mt-4">Salvar Produto</Button>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ===== CATEGORIES TAB ===== */}
      {activeTab === "categories" && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => { setEditingCategory({ name: "", slug: "", icon: "", sort_order: 0, is_active: true }); setIsCatDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Categoria
            </Button>
          </div>
          <div className="grid gap-2">
            {categories.map(cat => (
              <Card key={cat.id} className={!cat.is_active ? "opacity-50" : ""}>
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{cat.name}</span>
                    <p className="text-xs text-muted-foreground">{cat.slug} • {products.filter(p => p.category === cat.slug).length} produtos</p>
                  </div>
                  <Badge variant="secondary">#{cat.sort_order}</Badge>
                  <Switch
                    checked={cat.is_active}
                    onCheckedChange={async v => { await supabase.from("categories").update({ is_active: v }).eq("id", cat.id); fetchAll(); }}
                  />
                  <Button size="icon" variant="ghost" onClick={() => { setEditingCategory(cat); setIsCatDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteCategory(cat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingCategory?.id ? "Editar" : "Nova"} Categoria</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nome (ex: 🍔 Hambúrgueres)" value={editingCategory?.name || ""} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} />
                <Input placeholder="Slug (ex: hamburgueres)" value={editingCategory?.slug || ""} onChange={e => setEditingCategory({ ...editingCategory, slug: e.target.value })} />
                <Input placeholder="Ícone (emoji)" value={editingCategory?.icon || ""} onChange={e => setEditingCategory({ ...editingCategory, icon: e.target.value })} />
                <Input type="number" placeholder="Ordem" value={editingCategory?.sort_order || 0} onChange={e => setEditingCategory({ ...editingCategory, sort_order: parseInt(e.target.value) || 0 })} />
                <Button onClick={saveCategory} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ===== EXTRAS TAB ===== */}
      {activeTab === "extras" && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => { setEditingExtra({ name: "", price: 0, is_active: true, sort_order: 0 }); setIsExtraDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Adicional
            </Button>
          </div>
          <div className="grid gap-2">
            {extras.map(extra => (
              <Card key={extra.id} className={!extra.is_active ? "opacity-50" : ""}>
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-lg">🧀</span>
                  <span className="flex-1 font-medium">{extra.name}</span>
                  <span className="text-primary font-bold">R$ {Number(extra.price).toFixed(2).replace(".", ",")}</span>
                  <Badge variant="secondary">#{extra.sort_order}</Badge>
                  <Switch checked={extra.is_active} onCheckedChange={async v => { await supabase.from("product_extras").update({ is_active: v }).eq("id", extra.id); fetchAll(); }} />
                  <Button size="icon" variant="ghost" onClick={() => { setEditingExtra(extra); setIsExtraDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteExtra(extra.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </CardContent>
              </Card>
            ))}
            {extras.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum adicional cadastrado</p>
            )}
          </div>
          <Dialog open={isExtraDialogOpen} onOpenChange={setIsExtraDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingExtra?.id ? "Editar" : "Novo"} Adicional</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nome (ex: Queijo Extra)" value={editingExtra?.name || ""} onChange={e => setEditingExtra({ ...editingExtra, name: e.target.value })} />
                <Input type="number" step="0.01" placeholder="Preço" value={editingExtra?.price || ""} onChange={e => setEditingExtra({ ...editingExtra, price: parseFloat(e.target.value) || 0 })} />
                <Input type="number" placeholder="Ordem" value={editingExtra?.sort_order || 0} onChange={e => setEditingExtra({ ...editingExtra, sort_order: parseInt(e.target.value) || 0 })} />
                <Button onClick={saveExtra} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

// Product row sub-component
const ProductRow = ({ product, onEdit, onDelete, onToggle }: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
}) => {
  const channels = product.visibility_channels || [];
  const hasSchedule = product.available_start_time || product.available_end_time;
  const allDays = (product.available_days || []).length === 7;

  return (
    <div className={`flex items-center gap-3 p-3 ${!product.is_active ? "opacity-40" : ""}`}>
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} className="w-14 h-10 object-cover rounded-lg shrink-0" />
      ) : (
        <div className="w-14 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
          <Image className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">{product.name}</span>
          {product.is_combo && <Badge variant="secondary" className="text-[10px]">COMBO</Badge>}
          {product.badges?.map((b, i) => <Badge key={i} variant="outline" className="text-[10px]">{b}</Badge>)}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-primary font-bold text-sm">R$ {Number(product.price).toFixed(2).replace(".", ",")}</span>
          {/* Visibility indicators */}
          <div className="flex gap-0.5">
            {channels.length < 5 && channels.map(ch => (
              <span key={ch} className="text-[9px] bg-muted px-1 rounded" title={ch}>
                {ch === "delivery" ? "🛵" : ch === "dine_in" ? "🍽️" : ch === "pickup" ? "🏪" : ch === "qrcode" ? "📱" : "👨‍🍳"}
              </span>
            ))}
          </div>
          {hasSchedule && <Clock className="h-3 w-3 text-muted-foreground" title="Horário específico" />}
          {!allDays && <span className="text-[9px] text-muted-foreground" title="Dias específicos">📅</span>}
        </div>
      </div>
      <Switch checked={product.is_active} onCheckedChange={onToggle} />
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
    </div>
  );
};

export default MenuManager;
