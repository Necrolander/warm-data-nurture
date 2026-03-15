import { supabase } from "@/integrations/supabase/client";
import { DemandForecast } from "./types";

/**
 * Get demand forecast for next hours based on historical data
 */
export async function getDemandForecast(hoursAhead: number = 3): Promise<DemandForecast[]> {
  const now = new Date();
  const currentHour = now.getHours();
  const dayOfWeek = now.getDay();
  
  // Fetch historical order counts for same day of week
  const { data: history } = await supabase
    .from("orders")
    .select("created_at")
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days
  
  if (!history || history.length === 0) {
    // Return default estimates
    return Array.from({ length: hoursAhead }, (_, i) => ({
      hour: (currentHour + i + 1) % 24,
      predictedOrders: 8,
      suggestedDrivers: 2,
    }));
  }
  
  // Group by day of week and hour
  const hourCounts: Record<string, number[]> = {};
  
  for (const order of history) {
    const d = new Date(order.created_at!);
    const dow = d.getDay();
    const h = d.getHours();
    const key = `${dow}-${h}`;
    if (!hourCounts[key]) hourCounts[key] = [];
    hourCounts[key].push(1);
  }
  
  const forecasts: DemandForecast[] = [];
  const avgCapacityPerDriver = 6;
  
  for (let i = 1; i <= hoursAhead; i++) {
    const targetHour = (currentHour + i) % 24;
    const key = `${dayOfWeek}-${targetHour}`;
    const counts = hourCounts[key] || [];
    const avgOrders = counts.length > 0 ? Math.round(counts.length / 4) : 5; // Avg over ~4 weeks
    
    forecasts.push({
      hour: targetHour,
      predictedOrders: avgOrders,
      suggestedDrivers: Math.max(1, Math.ceil(avgOrders / avgCapacityPerDriver)),
    });
  }
  
  return forecasts;
}

/**
 * Get current operational stats
 */
export async function getOperationalStats() {
  const [
    { count: pendingCount },
    { count: readyCount },
    { data: activeRoutes },
    { data: onlineDrivers },
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending").eq("order_type", "delivery"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "ready").is("route_id", null).eq("order_type", "delivery"),
    supabase.from("routes").select("id, status").in("status", ["created", "awaiting_driver", "assigned", "in_delivery"]),
    supabase.from("delivery_persons").select("id, status, is_online").eq("is_active", true).eq("is_online", true),
  ]);
  
  const routesByStatus = {
    created: 0,
    awaiting_driver: 0,
    assigned: 0,
    in_delivery: 0,
  };
  
  (activeRoutes || []).forEach((r: any) => {
    if (routesByStatus.hasOwnProperty(r.status)) {
      routesByStatus[r.status as keyof typeof routesByStatus]++;
    }
  });
  
  const driversByStatus = {
    available: 0,
    on_route: 0,
    paused: 0,
    total_online: onlineDrivers?.length || 0,
  };
  
  (onlineDrivers || []).forEach((d: any) => {
    if (d.status === "available" || !d.status || d.status === "offline") driversByStatus.available++;
    else if (d.status === "on_route") driversByStatus.on_route++;
    else if (d.status === "paused") driversByStatus.paused++;
  });
  
  return {
    pendingOrders: pendingCount || 0,
    readyForRouting: readyCount || 0,
    routes: routesByStatus,
    drivers: driversByStatus,
    totalActiveRoutes: (activeRoutes || []).length,
  };
}
