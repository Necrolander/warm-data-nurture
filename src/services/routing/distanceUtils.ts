import { STORE_CONFIG } from "@/config/store";

/**
 * Haversine distance between two points in km
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate travel time in minutes based on distance and avg speed
 */
export function estimateTravelTime(distanceKm: number, avgSpeedKmh: number = 25): number {
  return Math.round((distanceKm / avgSpeedKmh) * 60);
}

/**
 * Get store coordinates
 */
export function getStoreCoords() {
  return STORE_CONFIG.coordinates;
}

/**
 * Generate all permutations of an array
 */
export function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

/**
 * Calculate total route distance: store -> stop1 -> stop2 -> ... 
 */
export function calculateRouteDistance(
  stops: Array<{ lat: number; lng: number }>,
  storeLat: number = STORE_CONFIG.coordinates.lat,
  storeLng: number = STORE_CONFIG.coordinates.lng
): { totalKm: number; legDistances: number[] } {
  const legDistances: number[] = [];
  let totalKm = 0;
  
  // Store to first stop
  const firstLeg = haversineDistance(storeLat, storeLng, stops[0].lat, stops[0].lng);
  legDistances.push(firstLeg);
  totalKm += firstLeg;
  
  // Between stops
  for (let i = 0; i < stops.length - 1; i++) {
    const leg = haversineDistance(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
    legDistances.push(leg);
    totalKm += leg;
  }
  
  return { totalKm, legDistances };
}
