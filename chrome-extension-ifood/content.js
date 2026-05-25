// Content script — injeta o hook na página e escuta os JSONs capturados.
// Normaliza cada pedido para o formato esperado pela edge function
// `external-orders-ingest` (que alimenta create_order_from_external).
(function () {
  const SEEN = new Set();

  // 1) Injetar inject.js no contexto da página
  try {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("inject.js");
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn("[Truebox] failed to inject", e);
  }

  // 2) Badge visual
  let badgeEl;
  function ensureBadge() {
    if (badgeEl) return badgeEl;
    badgeEl = document.createElement("div");
    badgeEl.style.cssText =
      "position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#ea1d2c;color:#fff;padding:8px 12px;border-radius:999px;font:600 12px system-ui;box-shadow:0 4px 12px rgba(0,0,0,.25);opacity:.95;pointer-events:none;transition:transform .2s";
    badgeEl.textContent = "Truebox iFood: aguardando…";
    (document.body || document.documentElement).appendChild(badgeEl);
    return badgeEl;
  }
  function showBadge(label) {
    const b = ensureBadge();
    b.textContent = `Truebox iFood ${label}`;
    b.style.transform = "scale(1.1)";
    setTimeout(() => (b.style.transform = "scale(1)"), 200);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureBadge);
  } else {
    ensureBadge();
  }

  // 3) Helpers de normalização
  const num = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };
  const pick = (o, ...keys) => {
    for (const k of keys) {
      if (o && o[k] != null && o[k] !== "") return o[k];
    }
    return undefined;
  };

  function mapStatus(raw) {
    const t = String(raw || "").toLowerCase();
    if (/cancel/.test(t)) return "cancelled";
    if (/concluded|deliver|entreg/.test(t)) return "delivered";
    if (/dispatched|out.*deliver|saiu|a.caminho/.test(t)) return "out_for_delivery";
    if (/ready|pronto/.test(t)) return "ready";
    if (/preparing|preparand|produ/.test(t)) return "preparing";
    if (/confirm/.test(t)) return "confirmed";
    if (/placed|pending|novo|new/.test(t)) return "pending";
    return "pending";
  }

  function mapPayment(raw) {
    const t = String(raw || "").toUpperCase();
    if (/PIX/.test(t)) return "PIX";
    if (/DEBIT|DEBITO|DÉBITO/.test(t)) return "DEBIT";
    if (/CREDIT|CREDITO|CRÉDITO|CARD|CARTAO|CARTÃO/.test(t)) return "CREDIT";
    if (/CASH|DINHEIRO/.test(t)) return "CASH";
    return null;
  }

  function mapDelivery(raw) {
    const t = String(raw || "").toUpperCase();
    if (/PICK|RETIR|TAKE/.test(t)) return "PICKUP";
    return "DELIVERY";
  }

  // 4) Converte um pedido bruto do iFood no `normalized` esperado pelo backend
  function normalizeOrder(src) {
    if (!src || typeof src !== "object") return null;

    const id = pick(src, "id", "orderId", "displayId", "shortId", "reference");
    if (!id) return null;

    const customer = src.customer || src.consumer || {};
    const delivery = src.delivery || src.deliveryAddress || src.address || {};
    const addr = delivery.deliveryAddress || delivery.address || delivery;
    const payments =
      src.payments?.methods || src.payments || src.payment || src.paymentMethods || [];
    const firstPayment = Array.isArray(payments) ? payments[0] : payments;

    const itemsSrc = src.items || src.bag || src.products || [];
    const items = (Array.isArray(itemsSrc) ? itemsSrc : []).map((it) => {
      const optionsSrc = it.options || it.subItems || it.garnishItems || it.choices || [];
      const options = (Array.isArray(optionsSrc) ? optionsSrc : []).flatMap((g) => {
        if (Array.isArray(g.garnishItems)) return g.garnishItems.map((x) => ({ name: x.name, quantity: x.quantity || 1, unitPrice: num(x.unitPrice || x.price) }));
        if (Array.isArray(g.items)) return g.items.map((x) => ({ name: x.name, quantity: x.quantity || 1, unitPrice: num(x.unitPrice || x.price) }));
        return [{ name: g.name, quantity: g.quantity || 1, unitPrice: num(g.unitPrice || g.price) }];
      });
      return {
        name: pick(it, "name", "productName", "title") || "Item",
        unitPrice: num(pick(it, "unitPrice", "price", "totalPrice")) / (it.quantity || 1) || num(pick(it, "unitPrice", "price")),
        quantity: Number(pick(it, "quantity", "qty")) || 1,
        notes: pick(it, "observations", "observation", "note", "notes"),
        options,
      };
    });

    const totals = src.total || src.totals || {};
    const subtotal = num(pick(totals, "subTotal", "subtotal", "itemsAmount") ?? src.subTotal);
    const deliveryFee = num(pick(totals, "deliveryFee", "deliveryAmount") ?? src.deliveryFee ?? delivery.deliveryFee);
    const total = num(pick(totals, "orderAmount", "total", "amount") ?? src.totalAmount ?? src.total);

    const rawStatus = pick(src, "status", "orderStatus", "currentStatus", "statusCode");

    return {
      rawStatus: String(rawStatus || ""),
      status: mapStatus(rawStatus),
      source: "ifood-portal-extension",
      orderNumber: String(pick(src, "displayId", "shortId", "reference", "id")),
      customer: {
        name: pick(customer, "name", "fullName", "displayName") || "Cliente iFood",
        phone:
          pick(customer, "phone", "phoneNumber", "mobilePhone") ||
          pick(customer.phone || {}, "number", "fullNumber") ||
          "",
        document: pick(customer, "documentNumber", "taxpayerIdentificationNumber", "cpf") || "",
      },
      delivery: {
        type: mapDelivery(pick(src, "orderType", "deliveryMethod") || delivery.mode || delivery.deliveryMode),
        reference: pick(addr, "reference", "complement", "neighborhood"),
        address: {
          street: pick(addr, "streetName", "street", "address"),
          number: pick(addr, "streetNumber", "number"),
          complement: pick(addr, "complement"),
          neighborhood: pick(addr, "neighborhood", "district"),
          city: pick(addr, "city"),
          state: pick(addr, "state", "uf"),
          postalCode: pick(addr, "postalCode", "zipCode", "cep"),
          latitude: addr?.coordinates?.latitude ?? addr?.latitude,
          longitude: addr?.coordinates?.longitude ?? addr?.longitude,
        },
      },
      payment: {
        method: mapPayment(pick(firstPayment || {}, "method", "type", "code", "name")),
        prepaid: !!pick(firstPayment || {}, "prepaid", "isPrepaid"),
        value: num(pick(firstPayment || {}, "value", "amount")),
        change: num(pick(firstPayment || {}, "changeFor", "cash")),
      },
      items,
      totals: { subtotal, total },
      fees: { deliveryFee },
      notes: pick(src, "observations", "notes", "additionalInfo"),
    };
  }

  // 5) Extrai array de pedidos de qualquer formato comum
  function pluckOrders(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.orders)) return data.orders;
    if (Array.isArray(data.content)) return data.content;
    if (Array.isArray(data.data)) return data.data;
    return [data];
  }

  // 6) Escuta mensagens do inject.js
  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const m = ev.data;
    if (!m || !m.__truebox || m.kind !== "ifood_response") return;

    try {
      const raws = pluckOrders(m.data);
      const batch = [];
      for (const raw of raws) {
        const norm = normalizeOrder(raw);
        if (!norm) continue;
        const key = norm.orderNumber + "|" + norm.status + "|" + norm.totals.total;
        if (SEEN.has(key)) continue;
        SEEN.add(key);
        batch.push({
          externalOrderId: norm.orderNumber,
          normalized: norm,
          raw: { url: m.url, source: raw },
        });
      }
      if (batch.length) {
        chrome.runtime.sendMessage(
          { type: "ORDERS_BATCH", orders: batch },
          () => void chrome.runtime.lastError
        );
        showBadge(`+${batch.length} pedido(s) capturado(s)`);
      }
    } catch (e) {
      console.warn("[Truebox] normalize error", e);
    }
  });

  console.log("[Truebox] content script ready");
})();
