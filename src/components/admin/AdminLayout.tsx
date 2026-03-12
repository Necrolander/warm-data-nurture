import { useEffect, useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import {
  ClipboardList,
  PlusCircle,
  UtensilsCrossed,
  Receipt,
  Bot,
  Armchair,
  Settings,
  Users,
  Gift,
  BarChart3,
  Truck,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logo from "@/assets/logo-truebox-new.png";

const menuItems = [
  { title: "Meus Pedidos", url: "/admin", icon: ClipboardList },
  { title: "Fazer Pedido", url: "/admin/new-order", icon: PlusCircle },
  { title: "Gestor de Cardápio", url: "/admin/menu-manager", icon: UtensilsCrossed },
  { title: "Notas Fiscais", url: "/admin/invoices", icon: Receipt },
  { title: "Robô", url: "/admin/bot", icon: Bot },
  { title: "Gestão Salão", url: "/admin/salon", icon: Armchair },
  { title: "Config. Salão", url: "/admin/salon-settings", icon: Settings },
  { title: "Contatos", url: "/admin/contacts", icon: Users },
  { title: "Cashback & Cupons", url: "/admin/cashback", icon: Gift },
  { title: "Relatórios", url: "/admin/reports", icon: BarChart3 },
  { title: "Frete", url: "/admin/delivery-fees", icon: Truck },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin/login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const hasAccess = roles?.some(r => r.role === "admin" || r.role === "staff");
      if (!hasAccess) {
        await supabase.auth.signOut();
        navigate("/admin/login");
        return;
      }

      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        navigate("/admin/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="icon">
          <SidebarContent className="pt-4">
            <div className="px-4 mb-4">
              <img src={logo} alt="Truebox" className="h-10 mx-auto" />
            </div>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/admin"}
                          className="hover:bg-muted/50"
                          activeClassName="bg-muted text-primary font-medium"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border px-4">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-lg font-semibold text-foreground">
              {menuItems.find(i => 
                i.url === "/admin" 
                  ? location.pathname === "/admin" 
                  : location.pathname.startsWith(i.url)
              )?.title || "Painel"}
            </h1>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
