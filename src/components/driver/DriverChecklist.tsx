import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, GlassWater, PackageCheck } from "lucide-react";

interface DriverChecklistProps {
  order: any;
  items: any[];
  onConfirmed: () => void;
  onCancel: () => void;
}

const DriverChecklist = ({ order, items, onConfirmed, onCancel }: DriverChecklistProps) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const drinks = items.filter(i =>
    /coca|guaraná|suco|água|refrigerante|cerveja|lata|pet|drink|bebida/i.test(i.product_name)
  );
  const otherItems = items.filter(i => !drinks.includes(i));
  const allItems = items.map(i => i.id);
  const allChecked = allItems.every(id => checked[id]);

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Card className="border-2 border-yellow-500">
      <CardContent className="p-4 space-y-4">
        <div className="bg-yellow-500/10 rounded-xl p-4 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <p className="font-bold text-lg text-foreground">ATENÇÃO</p>
          <p className="text-sm text-muted-foreground mt-1">
            CONFIRA TODOS OS ITENS DO PEDIDO ANTES DE SAIR PARA ENTREGA.
          </p>
        </div>

        <div>
          <p className="font-bold text-sm mb-3">Pedido #{order.order_number}</p>

          {/* Regular items */}
          <div className="space-y-3">
            {otherItems.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={!!checked[item.id]}
                  onCheckedChange={() => toggle(item.id)}
                  className="h-5 w-5"
                />
                <span className={`text-sm ${checked[item.id] ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>
                  {item.quantity}x {item.product_name}
                </span>
              </label>
            ))}
          </div>

          {/* Drinks section - highlighted */}
          {drinks.length > 0 && (
            <div className="mt-4 pt-3 border-t-2 border-blue-500/30 bg-blue-500/5 rounded-lg p-3">
              <p className="font-bold text-sm flex items-center gap-1 text-blue-500 mb-3">
                <GlassWater className="h-4 w-4" /> BEBIDAS NO PEDIDO:
              </p>
              <div className="space-y-3">
                {drinks.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-500/10 cursor-pointer"
                  >
                    <Checkbox
                      checked={!!checked[item.id]}
                      onCheckedChange={() => toggle(item.id)}
                      className="h-5 w-5"
                    />
                    <span className={`text-sm ${checked[item.id] ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>
                      {item.quantity}x {item.product_name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <Button
            onClick={onConfirmed}
            className="w-full"
            size="lg"
            disabled={!allChecked}
          >
            <PackageCheck className="h-5 w-5 mr-2" />
            {allChecked ? "SAIR PARA ENTREGA" : `Marque todos os itens (${Object.values(checked).filter(Boolean).length}/${allItems.length})`}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Voltar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DriverChecklist;
