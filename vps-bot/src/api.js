// Cliente HTTP simples para falar com as edge functions do Lovable Cloud
import "dotenv/config";

const FN_URL = process.env.LOVABLE_FN_URL;
const INGEST_URL = process.env.LOVABLE_INGEST_URL;
const TOKEN = process.env.BOT_TOKEN;

if (!FN_URL || !INGEST_URL || !TOKEN) {
  console.error("❌ Faltam env vars: LOVABLE_FN_URL, LOVABLE_INGEST_URL, BOT_TOKEN");
  process.exit(1);
}

async function call(url, action, payload = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`API ${action} ${res.status}: ${data?.error || text}`);
  }
  return data;
}

export const api = {
  // Credenciais
  getCredentials: () => call(FN_URL, "get_credentials"),

  // 2FA
  request2FA: (reason) => call(FN_URL, "request_2fa", { reason }),
  getPending2FA: () => call(FN_URL, "get_pending_2fa"),
  consume2FA: (id) => call(FN_URL, "consume_2fa", { id }),

  // Heartbeat & status
  heartbeat: (data) => call(FN_URL, "heartbeat", data),

  // Screenshot (base64)
  uploadScreenshot: (base64, pageUrl, note) =>
    call(FN_URL, "upload_screenshot", { screenshot_base64: base64, page_url: pageUrl, note }),

  // Falha
  logFailure: (errorMessage, context = {}, screenshotUrl = null) =>
    call(FN_URL, "log_failure", { errorMessage, context, screenshotUrl }),

  // Ingestão de pedido (external-orders-ingest)
  ingestOrder: (externalOrderId, normalized, raw = {}) =>
    call(INGEST_URL, "ingest_order", {
      channel: "ifood",
      externalOrderId,
      normalized,
      raw,
    }),

  // Atualização de status de pedido
  updateOrderStatus: (externalOrderId, rawStatus) =>
    call(INGEST_URL, "update_status", {
      channel: "ifood",
      externalOrderId,
      rawStatus,
    }),
};
