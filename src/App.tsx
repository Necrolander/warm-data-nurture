import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import Checkout from "./pages/Checkout";
import CustomerAuth from "./pages/CustomerAuth";
import OrderSuccess from "./pages/OrderSuccess";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./components/admin/AdminLayout";
import Orders from "./pages/admin/Orders";
import NewOrder from "./pages/admin/NewOrder";
import MenuManager from "./pages/admin/MenuManager";
import Invoices from "./pages/admin/Invoices";
import BotManager from "./pages/admin/BotManager";
import BotConversations from "./pages/admin/BotConversations";
import SalonManager from "./pages/admin/SalonManager";
import SalonSettings from "./pages/admin/SalonSettings";
import Contacts from "./pages/admin/Contacts";
import CashbackCoupons from "./pages/admin/CashbackCoupons";
import Reports from "./pages/admin/Reports";
import DeliveryFees from "./pages/admin/DeliveryFees";
import DigitalMenu from "./pages/admin/DigitalMenu";
import Establishment from "./pages/admin/Establishment";
import DeliveryPersons from "./pages/admin/DeliveryPersons";
import WaiterLogin from "./pages/WaiterLogin";
import WaiterDashboard from "./pages/waiter/WaiterDashboard";
import WaiterNewOrder from "./pages/waiter/WaiterNewOrder";
import TableQRPrint from "./pages/TableQRPrint";
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
            <Route path="/auth" element={<CustomerAuth />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-success" element={<OrderSuccess />} />

            {/* Admin */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Orders />} />
              <Route path="new-order" element={<NewOrder />} />
              <Route path="menu-manager" element={<MenuManager />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="bot" element={<BotManager />} />
              <Route path="salon" element={<SalonManager />} />
              <Route path="salon-settings" element={<SalonSettings />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="cashback" element={<CashbackCoupons />} />
              <Route path="reports" element={<Reports />} />
              <Route path="delivery-fees" element={<DeliveryFees />} />
              <Route path="digital-menu" element={<DigitalMenu />} />
              <Route path="establishment" element={<Establishment />} />
              <Route path="delivery-persons" element={<DeliveryPersons />} />
            </Route>

            {/* Waiter App */}
            <Route path="/waiter/login" element={<WaiterLogin />} />
            <Route path="/waiter" element={<WaiterDashboard />} />
            <Route path="/waiter/new-order" element={<WaiterNewOrder />} />

            {/* Table QR Print */}
            <Route path="/table-qr/:tableNumber" element={<TableQRPrint />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
