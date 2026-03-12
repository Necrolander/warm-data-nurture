import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const OrderSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center space-y-6 max-w-sm"
      >
        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-14 h-14 text-green-500" />
        </div>
        <h1 className="text-3xl font-black text-foreground">Pedido confirmado! 🎉</h1>
        <p className="text-muted-foreground">
          Seu pedido foi recebido e já está sendo preparado. Acompanhe pelo painel!
        </p>
        <Button onClick={() => navigate("/")} className="w-full" size="lg">
          Voltar ao cardápio
        </Button>
      </motion.div>
    </div>
  );
};

export default OrderSuccess;
