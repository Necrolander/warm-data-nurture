import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | undefined;
  driverId: string;
  onSubmitted: () => void;
}

const issues = [
  { key: "no_answer", label: "Cliente não respondeu", icon: "📵" },
  { key: "wrong_address", label: "Endereço errado", icon: "📍" },
  { key: "cancelled", label: "Pedido cancelado", icon: "❌" },
  { key: "order_problem", label: "Problema no pedido", icon: "⚠️" },
];

const DriverProblemDialog = ({ open, onOpenChange, orderId, driverId, onSubmitted }: Props) => {
  const [loading, setLoading] = useState(false);

  const submit = async (issueType: string) => {
    if (!orderId) return;
    setLoading(true);
    await supabase.from("delivery_issues").insert({
      order_id: orderId,
      delivery_person_id: driverId,
      issue_type: issueType,
    });
    setLoading(false);
    onSubmitted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Problema na Entrega
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {issues.map((issue) => (
            <Button
              key={issue.key}
              variant="outline"
              className="w-full justify-start text-left h-auto py-3"
              disabled={loading}
              onClick={() => submit(issue.key)}
            >
              <span className="mr-2 text-lg">{issue.icon}</span>
              {issue.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DriverProblemDialog;
