// Edge function: ifood-chat-respond
// Triggered when a new incoming chat message arrives from iFood order chat.
// Detects intent, generates AI reply (or escalates), and stores response_pending.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface ChatRequest {
  order_external_id: string;
  customer_name?: string;
  message: string;
  raw_payload?: Record<string, unknown>;
}

type Intent = "status" | "composition" | "complaint" | "cancellation" | "other";

function detectIntent(message: string): Intent {
  const m = message.toLowerCase();
  if (/(cancel|desist|n[ãa]o quero mais)/.test(m)) return "cancellation";
  if (/(errado|frio|faltou|faltando|ruim|pior|reclama|p[ée]ssimo|horr[íi]vel|estragad|cru|queimad|sujo)/.test(m))
    return "complaint";
  if (/(cad[êe]|onde|demora|atras|chega|quando|prev|sa[íi]u|saiu|t[áa] pronto|pronto|status)/.test(m))
    return "status";
  if (/(vem com|tem |sem |ingrediente|composi|leva |contém|contem|que vem)/.test(m))
    return "composition";
  return "other";
}

async function getOrderContext(supabase: any, externalId: string) {
  // Try to find linked internal order via external_orders
  const { data: ext } = await supabase
    .from("external_orders")
    .select("internal_order_id, normalized_payload, normalized_status")
    .eq("external_order_id", externalId)
    .maybeSingle();

  if (!ext?.internal_order_id) {
    return { external: ext, order: null, items: [], driver: null };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", ext.internal_order_id)
    .maybeSingle();

  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, quantity, observation, extras")
    .eq("order_id", ext.internal_order_id);

  let driver = null;
  if (order?.delivery_person_id) {
    const { data } = await supabase
      .from("delivery_persons")
      .select("name, phone")
      .eq("id", order.delivery_person_id)
      .maybeSingle();
    driver = data;
  }

  return { external: ext, order, items: items || [], driver };
}

function buildContextSummary(ctx: any, customerName?: string): string {
  const lines: string[] = [];
  lines.push(`Cliente: ${customerName || "Cliente"}`);
  if (ctx.order) {
    const statusMap: Record<string, string> = {
      pending: "Recebido",
      production: "Em preparo",
      ready: "Pronto",
      out_for_delivery: "Saiu para entrega",
      delivered: "Entregue",
      cancelled: "Cancelado",
    };
    lines.push(`Pedido #${ctx.order.order_number} - Status: ${statusMap[ctx.order.status] || ctx.order.status}`);
    if (ctx.order.estimated_delivery_minutes)
      lines.push(`ETA: ~${ctx.order.estimated_delivery_minutes} min`);
    if (ctx.driver) lines.push(`Entregador: ${ctx.driver.name} (${ctx.driver.phone})`);
    if (ctx.items.length) {
      lines.push("Itens:");
      ctx.items.forEach((i: any) =>
        lines.push(`  - ${i.quantity}x ${i.product_name}${i.observation ? ` (obs: ${i.observation})` : ""}`),
      );
    }
  } else {
    lines.push("(Pedido ainda não sincronizado internamente)");
  }
  return lines.join("\n");
}

async function generateAIReply(
  message: string,
  intent: Intent,
  contextSummary: string,
  model: string,
): Promise<string | null> {
  const systemPrompt = `Você é o atendente virtual da Truebox Hamburgueria respondendo no chat do iFood.
Regras:
- Seja CURTO (máx 2 frases), educado e empático.
- Use emojis com moderação (1-2 por mensagem).
- NUNCA invente informação. Use APENAS o contexto do pedido fornecido.
- Se for reclamação, peça desculpas e diga que vai resolver.
- NUNCA prometa reembolso, desconto ou cupom — isso só humano libera.
- Se não souber responder com certeza, diga "vou verificar com a equipe e já te respondo".
- Não use markdown, é chat simples.`;

  const userPrompt = `Contexto do pedido:
${contextSummary}

Intenção detectada: ${intent}

Mensagem do cliente: "${message}"

Gere a resposta:`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      console.error("AI gateway error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("AI call failed:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = (await req.json()) as ChatRequest;

    if (!body.order_external_id || !body.message) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read settings
    const { data: settings } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", [
        "ifood_chat_auto_reply_enabled",
        "ifood_chat_escalate_complaints",
        "ifood_chat_ai_model",
      ]);
    const cfg: Record<string, string> = {};
    settings?.forEach((s: any) => (cfg[s.key] = s.value));
    const autoReplyEnabled = cfg.ifood_chat_auto_reply_enabled !== "false";
    const escalateComplaints = cfg.ifood_chat_escalate_complaints !== "false";
    const model = cfg.ifood_chat_ai_model || "google/gemini-2.5-flash";

    const intent = detectIntent(body.message);
    const ctx = await getOrderContext(supabase, body.order_external_id);
    const internalOrderId = ctx.external?.internal_order_id || null;

    // Cancellation → never auto-reply, always escalate
    if (intent === "cancellation") {
      const { data: inserted } = await supabase
        .from("ifood_chat_messages")
        .insert({
          order_external_id: body.order_external_id,
          internal_order_id: internalOrderId,
          customer_name: body.customer_name,
          direction: "incoming",
          message: body.message,
          intent,
          escalated: true,
          raw_payload: body.raw_payload || {},
        })
        .select()
        .single();

      // Create kitchen alert for admin attention
      await supabase.from("kitchen_alerts").insert({
        message: `🚨 Cliente pediu CANCELAMENTO no chat iFood: "${body.message.slice(0, 100)}"`,
        order_id: internalOrderId,
        waiter_name: "Bot iFood",
      });

      return new Response(
        JSON.stringify({ ok: true, action: "escalated", intent, id: inserted?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Complaint → AI reply + escalate to admin
    let shouldEscalate = intent === "complaint" && escalateComplaints;

    let reply: string | null = null;
    if (autoReplyEnabled) {
      const contextSummary = buildContextSummary(ctx, body.customer_name);
      reply = await generateAIReply(body.message, intent, contextSummary, model);
    }

    const { data: inserted } = await supabase
      .from("ifood_chat_messages")
      .insert({
        order_external_id: body.order_external_id,
        internal_order_id: internalOrderId,
        customer_name: body.customer_name,
        direction: "incoming",
        message: body.message,
        intent,
        escalated: shouldEscalate,
        response_pending: reply,
        auto_replied: !!reply,
        raw_payload: body.raw_payload || {},
      })
      .select()
      .single();

    if (shouldEscalate) {
      await supabase.from("kitchen_alerts").insert({
        message: `⚠️ Reclamação no chat iFood: "${body.message.slice(0, 100)}"`,
        order_id: internalOrderId,
        waiter_name: "Bot iFood",
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        action: reply ? "auto_reply" : "stored_for_human",
        intent,
        escalated: shouldEscalate,
        reply,
        id: inserted?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ifood-chat-respond error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
