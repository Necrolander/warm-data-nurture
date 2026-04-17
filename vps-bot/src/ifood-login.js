// Lida com login do Portal iFood + 2FA via SMS
// Estratégia:
// 1. Abre página, se já tem sessão (cookies persistidos), pula
// 2. Se ver tela de login, busca credenciais do Lovable e preenche
// 3. Se aparecer 2FA, chama request_2fa e fica esperando admin colar o código no painel
import { api } from "./api.js";

const POLL_2FA_INTERVAL = 5000;   // 5s
const POLL_2FA_TIMEOUT = 15 * 60_000; // 15 min máx esperando admin

export async function ensureLoggedIn(page, log) {
  const url = process.env.IFOOD_PORTAL_URL || "https://portal.ifood.com.br";
  log("🌐 Indo para", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // Aguarda um pouco pra estabilizar
  await page.waitForTimeout(3000);

  // Heurística simples: se NÃO tem campo de email/senha, considera logado
  const hasLoginForm = await page.locator('input[type="email"], input[name="email"]').first().isVisible().catch(() => false);

  if (!hasLoginForm) {
    log("✅ Já está logado (sessão persistida)");
    return true;
  }

  log("🔐 Tela de login detectada — buscando credenciais");
  const { email, password } = await api.getCredentials();

  // Preenche email
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  // Avança (alguns fluxos têm 2 etapas: email primeiro, senha depois)
  const nextBtn = page.locator('button:has-text("Continuar"), button:has-text("Avançar"), button[type="submit"]').first();
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Preenche senha
  const passInput = page.locator('input[type="password"]').first();
  await passInput.waitFor({ timeout: 15_000 });
  await passInput.fill(password);

  const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Acessar")').first();
  await submitBtn.click().catch(() => {});

  log("⏳ Aguardando resposta do login...");
  await page.waitForTimeout(5000);

  // Verifica se caiu em tela de 2FA
  const needs2FA = await detect2FA(page);
  if (needs2FA) {
    log("📱 2FA detectado — solicitando código ao admin");
    await uploadCurrentScreen(page, "Tela de 2FA detectada");
    await api.request2FA("Portal iFood pediu verificação 2FA");

    const code = await wait2FACode(log);
    if (!code) {
      throw new Error("Timeout esperando código 2FA do admin");
    }

    log("⌨️  Digitando código 2FA");
    await fill2FACode(page, code);
    await page.waitForTimeout(5000);
  }

  // Confirma que logou
  const stillOnLogin = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
  if (stillOnLogin) {
    await uploadCurrentScreen(page, "Falha no login após 2FA");
    throw new Error("Login falhou — ainda na tela de login após enviar credenciais");
  }

  log("✅ Login concluído");
  await uploadCurrentScreen(page, "Login OK");
  return true;
}

async function detect2FA(page) {
  // Heurísticas comuns: input com 6 digits, texto "código", "verificação"
  const candidates = [
    'input[autocomplete="one-time-code"]',
    'input[name*="code" i]',
    'input[name*="otp" i]',
    'input[maxlength="6"]',
  ];
  for (const sel of candidates) {
    const visible = await page.locator(sel).first().isVisible().catch(() => false);
    if (visible) return true;
  }
  const bodyText = (await page.textContent("body").catch(() => "")) || "";
  return /verifica(ç|c)ão|c(ó|o)digo enviado|two[-\s]?factor|2fa/i.test(bodyText);
}

async function fill2FACode(page, code) {
  // Tenta primeiro um único input
  const single = page.locator('input[autocomplete="one-time-code"], input[maxlength="6"]').first();
  if (await single.isVisible().catch(() => false)) {
    await single.fill(code);
  } else {
    // Tenta inputs separados (1 dígito cada)
    const inputs = await page.locator('input[maxlength="1"]').all();
    if (inputs.length >= code.length) {
      for (let i = 0; i < code.length; i++) {
        await inputs[i].fill(code[i]);
      }
    }
  }
  // Tenta clicar em "Verificar" / "Confirmar"
  const confirmBtn = page.locator('button:has-text("Verificar"), button:has-text("Confirmar"), button:has-text("Continuar"), button[type="submit"]').first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click().catch(() => {});
  }
}

async function wait2FACode(log) {
  const start = Date.now();
  while (Date.now() - start < POLL_2FA_TIMEOUT) {
    try {
      const r = await api.getPending2FA();
      if (r.status === "ready" && r.code) {
        await api.consume2FA(r.id);
        return r.code;
      }
    } catch (e) {
      log("⚠️ Erro polling 2FA:", e.message);
    }
    await new Promise((r) => setTimeout(r, POLL_2FA_INTERVAL));
  }
  return null;
}

export async function uploadCurrentScreen(page, note) {
  try {
    const buf = await page.screenshot({ fullPage: false });
    const b64 = buf.toString("base64");
    const url = page.url();
    await api.uploadScreenshot(b64, url, note);
  } catch (e) {
    console.error("Falha ao upload screenshot:", e.message);
  }
}
