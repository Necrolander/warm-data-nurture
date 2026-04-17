// Stealth + fingerprint BR para evitar detecção do Cloudflare/iFood.
// Aplica patches no contexto do browser ANTES de qualquer página carregar.
//
// Cobre as detecções mais comuns:
// - navigator.webdriver
// - navigator.plugins / languages
// - chrome runtime
// - WebGL vendor
// - Permissions API quirks
// - Headless UA artifacts
//
// Não usa puppeteer-extra-plugin-stealth (incompatível com Playwright puro);
// implementa o essencial inline.

const REAL_UA_LIST = [
  // Chromes recentes BR (Win 10/11)
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

export function pickUserAgent() {
  return REAL_UA_LIST[Math.floor(Math.random() * REAL_UA_LIST.length)];
}

export function brContextOptions(userAgent) {
  return {
    userAgent: userAgent || pickUserAgent(),
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    geolocation: { latitude: -16.0145251, longitude: -48.0593436 }, // Gama-DF
    permissions: ["geolocation", "notifications"],
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    colorScheme: "light",
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Sec-CH-UA": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
      "Sec-CH-UA-Mobile": "?0",
      "Sec-CH-UA-Platform": '"Windows"',
    },
  };
}

/**
 * Aplica patches anti-detecção via addInitScript.
 * Deve ser chamado uma vez por context.
 */
export async function applyStealth(context) {
  await context.addInitScript(() => {
    // 1. navigator.webdriver = undefined
    try {
      Object.defineProperty(Navigator.prototype, "webdriver", {
        get: () => undefined,
        configurable: true,
      });
    } catch {}

    // 2. navigator.languages BR
    try {
      Object.defineProperty(Navigator.prototype, "languages", {
        get: () => ["pt-BR", "pt", "en-US", "en"],
        configurable: true,
      });
    } catch {}

    // 3. navigator.plugins fake (não pode ser vazio)
    try {
      Object.defineProperty(Navigator.prototype, "plugins", {
        get: () => {
          const fake = [
            { name: "PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
            { name: "Chrome PDF Viewer", filename: "internal-pdf-viewer", description: "" },
            { name: "Chromium PDF Viewer", filename: "internal-pdf-viewer", description: "" },
            { name: "Microsoft Edge PDF Viewer", filename: "internal-pdf-viewer", description: "" },
            { name: "WebKit built-in PDF", filename: "internal-pdf-viewer", description: "" },
          ];
          fake.length = 5;
          return fake;
        },
        configurable: true,
      });
    } catch {}

    // 4. window.chrome.runtime
    try {
      // @ts-ignore
      window.chrome = window.chrome || {};
      // @ts-ignore
      window.chrome.runtime = window.chrome.runtime || {};
      // @ts-ignore
      window.chrome.app = window.chrome.app || { isInstalled: false };
      // @ts-ignore
      window.chrome.csi = window.chrome.csi || function () {};
      // @ts-ignore
      window.chrome.loadTimes = window.chrome.loadTimes || function () {};
    } catch {}

    // 5. Permissions API: notification quirk
    try {
      const origQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
      // @ts-ignore
      window.navigator.permissions.query = (parameters) =>
        parameters?.name === "notifications"
          ? Promise.resolve({ state: Notification.permission, onchange: null })
          : origQuery(parameters);
    } catch {}

    // 6. WebGL vendor/renderer realista
    try {
      const getParam = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445) return "Intel Inc."; // UNMASKED_VENDOR_WEBGL
        if (parameter === 37446) return "Intel Iris OpenGL Engine"; // UNMASKED_RENDERER_WEBGL
        return getParam.call(this, parameter);
      };
    } catch {}

    // 7. hardwareConcurrency / deviceMemory plausíveis
    try {
      Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { get: () => 8, configurable: true });
      Object.defineProperty(Navigator.prototype, "deviceMemory", { get: () => 8, configurable: true });
    } catch {}

    // 8. Esconde "HeadlessChrome" do UA caso reste
    try {
      const ua = navigator.userAgent;
      if (ua.includes("HeadlessChrome")) {
        Object.defineProperty(Navigator.prototype, "userAgent", {
          get: () => ua.replace("HeadlessChrome", "Chrome"),
          configurable: true,
        });
      }
    } catch {}
  });
}

/**
 * Args do Chromium pra parecer mais humano e desabilitar flags reveladoras.
 */
export const STEALTH_ARGS = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-blink-features=AutomationControlled",
  "--disable-features=IsolateOrigins,site-per-process,AutomationControlled",
  "--disable-infobars",
  "--no-first-run",
  "--no-default-browser-check",
  "--password-store=basic",
  "--use-mock-keychain",
  "--lang=pt-BR",
  "--window-size=1366,768",
];

/**
 * Pequeno jitter humano: pausa 200-800ms ou simula movimento.
 */
export async function humanPause(min = 250, max = 900) {
  const ms = Math.floor(Math.random() * (max - min) + min);
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Digita texto caractere por caractere com delays variáveis (parece humano).
 */
export async function typeHuman(locator, text) {
  await locator.click({ delay: 50 + Math.random() * 100 });
  for (const ch of text) {
    await locator.type(ch, { delay: 60 + Math.random() * 140 });
  }
}
