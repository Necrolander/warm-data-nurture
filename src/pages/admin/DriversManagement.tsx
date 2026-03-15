import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { User, Phone, MapPin, Plus, Edit, Power, Pause, Eye } from "lucide-react";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  available: { label: "Disponível", variant: "default" },
  on_route: { label: "Em Rota", variant: "secondary" },
  paused: { label: "Pausado", variant: "outline" },
  offline: { label: "Offline", variant: "destructive" },
};

const DriversManagement = () => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editDriver, setEditDriver] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "", password: "" });

  const loadDrivers = async () => {
    setLoading(true);
    const { data } = await supabase.from("delivery_persons").select("*").order("name");
    setDrivers(data || []);
    setLoading(false);
  };

  useEffect(() => { loadDrivers(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.phone) { toast.error("Preencha nome e telefone"); return; }
    
    if (editDriver) {
      const updates: any = { name: form.name, phone: form.phone };
      if (form.password) updates.password_hash = form.password;
      await supabase.from("delivery_persons").update(updates).eq("id", editDriver.id);
      toast.success("Entregador atualizado!");
    } else {
      await supabase.from("delivery_persons").insert({
        name: form.name,
        phone: form.phone,
        password_hash: form.password || null,
        is_active: true,
        status: "offline",
      } as any);
      toast.success("Entregador cadastrado!");
    }
    setForm({ name: "", phone: "", password: "" });
    setShowAdd(false);
    setEditDriver(null);
    loadDrivers();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("delivery_persons").update({ is_active: !active } as any).eq("id", id);
    toast.success(active ? "Desativado" : "Ativado");
    loadDrivers();
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from("delivery_persons").update({ status, is_online: status !== "offline" } as any).eq("id", id);
    loadDrivers();
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Entregadores</h2>
        <Dialog open={showAdd || !!editDriver} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditDriver(null); } }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { setForm({ name: "", phone: "", password: "" }); setShowAdd(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editDriver ? "Editar" : "Novo"} Entregador</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>Senha</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editDriver ? "Deixe vazio para manter" : ""} /></div>
              <Button className="w-full" onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {drivers.map(d => {
          const st = statusLabels[(d as any).status || "offline"] || statusLabels.offline;
          return (
            <Card key={d.id} className={`${!d.is_active ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="font-bold text-foreground">{d.name}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {!d.is_active && <Badge variant="destructive">Inativo</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span><Phone className="w-3 h-3 inline" /> {d.phone}</span>
                      {d.current_lat && <span><MapPin className="w-3 h-3 inline" /> Localizado</span>}
                      {d.location_updated_at && (
                        <span>Atualizado: {new Date(d.location_updated_at).toLocaleTimeString("pt-BR")}</span>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Vel. média: {(d as any).avg_speed_kmh || 25}km/h</span>
                      <span>Cap.: {(d as any).avg_capacity_per_hour || 6}/h</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setForm({ name: d.name, phone: d.phone, password: "" }); setEditDriver(d); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(d.id, d.is_active!)}>
                      <Power className="w-4 h-4" />
                    </Button>
                    {d.is_active && d.is_online && (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(d.id, (d as any).status === "paused" ? "available" : "paused")}>
                        <Pause className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {drivers.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum entregador cadastrado.</CardContent></Card>
        )}
      </div>
    </div>
  );
};

export default DriversManagement;
