/**
 * Centralized Mercado Pago error catalog (PT-BR).
 * Single source of truth used by:
 *  - Card tokenization (cardForm onError / validation)
 *  - Payment creation (edge function response)
 *  - Payment status (status / status_detail after charge)
 *  - Admin audit screen (payment_failures listing)
 */

export type MpErrorSeverity = "info" | "warning" | "error";

export interface MpErrorEntry {
  /** Friendly PT-BR message shown to end users */
  message: string;
  /** Short label for tables / badges in admin */
  label: string;
  /** UX hint about what action the user should take */
  hint?: string;
  severity: MpErrorSeverity;
}

const E = (
  message: string,
  label: string,
  severity: MpErrorSeverity = "error",
  hint?: string,
): MpErrorEntry => ({ message, label, severity, hint });

export const MP_ERROR_CATALOG: Record<string, MpErrorEntry> = {
  // ---- Tokenization (cardForm field errors) ----
  "205": E("Digite o número do cartão.", "Cartão em branco", "warning"),
  "208": E("Selecione o mês de vencimento.", "Mês ausente", "warning"),
  "209": E("Selecione o ano de vencimento.", "Ano ausente", "warning"),
  "212": E("Selecione o tipo de documento.", "Tipo de documento ausente", "warning"),
  "213": E("Digite o número do documento.", "Documento ausente", "warning"),
  "214": E("Digite o número do documento.", "Documento ausente", "warning"),
  "220": E("Selecione o banco emissor.", "Emissor ausente", "warning"),
  "221": E("Digite o nome impresso no cartão.", "Nome ausente", "warning"),
  "224": E("Digite o código de segurança (CVV).", "CVV ausente", "warning"),
  E301: E("Número de cartão inválido. Verifique e tente novamente.", "Cartão inválido"),
  E302: E("Código de segurança (CVV) inválido.", "CVV inválido"),
  "316": E("Nome no cartão inválido.", "Nome inválido"),
  "324": E("CPF/CNPJ inválido.", "Documento inválido"),
  "325": E("Mês de vencimento inválido.", "Mês inválido"),
  "326": E("Ano de vencimento inválido.", "Ano inválido"),

  // ---- Payment status_detail (after charge) ----
  cc_rejected_bad_filled_card_number: E(
    "Número do cartão incorreto. Revise e tente novamente.",
    "Número incorreto",
    "error",
    "Confira o número do cartão.",
  ),
  cc_rejected_bad_filled_date: E(
    "Data de validade incorreta.",
    "Validade incorreta",
    "error",
    "Confira mês e ano de validade.",
  ),
  cc_rejected_bad_filled_security_code: E(
    "CVV incorreto.",
    "CVV incorreto",
    "error",
    "Verifique o código atrás do cartão.",
  ),
  cc_rejected_bad_filled_other: E(
    "Verifique os dados do cartão e tente novamente.",
    "Dados incorretos",
    "error",
  ),
  cc_rejected_call_for_authorize: E(
    "Você precisa autorizar o pagamento com seu banco antes de tentar novamente.",
    "Requer autorização do banco",
    "warning",
    "Ligue para seu banco e libere a compra.",
  ),
  cc_rejected_card_disabled: E(
    "Cartão desabilitado. Ligue para o seu banco para ativá-lo.",
    "Cartão desabilitado",
    "error",
  ),
  cc_rejected_card_error: E(
    "Não foi possível processar o pagamento. Tente outro cartão.",
    "Erro no cartão",
    "error",
  ),
  cc_rejected_duplicated_payment: E(
    "Você já fez um pagamento com esse valor. Se precisar pagar novamente, use outro cartão.",
    "Pagamento duplicado",
    "warning",
  ),
  cc_rejected_high_risk: E(
    "Pagamento recusado por análise de risco. Tente outro meio de pagamento.",
    "Recusado por risco",
    "error",
  ),
  cc_rejected_insufficient_amount: E(
    "Saldo insuficiente no cartão.",
    "Saldo insuficiente",
    "error",
  ),
  cc_rejected_invalid_installments: E(
    "Número de parcelas inválido para este cartão.",
    "Parcelas inválidas",
    "warning",
  ),
  cc_rejected_max_attempts: E(
    "Você atingiu o limite de tentativas. Tente outro cartão ou meio de pagamento.",
    "Limite de tentativas",
    "error",
  ),
  cc_rejected_other_reason: E(
    "O cartão não autorizou o pagamento. Tente outro cartão.",
    "Recusado pelo emissor",
    "error",
  ),
  cc_rejected_blacklist: E(
    "Cartão não autorizado. Use outro meio de pagamento.",
    "Cartão bloqueado",
    "error",
  ),

  // ---- Payment creation / API errors ----
  invalid_card_token: E(
    "Não foi possível validar os dados do cartão. Tente novamente.",
    "Token inválido",
  ),
  invalid_payment_method: E(
    "Meio de pagamento inválido. Recarregue a página e tente novamente.",
    "Meio inválido",
  ),

  // ---- Network / connectivity ----
  network_timeout: E(
    "O servidor demorou muito para responder. Verifique sua conexão e tente novamente em alguns instantes.",
    "Tempo esgotado",
    "warning",
    "Sua internet pode estar instável. Aguarde alguns segundos e clique em Tentar novamente.",
  ),
  network_offline: E(
    "Você está sem conexão com a internet. Verifique sua rede e tente novamente.",
    "Sem conexão",
    "warning",
    "Reconecte-se ao Wi-Fi ou aos dados móveis e clique em Tentar novamente.",
  ),
  network_error: E(
    "Não conseguimos falar com o servidor. Verifique sua internet ou tente novamente em instantes.",
    "Falha de rede",
    "warning",
    "Se o problema persistir, aguarde 1 minuto antes de tentar de novo.",
  ),
  server_error: E(
    "O servidor de pagamento está temporariamente indisponível. Tente novamente em instantes.",
    "Servidor indisponível",
    "warning",
    "Se o problema persistir, tente novamente em alguns minutos.",
  ),
};

