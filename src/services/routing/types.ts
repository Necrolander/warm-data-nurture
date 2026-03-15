export interface RouteStop {
  orderId: string;
  lat: number;
  lng: number;
  customerName: string;
  customerPhone: string;
  orderNumber: number;
  stopOrder: number;
}

export interface RouteCandidate {
  stops: RouteStop[];
  totalDistanceKm: number;
  estimatedDurationMin: number;
  predictedRealDurationMin: number;
  score: number;
}

export interface RoutingConfig {
  max_grouping_radius_km: number;
  max_orders_per_route: number;
  max_time_diff_min: number;
  max_wait_before_route_min: number;
  weight_distance: number;
  weight_time: number;
  weight_delay: number;
  weight_priority: number;
  assignment_mode: 'manual' | 'auto';
  acceptable_delay_min: number;
}

export interface EligibleOrder {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  created_at: string;
  ready_at: string | null;
  route_id: string | null;
  status: string;
  order_source: string | null;
  subtotal: number;
  total: number;
}

export interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
  current_route_id: string | null;
  is_active: boolean;
  is_online: boolean;
  avg_speed_kmh: number;
  avg_delay_rate: number;
  avg_capacity_per_hour: number;
  location_updated_at: string | null;
}

export interface RouteWithDetails {
  id: string;
  code: string;
  total_distance_km: number;
  estimated_duration_min: number;
  predicted_real_duration_min: number;
  status: string;
  driver_id: string | null;
  auto_assigned: boolean;
  created_at: string;
  updated_at: string;
  driver?: DriverInfo;
  stops: Array<{
    id: string;
    order_id: string;
    stop_order: number;
    stop_distance_km: number;
    stop_duration_min: number;
    predicted_eta: string | null;
    order?: EligibleOrder;
  }>;
}

export interface DemandForecast {
  hour: number;
  predictedOrders: number;
  suggestedDrivers: number;
}
