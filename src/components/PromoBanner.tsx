import { PRODUCTS } from "@/data/products";

const PromoBanner = () => {
  const promoProducts = PRODUCTS.filter((p) =>
    p.badges?.some((b) => b.includes("Economize"))
  );

  if (promoProducts.length === 0) return null;

  return (
    <section className="px-4 py-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-black text-secondary mb-4">🔥 PROMOÇÕES DO DIA</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {promoProducts.map((p) => (
          <div
            key={p.id}
            className="min-w-[260px] bg-card border-2 border-secondary rounded-xl overflow-hidden"
          >
            <img src={p.image} alt={p.name} className="w-full h-36 object-cover" loading="lazy" />
            <div className="p-3">
              <h4 className="font-bold text-foreground">{p.name}</h4>
              <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
              <p className="text-primary font-black text-lg mt-1">
                R$ {p.price.toFixed(2).replace(".", ",")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default PromoBanner;
