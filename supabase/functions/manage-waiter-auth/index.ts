import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "Not admin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { action, email, password, name, phone, waiter_id, user_id } = body;

    if (action === "create") {
      // Create auth user for waiter
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
      });
      if (createError) return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Assign waiter role
      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user!.id, role: "waiter" });

      // Create profile
      await supabaseAdmin.from("profiles").upsert({
        user_id: newUser.user!.id,
        display_name: name,
        phone: phone || null,
      }, { onConflict: "user_id" });

      // Update waiters table
      if (waiter_id) {
        await supabaseAdmin.from("waiters").update({ user_id: newUser.user!.id, email }).eq("id", waiter_id);
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user!.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      if (!user_id) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (name) updateData.user_metadata = { display_name: name };

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, updateData);
      if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Update profile
      if (name || phone !== undefined) {
        const profileUpdate: any = {};
        if (name) profileUpdate.display_name = name;
        if (phone !== undefined) profileUpdate.phone = phone;
        await supabaseAdmin.from("profiles").update(profileUpdate).eq("user_id", user_id);
      }

      // Update waiters table
      if (waiter_id) {
        const waiterUpdate: any = {};
        if (name) waiterUpdate.name = name;
        if (phone !== undefined) waiterUpdate.phone = phone;
        if (email) waiterUpdate.email = email;
        await supabaseAdmin.from("waiters").update(waiterUpdate).eq("id", waiter_id);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      if (user_id) {
        await supabaseAdmin.auth.admin.deleteUser(user_id);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
