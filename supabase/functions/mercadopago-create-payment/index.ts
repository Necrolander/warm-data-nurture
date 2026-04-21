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
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${body.order_id}&select=id,mercadopago_payment_id,payment_status,status`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    const orders = await orderRes.json();
    const order = orders?.[0];
    if (!order) return json({ error: "Pedido não encontrado" }, 404);
    if (order.status === "cancelled") {
      return json({ error: "Pedido cancelado. Crie um novo pedido." }, 409);
    }

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
    if (!mpRes.ok) {
      console.error("MP error:", mpData);
      return json({ error: mpData?.message || "Erro Mercado Pago", details: mpData }, 400);
    }

    // Save payment id on order
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
