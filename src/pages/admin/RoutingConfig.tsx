import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Settings } from "lucide-react";

const configFields = [
  { key: "max_grouping_radius_km", label: "Raio máximo de agrupamento (km)", type: "number" },
  { key: "max_orders_per_route", label: "Máx pedidos por rota", type: "number" },
  { key: "max_time_diff_min", label: "Diferença máx de tempo entre pedidos (min)", type: "number" },
  { key: "max_wait_before_route_min", label: "Tempo máx espera antes de gerar rota (min)", type: "number" },
  { key: "weight_distance", label: "Peso: Distância", type: "number" },
  { key: "weight_time", label: "Peso: Tempo", type: "number" },
  { key: "weight_delay", label: "Peso: Atraso", type: "number" },
  { key: "weight_priority", label: "Peso: Prioridade", type: "number" },
  { key: "acceptable_delay_min", label: "Limite de atraso aceitável (min)", type: "number" },
  { key: "assignment_mode", label: "Modo de atribuição padrão", type: "select", options: ["manual", "auto"] },
];

const RoutingConfig = () => {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("routing_config").select("key, value");
      const c: Record<string, string> = {};
      (data || []).forEach((r: any) => { c[r.key] = r.value; });
      setConfig(c);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(config)) {
      await supabase.from("routing_config").upsert({ key, value } as any, { onConflict: "key" });
    }
    toast.success("Configurações salvas!");
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2"><Settings className="w-6 h-6" /> Config. Logística</h2>
        <Button onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Parâmetros de Roteirização</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          {configFields.map(f => (
            <div key={f.key}>
              <Label className="text-sm">{f.label}</Label>
              {f.type === "select" ? (
                <Select value={config[f.key] || ""} onValueChange={v => setConfig(c => ({ ...c, [f.key]: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {f.options!.map(o => <SelectItem key={o} value={o}>{o === "manual" ? "Manual" : "Automático"}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  step="0.1"
                  value={config[f.key] || ""}
                  onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default RoutingConfig;
