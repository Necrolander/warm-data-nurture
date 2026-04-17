// Worker que consome whatsapp_outbox no Supabase e envia mensagens via WhatsApp Web (Playwright)
// Roda em paralelo ao bot iFood. Compartilha browser persistente diferente (perfil whatsapp).
import "dotenv/config";
import { chromium } from "playwright";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_INTERVAL_MS = parseInt(process.env.WA_POLL_INTERVAL_MS || "5000", 10);
const HEADLESS = (process.env.WA_HEADLESS || "false").toLowerCase() === "true"; // primeira vez precisa false pra escanear QR
const USER_DATA_DIR = path.resolve("./whatsapp-data");
const MAX_ATTEMPTS = 3;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Faltam SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const log = (...args) => console.log(`[WA ${new Date().toISOString()}]`, ...args);

// Normaliza telefone BR para formato internacional (55 + DDD + número)
function normalizePhone(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

async function ensureLoggedIn(page) {
  await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded" });
  // Espera carregar — ou QR ou chat list
  log("Aguardando WhatsApp Web carregar...");
  for (let i = 0; i < 60; i++) {
    const isLoggedIn = await page.locator('[data-testid="chat-list"], div[aria-label="Chat list"]').count();
    const hasQr = await page.locator('canvas[aria-label*="Scan"], div[data-testid="qrcode"]').count();
    if (isLoggedIn) { log("✅ Logado no WhatsApp Web"); return; }
    if (hasQr && i === 0) log("📱 Escaneie o QR code do WhatsApp para autenticar (HEADLESS=false na 1ª vez)");
    await page.waitForTimeout(2000);
  }
  throw new Error("Timeout esperando login WhatsApp Web");
}

async function sendMessage(page, phone, message) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error("Phone inválido: " + phone);

  // Abre conversa via deep link (cria se ainda não existe)
  const url = `https://web.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(message)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Espera input de mensagem ficar disponível
  const inputSelector = 'div[contenteditable="true"][data-tab="10"], footer div[contenteditable="true"]';
  await page.waitForSelector(inputSelector, { timeout: 30000 });
  await page.waitForTimeout(1500);

  // Clica enviar (Enter)
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  log(`📤 Enviado para ${normalized}`);
}

async function processOutbox(page) {
  const { data: pending, error } = await supabase
    .from("whatsapp_outbox")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) { log("⚠️ Erro lendo fila:", error.message); return; }
  if (!pending || pending.length === 0) return;

  for (const item of pending) {
    // Marca como sending
    await supabase.from("whatsapp_outbox")
      .update({ status: "sending", attempts: item.attempts + 1 })
      .eq("id", item.id);

    try {
      await sendMessage(page, item.phone, item.message);
      await supabase.from("whatsapp_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", item.id);
    } catch (e) {
      log(`❌ Falha enviando ${item.id}:`, e.message);
      const finalStatus = (item.attempts + 1) >= MAX_ATTEMPTS ? "failed" : "pending";
      await supabase.from("whatsapp_outbox")
        .update({ status: finalStatus, last_error: e.message?.slice(0, 500) })
        .eq("id", item.id);
    }
  }
}

async function main() {
  log("🚀 WhatsApp Sender iniciando");
  log("Config:", { POLL_INTERVAL_MS, HEADLESS, USER_DATA_DIR });

  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: HEADLESS,
    viewport: { width: 1366, height: 800 },
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = browser.pages()[0] || (await browser.newPage());
  await ensureLoggedIn(page);

  while (true) {
    try {
      await processOutbox(page);
    } catch (e) {
      log("⚠️ Erro no loop:", e.message);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

main().catch((e) => { log("💥 Fatal:", e); process.exit(1); });
