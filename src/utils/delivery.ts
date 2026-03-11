import { STORE_CONFIG } from "@/config/store";

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getDeliveryFee(customerLat: number, customerLng: number): { fee: number; distance: number } | null {
  const distance = calculateDistance(
    STORE_CONFIG.coordinates.lat,
    STORE_CONFIG.coordinates.lng,
    customerLat,
    customerLng
  );

  if (distance > STORE_CONFIG.maxDeliveryKm) return null;

  for (const tier of STORE_CONFIG.deliveryFees) {
    if (distance <= tier.maxKm) return { fee: tier.fee, distance };
  }

  return null;
}
