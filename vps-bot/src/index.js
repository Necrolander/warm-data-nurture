// Loop principal do bot
// - Inicia browser persistente (cookies salvos em /app/browser-data)
// - Garante login (incluindo 2FA via painel)
// - Faz polling de pedidos a cada POLL_INTERVAL_MS
// - Envia heartbeat constante
// - Em qualquer erro grave: log + screenshot + restart suave
// - Cloudflare block → retry com backoff exponencial + rotação automática de UA
import "dotenv/config";
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { api } from "./api.js";
import { ensureLoggedIn, uploadCurrentScreen } from "./ifood-login.js";
import { pollOrders } from "./ifood-orders.js";
import { applyStealth, brContextOptions, pickUserAgent, STEALTH_ARGS } from "./stealth.js";
import { withRetry, isBlockError } from "./retry.js";

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "20000", 10);
const HEADLESS = (process.env.HEADLESS || "true").toLowerCase() === "true";
const SLOW_MO = parseInt(process.env.SLOW_MO || "0", 10);
const USER_DATA_DIR = path.resolve("./browser-data");

let totalCaptured = 0;
let totalFailures = 0;
let totalBlocks = 0;
let currentUA = null;

const log = (...args) =>
  console.log(`[${new Date().toISOString()}]`, ...args);

async function heartbeatLoop() {
  while (true) {
    try {
      await api.heartbeat({
        status: "online",
        ordersCaptured: totalCaptured,
        failures: totalFailures,
        meta: { headless: HEADLESS, pid: process.pid, blocks: totalBlocks, ua: currentUA },
      });
    } catch (e) {
      log("⚠️ Heartbeat falhou:", e.message);
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

/**
 * Inicia um novo browser context com UA fresco.
 * Em caso de block recorrente, limpa browser-data pra forçar fingerprint novo.
 */
async function launchBrowser({ wipeProfile = false } = {}) {
  if (wipeProfile && fs.existsSync(USER_DATA_DIR)) {
    log("🧹 Limpando browser-data pra fingerprint zero");
    try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) { log("⚠️ rm falhou:", e.message); }
  }

  currentUA = pickUserAgent();
  log("🥷 UA:", currentUA);

  const ctxOpts = brContextOptions(currentUA);
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
  return browser;
}

/**
 * Login com retry exponencial + rotação de UA a cada falha.
 * Após 3 blocks consecutivos, limpa o profile inteiro.
 */
async function loginWithRetry() {
  let browser = null;
  let page = null;
  let blockStreak = 0;

  const result = await withRetry(
    async (attempt) => {
      log(`🔐 Tentativa de login #${attempt}`);
      // Fecha browser anterior se existir e abre um novo (UA fresco)
      if (browser) {
        try { await browser.close(); } catch {}
      }
      browser = await launchBrowser({ wipeProfile: blockStreak >= 3 });
      if (blockStreak >= 3) blockStreak = 0;

      page = browser.pages()[0] || (await browser.newPage());

      try {
        await ensureLoggedIn(page, log);
        return { browser, page };
      } catch (err) {
        if (isBlockError(err)) {
          blockStreak++;
          totalBlocks++;
        }
        throw err;
      }
    },
    {
      maxAttempts: 6,
      baseMs: 15_000,   // 15s, 30s, 60s, 2m, 4m, 5m(cap)
      maxMs: 5 * 60_000,
      onRetry: async (attempt, delay, err) => {
        const blocked = isBlockError(err);
        log(
          blocked
            ? `🛑 Cloudflare block (streak=${blockStreak}). Aguardando ${Math.round(delay/1000)}s + UA novo…`
            : `⚠️ Login falhou (${err.message}). Retry em ${Math.round(delay/1000)}s…`
        );
        try {
          await api.logFailure(`Login retry #${attempt}: ${err.message}`, {
            stage: "login_retry",
            attempt,
            blocked,
            blockStreak,
          });
        } catch {}
      },
    }
  );

  return result;
}

async function main() {
  log("🚀 Truebox iFood Bot iniciando");
  log("Config:", { POLL_INTERVAL_MS, HEADLESS, USER_DATA_DIR });

  heartbeatLoop().catch((e) => log("Heartbeat loop morreu:", e));

  // Login com retry exponencial + UA rotation
  let browser, page;
  try {
    ({ browser, page } = await loginWithRetry());
    log("✅ Login OK após retries");
  } catch (e) {
    log("❌ Login falhou após todas as tentativas:", e.message);
    totalFailures++;
    await api.logFailure(`Login esgotou retries: ${e.message}`, { stage: "login_fatal", blocks: totalBlocks });
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

      // Se foi block do Cloudflare → relogar com UA novo (rotação)
      if (isBlockError(e)) {
        log("🛑 Block detectado no polling — relogando com UA novo");
        try { await browser.close(); } catch {}
        try {
          ({ browser, page } = await loginWithRetry());
        } catch (re) {
          log("💀 Re-login falhou após block:", re.message);
          process.exit(1);
        }
      } else if (totalFailures % 5 === 0) {
        log("🔄 Recarregando página após erros consecutivos");
        await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
        await ensureLoggedIn(page, log).catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

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
