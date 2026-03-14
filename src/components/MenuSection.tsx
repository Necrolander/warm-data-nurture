import { useRef, useState, useEffect } from "react";
import { useProducts, useCategories, useExtras, useExtraGroups, buildExtraGroups, mapDbProduct, isProductAvailableNow } from "@/hooks/usePublicData";
import { Product } from "@/data/products";
import ProductCard from "./ProductCard";
import ProductModal from "./ProductModal";
import { Skeleton } from "./ui/skeleton";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MenuSection = () => {
  const { data: dbProducts, isLoading: loadingProducts } = useProducts();
  const { data: dbCategories, isLoading: loadingCategories } = useCategories();
  const { data: dbExtras } = useExtras();
  const { data: dbExtraGroups } = useExtraGroups();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryBarRef = useRef<HTMLDivElement>(null);

  const extraGroups = buildExtraGroups(dbExtraGroups, dbExtras);
  const availableDbProducts = (dbProducts || []).filter(isProductAvailableNow);
  const products: Product[] = availableDbProducts.map((p) => mapDbProduct(p, extraGroups));
  const categories = (dbCategories || []).map((c) => ({
    id: c.slug,
    name: c.icon ? `${c.icon} ${c.name}` : c.name,
  }));

  const activeCat = activeCategory || categories[0]?.id;

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    setSearch("");
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Filter products by search
  const filteredProducts = search.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const categoryProducts = categories
    .map((cat) => ({
      ...cat,
      products: filteredProducts.filter((p) => p.category === cat.id),
    }))
    .filter((c) => c.products.length > 0);

  const isLoading = loadingProducts || loadingCategories;

  return (
    <section id="menu" className="px-4 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-6"
      >
        <h2 className="text-3xl font-black text-foreground mb-2">
          Nosso Cardápio 🍔
        </h2>
        <p className="text-muted-foreground text-sm">
          Escolha seu lanche favorito e personalize do seu jeito
        </p>
      </motion.div>

      {/* Search bar */}
      <div className="relative mb-4 max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no cardápio..."
          className="w-full pl-10 pr-10 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-28 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Sticky category tabs */}
          {!search && (
            <div
              ref={categoryBarRef}
              className="sticky top-0 z-30 bg-background/90 backdrop-blur-md py-3 -mx-4 px-4 mb-6"
            >
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                      activeCat === cat.id
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-105"
                        : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search results */}
          {search && (
            <p className="text-sm text-muted-foreground mb-4">
              {filteredProducts.length} resultado(s) para "{search}"
            </p>
          )}

          {/* Products by category */}
          <AnimatePresence mode="wait">
            {categoryProducts.map((cat) => (
              <div
                key={cat.id}
                ref={(el) => {
                  sectionRefs.current[cat.id] = el;
                }}
                className="mb-10"
              >
                <motion.h3
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="text-xl font-bold text-foreground mb-4 flex items-center gap-2"
                >
                  {cat.name}
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {cat.products.length}
                  </span>
                </motion.h3>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  {cat.products.map((product, i) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <ProductCard product={product} onSelect={setSelectedProduct} />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>

          {categoryProducts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-muted-foreground">
                {search ? `Nenhum produto encontrado para "${search}"` : "Nenhum produto disponível no momento."}
              </p>
            </div>
          )}
        </>
      )}

      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </section>
  );
};

export default MenuSection;
