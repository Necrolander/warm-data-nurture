import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Store, MapPin, Clock, Truck, CreditCard, Save, Plus, Trash2, Pencil, Calculator,
} from "lucide-react";
import { toast } from "sonner";

interface ScheduleDay {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

interface Region {
  id: string;
  name: string;
  fee: number;
  is_active: boolean;
  sort_order: number;
}

const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const Establishment = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Partial<Region> | null>(null);
  const [isRegionDialogOpen, setIsRegionDialogOpen] = useState(false);

  // Change calculator
  const [orderTotal, setOrderTotal] = useState("");
  const [cashAmount, setCashAmount] = useState("");

  const fetchAll = async () => {
    const [s, sch, r] = await Promise.all([
      supabase.from("store_settings").select("*"),
      supabase.from("store_schedule").select("*").order("day_of_week"),
      supabase.from("delivery_regions").select("*").order("sort_order"),
    ]);
    if (s.data) {
      const map: Record<string, string> = {};
      s.data.forEach((item: any) => { map[item.key] = item.value; });
      setSettings(map);
    }
    if (sch.data) setSchedule(sch.data as ScheduleDay[]);
    if (r.data) setRegions(r.data as Region[]);
  };

  useEffect(() => { fetchAll(); }, []);

  const updateSetting = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  const saveSettings = async () => {
    const keys = [
      "store_full_address", "store_address", "min_order", "delivery_time",
      "delivery_enabled", "pickup_enabled",
      "payment_pix", "payment_credit", "payment_debit", "payment_cash",
    ];
    for (const key of keys) {
      if (settings[key] !== undefined) {
        await supabase.from("store_settings").upsert({ key, value: settings[key] }, { onConflict: "key" });
      }
    }
    toast.success("Configurações salvas!");
    setHasChanges(false);
  };

  const updateSchedule = async (id: string, field: string, value: any) => {
    await supabase.from("store_schedule").update({ [field]: value } as any).eq("id", id);
    fetchAll();
  };

  // Region CRUD
  const saveRegion = async () => {
    if (!editingRegion?.name) { toast.error("Preencha o nome"); return; }
    const data = { name: editingRegion.name, fee: editingRegion.fee || 0, is_active: editingRegion.is_active ?? true, sort_order: editingRegion.sort_order || 0 };
    if (editingRegion.id) {
      await supabase.from("delivery_regions").update(data).eq("id", editingRegion.id);
    } else {
      await supabase.from("delivery_regions").insert(data);
    }
    toast.success("Região salva!");
    setIsRegionDialogOpen(false);
    fetchAll();
  };

  const deleteRegion = async (id: string) => {
    await supabase.from("delivery_regions").delete().eq("id", id);
    toast.success("Região removida");
    fetchAll();
  };

  const changeAmount = cashAmount && orderTotal
    ? (parseFloat(cashAmount) - parseFloat(orderTotal)).toFixed(2)
    : null;

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Store className="h-5 w-5 text-primary" /> Estabelecimento
      </h2>

