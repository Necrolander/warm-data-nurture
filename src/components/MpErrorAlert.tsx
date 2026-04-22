import { AlertCircle, AlertTriangle, Info, RefreshCw, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getMpError, MpErrorEntry } from "@/lib/mpErrors";

interface Props {
  /** MP error code (tokenization), status_detail (charge), or status (refunded/rejected) */
  code?: string | number | null;
  /** Optional raw status to enrich fallback (e.g. "rejected", "cancelled") */
  status?: string | null;
  /** Optional override message (rarely needed) */
  fallback?: string | null;
  /** Compact one-line variant, no title */
  compact?: boolean;
  className?: string;
  /** Optional retry handler — when provided, renders a "Tentar novamente" button */
  onRetry?: () => void;
  /** Disable retry while a request is in flight */
  retrying?: boolean;
  /** Custom retry button label */
  retryLabel?: string;
}

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

const VARIANT: Record<MpErrorEntry["severity"], "info" | "warning" | "destructive"> = {
  info: "info",
  warning: "warning",
  error: "destructive",
};

/**
 * Standardized PT-BR error display for any Mercado Pago failure.
 * Use across tokenization, payment creation, and status updates.
 */
export const MpErrorAlert = ({ code, status, fallback, compact, className, onRetry, retrying, retryLabel }: Props) => {
  const entry = getMpError(code, status);
  const message =
    entry.message === "Não foi possível processar o pagamento. Tente novamente." && fallback
      ? fallback
      : entry.message;

  const Icon = ICONS[entry.severity];

  const retryBtn = onRetry ? (
    <Button
      type="button"
      size="sm"
      variant={entry.severity === "error" ? "outline" : "secondary"}
      onClick={onRetry}
      disabled={retrying}
      className="mt-2 h-8"
    >
      {retrying ? (
        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
      )}
      {retryLabel ?? "Tentar novamente"}
    </Button>
  ) : null;

  if (compact) {
    return (
      <Alert variant={VARIANT[entry.severity]} className={className}>
        <Icon className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {message}
          {retryBtn}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant={VARIANT[entry.severity]} className={className}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">{entry.label}</AlertTitle>
      <AlertDescription className="text-sm">
        {message}
        {entry.hint && <span className="block text-xs mt-1 opacity-80">{entry.hint}</span>}
        {retryBtn}
      </AlertDescription>
    </Alert>
  );
};

export default MpErrorAlert;
