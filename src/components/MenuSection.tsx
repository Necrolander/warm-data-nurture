import { useRef, useState } from "react";
import { CATEGORIES, PRODUCTS, Product } from "@/data/products";
import ProductCard from "./ProductCard";
import ProductModal from "./ProductModal";

const MenuSection = () => {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const categoryProducts = CATEGORIES.map((cat) => ({
    ...cat,
    products: PRODUCTS.filter((p) => p.category === cat.id),
  })).filter((c) => c.products.length > 0);

  return (
    <section id="menu" className="px-4 py-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-black text-foreground text-center mb-2">
        Escolha seu lanche 👇
      </h2>
      <p className="text-muted-foreground text-center text-sm mb-6">
        Toque no produto para personalizar
      </p>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => scrollToCategory(cat.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Products by category */}
      {categoryProducts.map((cat) => (
        <div
          key={cat.id}
          ref={(el) => { sectionRefs.current[cat.id] = el; }}
          className="mb-8"
        >
          <h3 className="text-xl font-bold text-foreground mb-4">{cat.name}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cat.products.map((product) => (
              <ProductCard key={product.id} product={product} onSelect={setSelectedProduct} />
            ))}
          </div>
        </div>
      ))}

      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </section>
  );
};

export default MenuSection;
