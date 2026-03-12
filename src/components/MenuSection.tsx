import { useRef, useState } from "react";
import { useProducts, useCategories, useExtras, mapDbProduct } from "@/hooks/usePublicData";
import { Product } from "@/data/products";
import ProductCard from "./ProductCard";
import ProductModal from "./ProductModal";
import { Skeleton } from "./ui/skeleton";

const MenuSection = () => {
  const { data: dbProducts, isLoading: loadingProducts } = useProducts();
  const { data: dbCategories, isLoading: loadingCategories } = useCategories();
  const { data: dbExtras } = useExtras();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const extras = dbExtras || [];
  const products: Product[] = (dbProducts || []).map((p) => mapDbProduct(p, extras));
  const categories = (dbCategories || []).map((c) => ({
    id: c.slug,
    name: c.icon ? `${c.icon} ${c.name}` : c.name,
  }));

  const activeCat = activeCategory || categories[0]?.id;

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const categoryProducts = categories
    .map((cat) => ({
      ...cat,
      products: products.filter((p) => p.category === cat.id),
    }))
    .filter((c) => c.products.length > 0);

  const isLoading = loadingProducts || loadingCategories;

  return (
    <section id="menu" className="px-4 py-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-black text-foreground text-center mb-2">
        Escolha seu lanche 👇
      </h2>
      <p className="text-muted-foreground text-center text-sm mb-6">
        Toque no produto para personalizar
      </p>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-28 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  activeCat === cat.id
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

          {categoryProducts.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum produto disponível no momento.</p>
          )}
        </>
      )}

      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </section>
  );
};

export default MenuSection;
