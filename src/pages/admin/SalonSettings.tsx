import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Settings, Printer } from "lucide-react";
import { toast } from "sonner";

interface Waiter {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
}

const SalonSettings = () => {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [editingWaiter, setEditingWaiter] = useState<Partial<Waiter> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [serviceFee, setServiceFee] = useState("10");
  const [hasChanges, setHasChanges] = useState(false);

  const fetchAll = async () => {
    const { data: w } = await supabase.from("waiters").select("*").order("name");
    if (w) setWaiters(w as Waiter[]);

    const { data: s } = await supabase.from("store_settings").select("*").eq("key", "service_fee").single();
    if (s) setServiceFee(s.value);
  };

  useEffect(() => { fetchAll(); }, []);

  const saveServiceFee = async () => {
    await supabase.from("store_settings").upsert({ key: "service_fee", value: serviceFee }, { onConflict: "key" });
    toast.success("Taxa de serviço atualizada!");
    setHasChanges(false);
  };

  const saveWaiter = async () => {
    if (!editingWaiter?.name) { toast.error("Preencha o nome"); return; }
    const data = { name: editingWaiter.name, phone: editingWaiter.phone || "", is_active: editingWaiter.is_active ?? true };
    if (editingWaiter.id) {
      await supabase.from("waiters").update(data).eq("id", editingWaiter.id);
      toast.success("Garçom atualizado!");
    } else {
      await supabase.from("waiters").insert(data);
      toast.success("Garçom cadastrado!");
    }
    setIsDialogOpen(false);
    fetchAll();
  };

  const deleteWaiter = async (id: string) => {
    await supabase.from("waiters").delete().eq("id", id);
    toast.success("Garçom removido");
    fetchAll();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Service Fee */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Taxa de Serviço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input type="number" value={serviceFee} onChange={e => { setServiceFee(e.target.value); setHasChanges(true); }} className="w-24" />
            <span className="text-sm">%</span>
            {hasChanges && <Button size="sm" onClick={saveServiceFee}>Salvar</Button>}
          </div>
          <p className="text-sm text-muted-foreground">O garçom pode escolher imprimir com ou sem taxa de serviço na hora do pagamento.</p>
        </CardContent>
      </Card>

      {/* Waiters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Meus Garçons</CardTitle>
            <Button size="sm" onClick={() => { setEditingWaiter({ name: "", phone: "", is_active: true }); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {waiters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum garçom cadastrado</p>
            ) : waiters.map(waiter => (
              <div key={waiter.id} className="flex items-center justify-between p-2 rounded border border-border">
                <div>
                  <span className="font-medium">{waiter.name}</span>
                  {waiter.phone && <span className="text-sm text-muted-foreground ml-2">{waiter.phone}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={waiter.is_active} onCheckedChange={async v => { await supabase.from("waiters").update({ is_active: v }).eq("id", waiter.id); fetchAll(); }} />
                  <Button size="icon" variant="ghost" onClick={() => { setEditingWaiter(waiter); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteWaiter(waiter.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Printers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Printer className="h-4 w-4" /> Impressoras</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Configuração de impressoras será integrada com o sistema de impressão térmica. Configure separação: uma para delivery e outra para salão.</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between p-2 rounded border border-border">
              <span className="text-sm">Impressora Delivery</span>
              <span className="text-sm text-muted-foreground">Não configurada</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded border border-border">
              <span className="text-sm">Impressora Salão</span>
              <span className="text-sm text-muted-foreground">Não configurada</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingWaiter?.id ? "Editar" : "Novo"} Garçom</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome" value={editingWaiter?.name || ""} onChange={e => setEditingWaiter({ ...editingWaiter, name: e.target.value })} />
            <Input placeholder="Telefone" value={editingWaiter?.phone || ""} onChange={e => setEditingWaiter({ ...editingWaiter, phone: e.target.value })} />
            <Button onClick={saveWaiter} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalonSettings;
