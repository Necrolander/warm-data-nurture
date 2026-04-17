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
import AdminDriverChat from "./components/admin/AdminDriverChat";
import SalonManager from "./pages/admin/SalonManager";
import SalonSettings from "./pages/admin/SalonSettings";
import Contacts from "./pages/admin/Contacts";
import CashbackCoupons from "./pages/admin/CashbackCoupons";
import Reports from "./pages/admin/Reports";
import DeliveryFees from "./pages/admin/DeliveryFees";
import DigitalMenu from "./pages/admin/DigitalMenu";
import Establishment from "./pages/admin/Establishment";
import DeliveryPersons from "./pages/admin/DeliveryPersons";
import DeliveryAlerts from "./pages/admin/DeliveryAlerts";
import WaiterLogin from "./pages/WaiterLogin";
import WaiterDashboard from "./pages/waiter/WaiterDashboard";
import WaiterNewOrder from "./pages/waiter/WaiterNewOrder";
import TableQRPrint from "./pages/TableQRPrint";
import DeliveryTracking from "./pages/DeliveryTracking";
import DriverLogin from "./pages/driver/DriverLogin";
import DriverDashboard from "./pages/driver/DriverDashboard";
import OrderHistory from "./pages/admin/OrderHistory";
import IfoodIntegration from "./pages/admin/IfoodIntegration";
import ExternalIntegrations from "./pages/admin/ExternalIntegrations";
import RoutingDashboard from "./pages/admin/RoutingDashboard";
import RoutesList from "./pages/admin/RoutesList";
import OperationalMap from "./pages/admin/OperationalMap";
import DriversManagement from "./pages/admin/DriversManagement";
import RoutingConfig from "./pages/admin/RoutingConfig";
import MapDemo from "./pages/MapDemo";
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
              <Route path="order-history" element={<OrderHistory />} />
              <Route path="new-order" element={<NewOrder />} />
              <Route path="menu-manager" element={<MenuManager />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="bot" element={<BotManager />} />
              <Route path="bot-conversations" element={<BotConversations />} />
              <Route path="driver-chat" element={<AdminDriverChat />} />
              <Route path="salon" element={<SalonManager />} />
              <Route path="salon-settings" element={<SalonSettings />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="cashback" element={<CashbackCoupons />} />
              <Route path="reports" element={<Reports />} />
              <Route path="delivery-fees" element={<DeliveryFees />} />
              <Route path="digital-menu" element={<DigitalMenu />} />
              <Route path="establishment" element={<Establishment />} />
              <Route path="delivery-persons" element={<DeliveryPersons />} />
              <Route path="delivery-alerts" element={<DeliveryAlerts />} />
              <Route path="ifood" element={<IfoodIntegration />} />
              <Route path="external-integrations" element={<ExternalIntegrations />} />
              <Route path="routing" element={<RoutingDashboard />} />
              <Route path="routes" element={<RoutesList />} />
              <Route path="operational-map" element={<OperationalMap />} />
              <Route path="drivers-mgmt" element={<DriversManagement />} />
              <Route path="routing-config" element={<RoutingConfig />} />
            </Route>

            {/* Waiter App */}
            <Route path="/waiter/login" element={<WaiterLogin />} />
            <Route path="/waiter" element={<WaiterDashboard />} />
            <Route path="/waiter/new-order" element={<WaiterNewOrder />} />

            {/* Table QR Print */}
            <Route path="/table-qr/:tableNumber" element={<TableQRPrint />} />

            {/* Delivery Tracking */}
            <Route path="/tracking/:token" element={<DeliveryTracking />} />

            {/* Public Map Demo */}
            <Route path="/mapa" element={<MapDemo />} />

            {/* Driver App */}
            <Route path="/driver/login" element={<DriverLogin />} />
            <Route path="/driver" element={<DriverDashboard />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
