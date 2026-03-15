import { supabase } from "@/integrations/supabase/client";
import { EligibleOrder, RouteCandidate, RoutingConfig, RouteStop } from "./types";
import { haversineDistance, calculateRouteDistance, permutations, estimateTravelTime, getStoreCoords } from "./distanceUtils";

/**
 * Fetch routing configuration from DB
 */
export async function fetchRoutingConfig(): Promise<RoutingConfig> {
  const { data } = await supabase.from("routing_config").select("key, value");
  const config: Record<string, string> = {};
  (data || []).forEach((r: any) => { config[r.key] = r.value; });
  
  return {
    max_grouping_radius_km: parseFloat(config.max_grouping_radius_km || "5"),
    max_orders_per_route: parseInt(config.max_orders_per_route || "3"),
    max_time_diff_min: parseInt(config.max_time_diff_min || "15"),
    max_wait_before_route_min: parseInt(config.max_wait_before_route_min || "10"),
    weight_distance: parseFloat(config.weight_distance || "1.0"),
    weight_time: parseFloat(config.weight_time || "1.5"),
    weight_delay: parseFloat(config.weight_delay || "2.0"),
    weight_priority: parseFloat(config.weight_priority || "1.8"),
    assignment_mode: (config.assignment_mode || "manual") as 'manual' | 'auto',
    acceptable_delay_min: parseInt(config.acceptable_delay_min || "15"),
  };
}

/**
 * Fetch eligible orders (ready, not routed, not cancelled)
 */
export async function fetchEligibleOrders(): Promise<EligibleOrder[]> {
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "ready")
    .is("route_id", null)
    .eq("order_type", "delivery")
    .not("delivery_lat", "is", null)
    .not("delivery_lng", "is", null)
    .order("created_at", { ascending: true });
  
  return (data || []) as EligibleOrder[];
}

/**
 * Group nearby orders within radius of anchor
 */
function groupNearbyOrders(
  anchor: EligibleOrder,
  others: EligibleOrder[],
  maxRadiusKm: number,
  maxOrders: number
): EligibleOrder[][] {
  const nearby = others.filter(o => {
    const dist = haversineDistance(
      anchor.delivery_lat!, anchor.delivery_lng!,
      o.delivery_lat!, o.delivery_lng!
    );
    return dist <= maxRadiusKm;
  });

  const groups: EligibleOrder[][] = [[anchor]];
  
  // Generate combinations of 2
  for (const o of nearby) {
    groups.push([anchor, o]);
  }
  
  // Generate combinations of 3
  if (maxOrders >= 3) {
    for (let i = 0; i < nearby.length; i++) {
      for (let j = i + 1; j < nearby.length; j++) {
        groups.push([anchor, nearby[i], nearby[j]]);
      }
    }
  }
  
  return groups;
}

/**
 * Score a route candidate
 */
function scoreRoute(
  candidate: RouteCandidate,
  config: RoutingConfig,
  anchorAgeMin: number
): number {
  return (
    candidate.totalDistanceKm * config.weight_distance +
    candidate.estimatedDurationMin * config.weight_time +
    Math.max(0, candidate.predictedRealDurationMin - config.acceptable_delay_min) * config.weight_delay +
    anchorAgeMin * config.weight_priority
  );
}

/**
 * Find the best route from eligible orders
 */
export async function optimizeRoutes(): Promise<RouteCandidate | null> {
  const config = await fetchRoutingConfig();
  const orders = await fetchEligibleOrders();
  
  if (orders.length === 0) return null;
  
  const store = getStoreCoords();
  const anchor = orders[0]; // Oldest order
  const others = orders.slice(1);
  const anchorAgeMin = (Date.now() - new Date(anchor.created_at).getTime()) / 60000;
  
  const groups = groupNearbyOrders(anchor, others, config.max_grouping_radius_km, config.max_orders_per_route);
  
  let bestCandidate: RouteCandidate | null = null;
  let bestScore = Infinity;
  
  for (const group of groups) {
    const stops: Array<{ lat: number; lng: number; order: EligibleOrder }> = group.map(o => ({
      lat: o.delivery_lat!,
      lng: o.delivery_lng!,
      order: o,
    }));
    
    // Try all permutations
    const perms = permutations(stops);
    
    for (const perm of perms) {
      const { totalKm, legDistances } = calculateRouteDistance(
        perm.map(s => ({ lat: s.lat, lng: s.lng })),
        store.lat, store.lng
      );
      
      const estDuration = estimateTravelTime(totalKm);
      const predictedReal = Math.round(estDuration * 1.15); // 15% buffer
      
      const routeStops: RouteStop[] = perm.map((s, i) => ({
        orderId: s.order.id,
        lat: s.lat,
        lng: s.lng,
        customerName: s.order.customer_name,
        customerPhone: s.order.customer_phone,
        orderNumber: s.order.order_number,
        stopOrder: i + 1,
      }));
      
      const candidate: RouteCandidate = {
        stops: routeStops,
        totalDistanceKm: Math.round(totalKm * 100) / 100,
        estimatedDurationMin: estDuration,
        predictedRealDurationMin: predictedReal,
        score: 0,
      };
      
      candidate.score = scoreRoute(candidate, config, anchorAgeMin);
      
      if (candidate.score < bestScore) {
        bestScore = candidate.score;
        bestCandidate = candidate;
      }
    }
  }
  
  return bestCandidate;
}

