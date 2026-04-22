import type { Database } from "@/integrations/supabase/types";

type DeliveryPerson = Database["public"]["Tables"]["delivery_persons"]["Row"];

export const DRIVER_GPS_STALE_MS = 3 * 60 * 1000;

export type DriverPresenceState = "available" | "on_route" | "paused" | "stale" | "offline";

export const getDriverPresence = (driver: DeliveryPerson, now = Date.now()) => {
  const lastSeenMs = driver.location_updated_at
    ? now - new Date(driver.location_updated_at).getTime()
    : null;
  const lastSeenMin = lastSeenMs !== null ? Math.max(0, Math.round(lastSeenMs / 60000)) : null;
  const isFreshGps = lastSeenMs !== null && lastSeenMs <= DRIVER_GPS_STALE_MS;
  const rawStatus = driver.status || "offline";

  let state: DriverPresenceState;

  if (!driver.is_online) {
    state = "offline";
  } else if (!isFreshGps) {
    state = "stale";
  } else if (rawStatus === "on_route") {
    state = "on_route";
  } else if (rawStatus === "paused") {
    state = "paused";
  } else {
    state = "available";
  }

  const label =
    state === "stale"
      ? `GPS parado ${lastSeenMin ?? "?"}m`
      : state === "on_route"
        ? "Em rota"
        : state === "paused"
          ? "Pausado"
          : state === "available"
            ? "Disponível"
            : "Offline";

  return {
    state,
    label,
    rawStatus,
    lastSeenMs,
    lastSeenMin,
    isFreshGps,
    isEffectivelyOnline: state === "available" || state === "on_route" || state === "paused",
  };
};