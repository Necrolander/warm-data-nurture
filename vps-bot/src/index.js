// Loop principal do bot
// - Inicia browser persistente (cookies salvos em /app/browser-data)
// - Garante login (incluindo 2FA via painel)
// - Faz polling de pedidos a cada POLL_INTERVAL_MS
// - Envia heartbeat constante
// - Em qualquer erro grave: log + screenshot + restart suave
import "dotenv/config";
import { chromium } from "playwright";
import path from "node:path";
import { api } from "./api.js";
import { ensureLoggedIn, uploadCurrentScreen } from "./ifood-login.js";
import { pollOrders } from "./ifood-orders.js";
import { applyStealth, brContextOptions, pickUserAgent, STEALTH_ARGS } from "./stealth.js";

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "20000", 10);
const HEADLESS = (process.env.HEADLESS || "true").toLowerCase() === "true";
const SLOW_MO = parseInt(process.env.SLOW_MO || "0", 10);
const USER_DATA_DIR = path.resolve("./browser-data");

let totalCaptured = 0;
let totalFailures = 0;

const log = (...args) =>
  console.log(`[${new Date().toISOString()}]`, ...args);

async function heartbeatLoop() {
  while (true) {
    try {
      await api.heartbeat({
        status: "online",
        ordersCaptured: totalCaptured,
        failures: totalFailures,
        meta: { headless: HEADLESS, pid: process.pid },
      });
    } catch (e) {
      log("⚠️ Heartbeat falhou:", e.message);
    }
    await new Promise((r) => setTimeout(r, 30_000)); // 30s
  }
}

async function main() {
  log("🚀 Truebox iFood Bot iniciando");
  log("Config:", { POLL_INTERVAL_MS, HEADLESS, USER_DATA_DIR });

  // Heartbeat em paralelo
  heartbeatLoop().catch((e) => log("Heartbeat loop morreu:", e));

  // Browser persistente com STEALTH ativado pra burlar Cloudflare/iFood
  const userAgent = pickUserAgent();
  log("🥷 UA:", userAgent);

  const ctxOpts = brContextOptions(userAgent);
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) log("🌐 Usando proxy:", proxyUrl.replace(/\/\/.*@/, "//***@"));

  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: HEADLESS,
    slowMo: SLOW_MO,
    args: STEALTH_ARGS,
    ignoreDefaultArgs: ["--enable-automation"],
    ...(proxyUrl ? { proxy: { server: proxyUrl } } : {}),
    ...ctxOpts,
  });

  await applyStealth(browser);

  const page = browser.pages()[0] || (await browser.newPage());

  // Login (com 2FA se necessário)
  try {
    await ensureLoggedIn(page, log);
  } catch (e) {
    log("❌ Falha crítica no login:", e.message);
    totalFailures++;
    await uploadCurrentScreen(page, "Falha crítica login");
    await api.logFailure(e.message, { stage: "login" });
    await browser.close();
    process.exit(1);
  }

  // Loop de polling
  while (true) {
    try {
      const { captured } = await pollOrders(page, log);
      totalCaptured += captured;
    } catch (e) {
      log("⚠️ Erro no polling:", e.message);
      totalFailures++;
      await uploadCurrentScreen(page, "Erro no polling: " + e.message.slice(0, 80));
      await api.logFailure(e.message, { stage: "polling" }).catch(() => {});
      // Se errou muito seguido, recarrega a página
      if (totalFailures % 5 === 0) {
        log("🔄 Recarregando página após erros consecutivos");
        await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
        // Pode ter sido deslogado
        await ensureLoggedIn(page, log).catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// Captura sinais pra log limpo
process.on("SIGTERM", () => { log("👋 SIGTERM, encerrando"); process.exit(0); });
process.on("SIGINT", () => { log("👋 SIGINT, encerrando"); process.exit(0); });
process.on("unhandledRejection", (r) => {
  log("💥 unhandledRejection:", r);
  totalFailures++;
});

main().catch((e) => {
  log("💥 Fatal:", e);
  process.exit(1);
});
