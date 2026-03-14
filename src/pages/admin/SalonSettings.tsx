import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Settings, Printer, Mail, Key, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

interface Waiter {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  user_id: string | null;
  is_active: boolean;
}

const SalonSettings = () => {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [editingWaiter, setEditingWaiter] = useState<Partial<Waiter> & { password?: string } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [serviceFee, setServiceFee] = useState("10");
  const [hasChanges, setHasChanges] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    const { data: w } = await supabase.from("waiters").select("*").order("name");
    if (w) setWaiters(w as any as Waiter[]);
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
    if (!editingWaiter?.email) { toast.error("Preencha o email"); return; }
    setSaving(true);

    try {
      if (editingWaiter.id && editingWaiter.user_id) {
        // Update existing waiter with auth
        const updatePayload: any = {
          action: "update",
          user_id: editingWaiter.user_id,
          waiter_id: editingWaiter.id,
          name: editingWaiter.name,
          phone: editingWaiter.phone || "",
          email: editingWaiter.email,
        };
        if (editingWaiter.password && editingWaiter.password.length >= 6) {
          updatePayload.password = editingWaiter.password;
        }

        const { data, error } = await supabase.functions.invoke("manage-waiter-auth", { body: updatePayload });
        if (error || data?.error) { toast.error(data?.error || "Erro ao atualizar"); setSaving(false); return; }

        // Also update the waiters table directly for name/phone
        await supabase.from("waiters").update({
          name: editingWaiter.name,
          phone: editingWaiter.phone || "",
          email: editingWaiter.email,
        } as any).eq("id", editingWaiter.id);

        toast.success("Garçom atualizado!");
      } else if (editingWaiter.id && !editingWaiter.user_id) {
        // Existing waiter record without auth - create auth account
        if (!editingWaiter.password || editingWaiter.password.length < 6) {
          toast.error("Defina uma senha (mín. 6 caracteres)");
          setSaving(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke("manage-waiter-auth", {
          body: {
            action: "create",
            email: editingWaiter.email,
            password: editingWaiter.password,
            name: editingWaiter.name,
            phone: editingWaiter.phone || "",
            waiter_id: editingWaiter.id,
          },
        });
        if (error || data?.error) { toast.error(data?.error || "Erro ao criar conta"); setSaving(false); return; }

        await supabase.from("waiters").update({
          name: editingWaiter.name,
          phone: editingWaiter.phone || "",
          email: editingWaiter.email,
        } as any).eq("id", editingWaiter.id);

        toast.success("Conta de acesso criada!");
      } else {
        // New waiter
        if (!editingWaiter.password || editingWaiter.password.length < 6) {
          toast.error("Defina uma senha (mín. 6 caracteres)");
          setSaving(false);
          return;
        }

        // Create waiter record first
        const { data: newW, error: insertErr } = await supabase.from("waiters").insert({
          name: editingWaiter.name,
          phone: editingWaiter.phone || "",
          email: editingWaiter.email,
          is_active: true,
        } as any).select().single();

        if (insertErr || !newW) { toast.error("Erro ao cadastrar garçom"); setSaving(false); return; }

        // Create auth account
        const { data, error } = await supabase.functions.invoke("manage-waiter-auth", {
          body: {
            action: "create",
            email: editingWaiter.email,
            password: editingWaiter.password,
            name: editingWaiter.name,
            phone: editingWaiter.phone || "",
            waiter_id: (newW as any).id,
          },
        });
        if (error || data?.error) { toast.error(data?.error || "Erro ao criar conta de acesso"); setSaving(false); return; }

        toast.success("Garçom cadastrado com acesso!");
      }
    } catch (e: any) {
      toast.error("Erro inesperado");
      console.error(e);
    }

    setSaving(false);
    setIsDialogOpen(false);
    setShowPassword(false);
    fetchAll();
  };

  const deleteWaiter = async (waiter: Waiter) => {
    if (!confirm(`Remover o garçom "${waiter.name}"? Isso também remove o acesso dele.`)) return;

    if (waiter.user_id) {
      await supabase.functions.invoke("manage-waiter-auth", {
        body: { action: "delete", user_id: waiter.user_id },
      });
    }
    await supabase.from("waiters").delete().eq("id", waiter.id);
    toast.success("Garçom removido");
    fetchAll();
  };

  const openNewWaiter = () => {
    setEditingWaiter({ name: "", phone: "", email: "", is_active: true, password: "" });
    setShowPassword(false);
    setIsDialogOpen(true);
  };

  const openEditWaiter = (waiter: Waiter) => {
    setEditingWaiter({ ...waiter, password: "" });
    setShowPassword(false);
    setIsDialogOpen(true);
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
            <Button size="sm" onClick={openNewWaiter}>
              <Plus className="h-4 w-4 mr-1" /> Novo Garçom
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {waiters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum garçom cadastrado</p>
            ) : waiters.map(waiter => (
              <div key={waiter.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{waiter.name}</span>
                    {waiter.user_id ? (
                      <span className="text-xs bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded">Com acesso</span>
                    ) : (
                      <span className="text-xs bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded">Sem acesso</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {waiter.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{waiter.email}</span>}
                    {waiter.phone && <span>{waiter.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={waiter.is_active} onCheckedChange={async v => { await supabase.from("waiters").update({ is_active: v }).eq("id", waiter.id); fetchAll(); }} />
                  <Button size="icon" variant="ghost" onClick={() => openEditWaiter(waiter)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteWaiter(waiter)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <p className="text-sm text-muted-foreground">Configuração de impressoras será integrada com o sistema de impressão térmica.</p>
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

      {/* Waiter Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); setShowPassword(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWaiter?.id ? "Editar" : "Novo"} Garçom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Nome completo" value={editingWaiter?.name || ""} onChange={e => setEditingWaiter({ ...editingWaiter, name: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input placeholder="(00) 00000-0000" value={editingWaiter?.phone || ""} onChange={e => setEditingWaiter({ ...editingWaiter, phone: e.target.value })} />
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Key className="w-4 h-4" /> Dados de Acesso (Login)
              </p>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Email de acesso *</Label>
                  <Input
                    type="email"
                    placeholder="garcom@email.com"
                    value={editingWaiter?.email || ""}
                    onChange={e => setEditingWaiter({ ...editingWaiter, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{editingWaiter?.user_id ? "Nova senha (deixe vazio para manter)" : "Senha *"}</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={editingWaiter?.user_id ? "••••••••" : "Mínimo 6 caracteres"}
                      value={editingWaiter?.password || ""}
                      onChange={e => setEditingWaiter({ ...editingWaiter, password: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={saveWaiter} className="w-full" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalonSettings;
