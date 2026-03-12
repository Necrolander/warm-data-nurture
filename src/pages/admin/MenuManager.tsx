import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, Image } from "lucide-react";
import { toast } from "sonner";

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

const emptyProduct: Partial<Product> = {
  name: "",
  description: "",
  price: 0,
  image_url: "",
  category: "",
  badges: [],
  is_active: true,
  sort_order: 0,
};

const MenuManager = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "categories" | "extras">("products");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [badgeInput, setBadgeInput] = useState("");

  // Category/Extra editing
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<Partial<Extra> | null>(null);
  const [isExtraDialogOpen, setIsExtraDialogOpen] = useState(false);

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
      toast.error("Preencha nome e categoria");
      return;
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
    toast.success("Categoria excluída");
    fetchAll();
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
    toast.success("Extra excluído");
    fetchAll();
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

  const filteredProducts = filterCategory === "all" ? products : products.filter(p => p.category === filterCategory);

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="flex gap-2">
        {(["products", "categories", "extras"] as const).map(tab => (
          <Button key={tab} variant={activeTab === tab ? "default" : "outline"} size="sm" onClick={() => setActiveTab(tab)}>
            {tab === "products" ? "Produtos" : tab === "categories" ? "Categorias" : "Extras"}
          </Button>
        ))}
      </div>

      {/* PRODUCTS TAB */}
      {activeTab === "products" && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingProduct({ ...emptyProduct }); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Produto
            </Button>
          </div>

          <div className="grid gap-3">
            {filteredProducts.map(product => (
              <Card key={product.id} className={!product.is_active ? "opacity-50" : ""}>
                <CardContent className="p-3 flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-16 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-12 bg-muted rounded flex items-center justify-center"><Image className="h-5 w-5 text-muted-foreground" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{product.name}</span>
                      {product.badges?.map((b, i) => <Badge key={i} variant="secondary" className="text-xs">{b}</Badge>)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{product.description}</p>
                  </div>
                  <span className="font-bold text-primary whitespace-nowrap">R$ {Number(product.price).toFixed(2).replace(".", ",")}</span>
                  <Switch checked={product.is_active} onCheckedChange={v => toggleProduct(product.id, v)} />
                  <Button size="icon" variant="ghost" onClick={() => { setEditingProduct(product); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteProduct(product.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingProduct?.id ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nome" value={editingProduct?.name || ""} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />
                <Textarea placeholder="Descrição" value={editingProduct?.description || ""} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} />
                <Input type="number" step="0.01" placeholder="Preço" value={editingProduct?.price || ""} onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} />
                <Input placeholder="URL da imagem" value={editingProduct?.image_url || ""} onChange={e => setEditingProduct({ ...editingProduct, image_url: e.target.value })} />
                <Select value={editingProduct?.category || ""} onValueChange={v => setEditingProduct({ ...editingProduct, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Ordem" value={editingProduct?.sort_order || 0} onChange={e => setEditingProduct({ ...editingProduct, sort_order: parseInt(e.target.value) || 0 })} />
                <div>
                  <label className="text-sm font-medium">Badges</label>
                  <div className="flex gap-1 flex-wrap mb-1">
                    {editingProduct?.badges?.map((b, i) => (
                      <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeBadge(i)}>{b} ✕</Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Ex: 🔥 Mais pedido" value={badgeInput} onChange={e => setBadgeInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addBadge()} />
                    <Button type="button" size="sm" onClick={addBadge}>+</Button>
                  </div>
                </div>
                <Button onClick={saveProduct} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === "categories" && (
        <>
          <Button onClick={() => { setEditingCategory({ name: "", slug: "", icon: "", sort_order: 0, is_active: true }); setIsCatDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova Categoria
          </Button>
          <div className="grid gap-3">
            {categories.map(cat => (
              <Card key={cat.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className="flex-1">
                    <span className="font-medium">{cat.name}</span>
                    <p className="text-sm text-muted-foreground">{cat.slug}</p>
                  </div>
                  <Badge variant="secondary">#{cat.sort_order}</Badge>
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

      {/* EXTRAS TAB */}
      {activeTab === "extras" && (
        <>
          <Button onClick={() => { setEditingExtra({ name: "", price: 0, is_active: true, sort_order: 0 }); setIsExtraDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Extra
          </Button>
          <div className="grid gap-3">
            {extras.map(extra => (
              <Card key={extra.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="flex-1 font-medium">{extra.name}</span>
                  <span className="text-primary font-bold">R$ {Number(extra.price).toFixed(2).replace(".", ",")}</span>
                  <Switch checked={extra.is_active} onCheckedChange={async v => { await supabase.from("product_extras").update({ is_active: v }).eq("id", extra.id); fetchAll(); }} />
                  <Button size="icon" variant="ghost" onClick={() => { setEditingExtra(extra); setIsExtraDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteExtra(extra.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <Dialog open={isExtraDialogOpen} onOpenChange={setIsExtraDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingExtra?.id ? "Editar" : "Novo"} Extra</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nome" value={editingExtra?.name || ""} onChange={e => setEditingExtra({ ...editingExtra, name: e.target.value })} />
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

export default MenuManager;
