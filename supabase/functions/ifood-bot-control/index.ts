// Edge function de controle do bot iFood (Playwright na VPS)
// Autenticação por bearer token compartilhado (IFOOD_BOT_TOKEN)
// Endpoints (action no body):
//   - get_credentials      → bot puxa email+senha
//   - request_2fa          → bot avisa que precisa de código
//   - get_pending_2fa      → bot pergunta se já tem código
//   - consume_2fa          → bot marca código como usado
//   - heartbeat            → bot reporta vivo
//   - upload_screenshot    → bot envia print da tela atual (base64 ou URL)
//   - log_failure          → bot reporta erro
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: bearer token compartilhado
  const expected = Deno.env.get("IFOOD_BOT_TOKEN");
  if (!expected) return json({ error: "IFOOD_BOT_TOKEN not configured" }, 500);
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token !== expected) return json({ error: "unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { action } = body ?? {};
  if (!action) return json({ error: "missing action" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // ---------------- get_credentials ----------------
    if (action === "get_credentials") {
      const email = Deno.env.get("IFOOD_PORTAL_EMAIL");
      const password = Deno.env.get("IFOOD_PORTAL_PASSWORD");
      if (!email || !password) {
        return json({ error: "iFood credentials not configured" }, 500);
      }
      return json({ email, password });
    }

    // ---------------- request_2fa ----------------
    // Bot chegou na tela de 2FA e precisa que admin cole o código.
    if (action === "request_2fa") {
      const { reason } = body;

      // Se já existe um pending recente, reaproveita
      const { data: existing } = await supabase
        .from("bot_2fa_requests")
        .select("id, status, expires_at")
        .eq("channel", "ifood")
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return json({ status: "already_pending", id: existing.id, expires_at: existing.expires_at });
      }

      const { data: created, error } = await supabase
        .from("bot_2fa_requests")
        .insert({ channel: "ifood", status: "pending", reason: reason ?? null })
        .select("id, expires_at")
        .single();
      if (error) throw error;

      return json({ status: "created", id: created.id, expires_at: created.expires_at });
    }

    // ---------------- get_pending_2fa ----------------
    // Bot faz polling: já tem código pra eu usar?
    if (action === "get_pending_2fa") {
      const { data: provided } = await supabase
        .from("bot_2fa_requests")
        .select("id, code, provided_at, expires_at")
        .eq("channel", "ifood")
        .eq("status", "provided")
        .gt("expires_at", new Date().toISOString())
        .order("provided_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!provided) return json({ status: "none" });
      return json({ status: "ready", id: provided.id, code: provided.code });
    }

    // ---------------- consume_2fa ----------------
    if (action === "consume_2fa") {
      const { id } = body;
      if (!id) return json({ error: "id required" }, 400);
      await supabase
        .from("bot_2fa_requests")
        .update({ status: "consumed", consumed_at: new Date().toISOString() })
        .eq("id", id);
      return json({ status: "consumed" });
    }

    // ---------------- heartbeat ----------------
    if (action === "heartbeat") {
      const { status, ordersCaptured, failures, meta } = body;
      await supabase
        .from("bot_heartbeats")
        .upsert(
          {
            channel: "ifood",
            status: status ?? "online",
            last_polled_at: new Date().toISOString(),
            orders_captured_total: ordersCaptured ?? 0,
            failures_total: failures ?? 0,
            meta: meta ?? {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: "channel" }
        );
      return json({ status: "ok" });
    }

    // ---------------- upload_screenshot ----------------
    // Aceita screenshot_url (já hospedado) OU screenshot_base64 (vai pro storage)
    if (action === "upload_screenshot") {
      const { screenshot_url, screenshot_base64, page_url, note } = body;
      let finalUrl = screenshot_url as string | undefined;

      if (!finalUrl && screenshot_base64) {
        // Decode base64 e sobe pro storage
        const cleanB64 = screenshot_base64.replace(/^data:image\/\w+;base64,/, "");
        const bytes = Uint8Array.from(atob(cleanB64), (c) => c.charCodeAt(0));
        const path = `ifood/${Date.now()}.png`;
        const { error: upErr } = await supabase.storage
          .from("bot-screenshots")
          .upload(path, bytes, { contentType: "image/png", upsert: false });
        if (upErr) {
          // Se bucket não existir, cria e tenta de novo
          if (String(upErr.message).toLowerCase().includes("not found")) {
            await supabase.storage.createBucket("bot-screenshots", { public: true });
            await supabase.storage.from("bot-screenshots").upload(path, bytes, {
              contentType: "image/png",
              upsert: false,
            });
          } else {
            throw upErr;
          }
        }
        const { data: pub } = supabase.storage.from("bot-screenshots").getPublicUrl(path);
        finalUrl = pub.publicUrl;
      }

      if (!finalUrl) return json({ error: "screenshot_url or screenshot_base64 required" }, 400);

      const { data, error } = await supabase
        .from("bot_screenshots")
        .insert({ channel: "ifood", screenshot_url: finalUrl, page_url, note })
        .select("id")
        .single();
      if (error) throw error;
      return json({ status: "uploaded", id: data.id, url: finalUrl });
    }

    // ---------------- log_failure ----------------
    if (action === "log_failure") {
      const { errorMessage, screenshotUrl, htmlSnapshotUrl, context } = body;
      await supabase.from("bot_failures").insert({
        channel: "ifood",
        error_message: errorMessage ?? "unknown",
        screenshot_url: screenshotUrl,
        html_snapshot_url: htmlSnapshotUrl,
        context: context ?? {},
      });
      return json({ status: "logged" });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e: any) {
    console.error("ifood-bot-control error", e);
    return json({ error: e?.message ?? "internal error" }, 500);
  }
});