      {/* Address */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Endereço</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium">Endereço completo</label>
            <Input value={settings.store_full_address || ""} onChange={e => updateSetting("store_full_address", e.target.value)} placeholder="Quadra X, Lote Y, Gama - DF" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Cidade/Região (exibição curta)</label>
            <Input value={settings.store_address || ""} onChange={e => updateSetting("store_address", e.target.value)} placeholder="Gama - DF" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Hours */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Horários de Funcionamento</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {schedule.map(day => (
            <div key={day.id} className="flex items-center gap-2 flex-wrap">
              <span className="w-20 text-sm font-medium">{dayNames[day.day_of_week]}</span>
              <Switch checked={day.is_open} onCheckedChange={v => updateSchedule(day.id, "is_open", v)} />
              {day.is_open && (
                <>
                  <Input type="time" value={day.open_time} onChange={e => updateSchedule(day.id, "open_time", e.target.value)} className="w-28" />
                  <span className="text-muted-foreground">até</span>
                  <Input type="time" value={day.close_time} onChange={e => updateSchedule(day.id, "close_time", e.target.value)} className="w-28" />
                </>
              )}
              {!day.is_open && <Badge variant="secondary">Fechado</Badge>}
            </div>
          ))}

          <div className="border-t border-border pt-3 mt-3">
            <label className="text-sm font-medium">Tempo de entrega (exibido ao cliente)</label>
            <Input value={settings.delivery_time || ""} onChange={e => updateSetting("delivery_time", e.target.value)} placeholder="30-50 min" className="w-40 mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Delivery options */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Formas de Entrega</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={settings.delivery_enabled === "true"} onCheckedChange={v => updateSetting("delivery_enabled", String(v))} />
            <span className="text-sm">🛵 Delivery (entrega até o cliente)</span>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={settings.pickup_enabled === "true"} onCheckedChange={v => updateSetting("pickup_enabled", String(v))} />
            <span className="text-sm">🏠 Retirada no local</span>
          </div>
          <div>
            <label className="text-sm font-medium">Taxa mínima de pedido (R$)</label>
            <Input type="number" step="0.01" value={settings.min_order || ""} onChange={e => updateSetting("min_order", e.target.value)} className="w-32 mt-1" placeholder="10.00" />
          </div>
        </CardContent>
      </Card>

      {/* Delivery Regions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Regiões de Atendimento</CardTitle>
            <Button size="sm" onClick={() => { setEditingRegion({ name: "", fee: 0, is_active: true, sort_order: regions.length + 1 }); setIsRegionDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {regions.map(region => (
              <div key={region.id} className="flex items-center justify-between p-2 rounded border border-border">
                <div className="flex items-center gap-2">
                  <Switch checked={region.is_active} onCheckedChange={async v => { await supabase.from("delivery_regions").update({ is_active: v }).eq("id", region.id); fetchAll(); }} />
                  <span className="font-medium text-sm">{region.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">R$ {Number(region.fee).toFixed(2).replace(".", ",")}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => { setEditingRegion(region); setIsRegionDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteRegion(region.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Formas de Pagamento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "payment_pix", label: "PIX" },
            { key: "payment_credit", label: "Cartão de Crédito" },
            { key: "payment_debit", label: "Cartão de Débito" },
            { key: "payment_cash", label: "Dinheiro (com troco)" },
          ].map(p => (
            <div key={p.key} className="flex items-center gap-3">
              <Switch checked={settings[p.key] === "true"} onCheckedChange={v => updateSetting(p.key, String(v))} />
              <span className="text-sm">{p.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Change Calculator */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Calculadora de Troco</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Calcule quanto troco o motoboy precisa levar</p>
          <div className="flex gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Valor do pedido</label>
              <Input type="number" step="0.01" placeholder="70.00" value={orderTotal} onChange={e => setOrderTotal(e.target.value)} className="w-32" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cliente paga com</label>
              <Input type="number" step="0.01" placeholder="100.00" value={cashAmount} onChange={e => setCashAmount(e.target.value)} className="w-32" />
            </div>
            {changeAmount !== null && (
              <div className="pb-2">
                <span className="text-sm text-muted-foreground">Troco: </span>
                <span className={`font-bold text-lg ${parseFloat(changeAmount) >= 0 ? "text-primary" : "text-destructive"}`}>
                  R$ {parseFloat(changeAmount).toFixed(2).replace(".", ",")}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <Button onClick={saveSettings} className="w-full">
          <Save className="h-4 w-4 mr-1" /> Salvar Alterações
        </Button>
      )}

      {/* Region dialog */}
      <Dialog open={isRegionDialogOpen} onOpenChange={setIsRegionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRegion?.id ? "Editar" : "Nova"} Região</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome (ex: Gama)" value={editingRegion?.name || ""} onChange={e => setEditingRegion({ ...editingRegion, name: e.target.value })} />
            <Input type="number" step="0.5" placeholder="Taxa de frete (R$)" value={editingRegion?.fee || ""} onChange={e => setEditingRegion({ ...editingRegion, fee: parseFloat(e.target.value) || 0 })} />
            <Button onClick={saveRegion} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Establishment;
