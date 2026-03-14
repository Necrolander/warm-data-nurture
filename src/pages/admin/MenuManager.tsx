import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import ProductsTab from "./menu/ProductsTab";
import CategoriesTab from "./menu/CategoriesTab";
import ExtrasTab from "./menu/ExtrasTab";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  badges: string[];
  is_active: boolean;
  sort_order: number;
  visibility_channels: string[] | null;
  available_days: number[] | null;
  available_start_time: string | null;
  available_end_time: string | null;
  is_combo: boolean | null;
  combo_items: any | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

interface ExtraGroup {
  id: string;
  name: string;
  description: string | null;
  max_select: number;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  applies_to_categories: string[] | null;
  applies_to_products: string[] | null;
}

interface Extra {
  id: string;
  name: string;
  description: string | null;
  price: number;
  group_id: string | null;
  max_quantity: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const MenuManager = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [extraGroups, setExtraGroups] = useState<ExtraGroup[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "categories" | "extras">("products");

  const fetchAll = async () => {
    const [p, c, eg, e] = await Promise.all([
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("extra_groups").select("*").order("sort_order"),
      supabase.from("product_extras").select("*").order("sort_order"),
    ]);
    if (p.data) setProducts(p.data as Product[]);
    if (c.data) setCategories(c.data as Category[]);
    if (eg.data) setExtraGroups(eg.data as ExtraGroup[]);
    if (e.data) setExtras(e.data as Extra[]);
  };

  useEffect(() => { fetchAll(); }, []);

  const productCounts: Record<string, number> = {};
  products.forEach(p => { productCounts[p.category] = (productCounts[p.category] || 0) + 1; });

  const tabs = [
    { key: "products" as const, label: "📦 Produtos", count: products.length },
    { key: "categories" as const, label: "📂 Categorias", count: categories.length },
    { key: "extras" as const, label: "🧀 Adicionais", count: `${extraGroups.length} grupos` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <Badge variant="secondary" className="text-[10px] h-5">{tab.count}</Badge>
          </button>
        ))}
      </div>

      {activeTab === "products" && (
        <ProductsTab products={products} categories={categories} onRefresh={fetchAll} />
      )}

      {activeTab === "categories" && (
        <CategoriesTab categories={categories} productCounts={productCounts} onRefresh={fetchAll} />
      )}

      {activeTab === "extras" && (
        <ExtrasTab
          groups={extraGroups}
          extras={extras}
          categories={categories.map(c => ({ slug: c.slug, name: c.name, icon: c.icon }))}
          products={products.map(p => ({ id: p.id, name: p.name, category: p.category }))}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
};

export default MenuManager;
