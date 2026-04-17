// Cliente HTTP pro endpoint wa-vps-bridge no Lovable Cloud
import "dotenv/config";

const BRIDGE_URL = process.env.LOVABLE_WA_BRIDGE_URL;
const TOKEN = process.env.BOT_TOKEN;

if (!BRIDGE_URL || !TOKEN) {
  console.error("❌ Faltam env vars: LOVABLE_WA_BRIDGE_URL, BOT_TOKEN");
  process.exit(1);
}

async function call(action, payload = {}) {
  const res = await fetch(BRIDGE_URL, {
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
    throw new Error(`wa-bridge ${action} ${res.status}: ${data?.error || text}`);
  }
  return data;
}

export const waApi = {
  getSessionState: () => call("get_session_state"),
  updateSession: (patch) => call("update_session", patch),
  heartbeat: (payload) => call("heartbeat", payload),
  getOutbox: (limit = 10) => call("get_outbox", { limit }),
  markOutboxSent: (payload) => call("mark_outbox_sent", payload),
  logIncoming: (payload) => call("log_incoming_message", payload),
  logOutgoing: (payload) => call("log_outgoing_message", payload),
  uploadMedia: (payload) => call("upload_media", payload),
};
