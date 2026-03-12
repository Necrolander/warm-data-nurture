import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Gift, Ticket } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Promotion {
  id: string;
  type: string;
  name: string;
  value: number;
  is_percentage: boolean;
  min_order: number;
  code: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

const emptyPromo: Partial<Promotion> = {
  type: "coupon",
  name: "",
  value: 0,
  is_percentage: true,
  min_order: 0,
  code: "",
  is_active: false,
};

const CashbackCoupons = () => {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [editing, setEditing] = useState<Partial<Promotion> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchPromos = async () => {
    const { data } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
    if (data) setPromos(data as Promotion[]);
  };

  useEffect(() => { fetchPromos(); }, []);

  const savePromo = async () => {
    if (!editing?.name) { toast.error("Preencha o nome"); return; }
    const data = {
      type: editing.type || "coupon",
      name: editing.name,
      value: editing.value || 0,
      is_percentage: editing.is_percentage ?? true,
      min_order: editing.min_order || 0,
      code: editing.code || null,
      is_active: editing.is_active ?? false,
      starts_at: editing.starts_at || null,
      ends_at: editing.ends_at || null,
    };
    if (editing.id) {
      await supabase.from("promotions").update(data).eq("id", editing.id);
      toast.success("Promoção atualizada!");
    } else {
      await supabase.from("promotions").insert(data);
      toast.success("Promoção criada!");
    }
    setIsDialogOpen(false);
    fetchPromos();
  };

  const deletePromo = async (id: string) => {
    await supabase.from("promotions").delete().eq("id", id);
    toast.success("Promoção excluída");
    fetchPromos();
  };

  const togglePromo = async (id: string, active: boolean) => {
    await supabase.from("promotions").update({ is_active: active }).eq("id", id);
    fetchPromos();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" /> Cashback & Cupons
        </h2>
        <Button onClick={() => { setEditing({ ...emptyPromo }); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Promoção
        </Button>
      </div>

      <div className="grid gap-3">
        {promos.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma promoção cadastrada</p>
        ) : promos.map(promo => (
          <Card key={promo.id} className={!promo.is_active ? "opacity-50" : ""}>
            <CardContent className="p-4 flex items-center gap-3">
              {promo.type === "cashback" ? <Gift className="h-5 w-5 text-primary" /> : <Ticket className="h-5 w-5 text-primary" />}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{promo.name}</span>
                  <Badge variant="outline">{promo.type === "cashback" ? "Cashback" : "Cupom"}</Badge>
                  {promo.code && <Badge variant="secondary">{promo.code}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {promo.is_percentage ? `${Number(promo.value)}%` : `R$ ${Number(promo.value).toFixed(2).replace(".", ",")}`} de desconto
                  {promo.min_order > 0 && ` • Mín: R$ ${Number(promo.min_order).toFixed(2).replace(".", ",")}`}
                  {promo.ends_at && ` • Até ${new Date(promo.ends_at).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <Switch checked={promo.is_active} onCheckedChange={v => togglePromo(promo.id, v)} />
              <Button size="icon" variant="ghost" onClick={() => { setEditing(promo); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => deletePromo(promo.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} Promoção</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={editing?.type || "coupon"} onValueChange={v => setEditing({ ...editing, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="coupon">Cupom</SelectItem>
                <SelectItem value="cashback">Cashback</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Nome (ex: Black Friday 20%)" value={editing?.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            <div className="flex gap-2">
              <Input type="number" step="0.01" placeholder="Valor" value={editing?.value || ""} onChange={e => setEditing({ ...editing, value: parseFloat(e.target.value) || 0 })} />
              <Select value={editing?.is_percentage ? "percent" : "fixed"} onValueChange={v => setEditing({ ...editing, is_percentage: v === "percent" })}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">%</SelectItem>
                  <SelectItem value="fixed">R$</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editing?.type === "coupon" && (
              <Input placeholder="Código do cupom (ex: PROMO10)" value={editing?.code || ""} onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
            )}
            <Input type="number" step="0.01" placeholder="Pedido mínimo (R$)" value={editing?.min_order || ""} onChange={e => setEditing({ ...editing, min_order: parseFloat(e.target.value) || 0 })} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm">Início</label>
                <Input type="date" value={editing?.starts_at?.split("T")[0] || ""} onChange={e => setEditing({ ...editing, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div>
                <label className="text-sm">Fim</label>
                <Input type="date" value={editing?.ends_at?.split("T")[0] || ""} onChange={e => setEditing({ ...editing, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
            </div>
            <Button onClick={savePromo} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashbackCoupons;