/**
 * Create a route in the database from a candidate
 */
export async function createRoute(candidate: RouteCandidate): Promise<string | null> {
  const store = getStoreCoords();
  
  const { data: route, error } = await supabase.from("routes").insert({
    origin_lat: store.lat,
    origin_lng: store.lng,
    total_distance_km: candidate.totalDistanceKm,
    estimated_duration_min: candidate.estimatedDurationMin,
    predicted_real_duration_min: candidate.predictedRealDurationMin,
    optimized_sequence: candidate.stops.map(s => s.orderId),
    status: "created",
  } as any).select("id").single();
  
  if (error || !route) return null;
  
  const routeId = (route as any).id;
  
  // Insert route stops
  const stopInserts = candidate.stops.map((s, i) => ({
    route_id: routeId,
    order_id: s.orderId,
    stop_order: i + 1,
    stop_distance_km: 0,
    stop_duration_min: Math.round(candidate.estimatedDurationMin / candidate.stops.length),
    predicted_eta: new Date(Date.now() + (candidate.estimatedDurationMin / candidate.stops.length * (i + 1)) * 60000).toISOString(),
  }));
  
  await supabase.from("route_orders").insert(stopInserts as any);
  
  // Update orders with route_id
  for (const stop of candidate.stops) {
    await supabase.from("orders").update({
      route_id: routeId,
      route_position: stop.stopOrder,
      predicted_eta: new Date(Date.now() + (candidate.estimatedDurationMin / candidate.stops.length * stop.stopOrder) * 60000).toISOString(),
    } as any).eq("id", stop.orderId);
  }
  
  return routeId;
}

/**
 * Auto-assign best available driver to a route
 */
export async function autoAssignDriver(routeId: string): Promise<string | null> {
  const store = getStoreCoords();
  
  const { data: drivers } = await supabase
    .from("delivery_persons")
    .select("*")
    .eq("is_active", true)
    .eq("is_online", true);
  
  if (!drivers || drivers.length === 0) return null;
  
  // Find available drivers (not on a route)
  const available = drivers.filter((d: any) => !d.current_route_id || d.status === "available");
  if (available.length === 0) return null;
  
  // Score drivers: prefer closest to store, least busy
  let bestDriver: any = null;
  let bestScore = Infinity;
  
  for (const driver of available) {
    const d = driver as any;
    const dist = d.current_lat && d.current_lng
      ? haversineDistance(store.lat, store.lng, d.current_lat, d.current_lng)
      : 999;
    const score = dist + (d.avg_delay_rate || 0) * 10;
    if (score < bestScore) {
      bestScore = score;
      bestDriver = d;
    }
  }
  
  if (!bestDriver) return null;
  
  await supabase.from("routes").update({
    driver_id: bestDriver.id,
    status: "assigned",
    auto_assigned: true,
  } as any).eq("id", routeId);
  
  await supabase.from("delivery_persons").update({
    current_route_id: routeId,
    status: "on_route",
  } as any).eq("id", bestDriver.id);
  
  return bestDriver.id;
}

/**
 * Manually assign a driver to a route
 */
export async function manualAssignDriver(routeId: string, driverId: string): Promise<boolean> {
  const { error: routeErr } = await supabase.from("routes").update({
    driver_id: driverId,
    status: "assigned",
    auto_assigned: false,
  } as any).eq("id", routeId);
  
  if (routeErr) return false;
  
  await supabase.from("delivery_persons").update({
    current_route_id: routeId,
    status: "on_route",
  } as any).eq("id", driverId);
  
  return true;
}

/**
 * Update route status
 */
export async function updateRouteStatus(routeId: string, status: string): Promise<boolean> {
  const { error } = await supabase.from("routes").update({ status } as any).eq("id", routeId);
  
  if (status === "completed" || status === "cancelled") {
    // Free up the driver
    const { data: route } = await supabase.from("routes").select("driver_id").eq("id", routeId).single();
    if (route && (route as any).driver_id) {
      await supabase.from("delivery_persons").update({
        current_route_id: null,
        status: "available",
      } as any).eq("id", (route as any).driver_id);
    }
  }
  
  return !error;
}
