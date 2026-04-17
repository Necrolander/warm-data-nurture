// Lê pedidos do Portal iFood e normaliza pra enviar ao Lovable.
//
// ⚠️ IMPORTANTE: os seletores abaixo são GENÉRICOS. O HTML real do portal iFood
// muda com frequência. Você (ou eu, depois) precisa ajustar os seletores
// olhando os screenshots que o bot envia para o painel /admin/ifood-bot.
//
// Estratégia atual:
// 1. Navega pra aba "Pedidos" (/pedidos)
// 2. Lê todos os cards visíveis
// 3. Pra cada card, extrai: id, status, cliente, itens, total
// 4. Envia pra edge function ingest_order
import { api } from "./api.js";
import { uploadCurrentScreen } from "./ifood-login.js";

const ORDERS_PATH = "/pedidos";

export async function pollOrders(page, log) {
  const baseUrl = (process.env.IFOOD_PORTAL_URL || "https://portal.ifood.com.br").replace(/\/$/, "");
  const target = baseUrl + ORDERS_PATH;

  if (!page.url().startsWith(target)) {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  // Tira screenshot ocasional pra debug
  if (Math.random() < 0.05) await uploadCurrentScreen(page, "Tela de pedidos");

  const cards = await extractOrderCards(page);
  if (cards.length === 0) {
    log(`📭 Nenhum pedido visível na tela`);
    return { captured: 0 };
  }

  let captured = 0;
  for (const card of cards) {
    try {
      await api.ingestOrder(card.externalOrderId, card.normalized, card.raw);
      captured++;
    } catch (e) {
      log(`⚠️ Falha enviando pedido ${card.externalOrderId}:`, e.message);
    }
  }
  log(`📦 ${captured}/${cards.length} pedido(s) enviados`);
  return { captured };
}

// Extrai cards visíveis. ESTE É O PONTO QUE PRECISA SER AJUSTADO
// quando você confirmar a estrutura real do portal.
async function extractOrderCards(page) {
  // Tentativa #1: cards com data-testid
  const candidates = [
    '[data-testid*="order-card" i]',
    '[data-testid*="pedido" i]',
    'article[class*="order" i]',
    'div[class*="order-card" i]',
    'li[class*="order" i]',
  ];

  let elements = [];
  for (const sel of candidates) {
    const found = await page.locator(sel).all();
    if (found.length > 0) {
      elements = found;
      break;
    }
  }

  if (elements.length === 0) return [];

  const out = [];
  for (const el of elements) {
    try {
      const text = (await el.textContent()) || "";
      const id =
        (await el.getAttribute("data-order-id")) ||
        (await el.getAttribute("data-id")) ||
        extractOrderNumber(text) ||
        hashOf(text);

      // Status
      const status = pickStatus(text);

      // Cliente
      const customer = pickAfter(text, /cliente[:\s]+([^\n]+)/i) || "Cliente iFood";

      // Total
      const total = pickMoney(text);

      out.push({
        externalOrderId: id,
        raw: { text },
        normalized: {
          rawStatus: status,
          status: status,
          customer: { name: customer.trim().slice(0, 80) },
          totals: { total },
          source: "ifood-portal-bot",
        },
      });
    } catch (_) {}
  }
  return out;
}

function extractOrderNumber(text) {
  const m = text.match(/#\s*(\d{3,})/);
  return m ? m[1] : null;
}

function pickStatus(text) {
  const t = text.toLowerCase();
  if (/cancelad/.test(t)) return "cancelled";
  if (/entreg(ue|ado)/.test(t)) return "delivered";
  if (/saiu para entrega|a caminho/.test(t)) return "out_for_delivery";
  if (/pronto|finalizado/.test(t)) return "ready";
  if (/em produ(c|ç)ão|preparand/.test(t)) return "preparing";
  if (/confirmad/.test(t)) return "confirmed";
  return "pending";
}

function pickAfter(text, regex) {
  const m = text.match(regex);
  return m ? m[1] : null;
}

function pickMoney(text) {
  const m = text.match(/R\$\s*([\d.,]+)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || 0;
}

function hashOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i), h |= 0;
  return "auto_" + Math.abs(h);
}
