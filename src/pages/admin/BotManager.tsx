import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Link, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface BotResponse {
  id: string;
  trigger_key: string;
  trigger_label: string;
  response_text: string;
  include_menu_link: boolean;
  is_active: boolean;
  sort_order: number;
}

const BotManager = () => {
  const [responses, setResponses] = useState<BotResponse[]>([]);
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set());

  const fetchResponses = async () => {
    const { data } = await supabase.from("bot_responses").select("*").order("sort_order");
    if (data) setResponses(data as BotResponse[]);
  };

  useEffect(() => { fetchResponses(); }, []);

  const updateField = (id: string, field: keyof BotResponse, value: any) => {
    setResponses(responses.map(r => r.id === id ? { ...r, [field]: value } : r));
    setEditedIds(prev => new Set(prev).add(id));
  };

  const saveResponse = async (response: BotResponse) => {
    const { error } = await supabase.from("bot_responses").update({
      response_text: response.response_text,
      include_menu_link: response.include_menu_link,
      is_active: response.is_active,
    }).eq("id", response.id);

    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success(`"${response.trigger_label}" salvo!`);
      setEditedIds(prev => { const next = new Set(prev); next.delete(response.id); return next; });
    }
  };

  const saveAll = async () => {
    const toSave = responses.filter(r => editedIds.has(r.id));
    for (const r of toSave) {
      await supabase.from("bot_responses").update({
        response_text: r.response_text,
        include_menu_link: r.include_menu_link,
        is_active: r.is_active,
      }).eq("id", r.id);
    }
    toast.success(`${toSave.length} respostas salvas!`);
    setEditedIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Respostas Automáticas do Robô
          </h2>
          <p className="text-sm text-muted-foreground">Configure as respostas que serão enviadas automaticamente aos clientes</p>
        </div>
        {editedIds.size > 0 && (
          <Button onClick={saveAll}>
            <Save className="h-4 w-4 mr-1" /> Salvar Tudo ({editedIds.size})
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {responses.map(response => (
          <Card key={response.id} className={!response.is_active ? "opacity-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{response.trigger_label}</Badge>
                    {response.include_menu_link && (
                      <Badge variant="secondary" className="text-xs">
                        <Link className="h-3 w-3 mr-1" /> Link do cardápio
                      </Badge>
                    )}
                    {editedIds.has(response.id) && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">Não salvo</Badge>
                    )}
                  </div>

                  <Textarea
                    value={response.response_text}
                    onChange={e => updateField(response.id, "response_text", e.target.value)}
                    rows={2}
                    className="resize-none"
                  />

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={response.include_menu_link}
                        onCheckedChange={v => updateField(response.id, "include_menu_link", v)}
                      />
                      <span className="text-sm">Incluir link do cardápio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={response.is_active}
                        onCheckedChange={v => updateField(response.id, "is_active", v)}
                      />
                      <span className="text-sm">Ativo</span>
                    </div>
                  </div>
                </div>

                {editedIds.has(response.id) && (
                  <Button size="sm" variant="outline" onClick={() => saveResponse(response)}>
                    <Save className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BotManager;
