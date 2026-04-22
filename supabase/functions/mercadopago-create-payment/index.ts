// Mercado Pago - Create Payment (PIX or Card token)
// Public endpoint - validates input, calls MP API, updates order
// Idempotent by order_id: if a pending/in_process payment already exists, returns it.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PixBody {
  method: "pix";
  order_id: string;
  amount: number;
  payer: { email?: string; first_name?: string; last_name?: string; phone?: string };
}
interface CardBody {
  method: "card";
  order_id: string;
  amount: number;
  token: string;
  installments: number;
  payment_method_id: string;
  issuer_id?: string;
  payer: { email: string; identification?: { type: string; number: string } };
}

const REUSABLE_STATUSES = new Set(["pending", "in_process", "authorized"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as PixBody | CardBody;
    if (!body?.order_id || !body?.amount || !body?.method) {
      return json({ error: "Campos obrigatórios faltando" }, 400);
    }
    if (body.amount <= 0) return json({ error: "Valor inválido" }, 400);

    // ---- Idempotency check ----
    const orderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${body.order_id}&select=id,mercadopago_payment_id,payment_status,status,customer_name,customer_phone`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    const orders = await orderRes.json();
    const order = orders?.[0];
    if (!order) return json({ error: "Pedido não encontrado" }, 404);
    if (order.status === "cancelled") {
      return json({ error: "Pedido cancelado. Crie um novo pedido." }, 409);
    }

    // Optional auth user (if frontend forwarded a JWT)
    let authUserId: string | null = null;
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: SERVICE_KEY, Authorization: authHeader },
        });
        if (userRes.ok) {
          const u = await userRes.json();
          authUserId = u?.id || null;
        }
      }
    } catch { /* ignore */ }

    const previousPaymentId: string | null = order.mercadopago_payment_id || null;

    if (order.mercadopago_payment_id) {
      // Fetch live status from MP to decide whether to reuse
      const mpGet = await fetch(
        `https://api.mercadopago.com/v1/payments/${order.mercadopago_payment_id}`,
        { headers: { Authorization: `Bearer ${MP_TOKEN}` } },
      );
      if (mpGet.ok) {
        const existing = await mpGet.json();
        if (existing.status === "approved") {
          return json(
            {
              error: "Pagamento já aprovado para este pedido.",
              payment_id: existing.id,
              status: existing.status,
            },
            409,
          );
        }
        if (REUSABLE_STATUSES.has(existing.status)) {
          // Same method? Reuse. Different method? Cancel old, create new below.
          const existingMethod =
            existing.payment_method_id === "pix" ? "pix" : "card";
          if (existingMethod === body.method) {
            const result: any = {
              payment_id: existing.id,
              status: existing.status,
              status_detail: existing.status_detail,
              reused: true,
            };
            if (body.method === "pix") {
              const tx = existing.point_of_interaction?.transaction_data;
              result.qr_code = tx?.qr_code;
              result.qr_code_base64 = tx?.qr_code_base64;
              result.ticket_url = tx?.ticket_url;
            }
            return json(result, 200);
          } else {
            // Cancel previous payment (different method requested)
            await fetch(
              `https://api.mercadopago.com/v1/payments/${order.mercadopago_payment_id}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${MP_TOKEN}`,
                },
                body: JSON.stringify({ status: "cancelled" }),
              },
            );
          }
        }
      }
    }

    const idempotencyKey = `${body.order_id}:${body.method}`;
    const baseEmail = body.payer?.email?.trim() || `cliente-${body.order_id.slice(0, 8)}@truebox.app`;

    let mpPayload: any;
    if (body.method === "pix") {
      mpPayload = {
        transaction_amount: Number(body.amount.toFixed(2)),
        description: `Pedido Truebox`,
        payment_method_id: "pix",
        external_reference: body.order_id,
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
        payer: {
          email: baseEmail,
          first_name: body.payer?.first_name || "Cliente",
          last_name: body.payer?.last_name || "Truebox",
        },
      };
    } else {
      mpPayload = {
        transaction_amount: Number(body.amount.toFixed(2)),
        token: body.token,
        description: `Pedido Truebox`,
        installments: body.installments || 1,
        payment_method_id: body.payment_method_id,
        issuer_id: body.issuer_id,
        external_reference: body.order_id,
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
        payer: {
          email: baseEmail,
          identification: body.payer?.identification,
        },
      };
    }

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_TOKEN}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpRes.json();

    // Common context for failure logging
    const failureContext = {
      customer_phone: order.customer_phone || null,
      customer_name: order.customer_name || null,
      user_id: authUserId,
      previous_payment_id: previousPaymentId,
    };
    const cardFromMp = mpData?.card || {};
    const cardInfo = {
      card_first_six: cardFromMp.first_six_digits || null,
      card_last_four: cardFromMp.last_four_digits || null,
      card_holder_name: cardFromMp.cardholder?.name || null,
    };

    if (!mpRes.ok) {
      console.error("MP error:", mpData);
      await logPaymentFailure({
        order_id: body.order_id,
        method: body.method,
        amount: body.amount,
        mp_payment_id: mpData?.id ? String(mpData.id) : null,
        status: mpData?.status || "error",
        status_detail: mpData?.status_detail || mpData?.error || null,
        error_code: mpData?.cause?.[0]?.code ? String(mpData.cause[0].code) : null,
        error_message: mpData?.message || mpData?.error || null,
        payment_method_id: (body as CardBody).payment_method_id || body.method,
        installments: (body as CardBody).installments || null,
        raw_response: mpData,
        ...failureContext,
        ...cardInfo,
      });
      return json({ error: mpData?.message || "Erro Mercado Pago", details: mpData }, 400);
    }

    if (body.method === "card" && mpData.status === "rejected") {
      await logPaymentFailure({
        order_id: body.order_id,
        method: "card",
        amount: body.amount,
        mp_payment_id: String(mpData.id),
        status: mpData.status,
        status_detail: mpData.status_detail || null,
        error_code: mpData.status_detail || null,
        error_message: mpData.status_detail || "Pagamento recusado",
        payment_method_id: (body as CardBody).payment_method_id,
        installments: (body as CardBody).installments || 1,
        raw_response: mpData,
        ...failureContext,
        ...cardInfo,
      });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${body.order_id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        mercadopago_payment_id: String(mpData.id),
        payment_status: mpData.status,
      }),
    });

    const result: any = {
      payment_id: mpData.id,
      status: mpData.status,
      status_detail: mpData.status_detail,
    };
    if (body.method === "pix") {
      const tx = mpData.point_of_interaction?.transaction_data;
      result.qr_code = tx?.qr_code;
      result.qr_code_base64 = tx?.qr_code_base64;
      result.ticket_url = tx?.ticket_url;
    }
    return json(result, 200);
  } catch (err: any) {
    console.error("create-payment fatal:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});

function json(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logPaymentFailure(record: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/payment_failures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(record),
    });
  } catch (e) {
    console.error("logPaymentFailure failed:", e);
  }
}
