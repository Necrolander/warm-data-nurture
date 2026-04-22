import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, QrCode, Printer } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface SalonTable {
  id: string;
  table_number: number;
  seats: number;
  qr_code_url: string | null;
  is_active: boolean;
}

const SalonManager = () => {
  const [tables, setTables] = useState<SalonTable[]>([]);
  const [editingTable, setEditingTable] = useState<Partial<SalonTable> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();

  const fetchTables = async () => {
    const { data } = await supabase.from("salon_tables").select("*").order("table_number");
    if (data) setTables(data as SalonTable[]);
  };

  useEffect(() => { fetchTables(); }, []);

  const saveTable = async () => {
    if (!editingTable?.table_number) { toast.error("Preencha o número da mesa"); return; }

    const menuUrl = `${window.location.origin}/?mesa=${editingTable.table_number}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(menuUrl)}`;

    const data = {
      table_number: editingTable.table_number,
      seats: editingTable.seats || 4,
      qr_code_url: qrUrl,
      is_active: editingTable.is_active ?? true,
    };

    if (editingTable.id) {
      const { error } = await supabase.from("salon_tables").update(data).eq("id", editingTable.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Mesa atualizada!");
    } else {
      const { error } = await supabase.from("salon_tables").insert(data);
      if (error) { toast.error(error.message.includes("unique") ? "Número de mesa já existe" : "Erro ao criar"); return; }
      toast.success("Mesa criada!");
    }
    setIsDialogOpen(false);
    fetchTables();
  };

  const deleteTable = async (id: string) => {
    await supabase.from("salon_tables").delete().eq("id", id);
    toast.success("Mesa excluída");
    fetchTables();
  };

  const toggleTable = async (id: string, active: boolean) => {
    await supabase.from("salon_tables").update({ is_active: active }).eq("id", id);
    fetchTables();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gestão do Salão</h2>
          <p className="text-sm text-muted-foreground">{tables.length} mesas cadastradas</p>
        </div>
        <Button onClick={() => { setEditingTable({ table_number: tables.length + 1, seats: 4, is_active: true }); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Mesa
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tables.map(table => (
          <Card key={table.id} className={!table.is_active ? "opacity-50" : ""}>
            <CardContent className="p-4 text-center space-y-2">
              <div className="text-3xl font-bold text-primary">{table.table_number}</div>
              <p className="text-sm text-muted-foreground">{table.seats} lugares</p>

              {table.qr_code_url && (
                <img src={table.qr_code_url} alt={`QR Mesa ${table.table_number}`} className="w-24 h-24 mx-auto rounded" />
              )}

              <p className="text-xs text-muted-foreground break-all">
                /?mesa={table.table_number}
              </p>

              <div className="flex items-center justify-center gap-1">
                <Switch checked={table.is_active} onCheckedChange={v => toggleTable(table.id, v)} />
                <Button
                  size="icon"
                  variant="ghost"
                  title="Imprimir QR Code"
                  onClick={() => window.open(`/mesa-qr/${table.table_number}`, "_blank")}
                >
                  <Printer className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { setEditingTable(table); setIsDialogOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteTable(table.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTable?.id ? "Editar" : "Nova"} Mesa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="number" placeholder="Número da mesa" value={editingTable?.table_number || ""} onChange={e => setEditingTable({ ...editingTable, table_number: parseInt(e.target.value) || 0 })} />
            <Input type="number" placeholder="Quantidade de lugares" value={editingTable?.seats || ""} onChange={e => setEditingTable({ ...editingTable, seats: parseInt(e.target.value) || 4 })} />
            <Button onClick={saveTable} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalonManager;
