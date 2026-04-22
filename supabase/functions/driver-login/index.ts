import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.3";
import { SignJWT } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const tokenSecret = new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "driver-session-secret");

const LoginSchema = z.object({
  phone: z.string().min(8).max(20),
});

async function signDriverToken(driver: { id: string; name: string; phone: string }) {
  return await new SignJWT({
    role: "delivery_driver",
    name: driver.name,
    phone: driver.phone,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(driver.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(tokenSecret);
}

async function resolveDriverStatus(supabaseAdmin: ReturnType<typeof createClient>, driverId: string) {
  const [{ count: activeRoutes }, { count: activeOrders }] = await Promise.all([
    supabaseAdmin
      .from("routes")
      .select("id", { head: true, count: "exact" })
      .eq("driver_id", driverId)
      .in("status", ["assigned", "in_delivery"]),
    supabaseAdmin
      .from("orders")
      .select("id", { head: true, count: "exact" })
      .eq("delivery_person_id", driverId)
      .in("status", ["ready", "out_for_delivery"]),
  ]);

  if ((activeRoutes || 0) > 0 || (activeOrders || 0) > 0) return "on_route";
  return "available";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rawBody = await req.json().catch(() => null);
    const parsed = LoginSchema.safeParse(rawBody);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Telefone inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPhone = normalizePhone(parsed.data.phone);
    const candidates = Array.from(new Set([
      normalizedPhone,
      normalizedPhone.startsWith("55") && normalizedPhone.length > 11 ? normalizedPhone.slice(2) : normalizedPhone,
      normalizedPhone.startsWith("55") ? normalizedPhone : `55${normalizedPhone}`,
    ].filter(Boolean)));

    const { data: drivers, error } = await supabaseAdmin
      .from("delivery_persons")
      .select("id, name, phone, is_active")
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

    const nextStatus = await resolveDriverStatus(supabaseAdmin, driver.id);

    await supabaseAdmin
      .from("delivery_persons")
      .update({
        is_online: true,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", driver.id);

    const token = await signDriverToken(driver);

    return new Response(JSON.stringify({
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        is_online: true,
        status: nextStatus,
      },
      token,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Erro interno no login do entregador" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
