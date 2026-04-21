// Returns the Mercado Pago public key (safe to expose to frontend)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({ public_key: Deno.env.get("MERCADO_PAGO_PUBLIC_KEY") || "" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
