import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Hero from "@/components/Hero";
import MenuSection from "@/components/MenuSection";
import PromoBanner from "@/components/PromoBanner";
import FloatingCart from "@/components/FloatingCart";
import CartDrawer from "@/components/CartDrawer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import InAppBrowserGate from "@/components/InAppBrowserGate";
import TableHeader from "@/components/TableHeader";
import CallWaiterButton from "@/components/CallWaiterButton";

const Index = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get("mesa") ? parseInt(searchParams.get("mesa")!) : null;
  const isDineIn = !!tableNumber;

  const scrollToMenu = () => {
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <InAppBrowserGate>
      <div className="min-h-screen bg-background">
        {isDineIn ? (
          <TableHeader tableNumber={tableNumber!} onViewMenu={scrollToMenu} />
        ) : (
          <Hero onViewMenu={scrollToMenu} />
        )}
        {!isDineIn && <PromoBanner />}
        <MenuSection channel={isDineIn ? "dine_in" : "delivery"} tableNumber={tableNumber} />
        <FloatingCart onClick={() => setCartOpen(true)} />
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        {isDineIn ? (
          <CallWaiterButton tableNumber={tableNumber!} />
        ) : (
          <WhatsAppFloat />
        )}
      </div>
    </InAppBrowserGate>
  );
};

export default Index;
