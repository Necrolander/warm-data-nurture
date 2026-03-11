import { motion } from "framer-motion";
import { Product } from "@/data/products";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

const ProductCard = ({ product, onSelect }: ProductCardProps) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(product)}
      className="bg-card rounded-xl overflow-hidden border border-border cursor-pointer hover:border-primary/50 transition-colors"
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {product.badges && product.badges.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.badges.map((badge) => (
              <span
                key={badge}
                className="bg-secondary text-secondary-foreground text-xs font-bold px-2 py-1 rounded-full"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-foreground text-lg">{product.name}</h3>
        <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-primary font-black text-xl">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </span>
          <button className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg text-sm hover:brightness-110 transition-all">
            Adicionar
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
