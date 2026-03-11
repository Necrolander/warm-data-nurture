import { useState } from "react";
import Hero from "@/components/Hero";
import MenuSection from "@/components/MenuSection";
import PromoBanner from "@/components/PromoBanner";
import FloatingCart from "@/components/FloatingCart";
import CartDrawer from "@/components/CartDrawer";
import WhatsAppFloat from "@/components/WhatsAppFloat";

const Index = () => {
  const [cartOpen, setCartOpen] = useState(false);

  const scrollToMenu = () => {
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Hero onViewMenu={scrollToMenu} />
      <PromoBanner />
      <MenuSection />
      <FloatingCart onClick={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <WhatsAppFloat />
    </div>
  );
};

export default Index;
