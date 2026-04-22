import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const rawPhone = typeof body.phone === "string" ? body.phone : "";
    const normalizedPhone = normalizePhone(rawPhone);

    if (!normalizedPhone) {
      return new Response(JSON.stringify({ error: "Preencha o telefone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidates = normalizedPhone.startsWith("55") && normalizedPhone.length > 11
      ? [normalizedPhone, normalizedPhone.slice(2)]
      : [normalizedPhone];

    const { data: drivers, error } = await supabaseAdmin
      .from("delivery_persons")
      .select("id, name, phone")
      .in("phone", candidates)
      .eq("is_active", true)
      .limit(1);

    if (error) {
      return new Response(JSON.stringify({ error: "Erro ao validar entregador" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const driver = drivers?.[0];

    if (!driver) {
      return new Response(JSON.stringify({ error: "Entregador não encontrado ou inativo" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ driver }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Erro interno no login do entregador" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
