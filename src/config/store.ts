export const STORE_CONFIG = {
  name: "Truebox Hamburgueria",
  phone: "5561996179376",
  address: "Gama - DF",
  coordinates: {
    lat: -16.0145251,
    lng: -48.0593436,
  },
  hours: {
    open: "18:00",
    close: "23:00",
  },
  minOrder: 20,
  deliveryFees: [
    { maxKm: 3, fee: 5 },
    { maxKm: 5, fee: 7 },
    { maxKm: 7, fee: 10 },
    { maxKm: 10, fee: 15 },
    { maxKm: 15, fee: 20 },
  ],
  maxDeliveryKm: 15,
};

export type StoreConfig = typeof STORE_CONFIG;
