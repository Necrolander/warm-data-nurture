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
  Smartphone,
  Store,
  Bike,
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
  { title: "Entregadores", url: "/admin/delivery-persons", icon: Bike },
  { title: "Cardápio Digital", url: "/admin/digital-menu", icon: Smartphone },
  { title: "Estabelecimento", url: "/admin/establishment", icon: Store },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [storeOpen, setStoreOpen] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchStoreStatus = async () => {
    const { data } = await supabase.from("store_settings").select("value").eq("key", "store_open").single();
    if (data) setStoreOpen(data.value === "true");
  };

  // Print queue listener - auto-prints when waiter sends print job
  useEffect(() => {
    const channel = supabase
      .channel("admin-print-queue")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "print_queue" },
        async (payload: any) => {
          const record = payload.new;
          if (record && !record.printed && record.content) {
            // Open print window
            const win = window.open("", "_blank", "width=320,height=700");
            if (win) {
              win.document.write(record.content);
              win.document.close();
              // Auto-print is triggered by the HTML content's onload script
              // For order tickets (no onload script), trigger manually
              if (!record.content.includes("window.print()")) {
                setTimeout(() => win.print(), 500);
              }
            }
            // Mark as printed
            await supabase.from("print_queue" as any).update({ printed: true } as any).eq("id", record.id);
            toast.success(`📠 Impressão: ${record.type === "bill" ? "Fechamento de conta" : "Comanda"}`);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/admin/login"); return; }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const hasAccess = roles?.some(r => r.role === "admin" || r.role === "staff");
      if (!hasAccess) { await supabase.auth.signOut(); navigate("/admin/login"); return; }

      setLoading(false);
      fetchStoreStatus();
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate("/admin/login");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const toggleStore = async () => {
    setToggling(true);
    const newVal = !storeOpen;
    await supabase.from("store_settings").upsert({ key: "store_open", value: String(newVal) }, { onConflict: "key" });
    setStoreOpen(newVal);
    toast.success(newVal ? "🟢 Loja ABERTA!" : "🔴 Loja FECHADA!");
    setToggling(false);
  };

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
            {/* Logo + Store status */}
            <div className="px-4 mb-4">
              <div className="flex items-center justify-center gap-2">
                <img src={logo} alt="Truebox" className="h-10" />
                <button
                  onClick={toggleStore}
                  disabled={toggling}
                  className="relative flex-shrink-0"
                  title={storeOpen ? "Loja ABERTA — clique para fechar" : "Loja FECHADA — clique para abrir"}
                >
                  <span className={`block w-4 h-4 rounded-full ${storeOpen ? "bg-green-500" : "bg-red-500"} ${storeOpen ? "animate-pulse" : ""}`} />
                </button>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-1">
                {storeOpen ? "Aberta" : "Fechada"}
              </p>
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
            <h1 className="text-lg font-semibold text-foreground flex-1">
              {menuItems.find(i =>
                i.url === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname.startsWith(i.url)
              )?.title || "Painel"}
            </h1>
            <button
              onClick={toggleStore}
              disabled={toggling}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                storeOpen
                  ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${storeOpen ? "bg-green-500" : "bg-red-500"}`} />
              {storeOpen ? "Aberta" : "Fechada"}
            </button>
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
