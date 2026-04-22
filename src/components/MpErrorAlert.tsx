import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
}

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

const VARIANT: Record<MpErrorEntry["severity"], "default" | "destructive"> = {
  info: "default",
  warning: "default",
  error: "destructive",
};

/**
 * Standardized PT-BR error display for any Mercado Pago failure.
 * Use across tokenization, payment creation, and status updates.
 */
export const MpErrorAlert = ({ code, status, fallback, compact, className }: Props) => {
  const entry = getMpError(code, status);
  // If user passed an explicit fallback and we got the default, prefer fallback message
  const message =
    entry.message === "Não foi possível processar o pagamento. Tente novamente." && fallback
      ? fallback
      : entry.message;

  const Icon = ICONS[entry.severity];

  if (compact) {
    return (
      <Alert variant={VARIANT[entry.severity]} className={className}>
        <Icon className="h-4 w-4" />
        <AlertDescription className="text-sm">{message}</AlertDescription>
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
      </AlertDescription>
    </Alert>
  );
};

export default MpErrorAlert;
