import { useProducts, useExtras, mapDbProduct } from "@/hooks/usePublicData";
import { useEffect, useRef, useState } from "react";

const PromoBanner = () => {
  const { data: dbProducts } = useProducts();
  const { data: dbExtras } = useExtras();
  const [isPaused, setIsPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const extras = dbExtras || [];
  const products = (dbProducts || []).map((p) => mapDbProduct(p, extras));
  const promoProducts = products.filter((p) => p.badges?.some((b) => b.includes("Economize")));

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const interval = window.setInterval(() => {
      if (isPaused) return;
      el.scrollLeft += 1;
      if (el.scrollLeft >= el.scrollWidth / 2) {
        el.scrollLeft = 0;
      }
    }, 20);

    return () => window.clearInterval(interval);
  }, [isPaused]);

  if (promoProducts.length === 0) return null;

  const repeated = [...promoProducts, ...promoProducts];

  return (
    <section className="px-4 py-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-black text-secondary mb-1">🔥 PROMOÇÕES DO DIA</h2>
      <p className="text-sm text-muted-foreground mb-4">Ofertas rolando automaticamente para você não perder nenhuma</p>

      <div
        ref={trackRef}
        className="overflow-x-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="flex gap-4 w-max">
          {repeated.map((p, idx) => (
            <div
              key={`${p.id}-${idx}`}
              className="min-w-[260px] bg-card border-2 border-secondary rounded-xl overflow-hidden"
            >
              <img src={p.image} alt={p.name} className="w-full h-36 object-cover" loading="lazy" />
              <div className="p-3">
                <h4 className="font-bold text-foreground">{p.name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                <p className="text-primary font-black text-lg mt-1">R$ {p.price.toFixed(2).replace(".", ",")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
