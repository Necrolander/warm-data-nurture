// Content script — roda em portal.ifood.com.br, lê pedidos visíveis na DOM
// e envia em batch para o service worker.
(function () {
  const POLL_MS = 15000;
  const SEEN = new Set();

  function pickStatus(text) {
    const t = (text || "").toLowerCase();
    if (/cancelad/.test(t)) return "cancelled";
    if (/entreg(ue|ado)/.test(t)) return "delivered";
    if (/saiu para entrega|a caminho/.test(t)) return "out_for_delivery";
    if (/pronto|finalizado/.test(t)) return "ready";
    if (/em produ(c|ç)ão|preparand/.test(t)) return "preparing";
    if (/confirmad/.test(t)) return "confirmed";
    return "pending";
  }
  function pickMoney(text) {
    const m = (text || "").match(/R\$\s*([\d.,]+)/);
    if (!m) return 0;
    return parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || 0;
  }
  function pickOrderNumber(text) {
    const m = (text || "").match(/#\s*(\d{2,})/);
    return m ? m[1] : null;
  }
  function hashOf(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return "auto_" + Math.abs(h);
  }
  function pickCustomer(text) {
    const m = (text || "").match(/cliente[:\s]+([^\n]+)/i);
    return m ? m[1].trim().slice(0, 80) : "Cliente iFood";
  }

  function extractOrders() {
    const selectors = [
      '[data-testid*="order-card" i]',
      '[data-testid*="pedido" i]',
      'article[class*="order" i]',
      'div[class*="order-card" i]',
      'li[class*="order" i]',
    ];
    let nodes = [];
    for (const sel of selectors) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length) { nodes = found; break; }
    }
    if (!nodes.length) return [];

    const out = [];
    for (const el of nodes) {
      try {
        const text = el.innerText || el.textContent || "";
        const id = el.getAttribute("data-order-id")
          || el.getAttribute("data-id")
          || pickOrderNumber(text)
          || hashOf(text);
        const status = pickStatus(text);
        out.push({
          externalOrderId: String(id),
          raw: { text: text.slice(0, 2000), url: location.href },
          normalized: {
            rawStatus: status,
            status,
            customer: { name: pickCustomer(text) },
            totals: { total: pickMoney(text) },
            source: "chrome-extension",
          },
        });
      } catch (_) {}
    }
    return out;
  }

  async function tick() {
    try {
      const orders = extractOrders();
      const fresh = orders.filter((o) => {
        const key = o.externalOrderId + "|" + o.normalized.status + "|" + o.normalized.totals.total;
        if (SEEN.has(key)) return false;
        SEEN.add(key);
        return true;
      });
      if (fresh.length) {
        chrome.runtime.sendMessage({ type: "ORDERS_BATCH", orders: fresh }, () => void chrome.runtime.lastError);
        showBadge(`+${fresh.length}`);
      }
    } catch (e) {
      console.warn("[Truebox iFood] tick error", e);
    }
  }

  // Badge visual flutuante no portal
  let badgeEl;
  function ensureBadge() {
    if (badgeEl) return badgeEl;
    badgeEl = document.createElement("div");
    badgeEl.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#ea1d2c;color:#fff;padding:8px 12px;border-radius:999px;font:600 12px system-ui;box-shadow:0 4px 12px rgba(0,0,0,.25);opacity:.95;pointer-events:none;transition:transform .2s";
    badgeEl.textContent = "Truebox: lendo…";
    document.documentElement.appendChild(badgeEl);
    return badgeEl;
  }
  function showBadge(label) {
    const b = ensureBadge();
    b.textContent = `Truebox iFood ${label}`;
    b.style.transform = "scale(1.1)";
    setTimeout(() => (b.style.transform = "scale(1)"), 200);
  }

  ensureBadge();
  tick();
  setInterval(tick, POLL_MS);
})();
