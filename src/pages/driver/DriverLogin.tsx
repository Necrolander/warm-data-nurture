import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bike, LogIn } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-truebox-new.png";
import { saveDriverSession } from "@/lib/driverApp";

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const DriverLogin = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      toast.error("Preencha o telefone");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("driver-login", {
        body: { phone: normalizedPhone },
      });

      if (error) throw error;
      if (data?.error || !data?.driver || !data?.token) {
        toast.error(data?.error || "Entregador não encontrado ou inativo");
        return;
      }

      saveDriverSession({
        id: data.driver.id,
        name: data.driver.name,
        phone: data.driver.phone,
        token: data.token,
      });

      toast.success(`Bem-vindo, ${data.driver.name}!`);
      navigate("/entregador");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img src={logo} alt="Truebox" className="h-12 mx-auto" />
          <div className="flex items-center justify-center gap-2 mt-4">
            <Bike className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">App do Entregador</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Faça login com seu telefone cadastrado
          </p>
        </div>

        <div className="space-y-3">
          <Input
            placeholder="Telefone (ex: 61999999999)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
          />
          <Button onClick={handleLogin} disabled={loading} className="w-full" size="lg">
            <LogIn className="h-4 w-4 mr-2" />
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Use o telefone cadastrado pelo administrador.
        </p>
      </div>
    </div>
  );
};

export default DriverLogin;
