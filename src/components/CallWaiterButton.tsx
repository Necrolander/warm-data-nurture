import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface CallWaiterButtonProps {
  tableNumber: number;
}

const CallWaiterButton = ({ tableNumber }: CallWaiterButtonProps) => {
  const [calling, setCalling] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const callWaiter = async () => {
    if (cooldown) {
      toast.info("Aguarde um momento, o garçom já foi chamado!");
      return;
    }

    setCalling(true);
    try {
      await supabase.from("kitchen_alerts").insert({
        table_number: tableNumber,
        message: `Mesa ${tableNumber} está chamando o garçom!`,
        waiter_name: "Cliente",
        acknowledged: false,
      });
      toast.success("Garçom chamado! Aguarde um momento.");
      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000); // 30s cooldown
    } catch {
      toast.error("Erro ao chamar garçom");
    }
    setCalling(false);
  };

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileTap={{ scale: 0.9 }}
      onClick={callWaiter}
      disabled={calling}
      className={`fixed bottom-24 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm shadow-lg transition-all ${
        cooldown
          ? "bg-muted text-muted-foreground"
          : "bg-secondary text-secondary-foreground shadow-secondary/30 hover:brightness-110"
      }`}
    >
      <Bell className="h-5 w-5" />
      {cooldown ? "Garçom chamado ✓" : "Chamar Garçom"}
    </motion.button>
  );
};

export default CallWaiterButton;
