import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("55") && digits.length > 11) {
    return digits.slice(2);
  }

  return digits;
}

function candidatePhones(phone: string) {
  const normalized = normalizePhone(phone);
  const withoutLeadingZero = normalized.replace(/^0+/, "");

  return Array.from(
    new Set([
      phone,
      normalized,
      withoutLeadingZero,
      `+55${normalized}`,
      `55${normalized}`,
      `(${normalized.slice(0, 2)}) ${normalized.slice(2, 7)}-${normalized.slice(7)}`,
      `(${normalized.slice(0, 2)}) ${normalized.slice(2, 6)}-${normalized.slice(6)}`,
    ].filter((value) => value && value.length >= 8)),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneVariants = candidatePhones(phone);
    const normalizedInput = normalizePhone(phone);

    const { data: drivers, error } = await supabaseAdmin
      .from("delivery_persons")
      .select("id, name, phone, is_active")
      .eq("is_active", true)
      .in("phone", phoneVariants);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const driver = (drivers || []).find((item) => normalizePhone(item.phone) === normalizedInput) || drivers?.[0];

    if (!driver) {
      return new Response(JSON.stringify({ error: "Entregador não encontrado ou inativo" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