/** Generic fallback messages by status when no detail is provided */
const STATUS_FALLBACK: Record<string, MpErrorEntry> = {
  rejected: E("Pagamento recusado pelo emissor.", "Recusado", "error"),
  cancelled: E("Pagamento cancelado.", "Cancelado", "warning"),
  refunded: E("Pagamento estornado.", "Estornado", "warning"),
  charged_back: E("Pagamento contestado pelo titular.", "Contestado", "error"),
  in_mediation: E("Pagamento em mediação com o Mercado Pago.", "Em mediação", "warning"),
  error: E("Erro ao processar pagamento. Tente novamente.", "Erro", "error"),
};

const DEFAULT_ENTRY: MpErrorEntry = E(
  "Não foi possível processar o pagamento. Tente novamente.",
  "Erro desconhecido",
  "error",
);

/**
 * Get a friendly entry for a Mercado Pago error/status code.
 * Tries the code as-is, uppercased, then falls back to status-level message.
 */
export const getMpError = (
  code?: string | number | null,
  fallbackStatus?: string | null,
): MpErrorEntry => {
  if (code != null && code !== "") {
    const k = String(code);
    if (MP_ERROR_CATALOG[k]) return MP_ERROR_CATALOG[k];
    const upper = k.toUpperCase();
    if (MP_ERROR_CATALOG[upper]) return MP_ERROR_CATALOG[upper];
  }
  if (fallbackStatus && STATUS_FALLBACK[fallbackStatus]) return STATUS_FALLBACK[fallbackStatus];
  return DEFAULT_ENTRY;
};

/** Friendly message string (shortcut) */
export const friendlyMpError = (
  code?: string | number | null,
  fallback?: string | null,
): string => {
  const entry = getMpError(code, null);
  if (entry === DEFAULT_ENTRY && fallback) return fallback;
  return entry.message;
};

/** Short label for tables / badges */
export const mpErrorLabel = (code?: string | null): string => {
  if (!code) return "—";
  return MP_ERROR_CATALOG[code]?.label || MP_ERROR_CATALOG[String(code).toUpperCase()]?.label || code;
};
