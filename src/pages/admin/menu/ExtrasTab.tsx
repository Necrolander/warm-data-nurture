import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Settings2, Copy, Image } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

interface ExtraGroup {
  id: string;
  name: string;
  description: string | null;
  max_select: number;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  applies_to_categories: string[] | null;
  applies_to_products: string[] | null;
}

interface Extra {
  id: string;
  name: string;
  description: string | null;
  price: number;
  group_id: string | null;
  max_quantity: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

interface CategoryInfo {
  slug: string;
  name: string;
  icon: string | null;
}

interface ProductInfo {
  id: string;
  name: string;
  category: string;
}

interface ExtrasTabProps {
  groups: ExtraGroup[];
  extras: Extra[];
  categories: CategoryInfo[];
  products: ProductInfo[];
  onRefresh: () => void;
}

export default function ExtrasTab({ groups, extras, categories, products, onRefresh }: ExtrasTabProps) {
  const [editingGroup, setEditingGroup] = useState<Partial<ExtraGroup> | null>(null);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<Partial<Extra> | null>(null);
  const [isExtraDialogOpen, setIsExtraDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);

  const sortedGroups = [...groups].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const toggleExpand = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ---- Group CRUD ----
  const saveGroup = async () => {
    if (!editingGroup?.name) { toast.error("Preencha o nome do grupo"); return; }
    const data = {
      name: editingGroup.name,
      description: editingGroup.description || null,
      max_select: editingGroup.max_select || 1,
      is_required: editingGroup.is_required ?? false,
      is_active: editingGroup.is_active ?? true,
      sort_order: editingGroup.sort_order || 0,
      applies_to_categories: editingGroup.applies_to_categories || [],
      applies_to_products: editingGroup.applies_to_products || [],
    };
    if (editingGroup.id) {
      const { error } = await supabase.from("extra_groups").update(data).eq("id", editingGroup.id);
      if (error) { toast.error("Erro ao atualizar grupo"); return; }
      toast.success("Grupo atualizado!");
    } else {
      const { error } = await supabase.from("extra_groups").insert(data);
      if (error) { toast.error("Erro ao criar grupo"); return; }
      toast.success("Grupo criado!");
    }
    setIsGroupDialogOpen(false);
    onRefresh();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Excluir este grupo e todos os adicionais dentro dele?")) return;
    // Delete extras in group first
    await supabase.from("product_extras").delete().eq("group_id", id);
    await supabase.from("extra_groups").delete().eq("id", id);
    toast.success("Grupo excluído");
    onRefresh();
  };

  const duplicateGroup = async (group: ExtraGroup) => {
    const groupExtras = extras.filter(e => e.group_id === group.id);
    const { data: newGroup, error } = await supabase.from("extra_groups").insert({
      name: `${group.name} (cópia)`,
      description: group.description,
      max_select: group.max_select,
      is_required: group.is_required,
      is_active: group.is_active,
      sort_order: group.sort_order + 1,
      applies_to_categories: group.applies_to_categories,
      applies_to_products: group.applies_to_products,
    }).select().single();

    if (error || !newGroup) { toast.error("Erro ao duplicar"); return; }

    if (groupExtras.length > 0) {
      await supabase.from("product_extras").insert(
        groupExtras.map(e => ({
          name: e.name, description: e.description, price: e.price,
          group_id: newGroup.id, max_quantity: e.max_quantity,
          image_url: e.image_url, is_active: e.is_active, sort_order: e.sort_order,
        }))
      );
    }
    toast.success("Grupo duplicado!");
    onRefresh();
  };

  const moveGroup = async (group: ExtraGroup, direction: "up" | "down") => {
    const idx = sortedGroups.findIndex(g => g.id === group.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedGroups.length) return;
    await Promise.all([
      supabase.from("extra_groups").update({ sort_order: sortedGroups[swapIdx].sort_order }).eq("id", group.id),
      supabase.from("extra_groups").update({ sort_order: group.sort_order }).eq("id", sortedGroups[swapIdx].id),
    ]);
    onRefresh();
  };

  // ---- Extra CRUD ----
  const saveExtra = async () => {
    if (!editingExtra?.name) { toast.error("Preencha o nome"); return; }
    const data = {
      name: editingExtra.name,
      description: editingExtra.description || null,
      price: editingExtra.price || 0,
      group_id: editingExtra.group_id || null,
      max_quantity: editingExtra.max_quantity || 1,
      image_url: editingExtra.image_url || null,
      is_active: editingExtra.is_active ?? true,
      sort_order: editingExtra.sort_order || 0,
    };
    if (editingExtra.id) {
      const { error } = await supabase.from("product_extras").update(data).eq("id", editingExtra.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Adicional atualizado!");
    } else {
      const { error } = await supabase.from("product_extras").insert(data);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Adicional criado!");
    }
    setIsExtraDialogOpen(false);
    onRefresh();
  };

  const deleteExtra = async (id: string) => {
    if (!confirm("Excluir este adicional?")) return;
    await supabase.from("product_extras").delete().eq("id", id);
    toast.success("Adicional excluído");
    onRefresh();
  };

  const duplicateExtra = async (extra: Extra) => {
    const { id, ...rest } = extra;
    await supabase.from("product_extras").insert({ ...rest, name: `${rest.name} (cópia)`, sort_order: rest.sort_order + 1 });
    toast.success("Adicional duplicado!");
    onRefresh();
  };

  const moveExtra = async (extra: Extra, direction: "up" | "down") => {
    const groupExtras = extras.filter(e => e.group_id === extra.group_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const idx = groupExtras.findIndex(e => e.id === extra.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= groupExtras.length) return;
    await Promise.all([
      supabase.from("product_extras").update({ sort_order: groupExtras[swapIdx].sort_order }).eq("id", extra.id),
      supabase.from("product_extras").update({ sort_order: extra.sort_order }).eq("id", groupExtras[swapIdx].id),
    ]);
    onRefresh();
  };

  const uploadExtraImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `extras/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      setEditingExtra(prev => prev ? { ...prev, image_url: data.publicUrl } : prev);
      toast.success("Imagem enviada!");
    } catch {
      toast.error("Erro ao enviar imagem");
    }
    setUploading(false);
  };

  const toggleGroupCategory = (slug: string) => {
    if (!editingGroup) return;
    const cats = editingGroup.applies_to_categories || [];
    const updated = cats.includes(slug) ? cats.filter(c => c !== slug) : [...cats, slug];
    setEditingGroup({ ...editingGroup, applies_to_categories: updated });
  };

  const toggleGroupProduct = (productId: string) => {
    if (!editingGroup) return;
    const prods = editingGroup.applies_to_products || [];
    const updated = prods.includes(productId) ? prods.filter(p => p !== productId) : [...prods, productId];
    setEditingGroup({ ...editingGroup, applies_to_products: updated });
  };

  // Extras without a group
  const ungroupedExtras = extras.filter(e => !e.group_id || !groups.some(g => g.id === e.group_id));

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Gerencie grupos de adicionais e seus itens</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            setEditingExtra({ name: "", price: 0, is_active: true, sort_order: 0, group_id: null, max_quantity: 1, description: null, image_url: null });
            setIsExtraDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-1" /> Adicional Avulso
          </Button>
          <Button onClick={() => {
            setEditingGroup({ name: "", description: null, max_select: 5, is_required: false, is_active: true, sort_order: (sortedGroups.length + 1) * 10, applies_to_categories: [], applies_to_products: [] });
            setIsGroupDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Grupo
          </Button>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-3">
        {sortedGroups.map((group, gIdx) => {
          const groupExtras = extras.filter(e => e.group_id === group.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          const isExpanded = expandedGroups.has(group.id);
          const appliedCats = (group.applies_to_categories || []).map(s => categories.find(c => c.slug === s)?.name || s);
          const appliedProds = (group.applies_to_products || []).map(pid => products.find(p => p.id === pid)?.name || pid);

          return (
            <div key={group.id} className={`border rounded-xl overflow-hidden ${!group.is_active ? "opacity-50" : "border-border"}`}>
              {/* Group Header */}
              <div className="flex items-center gap-2 p-3 bg-muted/50">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveGroup(group, "up")} disabled={gIdx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground">
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button onClick={() => moveGroup(group, "down")} disabled={gIdx === sortedGroups.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground">
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                <button onClick={() => toggleExpand(group.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{group.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{groupExtras.length} itens</Badge>
                      {group.is_required && <Badge variant="destructive" className="text-[10px]">Obrigatório</Badge>}
                      <Badge variant="outline" className="text-[10px]">Máx {group.max_select}</Badge>
                    </div>
                    {(appliedCats.length > 0 || appliedProds.length > 0) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {appliedCats.length > 0 && `Categorias: ${appliedCats.join(", ")}`}
                        {appliedCats.length > 0 && appliedProds.length > 0 && " | "}
                        {appliedProds.length > 0 && `Produtos: ${appliedProds.join(", ")}`}
                      </p>
                    )}
                  </div>
                </button>

                <Switch checked={group.is_active} onCheckedChange={async v => { await supabase.from("extra_groups").update({ is_active: v }).eq("id", group.id); onRefresh(); }} />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => duplicateGroup(group)} title="Duplicar"><Copy className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingGroup(group); setIsGroupDialogOpen(true); }} title="Editar"><Settings2 className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteGroup(group.id)} title="Excluir"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>

              {/* Group Extras */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="divide-y divide-border">
                      {groupExtras.map((extra, eIdx) => (
                        <ExtraRow
                          key={extra.id}
                          extra={extra}
                          isFirst={eIdx === 0}
                          isLast={eIdx === groupExtras.length - 1}
                          onEdit={() => { setEditingExtra(extra); setIsExtraDialogOpen(true); }}
                          onDelete={() => deleteExtra(extra.id)}
                          onDuplicate={() => duplicateExtra(extra)}
                          onMoveUp={() => moveExtra(extra, "up")}
                          onMoveDown={() => moveExtra(extra, "down")}
                          onToggle={async v => { await supabase.from("product_extras").update({ is_active: v }).eq("id", extra.id); onRefresh(); }}
                        />
                      ))}
                      {groupExtras.length === 0 && (
                        <p className="text-center text-muted-foreground text-sm py-4">Nenhum adicional neste grupo</p>
                      )}
                      <div className="p-2 bg-muted/30">
                        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => {
                          setEditingExtra({ name: "", price: 0, is_active: true, sort_order: (groupExtras.length + 1) * 10, group_id: group.id, max_quantity: group.max_select, description: null, image_url: null });
                          setIsExtraDialogOpen(true);
                        }}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item ao grupo
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Ungrouped extras */}
        {ungroupedExtras.length > 0 && (
          <div className="border border-dashed border-border rounded-xl overflow-hidden">
            <div className="p-3 bg-muted/30">
              <span className="font-bold text-muted-foreground">⚠️ Adicionais sem grupo</span>
              <Badge variant="secondary" className="text-[10px] ml-2">{ungroupedExtras.length}</Badge>
            </div>
            <div className="divide-y divide-border">
              {ungroupedExtras.map((extra, eIdx) => (
                <ExtraRow
                  key={extra.id}
                  extra={extra}
                  isFirst={eIdx === 0}
                  isLast={eIdx === ungroupedExtras.length - 1}
                  onEdit={() => { setEditingExtra(extra); setIsExtraDialogOpen(true); }}
                  onDelete={() => deleteExtra(extra.id)}
                  onDuplicate={() => duplicateExtra(extra)}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
                  onToggle={async v => { await supabase.from("product_extras").update({ is_active: v }).eq("id", extra.id); onRefresh(); }}
                />
              ))}
            </div>
          </div>
        )}

        {sortedGroups.length === 0 && ungroupedExtras.length === 0 && (
          <p className="text-center text-muted-foreground py-12">Nenhum grupo de adicional cadastrado. Crie um grupo para começar!</p>
        )}
      </div>

      {/* ---- Group Dialog ---- */}
      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingGroup?.id ? "Editar" : "Novo"} Grupo de Adicionais</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome do grupo</label>
              <Input placeholder="Ex: Escolha seu hambúrguer" value={editingGroup?.name || ""} onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
              <Textarea placeholder="Ex: Escolha até 2 itens" value={editingGroup?.description || ""} onChange={e => setEditingGroup({ ...editingGroup, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Máx. seleções</label>
                <Input type="number" min={1} value={editingGroup?.max_select || 1} onChange={e => setEditingGroup({ ...editingGroup, max_select: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Ordem</label>
                <Input type="number" value={editingGroup?.sort_order || 0} onChange={e => setEditingGroup({ ...editingGroup, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <Switch checked={editingGroup?.is_required ?? false} onCheckedChange={v => setEditingGroup({ ...editingGroup, is_required: v })} />
              <div>
                <span className="font-bold text-foreground text-sm">Obrigatório</span>
                <p className="text-xs text-muted-foreground">Cliente precisa selecionar a quantidade máxima</p>
              </div>
            </div>

            {/* Apply to categories */}
            <div>
              <label className="text-xs font-bold text-foreground mb-2 block">📂 Aplicar a categorias</label>
              <p className="text-xs text-muted-foreground mb-2">Selecione em quais categorias este grupo aparece</p>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const checked = (editingGroup?.applies_to_categories || []).includes(cat.slug);
                  return (
                    <label key={cat.slug} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all ${checked ? "border-primary bg-primary/10 font-bold" : "border-border hover:border-muted-foreground"}`}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleGroupCategory(cat.slug)} />
                      {cat.icon} {cat.name}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Apply to specific products */}
            <div>
              <label className="text-xs font-bold text-foreground mb-2 block">📦 Aplicar a produtos específicos (opcional)</label>
              <p className="text-xs text-muted-foreground mb-2">Se selecionado, aparece APENAS nesses produtos (ignora categorias)</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {products.map(prod => {
                  const checked = (editingGroup?.applies_to_products || []).includes(prod.id);
                  return (
                    <label key={prod.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all ${checked ? "border-primary bg-primary/10 font-bold" : "border-border hover:border-muted-foreground"}`}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleGroupProduct(prod.id)} />
                      <span className="truncate">{prod.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{prod.category}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button onClick={saveGroup} className="w-full">Salvar Grupo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Extra Dialog ---- */}
      <Dialog open={isExtraDialogOpen} onOpenChange={setIsExtraDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingExtra?.id ? "Editar" : "Novo"} Adicional</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input placeholder="Ex: Queijo Extra" value={editingExtra?.name || ""} onChange={e => setEditingExtra({ ...editingExtra, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
              <Textarea placeholder="Ex: Fatia extra de queijo cheddar" value={editingExtra?.description || ""} onChange={e => setEditingExtra({ ...editingExtra, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Preço (R$)</label>
                <Input type="number" step="0.01" value={editingExtra?.price || ""} onChange={e => setEditingExtra({ ...editingExtra, price: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Máx. qtd</label>
                <Input type="number" min={1} value={editingExtra?.max_quantity || 1} onChange={e => setEditingExtra({ ...editingExtra, max_quantity: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ordem</label>
                <Input type="number" value={editingExtra?.sort_order || 0} onChange={e => setEditingExtra({ ...editingExtra, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            {/* Image */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Imagem (opcional)</label>
              {editingExtra?.image_url && (
                <img src={editingExtra.image_url} alt="Preview" className="w-20 h-20 object-cover rounded-lg mb-2" />
              )}
              <div className="flex gap-2">
                <Input placeholder="URL da imagem" value={editingExtra?.image_url || ""} onChange={e => setEditingExtra({ ...editingExtra, image_url: e.target.value })} className="flex-1" />
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" className="h-10" asChild disabled={uploading}>
                    <span>{uploading ? "..." : <><Image className="h-4 w-4 mr-1" /> Upload</>}</span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadExtraImage(e.target.files[0]); }} />
                </label>
              </div>
            </div>

            {/* Group assignment */}
            <div>
              <label className="text-xs text-muted-foreground">Grupo</label>
              <select
                className="w-full border border-border rounded-lg p-2 text-sm bg-background text-foreground"
                value={editingExtra?.group_id || ""}
                onChange={e => setEditingExtra({ ...editingExtra, group_id: e.target.value || null })}
              >
                <option value="">Sem grupo</option>
                {sortedGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <Button onClick={saveExtra} className="w-full">Salvar Adicional</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExtraRow({ extra, isFirst, isLast, onEdit, onDelete, onDuplicate, onMoveUp, onMoveDown, onToggle }: {
  extra: Extra; isFirst: boolean; isLast: boolean;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
  onMoveUp: () => void; onMoveDown: () => void; onToggle: (v: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 ${!extra.is_active ? "opacity-40" : ""}`}>
      <div className="flex flex-col gap-0.5">
        <button onClick={onMoveUp} disabled={isFirst} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground">
          <ArrowUp className="h-3 w-3" />
        </button>
        <button onClick={onMoveDown} disabled={isLast} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground">
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>
      {extra.image_url ? (
        <img src={extra.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0 text-muted-foreground text-xs">🧀</div>
      )}
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm text-foreground truncate block">{extra.name}</span>
        {extra.description && <p className="text-[10px] text-muted-foreground truncate">{extra.description}</p>}
        <div className="flex items-center gap-2">
          <span className="text-primary font-bold text-xs">
            {Number(extra.price) > 0 ? `R$ ${Number(extra.price).toFixed(2).replace(".", ",")}` : "Grátis"}
          </span>
          <span className="text-[10px] text-muted-foreground">Máx {extra.max_quantity || 1}</span>
        </div>
      </div>
      <Switch checked={extra.is_active} onCheckedChange={onToggle} />
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDuplicate} title="Duplicar"><Copy className="h-3 w-3" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Editar"><Pencil className="h-3 w-3" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete} title="Excluir"><Trash2 className="h-3 w-3 text-destructive" /></Button>
    </div>
  );
}
