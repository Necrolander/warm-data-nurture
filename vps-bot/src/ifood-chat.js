/**
 * iFood Chat Reader & Sender
 * - Lê mensagens novas do chat de cada pedido ATIVO no portal do iFood
 * - Envia pra edge function `ifood-chat-respond` que processa intenção + IA
 * - Lê respostas pendentes (response_pending) e digita no chat
 *
 * IMPORTANTE: os seletores CSS abaixo são placeholders. Você precisa inspecionar
 * o portal real do iFood (chat de pedido) e ajustar os seletores no método
 * `extractMessages()` e `sendMessage()` na primeira execução.
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[ifood-chat] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const POLL_INTERVAL_MS = 30_000;
const seenMessages = new Set(); // dedupe key: orderId + hash(message + ts)

function hashMsg(orderId, msg, ts) {
  return `${orderId}::${ts || ""}::${msg.slice(0, 60)}`;
}

/**
 * Lê chats ativos no portal iFood.
 * @param {import('playwright').Page} page - Playwright page já logada no portal iFood
 * @returns {Promise<Array<{order_external_id, customer_name, message, ts}>>}
 */
async function extractMessages(page) {
  // Placeholder - ajustar conforme seletor real do portal iFood
  // Exemplo de estrutura esperada:
  return await page.evaluate(() => {
    const out = [];
    const chats = document.querySelectorAll("[data-testid='order-chat-thread']");
    chats.forEach((chat) => {
      const orderId = chat.getAttribute("data-order-id");
      const customer = chat.querySelector("[data-testid='customer-name']")?.textContent?.trim();
      const msgs = chat.querySelectorAll("[data-testid='message-incoming']");
      msgs.forEach((m) => {
        out.push({
          order_external_id: orderId,
          customer_name: customer,
          message: m.textContent?.trim() || "",
          ts: m.getAttribute("data-timestamp") || new Date().toISOString(),
        });
      });
    });
    return out;
  });
}

/**
 * Digita uma resposta no chat de um pedido específico no portal iFood.
 */
async function sendMessage(page, orderExternalId, text) {
  // Placeholder - ajustar conforme portal real
  return await page.evaluate(
    ({ orderId, text }) => {
      const chat = document.querySelector(`[data-testid='order-chat-thread'][data-order-id='${orderId}']`);
      if (!chat) return false;
      const input = chat.querySelector("textarea, input[type='text']");
      const sendBtn = chat.querySelector("button[data-testid='send-message']");
      if (!input || !sendBtn) return false;
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      sendBtn.click();
      return true;
    },
    { orderId: orderExternalId, text },
  );
}

async function processIncomingMessages(page) {
  let messages = [];
  try {
    messages = await extractMessages(page);
  } catch (e) {
    console.error("[ifood-chat] extractMessages failed:", e.message);
    return;
  }

  for (const m of messages) {
    if (!m.message || !m.order_external_id) continue;
    const key = hashMsg(m.order_external_id, m.message, m.ts);
    if (seenMessages.has(key)) continue;
    seenMessages.add(key);

    // Cap dedupe set size
    if (seenMessages.size > 5000) {
      const arr = Array.from(seenMessages);
      seenMessages.clear();
      arr.slice(-2500).forEach((k) => seenMessages.add(k));
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ifood-chat-respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          order_external_id: m.order_external_id,
          customer_name: m.customer_name,
          message: m.message,
          raw_payload: { ts: m.ts },
        }),
      });
      const json = await res.json();
      console.log(
        `[ifood-chat] msg from ${m.customer_name || "?"} (#${m.order_external_id}) → intent=${json.intent} action=${json.action}`,
      );
    } catch (e) {
      console.error("[ifood-chat] edge function call failed:", e.message);
    }
  }
}

async function processOutgoingMessages(page) {
  // Pega respostas pendentes (geradas pela edge function) e envia no portal
  const { data: pending, error } = await supabase
    .from("ifood_chat_messages")
    .select("id, order_external_id, response_pending, customer_name")
    .not("response_pending", "is", null)
    .is("response_sent_at", null)
    .limit(20);

  if (error) {
    console.error("[ifood-chat] fetch pending error:", error.message);
    return;
  }
  if (!pending?.length) return;

  for (const row of pending) {
    try {
      const ok = await sendMessage(page, row.order_external_id, row.response_pending);
      if (ok) {
        // Log outgoing message + mark as sent
        await supabase.from("ifood_chat_messages").insert({
          order_external_id: row.order_external_id,
          customer_name: row.customer_name,
          direction: "outgoing",
          message: row.response_pending,
          auto_replied: true,
        });
        await supabase
          .from("ifood_chat_messages")
          .update({ response_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        console.log(`[ifood-chat] ✓ replied to #${row.order_external_id}`);
      } else {
        console.warn(`[ifood-chat] ✗ could not send to #${row.order_external_id} (selector failed)`);
      }
    } catch (e) {
      console.error("[ifood-chat] send error:", e.message);
    }
  }
}

/**
 * Loop principal - chamar de dentro do bot iFood já logado.
 */
async function startChatWorker(page) {
  console.log("[ifood-chat] worker started");
  while (true) {
    try {
      await processIncomingMessages(page);
      await processOutgoingMessages(page);
    } catch (e) {
      console.error("[ifood-chat] loop error:", e.message);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

module.exports = { startChatWorker, extractMessages, sendMessage };
