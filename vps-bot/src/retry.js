// Retry com backoff exponencial + jitter + detecção de Cloudflare
// Usado em volta de qualquer operação que possa cair em block / timeout / network flake.

export class CloudflareBlockError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "CloudflareBlockError";
    this.isCloudflareBlock = true;
  }
}

export function isBlockError(err) {
  if (!err) return false;
  if (err.isCloudflareBlock) return true;
  const m = (err.message || "").toLowerCase();
  return /cloudflare|blocked|forbidden|403|access denied|just a moment/i.test(m);
}

/**
 * Executa fn() com retry exponencial.
 * @param {Function} fn  async function que pode lançar
 * @param {Object} opts
 *   - maxAttempts: nº máx de tentativas (default 5)
 *   - baseMs: backoff base (default 5000)
 *   - maxMs: cap do backoff (default 5 min)
 *   - onRetry: (attempt, delayMs, err) => void  // chamado antes de cada espera
 *   - shouldRetry: (err) => bool  // default: sempre, exceto erros fatais
 */
export async function withRetry(fn, opts = {}) {
  const {
    maxAttempts = 5,
    baseMs = 5000,
    maxMs = 5 * 60_000,
    onRetry = () => {},
    shouldRetry = () => true,
  } = opts;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !shouldRetry(err)) throw err;

      // Exponential backoff: base * 2^(attempt-1) + jitter
      const exp = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
      const jitter = Math.floor(Math.random() * (exp * 0.3));
      const delay = exp + jitter;

      try { await onRetry(attempt, delay, err); } catch {}
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
