// Cancel a Mercado Pago payment (only works while pending/in_process)
// Also marks the local order as cancelled.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id obrigatório" }, 400);

    // Load order
    const orderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}&select=id,mercadopago_payment_id,payment_status,status`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    const orders = await orderRes.json();
    const order = orders?.[0];
    if (!order) return json({ error: "Pedido não encontrado" }, 404);

    if (order.status === "cancelled") {
      return json({ ok: true, already_cancelled: true });
    }

    // If there's an MP payment id and it's still cancellable, cancel it
    let mpStatus: string | null = null;
    if (order.mercadopago_payment_id && order.payment_status !== "approved") {
      const mpRes = await fetch(
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
      const mpData = await mpRes.json();
      mpStatus = mpData?.status || null;
      if (!mpRes.ok && mpData?.status !== "cancelled") {
        console.warn("MP cancel warning:", mpData);
        // Don't fail — still mark order as cancelled locally if MP refuses (e.g. already approved)
        if (mpData?.status === "approved") {
          return json(
            { error: "Pagamento já foi aprovado. Não é possível cancelar pelo gateway." },
            409,
          );
        }
      }
    }

    // Update local order
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "cancelled",
        payment_status: mpStatus || "cancelled",
      }),
    });

    return json({ ok: true, mp_status: mpStatus });
  } catch (err: any) {
    console.error("cancel-payment fatal:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
