// WhatsApp Worker via whatsapp-web.js
// - Conecta um número de WhatsApp (escaneando QR Code uma vez)
// - Persiste sessão em /app/wa-session (LocalAuth)
// - Faz polling do whatsapp_outbox e envia mensagens
// - Recebe mensagens de clientes e despacha pro edge whatsapp-bot via bridge
//
// Estratégia:
//  1. Sobe client.initialize()
//  2. Em "qr" → manda string pro Lovable (UI mostra QR Code)
//  3. Em "ready" → status=connected, começa loop de outbox
//  4. Em "message" (de cliente) → log_incoming_message
//
import "dotenv/config";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import { waApi } from "./wa-api.js";

const POLL_OUTBOX_MS = parseInt(process.env.WA_POLL_INTERVAL_MS || "5000", 10);
const SESSION_DIR = process.env.WA_SESSION_DIR || "./wa-session";

const log = (...args) =>
  console.log(`[WA ${new Date().toISOString()}]`, ...args);

let isReady = false;

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "truebox-wa", dataPath: SESSION_DIR }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  },
});

// ===== Eventos =====
client.on("qr", async (qr) => {
  log("📷 QR Code gerado — abra /admin/whatsapp-connect pra escanear");
  await waApi.updateSession({
    status: "qr",
    qr_code: qr,
    last_event: "qr_generated",
  }).catch((e) => log("update_session(qr) falhou:", e.message));
});

client.on("authenticated", async () => {
  log("🔑 Autenticado");
  await waApi.updateSession({ status: "authenticating", last_event: "authenticated" })
    .catch(() => {});
});

client.on("auth_failure", async (msg) => {
  log("❌ Falha de autenticação:", msg);
  await waApi.updateSession({ status: "failed", last_event: `auth_failure: ${msg}` })
    .catch(() => {});
});

client.on("ready", async () => {
  isReady = true;
  const me = client.info?.wid?.user || null;
  const name = client.info?.pushname || null;
  log(`✅ WhatsApp pronto — número: ${me} (${name})`);
  await waApi.updateSession({
    status: "connected",
    qr_code: null,
    phone_number: me,
    display_name: name,
    last_event: "ready",
  }).catch(() => {});
});

client.on("disconnected", async (reason) => {
  isReady = false;
  log("🔌 Desconectado:", reason);
  await waApi.updateSession({ status: "disconnected", last_event: `disconnected: ${reason}` })
    .catch(() => {});
  // Tenta reconectar após 10s
  setTimeout(() => client.initialize().catch((e) => log("reinit falhou:", e.message)), 10_000);
});

// Mensagens recebidas → encaminha pro fluxo do bot
client.on("message", async (msg) => {
  try {
    // Ignora grupos, status broadcast, mensagens próprias
    if (msg.from.endsWith("@g.us") || msg.from === "status@broadcast" || msg.fromMe) return;
    if (msg.type !== "chat") return; // ignora media/áudio por enquanto

    const phone = msg.from.replace(/@c\.us$/, "");
    const text = msg.body?.trim();
    if (!text) return;

    let contactName = null;
    try {
      const contact = await msg.getContact();
      contactName = contact?.pushname || contact?.name || null;
    } catch {}

    log(`📥 ${phone}${contactName ? ` (${contactName})` : ""}: ${text.slice(0, 80)}`);

    await waApi.logIncoming({
      from_phone: phone,
      message: text,
      wa_message_id: msg.id?._serialized,
      customer_name: contactName,
      raw: { type: msg.type, timestamp: msg.timestamp },
    });
  } catch (e) {
    log("⚠️ Erro processando msg recebida:", e.message);
  }
});

// ===== Loop de envio do outbox =====
async function processOutbox() {
  if (!isReady) return;
  try {
    const { outbox } = await waApi.getOutbox(10);
    if (!outbox?.length) return;

    for (const item of outbox) {
      try {
        const phone = String(item.phone).replace(/\D/g, "");
        if (!phone) {
          await waApi.markOutboxSent({ id: item.id, success: false, error: "phone vazio", attempts: item.attempts });
          continue;
        }

        // Formato esperado: 5561999999999@c.us
        const chatId = phone.includes("@") ? phone : `${phone}@c.us`;

        // Verifica se número existe no WhatsApp
        const exists = await client.isRegisteredUser(chatId).catch(() => true);
        if (!exists) {
          log(`⚠️ Número ${phone} não está no WhatsApp — pulando`);
          await waApi.markOutboxSent({
            id: item.id,
            success: false,
            error: "número não registrado no WhatsApp",
            attempts: item.attempts,
          });
          continue;
        }

        const sent = await client.sendMessage(chatId, item.message);
        log(`📤 Enviado pra ${phone} [${item.kind || "msg"}]`);

        await waApi.markOutboxSent({
          id: item.id,
          success: true,
          phone,
          message: item.message,
          order_id: item.order_id,
          wa_message_id: sent?.id?._serialized,
          attempts: item.attempts,
        });
      } catch (err) {
        log("❌ Falha enviando outbox", item.id, err.message);
        await waApi.markOutboxSent({
          id: item.id,
          success: false,
          error: err.message,
          attempts: item.attempts,
        });
      }
    }
  } catch (e) {
    log("⚠️ Erro no loop outbox:", e.message);
  }
}

async function heartbeatLoop() {
  while (true) {
    if (isReady) {
      await waApi.heartbeat({ status: "connected" }).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

// ===== Boot =====
log("🚀 WhatsApp worker iniciando");
log(`Config: POLL=${POLL_OUTBOX_MS}ms SESSION_DIR=${SESSION_DIR}`);

client.initialize().catch((e) => {
  log("💥 Falha ao inicializar:", e);
  process.exit(1);
});

setInterval(processOutbox, POLL_OUTBOX_MS);
heartbeatLoop().catch((e) => log("heartbeat loop morreu:", e));

process.on("SIGTERM", async () => {
  log("👋 SIGTERM — fechando WA");
  try { await client.destroy(); } catch {}
  process.exit(0);
});
process.on("SIGINT", async () => {
  log("👋 SIGINT — fechando WA");
  try { await client.destroy(); } catch {}
  process.exit(0);
});
