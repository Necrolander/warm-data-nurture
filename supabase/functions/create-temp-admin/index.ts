import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const email = "acesso-temp@truebox.com";
    const password = "TempTruebox#2026";

    // Try to find existing user
    const { data: list } = await admin.auth.admin.listUsers();
    let user = list?.users?.find((u: any) => u.email === email);

    if (!user) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Acesso Temporário" },
      });
      if (error) throw error;
      user = created.user!;
    } else {
      await admin.auth.admin.updateUserById(user.id, { password });
    }

    await admin.from("user_roles").upsert(
      { user_id: user!.id, role: "admin" },
      { onConflict: "user_id,role" }
    );

    return new Response(
      JSON.stringify({ success: true, email, password, user_id: user!.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
