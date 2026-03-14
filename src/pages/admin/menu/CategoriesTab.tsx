import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

interface CategoriesTabProps {
  categories: Category[];
  productCounts: Record<string, number>;
  onRefresh: () => void;
}

export default function CategoriesTab({ categories, productCounts, onRefresh }: CategoriesTabProps) {
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const save = async () => {
    if (!editing?.name || !editing?.slug) { toast.error("Preencha nome e slug"); return; }
    const data = { name: editing.name, slug: editing.slug, icon: editing.icon || "", sort_order: editing.sort_order || 0, is_active: editing.is_active ?? true };
    if (editing.id) {
      await supabase.from("categories").update(data).eq("id", editing.id);
      toast.success("Categoria atualizada!");
    } else {
      await supabase.from("categories").insert(data);
      toast.success("Categoria criada!");
    }
    setIsOpen(false);
    onRefresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta categoria?")) return;
    await supabase.from("categories").delete().eq("id", id);
    toast.success("Categoria excluída");
    onRefresh();
  };

  const move = async (cat: Category, direction: "up" | "down") => {
    const sorted = [...categories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const idx = sorted.findIndex(c => c.id === cat.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    await Promise.all([
      supabase.from("categories").update({ sort_order: sorted[swapIdx].sort_order }).eq("id", cat.id),
      supabase.from("categories").update({ sort_order: cat.sort_order }).eq("id", sorted[swapIdx].id),
    ]);
    onRefresh();
  };

  const sorted = [...categories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Organize a ordem que as categorias aparecem no cardápio</p>
        <Button onClick={() => { setEditing({ name: "", slug: "", icon: "", sort_order: (sorted.length + 1) * 10, is_active: true }); setIsOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Categoria
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.map((cat, idx) => (
          <Card key={cat.id} className={`${!cat.is_active ? "opacity-50" : ""} transition-opacity`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => move(cat, "up")} disabled={idx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => move(cat, "down")} disabled={idx === sorted.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-2xl">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-foreground">{cat.name}</span>
                <p className="text-xs text-muted-foreground">{cat.slug} • {productCounts[cat.slug] || 0} produtos</p>
              </div>
              <Badge variant="secondary" className="text-xs">#{cat.sort_order}</Badge>
              <Switch checked={cat.is_active} onCheckedChange={async v => { await supabase.from("categories").update({ is_active: v }).eq("id", cat.id); onRefresh(); }} />
              <Button size="icon" variant="ghost" onClick={() => { setEditing(cat); setIsOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(cat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhuma categoria cadastrada</p>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} Categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input placeholder="Ex: 🍔 Hambúrgueres" value={editing?.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Slug (identificador único)</label>
              <Input placeholder="Ex: hamburgueres" value={editing?.slug || ""} onChange={e => setEditing({ ...editing, slug: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Ícone (emoji)</label>
                <Input placeholder="🍔" value={editing?.icon || ""} onChange={e => setEditing({ ...editing, icon: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ordem</label>
                <Input type="number" value={editing?.sort_order || 0} onChange={e => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <Button onClick={save} className="w-full">Salvar Categoria</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
