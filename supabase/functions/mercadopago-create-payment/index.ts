// Mercado Pago - Create Payment (PIX or Card token)
// Public endpoint - validates input, calls MP API, updates order
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as PixBody | CardBody;
    if (!body?.order_id || !body?.amount || !body?.method) {
      return json({ error: "Campos obrigatórios faltando" }, 400);
    }
    if (body.amount <= 0) return json({ error: "Valor inválido" }, 400);

    const idempotencyKey = crypto.randomUUID();
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
