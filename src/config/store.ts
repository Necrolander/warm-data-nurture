export const STORE_CONFIG = {
  name: "Burger House",
  phone: "5561999999999", // WhatsApp number with country code
  address: "Gama - DF",
  coordinates: {
    lat: -15.9594,
    lng: -48.0482,
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
  ],
  maxDeliveryKm: 10,
};

export type StoreConfig = typeof STORE_CONFIG;
