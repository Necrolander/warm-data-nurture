import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DbProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  badges: string[] | null;
  sort_order: number | null;
}

export interface DbCategory {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number | null;
}

export interface DbExtra {
  id: string;
  name: string;
  price: number;
}

// Map DB product to the Product interface used by components
export function mapDbProduct(p: DbProduct, extras: DbExtra[]) {
  return {
    id: p.id,
    name: p.name,
    description: p.description || "",
    price: Number(p.price),
    image: p.image_url || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop",
    category: p.category,
    badges: p.badges || undefined,
    extras: extras.map((e) => ({ id: e.id, name: e.name, price: Number(e.price) })),
  };
}

export function useProducts() {
  return useQuery({
    queryKey: ["public-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as DbProduct[];
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["public-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as DbCategory[];
    },
  });
}

export function useExtras() {
  return useQuery({
    queryKey: ["public-extras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_extras")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as DbExtra[];
    },
  });
}

export function useStoreSettings() {
  return useQuery({
    queryKey: ["public-store-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("key, value");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((row) => { map[row.key] = row.value; });
      return map;
    },
  });
}

export function useStoreSchedule() {
  return useQuery({
    queryKey: ["public-store-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_schedule")
        .select("*")
        .order("day_of_week", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useIsStoreOpen(settings: Record<string, string> | undefined, schedule: any[] | undefined) {
  if (!settings || !schedule) return null;

  // Check manual override
  if (settings.store_open === "false") return false;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const todaySchedule = schedule.find((s) => s.day_of_week === dayOfWeek);

  if (!todaySchedule || !todaySchedule.is_open) return false;

  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;
}
