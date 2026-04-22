import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";

const WaiterLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Preencha email e senha");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check if user has waiter or admin role
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      if (roleError) throw roleError;

      const hasAccess = roles?.some(r => r.role === "waiter" || r.role === "admin" || r.role === "staff");
      if (!hasAccess) {
        await supabase.auth.signOut();
        toast.error("Acesso negado. Você não tem permissão de garçom.");
        setLoading(false);
        return;
      }

      toast.success("Login realizado! ✅");
      navigate("/garcom");
    } catch (err: any) {
      toast.error(err.message || "Erro no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <UtensilsCrossed className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-foreground">App Garçom</h1>
          <p className="text-muted-foreground text-sm">Entre com suas credenciais</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
          <Input
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default WaiterLogin;
