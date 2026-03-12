import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Palette, Link, QrCode, Save, Copy } from "lucide-react";
import { toast } from "sonner";

const DigitalMenu = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSettings = async () => {
    const { data } = await supabase.from("store_settings").select("*");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((s: any) => { map[s.key] = s.value; });
      setSettings(map);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const updateSetting = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  const saveAll = async () => {
    const keys = ["primary_color", "store_cover_url", "delivery_link", "qrcode_link"];
    for (const key of keys) {
      if (settings[key] !== undefined) {
        await supabase.from("store_settings").upsert({ key, value: settings[key] }, { onConflict: "key" });
      }
    }
    toast.success("Configurações salvas!");
    setHasChanges(false);
  };

  const deliveryUrl = settings.delivery_link || `${window.location.origin}`;
  const qrcodeUrl = settings.qrcode_link || `${window.location.origin}/?modo=mesa`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" /> Cardápio Digital
      </h2>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" /> Aparência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Cor Principal</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={settings.primary_color || "#ffc107"}
                onChange={e => updateSetting("primary_color", e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-border"
              />
              <Input
                value={settings.primary_color || "#ffc107"}
                onChange={e => updateSetting("primary_color", e.target.value)}
                className="w-32"
                placeholder="#ffc107"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Capa da Loja (URL da imagem)</label>
            <Input
              value={settings.store_cover_url || ""}
              onChange={e => updateSetting("store_cover_url", e.target.value)}
              placeholder="https://exemplo.com/capa.jpg"
              className="mt-1"
            />
            {settings.store_cover_url && (
              <img src={settings.store_cover_url} alt="Capa" className="mt-2 rounded h-32 object-cover w-full" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link className="h-4 w-4" /> Links do Cardápio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">🛵 Link Delivery (para clientes em casa)</label>
            <p className="text-xs text-muted-foreground mb-1">Este link abre o cardápio para pedidos de entrega e retirada</p>
            <div className="flex gap-2">
              <Input
                value={settings.delivery_link || deliveryUrl}
                onChange={e => updateSetting("delivery_link", e.target.value)}
                placeholder={deliveryUrl}
              />
              <Button size="icon" variant="outline" onClick={() => copyToClipboard(settings.delivery_link || deliveryUrl, "Link delivery")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">🍽️ Link QR Code Mesas (para clientes no salão)</label>
            <p className="text-xs text-muted-foreground mb-1">Este link abre o cardápio para consumo no local. O garçom usa o App Garçom para fazer pedidos do salão.</p>
            <div className="flex gap-2">
              <Input
                value={settings.qrcode_link || qrcodeUrl}
                onChange={e => updateSetting("qrcode_link", e.target.value)}
                placeholder={qrcodeUrl}
              />
              <Button size="icon" variant="outline" onClick={() => copyToClipboard(settings.qrcode_link || qrcodeUrl, "Link QR Code")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <QrCode className="h-4 w-4" /> QR Codes gerados
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Delivery</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(settings.delivery_link || deliveryUrl)}`}
                  alt="QR Delivery"
                  className="mx-auto rounded"
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Mesa / Salão</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(settings.qrcode_link || qrcodeUrl)}`}
                  alt="QR Mesa"
                  className="mx-auto rounded"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <Button onClick={saveAll} className="w-full">
          <Save className="h-4 w-4 mr-1" /> Salvar Alterações
        </Button>
      )}
    </div>
  );
};

export default DigitalMenu;
