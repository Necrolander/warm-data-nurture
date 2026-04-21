// Mercado Pago Webhook - receives notifications and updates order
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
    let topic = url.searchParams.get("type") || url.searchParams.get("topic");

    if (req.method === "POST") {
      try {
        const body = await req.json();
        paymentId = body?.data?.id || body?.id || paymentId;
        topic = body?.type || body?.topic || topic;
      } catch (_) { /* may be empty */ }
    }

    if (!paymentId || (topic && topic !== "payment")) {
      return new Response("ignored", { status: 200, headers: corsHeaders });
    }

    // Fetch payment from MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!mpRes.ok) {
      console.error("MP fetch failed", await mpRes.text());
      return new Response("err", { status: 200, headers: corsHeaders });
    }
    const payment = await mpRes.json();
    const orderId = payment.external_reference;
    const status = payment.status; // approved | pending | rejected | cancelled

    if (!orderId) return new Response("no order", { status: 200, headers: corsHeaders });

    const updates: Record<string, any> = {
      payment_status: status,
      mercadopago_payment_id: String(payment.id),
    };
    // When approved, advance order from pending to production automatically
    if (status === "approved") {
      updates.status = "production";
    }
    if (status === "rejected" || status === "cancelled") {
      updates.status = "cancelled";
    }

    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(updates),
    });

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("webhook error:", err);
    return new Response("err", { status: 200, headers: corsHeaders });
  }
});
