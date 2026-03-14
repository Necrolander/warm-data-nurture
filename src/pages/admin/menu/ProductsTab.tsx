import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Image, ChevronDown, ChevronRight, Search, X, Package, Eye, Clock, Layers, ArrowUp, ArrowDown, Copy } from "lucide-react";
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

interface ProductsTabProps {
  products: Product[];
  categories: Category[];
  onRefresh: () => void;
}

export default function ProductsTab({ products, categories, onRefresh }: ProductsTabProps) {
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [badgeInput, setBadgeInput] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [productDialogTab, setProductDialogTab] = useState<"info" | "visibility" | "combo">("info");
  const [uploading, setUploading] = useState(false);

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
    onRefresh();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Produto excluído"); onRefresh(); }
  };

  const toggleProduct = async (id: string, active: boolean) => {
    await supabase.from("products").update({ is_active: active }).eq("id", id);
    onRefresh();
  };

  const duplicateProduct = async (product: Product) => {
    const { id, ...rest } = product;
    const data = { ...rest, name: `${rest.name} (cópia)`, sort_order: rest.sort_order + 1 };
    const { error } = await supabase.from("products").insert(data);
    if (error) toast.error("Erro ao duplicar");
    else { toast.success("Produto duplicado!"); onRefresh(); }
  };

  const moveProduct = async (product: Product, direction: "up" | "down") => {
    const categoryProducts = products
      .filter(p => p.category === product.category)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const idx = categoryProducts.findIndex(p => p.id === product.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categoryProducts.length) return;

    const current = categoryProducts[idx];
    const swap = categoryProducts[swapIdx];

    await Promise.all([
      supabase.from("products").update({ sort_order: swap.sort_order }).eq("id", current.id),
      supabase.from("products").update({ sort_order: current.sort_order }).eq("id", swap.id),
    ]);
    onRefresh();
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      setEditingProduct(prev => prev ? { ...prev, image_url: data.publicUrl } : prev);
      toast.success("Imagem enviada!");
    } catch {
      toast.error("Erro ao enviar imagem");
    }
    setUploading(false);
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
    const updated = channels.includes(channel) ? channels.filter(c => c !== channel) : [...channels, channel];
    setEditingProduct({ ...editingProduct, visibility_channels: updated });
  };

  const toggleDay = (day: number) => {
    if (!editingProduct) return;
    const days = editingProduct.available_days || [];
    const updated = days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort();
    setEditingProduct({ ...editingProduct, available_days: updated });
  };

  const toggleComboItem = (productId: string) => {
    if (!editingProduct) return;
    const items: string[] = editingProduct.combo_items || [];
    const updated = items.includes(productId) ? items.filter(id => id !== productId) : [...items, productId];
    setEditingProduct({ ...editingProduct, combo_items: updated });
  };

  const toggleCategoryCollapse = (slug: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  const filteredProducts = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const productsByCategory = categories.map(cat => ({
    ...cat,
    products: filteredProducts
      .filter(p => p.category === cat.slug)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  })).filter(c => c.products.length > 0);

  const uncategorized = filteredProducts.filter(p => !categories.some(c => c.slug === p.category));

  return (
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
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      <div className="space-y-4">
        {productsByCategory.map(cat => {
          const isCollapsed = collapsedCategories.has(cat.slug);
          return (
            <div key={cat.slug} className="border border-border rounded-xl overflow-hidden">
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
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="divide-y divide-border">
                      {cat.products.map((product, idx) => (
                        <ProductRow
                          key={product.id}
                          product={product}
                          isFirst={idx === 0}
                          isLast={idx === cat.products.length - 1}
                          onEdit={() => { setEditingProduct(product); setProductDialogTab("info"); setIsDialogOpen(true); }}
                          onDelete={() => deleteProduct(product.id)}
                          onToggle={(v) => toggleProduct(product.id, v)}
                          onDuplicate={() => duplicateProduct(product)}
                          onMoveUp={() => moveProduct(product, "up")}
                          onMoveDown={() => moveProduct(product, "down")}
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
              {uncategorized.map((product, idx) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  isFirst={idx === 0}
                  isLast={idx === uncategorized.length - 1}
                  onEdit={() => { setEditingProduct(product); setProductDialogTab("info"); setIsDialogOpen(true); }}
                  onDelete={() => deleteProduct(product.id)}
                  onToggle={(v) => toggleProduct(product.id, v)}
                  onDuplicate={() => duplicateProduct(product)}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
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

      {/* Product Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct?.id ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 mb-4">
            {([
              { key: "info" as const, label: "Informações", icon: Package },
              { key: "visibility" as const, label: "Visibilidade", icon: Eye },
              { key: "combo" as const, label: "Combo", icon: Layers },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setProductDialogTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  productDialogTab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {productDialogTab === "info" && (
            <div className="space-y-3">
              <Input placeholder="Nome do produto" value={editingProduct?.name || ""} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              <Textarea placeholder="Descrição" value={editingProduct?.description || ""} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Preço (R$)</label>
                  <Input type="number" step="0.01" placeholder="0.00" value={editingProduct?.price || ""} onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Ordem</label>
                  <Input type="number" value={editingProduct?.sort_order || 0} onChange={e => setEditingProduct({ ...editingProduct, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              {/* Image upload */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Imagem</label>
                {editingProduct?.image_url && (
                  <img src={editingProduct.image_url} alt="Preview" className="w-full h-32 object-cover rounded-lg mb-2" />
                )}
                <div className="flex gap-2">
                  <Input placeholder="URL da imagem" value={editingProduct?.image_url || ""} onChange={e => setEditingProduct({ ...editingProduct, image_url: e.target.value })} className="flex-1" />
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="h-10" asChild disabled={uploading}>
                      <span>{uploading ? "..." : <><Image className="h-4 w-4 mr-1" /> Upload</>}</span>
                    </Button>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); }} />
                  </label>
                </div>
              </div>

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

          {productDialogTab === "visibility" && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-foreground mb-2 flex items-center gap-2"><Eye className="h-4 w-4" /> Onde exibir</h4>
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
              <div>
                <h4 className="font-bold text-foreground mb-2 flex items-center gap-2"><Clock className="h-4 w-4" /> Dias e horários</h4>
                <div className="flex gap-1 flex-wrap mb-3">
                  {DAYS.map(day => {
                    const checked = (editingProduct?.available_days || []).includes(day.value);
                    return (
                      <button key={day.value} onClick={() => toggleDay(day.value)} className={`w-10 h-10 rounded-lg text-xs font-bold transition-all ${checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-muted-foreground">Início</label><Input type="time" value={editingProduct?.available_start_time || ""} onChange={e => setEditingProduct({ ...editingProduct, available_start_time: e.target.value || null })} /></div>
                  <div><label className="text-xs text-muted-foreground">Fim</label><Input type="time" value={editingProduct?.available_end_time || ""} onChange={e => setEditingProduct({ ...editingProduct, available_end_time: e.target.value || null })} /></div>
                </div>
              </div>
            </div>
          )}

          {productDialogTab === "combo" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Switch checked={editingProduct?.is_combo || false} onCheckedChange={v => setEditingProduct({ ...editingProduct, is_combo: v })} />
                <div>
                  <span className="font-bold text-foreground">É um combo?</span>
                  <p className="text-xs text-muted-foreground">Combos agrupam vários produtos</p>
                </div>
              </div>
              {editingProduct?.is_combo && (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {products.filter(p => p.id !== editingProduct?.id).map(p => {
                    const checked = ((editingProduct?.combo_items as string[]) || []).includes(p.id);
                    return (
                      <label key={p.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${checked ? "border-primary bg-primary/5" : "border-border"}`}>
                        <Checkbox checked={checked} onCheckedChange={() => toggleComboItem(p.id)} />
                        <img src={p.image_url || fallbackImage} alt="" className="w-8 h-8 rounded object-cover" />
                        <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                        <span className="text-xs text-primary font-bold">R$ {Number(p.price).toFixed(2).replace(".", ",")}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <Button onClick={saveProduct} className="w-full mt-4">Salvar Produto</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductRow({ product, isFirst, isLast, onEdit, onDelete, onToggle, onDuplicate, onMoveUp, onMoveDown }: {
  product: Product; isFirst: boolean; isLast: boolean;
  onEdit: () => void; onDelete: () => void; onToggle: (v: boolean) => void;
  onDuplicate: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const channels = product.visibility_channels || [];
  const hasSchedule = product.available_start_time || product.available_end_time;
  const allDays = (product.available_days || []).length === 7;

  return (
    <div className={`flex items-center gap-2 p-3 ${!product.is_active ? "opacity-40" : ""}`}>
      {/* Reorder buttons */}
      <div className="flex flex-col gap-0.5">
        <button onClick={onMoveUp} disabled={isFirst} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground" title="Subir">
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={onMoveDown} disabled={isLast} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground" title="Descer">
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {product.image_url ? (
        <img src={product.image_url} alt={product.name} className="w-12 h-9 object-cover rounded-lg shrink-0" />
      ) : (
        <div className="w-12 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0">
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
          <div className="flex gap-0.5">
            {channels.length < 5 && channels.map(ch => (
              <span key={ch} className="text-[9px] bg-muted px-1 rounded">
                {ch === "delivery" ? "🛵" : ch === "dine_in" ? "🍽️" : ch === "pickup" ? "🏪" : ch === "qrcode" ? "📱" : "👨‍🍳"}
              </span>
            ))}
          </div>
          {hasSchedule && <Clock className="h-3 w-3 text-muted-foreground" />}
          {!allDays && <span className="text-[9px] text-muted-foreground">📅</span>}
        </div>
      </div>
      <Switch checked={product.is_active} onCheckedChange={onToggle} />
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDuplicate} title="Duplicar"><Copy className="h-3.5 w-3.5" /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete} title="Excluir"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
    </div>
  );
}
