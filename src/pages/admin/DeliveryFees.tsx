import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface DeliveryFee {
  id: string;
  max_km: number;
  fee: number;
  sort_order: number;
}

const DeliveryFees = () => {
  const [fees, setFees] = useState<DeliveryFee[]>([]);
  const [maxDeliveryKm, setMaxDeliveryKm] = useState("15");
  const [hasChanges, setHasChanges] = useState(false);

  const fetchFees = async () => {
    const { data } = await supabase.from("delivery_fees").select("*").order("sort_order");
    if (data) setFees(data as DeliveryFee[]);

    const { data: settings } = await supabase.from("store_settings").select("*").eq("key", "max_delivery_km").single();
    if (settings) setMaxDeliveryKm(settings.value);
  };

  useEffect(() => { fetchFees(); }, []);

  const updateFee = (id: string, field: "max_km" | "fee", value: string) => {
    setFees(fees.map(f => f.id === id ? { ...f, [field]: parseFloat(value) || 0 } : f));
    setHasChanges(true);
  };

  const addFee = () => {
    const newFee: DeliveryFee = {
      id: `new-${Date.now()}`,
      max_km: 0,
      fee: 0,
      sort_order: fees.length + 1,
    };
    setFees([...fees, newFee]);
    setHasChanges(true);
  };

  const removeFee = async (id: string) => {
    if (id.startsWith("new-")) {
      setFees(fees.filter(f => f.id !== id));
    } else {
      await supabase.from("delivery_fees").delete().eq("id", id);
      toast.success("Faixa removida");
      fetchFees();
    }
  };

  const saveAll = async () => {
    // Delete all and re-insert
    await supabase.from("delivery_fees").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const inserts = fees.map((f, i) => ({
      max_km: f.max_km,
      fee: f.fee,
      sort_order: i + 1,
    }));

    const { error } = await supabase.from("delivery_fees").insert(inserts);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }

    // Save max delivery km
    await supabase.from("store_settings").upsert({ key: "max_delivery_km", value: maxDeliveryKm }, { onConflict: "key" });

    toast.success("Fretes atualizados!");
    setHasChanges(false);
    fetchFees();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração de Frete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Distância máxima de entrega (km)</label>
            <Input
              type="number"
              value={maxDeliveryKm}
              onChange={e => { setMaxDeliveryKm(e.target.value); setHasChanges(true); }}
              className="w-32 mt-1"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Faixas de Frete</label>
            <div className="grid gap-2">
              {fees.map((fee) => (
                <div key={fee.id} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-12">Até</span>
                  <Input
                    type="number"
                    step="0.5"
                    value={fee.max_km}
                    onChange={e => updateFee(fee.id, "max_km", e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">km →</span>
                  <span className="text-sm">R$</span>
                  <Input
                    type="number"
                    step="0.5"
                    value={fee.fee}
                    onChange={e => updateFee(fee.id, "fee", e.target.value)}
                    className="w-24"
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeFee(fee.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addFee}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar faixa
            </Button>
          </div>

          {hasChanges && (
            <Button onClick={saveAll} className="w-full">
              <Save className="h-4 w-4 mr-1" /> Salvar Alterações
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveryFees;
