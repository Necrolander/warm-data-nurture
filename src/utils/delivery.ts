import { supabase } from "@/integrations/supabase/client";

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Store coordinates (default fallback)
const DEFAULT_COORDS = { lat: -16.014293069314565, lng: -48.05929532023717 };

export async function getDeliveryFeeFromDB(
  customerLat: number,
  customerLng: number,
  storeCoords?: { lat: number; lng: number }
): Promise<{ fee: number; distance: number } | null> {
  const coords = storeCoords || DEFAULT_COORDS;
  const distance = calculateDistance(coords.lat, coords.lng, customerLat, customerLng);

  const { data: fees } = await supabase
    .from("delivery_fees")
    .select("max_km, fee")
    .order("max_km", { ascending: true });

  if (!fees || fees.length === 0) return null;

  const maxKm = Math.max(...fees.map((f) => Number(f.max_km)));
  if (distance > maxKm) return null;

  for (const tier of fees) {
    if (distance <= Number(tier.max_km)) {
      return { fee: Number(tier.fee), distance };
    }
  }

  return null;
}

// Keep sync version for backward compat using cached fees
export function getDeliveryFeeSync(
  customerLat: number,
  customerLng: number,
  fees: Array<{ max_km: number; fee: number }>,
  storeCoords?: { lat: number; lng: number }
): { fee: number; distance: number } | null {
  const coords = storeCoords || DEFAULT_COORDS;
  const distance = calculateDistance(coords.lat, coords.lng, customerLat, customerLng);

  if (fees.length === 0) return null;

  const maxKm = Math.max(...fees.map((f) => f.max_km));
  if (distance > maxKm) return null;

  for (const tier of fees) {
    if (distance <= tier.max_km) {
      return { fee: tier.fee, distance };
    }
  }

  return null;
}
