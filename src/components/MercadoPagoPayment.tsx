import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Check, Loader2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";



interface Props {
  orderId: string;
  amount: number;
  payerName: string;
  payerPhone: string;
  method: "pix" | "card";
  onApproved: () => void;
  onPending: () => void;
  onCancelled?: () => void;
}

declare global {
  interface Window {
    MercadoPago: any;
  }
}

const MercadoPagoPayment = ({ orderId, amount, payerName, payerPhone, method, onApproved, onPending, onCancelled }: Props) => {
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pix, setPix] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const mpRef = useRef<any>(null);
  const cardFormRef = useRef<any>(null);
  const [mpPublicKey, setMpPublicKey] = useState<string>("");
  const finalizedRef = useRef(false);

  // Realtime: subscribe to order payment_status changes
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-payment-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload: any) => {
          const next = payload.new?.payment_status;
          const status = payload.new?.status;
          if (next) setPaymentStatus(next);
          if (finalizedRef.current) return;
          if (next === "approved") {
            finalizedRef.current = true;
            toast.success("Pagamento confirmado! 🎉");
            onApproved();
          } else if (next === "rejected" || status === "cancelled" || next === "cancelled") {
            finalizedRef.current = true;
            toast.error("Pagamento não aprovado");
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Fetch public key from edge function (so we don't hardcode it)
  useEffect(() => {
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-public-key`;
        const r = await fetch(url);
        if (r.ok) {
          const d = await r.json();
          setMpPublicKey(d.public_key);
        }
      } catch (_) {}
    })();
  }, []);

  // Load MP SDK for card form
  useEffect(() => {
    if (method !== "card" || !mpPublicKey) return;
    if (document.getElementById("mp-sdk")) {
      initCardForm();
      return;
    }
    const s = document.createElement("script");
    s.id = "mp-sdk";
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.onload = initCardForm;
    document.body.appendChild(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, mpPublicKey, amount, orderId]);

  const initCardForm = () => {
    if (!window.MercadoPago || !mpPublicKey) return;
    mpRef.current = new window.MercadoPago(mpPublicKey, { locale: "pt-BR" });
    const cardForm = mpRef.current.cardForm({
      amount: String(amount.toFixed(2)),
      autoMount: true,
      form: {
        id: "form-mp-card",
        cardNumber: { id: "form-mp-cardNumber", placeholder: "Número do cartão" },
        expirationDate: { id: "form-mp-expirationDate", placeholder: "MM/AA" },
        securityCode: { id: "form-mp-securityCode", placeholder: "CVV" },
        cardholderName: { id: "form-mp-cardholderName", placeholder: "Nome no cartão" },
        identificationType: { id: "form-mp-identificationType" },
        identificationNumber: { id: "form-mp-identificationNumber", placeholder: "CPF" },
        cardholderEmail: { id: "form-mp-cardholderEmail", placeholder: "E-mail" },
        installments: { id: "form-mp-installments", placeholder: "Parcelas" },
        issuer: { id: "form-mp-issuer", placeholder: "Banco" },
      },
      callbacks: {
        onFormMounted: (e: any) => { if (e) console.warn("MP mount", e); },
        onSubmit: async (event: any) => {
          event.preventDefault();
          await handleCardSubmit();
        },
      },
    });
    cardFormRef.current = cardForm;
  };

  const handleCardSubmit = async () => {
    if (!cardFormRef.current) return;
    const data = cardFormRef.current.getCardFormData();
    if (!data.token) {
      toast.error("Verifique os dados do cartão");
      return;
    }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("mercadopago-create-payment", {
        body: {
          method: "card",
          order_id: orderId,
          amount,
          token: data.token,
          installments: Number(data.installments) || 1,
          payment_method_id: data.paymentMethodId,
          issuer_id: data.issuerId,
          payer: {
            email: data.cardholderEmail,
            identification: {
              type: data.identificationType,
              number: data.identificationNumber,
            },
          },
        },
      });
      if (error) throw error;
      if (res?.status) setPaymentStatus(res.status);
      if (res?.status === "approved") {
        finalizedRef.current = true;
        toast.success("Pagamento aprovado! 🎉");
        onApproved();
      } else if (res?.status === "in_process" || res?.status === "pending") {
        toast.info("Pagamento em análise");
        onPending();
      } else {
        toast.error(`Pagamento recusado: ${res?.status_detail || res?.status}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao processar cartão");
    } finally {
      setLoading(false);
    }
  };

  const generatePix = async () => {
    setLoading(true);
    try {
      const [first, ...rest] = (payerName || "Cliente").split(" ");
      const { data, error } = await supabase.functions.invoke("mercadopago-create-payment", {
        body: {
          method: "pix",
          order_id: orderId,
          amount,
          payer: {
            first_name: first,
            last_name: rest.join(" ") || "Truebox",
            phone: payerPhone,
          },
        },
      });
      if (error) throw error;
      if (!data?.qr_code) throw new Error("QR Code não gerado");
      setPix({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64 });
      if (data?.status) setPaymentStatus(data.status);
      startPolling();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    // Realtime is primary; polling stays as fallback (every 8s)
    setPolling(true);
    const interval = setInterval(async () => {
      if (finalizedRef.current) { clearInterval(interval); setPolling(false); return; }
      const { data } = await supabase
        .from("orders")
        .select("payment_status,status")
        .eq("id", orderId)
        .maybeSingle();
      if (data?.payment_status) setPaymentStatus(data.payment_status);
      if (data?.payment_status === "approved") {
        finalizedRef.current = true;
        clearInterval(interval);
        setPolling(false);
        toast.success("Pagamento PIX confirmado! 🎉");
        onApproved();
      } else if (data?.payment_status === "rejected" || data?.payment_status === "cancelled" || data?.status === "cancelled") {
        finalizedRef.current = true;
        clearInterval(interval);
        setPolling(false);
        toast.error("Pagamento não aprovado");
      }
    }, 8000);
    // stop after 15 min
    setTimeout(() => { clearInterval(interval); setPolling(false); }, 15 * 60 * 1000);
  };

  const statusBadge = () => {
    const s = paymentStatus;
    if (!s) return null;
    if (s === "approved") {
      return (
        <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/15">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pagamento aprovado
        </Badge>
      );
    }
    if (s === "rejected" || s === "cancelled") {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3.5 h-3.5 mr-1" /> {s === "cancelled" ? "Cancelado" : "Recusado"}
        </Badge>
      );
    }
    // pending / in_process / authorized
    return (
      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/15">
        <Clock className="w-3.5 h-3.5 mr-1 animate-pulse" /> Aguardando pagamento
      </Badge>
    );
  };

  const copyPix = () => {
    if (!pix?.qr_code) return;
    navigator.clipboard.writeText(pix.qr_code);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCancel = async () => {
    if (cancelling) return;
    if (!confirm("Cancelar este pedido? O pagamento será anulado.")) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-cancel-payment", {
        body: { order_id: orderId },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Erro ao cancelar");
      }
      toast.success("Pedido cancelado");
      onCancelled?.();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cancelar");
    } finally {
      setCancelling(false);
    }
  };

  if (method === "pix") {
    return (
      <div className="space-y-4">
        {paymentStatus && (
          <div className="flex justify-center">{statusBadge()}</div>
        )}
        {!pix ? (
          <Button onClick={generatePix} disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Gerar QR Code PIX
          </Button>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${pix.qr_code_base64}`}
                alt="QR Code PIX"
                className="w-56 h-56 bg-white p-2 rounded-lg"
              />
            </div>
            <Button onClick={copyPix} variant="outline" className="w-full">
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copiado!" : "Copiar código PIX"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {paymentStatus === "approved"
                ? "✅ Pagamento confirmado!"
                : polling
                  ? "⏳ Aguardando confirmação em tempo real..."
                  : "Após pagar, aguarde a confirmação"}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={handleCancel}
          disabled={cancelling || paymentStatus === "approved"}
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Cancelar pedido
        </Button>
      </div>
    );
  }

  // CARD
  return (
    <form id="form-mp-card" className="space-y-3">
      <div>
        <Label className="text-xs">Número do cartão</Label>
        <div id="form-mp-cardNumber" className="h-12 bg-background border border-border rounded-xl px-3" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Validade</Label>
          <div id="form-mp-expirationDate" className="h-12 bg-background border border-border rounded-xl px-3" />
        </div>
        <div>
          <Label className="text-xs">CVV</Label>
          <div id="form-mp-securityCode" className="h-12 bg-background border border-border rounded-xl px-3" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Nome no cartão</Label>
        <Input id="form-mp-cardholderName" placeholder="Como está no cartão" />
      </div>
      <div>
        <Label className="text-xs">E-mail</Label>
        <Input id="form-mp-cardholderEmail" type="email" placeholder="seu@email.com" />
      </div>
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <div>
          <Label className="text-xs">Documento</Label>
          <select id="form-mp-identificationType" className="h-10 w-full bg-background border border-border rounded-xl px-2" />
        </div>
        <div>
          <Label className="text-xs">Número</Label>
          <Input id="form-mp-identificationNumber" placeholder="000.000.000-00" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Banco emissor</Label>
        <select id="form-mp-issuer" className="h-10 w-full bg-background border border-border rounded-xl px-2" />
      </div>
      <div>
        <Label className="text-xs">Parcelas</Label>
        <select id="form-mp-installments" className="h-10 w-full bg-background border border-border rounded-xl px-2" />
      </div>
      <Button type="submit" disabled={loading || cancelling} size="lg" className="w-full">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Pagar R$ {amount.toFixed(2).replace(".", ",")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={handleCancel}
        disabled={cancelling || loading}
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Cancelar pedido
      </Button>
    </form>
  );
};

export default MercadoPagoPayment;
