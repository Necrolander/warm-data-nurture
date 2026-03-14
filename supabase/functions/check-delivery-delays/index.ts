import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Find orders that are in production or out_for_delivery and potentially delayed
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["production", "out_for_delivery"])
      .eq("delay_notified", false)
      .eq("order_type", "delivery");

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ message: "No delayed orders" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const delayedOrders = [];

    for (const order of orders) {
      const createdAt = new Date(order.created_at);
      const estimatedTotal = (order.estimated_prep_minutes || 30) + (order.estimated_delivery_minutes || 15);
      const elapsedMinutes = (now.getTime() - createdAt.getTime()) / 60000;

      if (elapsedMinutes > estimatedTotal) {
        delayedOrders.push({
          ...order,
          elapsed: Math.round(elapsedMinutes),
          expected: estimatedTotal,
        });

        // Mark as notified
        await supabase
          .from("orders")
          .update({ delay_notified: true })
          .eq("id", order.id);

        // Send delay notification to customer via bot
        const delayMsg = `⏰ *Atualização do Pedido #${order.order_number}*\n\nSeu pedido está a caminho 🚴\nHouve um pequeno atraso no trajeto, mas já estamos chegando.\n\nAgradecemos pela paciência! 🙏`;

        // Find or create session
        let { data: session } = await supabase
          .from("chat_sessions")
          .select("*")
          .eq("phone", order.customer_phone)
          .eq("is_active", true)
          .single();

        if (!session) {
          const { data: newSession } = await supabase
            .from("chat_sessions")
            .insert({
              phone: order.customer_phone,
              customer_name: order.customer_name,
              state: "greeting",
              order_id: order.id,
            })
            .select()
            .single();
          session = newSession;
        }

        if (session) {
          await supabase.from("chat_messages").insert({
            session_id: session.id,
            direction: "outgoing",
            message: delayMsg,
          });
        }

        // Create kitchen alert for the restaurant
        await supabase.from("kitchen_alerts").insert({
          order_id: order.id,
          message: `⏰ ATRASO DETECTADO - Pedido #${order.order_number} | Previsto: ${estimatedTotal}min | Atual: ${Math.round(elapsedMinutes)}min`,
          waiter_name: "Sistema",
        });
      }
    }

    return new Response(JSON.stringify({
      checked: orders.length,
      delayed: delayedOrders.length,
      details: delayedOrders.map(o => ({
        order_number: o.order_number,
        elapsed: o.elapsed,
        expected: o.expected,
      })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Delay check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
