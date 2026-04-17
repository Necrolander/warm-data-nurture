// Analisa imagem recebida no WhatsApp via Lovable AI (visão).
// Detecta: comprovante PIX, foto de problema/produto, identifica conteúdo geral.
// Atualiza wa_messages.ai_analysis com a descrição.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message_id, image_url } = await req.json();
    if (!message_id || !image_url) {
      return new Response(JSON.stringify({ error: "message_id e image_url obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você analisa imagens enviadas por clientes de uma hamburgueria via WhatsApp. Responda em português, em no máximo 3 linhas. Se for comprovante PIX, comece com '💰 COMPROVANTE PIX:' e extraia valor + chave/destino. Se for foto de problema com produto, comece com '⚠️ PROBLEMA:' e descreva. Se for cardápio/foto solicitando produto, comece com '🍔 PEDIDO:'. Caso contrário, descreva brevemente."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "O que tem nesta imagem?" },
              { type: "image_url", image_url: { url: image_url } },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error", status: aiRes.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const analysis = data?.choices?.[0]?.message?.content || "(sem análise)";

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    await supabase.from("wa_messages").update({ ai_analysis: analysis }).eq("id", message_id);

    return new Response(JSON.stringify({ ok: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
