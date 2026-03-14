import { motion } from "framer-motion";
import logo from "@/assets/logo-truebox-new.png";

interface TableHeaderProps {
  tableNumber: number;
  onViewMenu: () => void;
}

const TableHeader = ({ tableNumber, onViewMenu }: TableHeaderProps) => {
  return (
    <section className="relative py-12 flex flex-col items-center justify-center px-4 overflow-hidden bg-gradient-to-b from-primary/10 to-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg"
      >
        <img
          src={logo}
          alt="Truebox Hamburgueria"
          className="mx-auto w-40 h-auto mb-4"
          style={{ mixBlendMode: "screen" }}
        />

        <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl text-2xl font-black mb-4 shadow-lg shadow-primary/30">
          🍽️ Mesa {tableNumber}
        </div>

        <p className="text-muted-foreground text-sm mb-6">
          Faça seu pedido direto pelo celular!
        </p>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onViewMenu}
          className="bg-secondary text-secondary-foreground font-bold text-lg px-10 py-4 rounded-xl shadow-lg shadow-secondary/30 hover:brightness-110 transition-all"
        >
          VER CARDÁPIO 🍔
        </motion.button>
      </motion.div>
    </section>
  );
};

export default TableHeader;
