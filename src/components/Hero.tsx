import { motion } from "framer-motion";
import logo from "@/assets/logo-truebox-new.png";
import { useStoreSettings, useStoreSchedule, useIsStoreOpen } from "@/hooks/usePublicData";

interface HeroProps {
  onViewMenu: () => void;
}

const Hero = ({ onViewMenu }: HeroProps) => {
  const { data: settings } = useStoreSettings();
  const { data: schedule } = useStoreSchedule();
  const isOpen = useIsStoreOpen(settings, schedule);

  const deliveryTime = settings?.delivery_time || "40-60 min";

  return (
    <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: settings?.cover_image
            ? `url('${settings.cover_image}')`
            : "url('https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1200&h=800&fit=crop')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/70 to-background" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center max-w-lg"
      >
        {/* Logo */}
        <div className="relative inline-block mb-6">
          <motion.img
            src={logo}
            alt="Truebox Hamburgueria"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto w-56 h-auto"
            style={{ mixBlendMode: "screen" }}
          />
          {/* Store status indicator */}
          {isOpen !== null && (
            <span
              className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${
                isOpen ? "bg-green-500" : "bg-red-500"
              }`}
              title={isOpen ? "Loja aberta" : "Loja fechada"}
            />
          )}
        </div>

        {/* Open/Closed badge */}
        {isOpen !== null && (
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-4 ${
            isOpen
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}>
            <span className={`w-2 h-2 rounded-full ${isOpen ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            {isOpen ? "Aberto agora" : "Fechado agora"}
          </div>
        )}

        <h1 className="text-4xl md:text-5xl font-black text-foreground mb-4 leading-tight">
          Os burgers mais{" "}
          <span className="text-secondary">brabos</span> do Gama 🔥
        </h1>

        <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">🚀 {deliveryTime}</span>
          <span className="flex items-center gap-1">🍔 Hambúrguer artesanal</span>
          <span className="flex items-center gap-1">📍 Gama DF</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onViewMenu}
            className="bg-primary text-primary-foreground font-bold text-lg px-10 py-4 rounded-xl shadow-lg shadow-primary/30 hover:brightness-110 transition-all"
          >
            VER CARDÁPIO
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onViewMenu}
            className="bg-secondary text-secondary-foreground font-bold text-lg px-10 py-4 rounded-xl shadow-lg shadow-secondary/30 hover:brightness-110 transition-all"
          >
            PEDIR AGORA 🍔
          </motion.button>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
