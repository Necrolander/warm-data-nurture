import { motion } from "framer-motion";
import { Plus, ShoppingBag } from "lucide-react";
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
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(product)}
      className="bg-card rounded-2xl overflow-hidden border border-border cursor-pointer hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 group"
    >
      {/* Image container */}
      <div className="relative h-48 overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          loading="lazy"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />

        {/* Badges */}
        {product.badges && product.badges.length > 0 && (
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.badges.map((badge) => (
              <span
                key={badge}
                className="bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm shadow-sm"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Quick add button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.1 }}
          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <div className="bg-primary text-primary-foreground rounded-full p-2.5 shadow-lg shadow-primary/40">
            <Plus className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Price tag on image */}
        <div className="absolute bottom-3 left-3">
          <span className="bg-primary/90 backdrop-blur-sm text-primary-foreground font-black text-lg px-3 py-1 rounded-lg shadow-lg">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-foreground text-lg leading-tight">{product.name}</h3>
        <p className="text-muted-foreground text-sm mt-1.5 line-clamp-2 leading-relaxed">
          {product.description}
        </p>

        {/* Extras indicator */}
        {product.extras && product.extras.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3">
            <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {product.extras.length} adicionais disponíveis
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProductCard;
