import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import Checkout from "./pages/Checkout";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./components/admin/AdminLayout";
import Orders from "./pages/admin/Orders";
import NewOrder from "./pages/admin/NewOrder";
import MenuManager from "./pages/admin/MenuManager";
import BotManager from "./pages/admin/BotManager";
import DeliveryFees from "./pages/admin/DeliveryFees";
import PlaceholderPage from "./pages/admin/PlaceholderPage";
import { ScrollToTop } from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/checkout" element={<Checkout />} />

            {/* Admin */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Orders />} />
              <Route path="new-order" element={<NewOrder />} />
              <Route path="menu-manager" element={<MenuManager />} />
              <Route path="invoices" element={<PlaceholderPage title="Notas Fiscais" />} />
              <Route path="bot" element={<BotManager />} />
              <Route path="salon" element={<PlaceholderPage title="Gestão Salão" />} />
              <Route path="salon-settings" element={<PlaceholderPage title="Configurações do Salão" />} />
              <Route path="contacts" element={<PlaceholderPage title="Contatos" />} />
              <Route path="cashback" element={<PlaceholderPage title="Cashback & Cupons" />} />
              <Route path="reports" element={<PlaceholderPage title="Relatórios" />} />
              <Route path="delivery-fees" element={<DeliveryFees />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
