// Roda no contexto da página (não da extensão) para hookar fetch e XHR.
// Captura QUALQUER resposta JSON que pareça um pedido do iFood e dispara
// um window.postMessage que o content script escuta.
(function () {
  if (window.__TRUEBOX_HOOKED__) return;
  window.__TRUEBOX_HOOKED__ = true;

  const TAG = "[Truebox-Inject]";
  const send = (url, data) => {
    try {
      window.postMessage(
        { __truebox: true, kind: "ifood_response", url, data },
        "*"
      );
    } catch (_) {}
  };

  const looksLikeOrder = (obj) => {
    if (!obj || typeof obj !== "object") return false;
    // Pedido único
    if ((obj.id || obj.orderId || obj.displayId) && (obj.items || obj.bag || obj.products)) return true;
    // Lista de pedidos
    if (Array.isArray(obj) && obj.length && looksLikeOrder(obj[0])) return true;
    if (Array.isArray(obj.orders) && obj.orders.length && looksLikeOrder(obj.orders[0])) return true;
    if (Array.isArray(obj.content) && obj.content.length && looksLikeOrder(obj.content[0])) return true;
    if (Array.isArray(obj.data) && obj.data.length && looksLikeOrder(obj.data[0])) return true;
    return false;
  };

  const tryParse = (text) => {
    if (!text || typeof text !== "string") return null;
    if (text[0] !== "{" && text[0] !== "[") return null;
    try { return JSON.parse(text); } catch { return null; }
  };

  const handle = (url, payload) => {
    if (!payload) return;
    if (looksLikeOrder(payload)) {
      send(url, payload);
      return;
    }
    // Mergulha um nível em chaves comuns
    for (const k of ["order", "data", "result", "payload"]) {
      if (payload[k] && looksLikeOrder(payload[k])) { send(url, payload[k]); return; }
    }
  };

  // ---- fetch hook ----
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const req = args[0];
    const url = typeof req === "string" ? req : req?.url || "";
    return origFetch.apply(this, args).then(async (res) => {
      try {
        if (/ifood/i.test(url) && /\/(order|pedido|merchant|consumer|virtual-bag)/i.test(url)) {
          const clone = res.clone();
          const text = await clone.text();
          const data = tryParse(text);
          handle(url, data);
        }
      } catch (e) { /* silencioso */ }
      return res;
    });
  };

  // ---- XHR hook ----
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__truebox_url = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", () => {
      try {
        const url = this.__truebox_url || "";
        if (/ifood/i.test(url) && /\/(order|pedido|merchant|consumer|virtual-bag)/i.test(url)) {
          const data = tryParse(this.responseText);
          handle(url, data);
        }
      } catch (_) {}
    });
    return origSend.apply(this, arguments);
  };

  console.log(TAG, "fetch/XHR hooked");
})();
