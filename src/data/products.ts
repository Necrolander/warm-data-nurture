export interface Extra {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  badges?: string[];
  extras?: Extra[];
}

export const EXTRAS: Extra[] = [
  { id: "queijo-extra", name: "Queijo Extra", price: 4 },
  { id: "bacon-extra", name: "Bacon Extra", price: 5 },
  { id: "hamburguer-extra", name: "Hambúrguer Extra", price: 8 },
  { id: "molho-especial", name: "Molho Especial", price: 3 },
  { id: "cebola-caramelizada", name: "Cebola Caramelizada", price: 4 },
  { id: "ovo", name: "Ovo", price: 3 },
];

export const CATEGORIES = [
  { id: "mais-pedidos", name: "🔥 Mais pedidos", icon: "🔥" },
  { id: "hamburgueres", name: "🍔 Hambúrgueres", icon: "🍔" },
  { id: "acompanhamentos", name: "🍟 Acompanhamentos", icon: "🍟" },
  { id: "bebidas", name: "🥤 Bebidas", icon: "🥤" },
  { id: "combos", name: "🔥 Combos", icon: "🔥" },
];

export const PRODUCTS: Product[] = [
  // Mais pedidos
  {
    id: "smash-classic",
    name: "Smash Classic",
    description: "Burguer artesanal 150g, queijo cheddar cremoso, bacon crocante e molho da casa",
    price: 28.9,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop",
    category: "mais-pedidos",
    badges: ["🔥 Mais pedido"],
    extras: EXTRAS,
  },
  {
    id: "duplo-smash",
    name: "Duplo Smash",
    description: "Dois burguers smash 120g, queijo cheddar duplo, cebola caramelizada e molho especial",
    price: 35.9,
    image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&h=400&fit=crop",
    category: "mais-pedidos",
    badges: ["⭐ Favorito"],
    extras: EXTRAS,
  },
  {
    id: "bacon-monster",
    name: "Bacon Monster",
    description: "Burguer 200g, montanha de bacon crocante, queijo cheddar, alface e tomate",
    price: 38.9,
    image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=600&h=400&fit=crop",
    category: "mais-pedidos",
    badges: ["🔥 Mais pedido"],
    extras: EXTRAS,
  },
  // Hambúrgueres
  {
    id: "classic-burger",
    name: "Classic Burger",
    description: "Burguer artesanal 150g, queijo, alface, tomate e maionese caseira",
    price: 24.9,
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&h=400&fit=crop",
    category: "hamburgueres",
    extras: EXTRAS,
  },
  {
    id: "cheddar-melt",
    name: "Cheddar Melt",
    description: "Burguer 180g coberto com cheddar derretido, cebola roxa e pickle",
    price: 32.9,
    image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&h=400&fit=crop",
    category: "hamburgueres",
    extras: EXTRAS,
  },
  {
    id: "bbq-burger",
    name: "BBQ Burger",
    description: "Burguer 180g, onion rings, bacon, cheddar e molho barbecue defumado",
    price: 36.9,
    image: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=600&h=400&fit=crop",
    category: "hamburgueres",
    extras: EXTRAS,
  },
  {
    id: "trufado",
    name: "Burger Trufado",
    description: "Burguer 200g, queijo brie, cogumelos salteados e maionese trufada",
    price: 42.9,
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&h=400&fit=crop",
    category: "hamburgueres",
    badges: ["⭐ Favorito"],
    extras: EXTRAS,
  },
  // Acompanhamentos
  {
    id: "batata-frita",
    name: "Batata Frita",
    description: "Porção de batata frita crocante com sal e temperos",
    price: 14.9,
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=400&fit=crop",
    category: "acompanhamentos",
  },
  {
    id: "onion-rings",
    name: "Onion Rings",
    description: "Anéis de cebola empanados e crocantes",
    price: 16.9,
    image: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&h=400&fit=crop",
    category: "acompanhamentos",
  },
  {
    id: "nuggets",
    name: "Nuggets (10un)",
    description: "Nuggets crocantes com molho à escolha",
    price: 18.9,
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=400&fit=crop",
    category: "acompanhamentos",
  },
  // Bebidas
  {
    id: "coca-lata",
    name: "Coca-Cola Lata",
    description: "Coca-Cola lata 350ml gelada",
    price: 6.9,
    image: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=600&h=400&fit=crop",
    category: "bebidas",
  },
  {
    id: "guarana-lata",
    name: "Guaraná Lata",
    description: "Guaraná Antarctica lata 350ml",
    price: 5.9,
    image: "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=600&h=400&fit=crop",
    category: "bebidas",
  },
  {
    id: "suco-natural",
    name: "Suco Natural",
    description: "Suco natural 500ml - sabores variados",
    price: 9.9,
    image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=600&h=400&fit=crop",
    category: "bebidas",
  },
  {
    id: "milkshake",
    name: "Milkshake",
    description: "Milkshake cremoso 400ml - chocolate, morango ou ovomaltine",
    price: 16.9,
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&h=400&fit=crop",
    category: "bebidas",
  },
  // Combos
  {
    id: "combo-smash",
    name: "Combo Smash",
    description: "Smash Classic + Batata Frita + Coca-Cola. Economize R$6!",
    price: 44.9,
    image: "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=600&h=400&fit=crop",
    category: "combos",
    badges: ["💰 Economize R$6"],
  },
  {
    id: "combo-duplo",
    name: "Combo Duplo Smash",
    description: "Duplo Smash + Onion Rings + Milkshake. Economize R$8!",
    price: 62.9,
    image: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=600&h=400&fit=crop",
    category: "combos",
    badges: ["💰 Economize R$8"],
  },
  {
    id: "combo-casal",
    name: "Combo Casal",
    description: "2 Classic Burgers + Batata Grande + 2 Coca-Cola. Economize R$10!",
    price: 69.9,
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=600&h=400&fit=crop",
    category: "combos",
    badges: ["💰 Economize R$10", "⭐ Favorito"],
  },
];
