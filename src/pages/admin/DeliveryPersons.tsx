import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Phone, User, Bike } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type DeliveryPerson = Database["public"]["Tables"]["delivery_persons"]["Row"];

const DeliveryPersonsManager = () => {
  const [persons, setPersons] = useState<DeliveryPerson[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchPersons = async () => {
    const { data } = await supabase
      .from("delivery_persons")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPersons(data);
  };

  useEffect(() => { fetchPersons(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error("Informe o nome"); return; }
    if (!newPhone.trim()) { toast.error("Informe o telefone"); return; }
    setLoading(true);
    const { error } = await supabase.from("delivery_persons").insert({
      name: newName.trim(),
      phone: newPhone.trim(),
    });
    if (error) {
      toast.error("Erro ao cadastrar");
    } else {
      toast.success("Entregador cadastrado!");
      setNewName("");
      setNewPhone("");
      setShowAdd(false);
      fetchPersons();
    }
    setLoading(false);
  };

  const toggleActive = async (person: DeliveryPerson) => {
    const { error } = await supabase
      .from("delivery_persons")
      .update({ is_active: !person.is_active })
      .eq("id", person.id);
    if (!error) fetchPersons();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("delivery_persons").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Entregador removido");
      fetchPersons();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" /> Entregadores
        </h2>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Entregador
        </Button>
      </div>

      {persons.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum entregador cadastrado</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {persons.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{p.phone}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ativo</span>
                    <Switch checked={p.is_active ?? true} onCheckedChange={() => toggleActive(p)} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Entregador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome *" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Telefone (WhatsApp) *" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" />
            <Button onClick={handleAdd} disabled={loading} className="w-full">
              {loading ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeliveryPersonsManager;
