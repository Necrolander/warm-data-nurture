import { CartItem } from "@/contexts/CartContext";

interface OrderData {
  name: string;
  phone: string;
  reference: string;
  observation: string;
  payment: string;
  change?: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  location: { lat: number; lng: number };
  storeName?: string;
  storePhone?: string;
}

export function buildWhatsAppMessage(order: OrderData): string {
  const storeName = order.storeName || "Truebox Hamburgueria";
  let msg = `🍔 *NOVO PEDIDO - ${storeName}*\n\n`;
  msg += `👤 *Cliente:* ${order.name}\n`;
  msg += `📱 *Telefone:* ${order.phone}\n`;
  msg += `📍 *Referência:* ${order.reference}\n`;
  if (order.observation) msg += `📝 *Observação:* ${order.observation}\n`;
  msg += `\n━━━━━━━━━━━━━━━\n`;
  msg += `📋 *ITENS DO PEDIDO:*\n\n`;

  order.items.forEach((item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    const itemTotal = (item.product.price + extrasTotal) * item.quantity;
    msg += `${item.quantity}x ${item.product.name} — R$ ${itemTotal.toFixed(2).replace(".", ",")}\n`;
    if (item.extras.length > 0) {
      msg += `   ➕ ${item.extras.map((e) => e.name).join(", ")}\n`;
    }
    if (item.observation) {
      msg += `   📝 ${item.observation}\n`;
    }
  });

  msg += `\n━━━━━━━━━━━━━━━\n`;
  msg += `💰 *Subtotal:* R$ ${order.subtotal.toFixed(2).replace(".", ",")}\n`;
  msg += `🚚 *Taxa de entrega:* R$ ${order.deliveryFee.toFixed(2).replace(".", ",")}\n`;
  msg += `💵 *TOTAL:* R$ ${order.total.toFixed(2).replace(".", ",")}\n\n`;
  msg += `💳 *Pagamento:* ${order.payment}\n`;
  if (order.payment === "Dinheiro" && order.change) {
    const changeVal = parseFloat(order.change);
    if (!isNaN(changeVal) && changeVal > order.total) {
      const trocoNeeded = changeVal - order.total;
      msg += `💰 *Troco para:* R$ ${order.change}\n`;
      msg += `🔄 *Levar de troco:* R$ ${trocoNeeded.toFixed(2).replace(".", ",")}\n`;
    } else {
      msg += `💰 *Troco para:* R$ ${order.change}\n`;
    }
  }
  msg += `\n📍 *Localização:*\nhttps://maps.google.com/?q=${order.location.lat},${order.location.lng}`;

  return msg;
}

export function sendWhatsAppOrder(order: OrderData) {
  const storePhone = order.storePhone || "5561996179376";
  const message = buildWhatsAppMessage(order);
  const url = `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}
