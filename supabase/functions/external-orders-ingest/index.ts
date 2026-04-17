// Edge function que recebe pedidos do bot externo (Playwright na VPS).
// Autenticação por bearer token compartilhado (EXTERNAL_BOT_TOKEN).
// Ações: ingest_order, update_status, heartbeat, log_failure, reprocess
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Hash estável do conteúdo normalizado para detectar mudanças
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const STATUS_MAP: Record<string, string> = {
  pending: "PENDING", new: "PENDING", novo: "PENDING",
  confirmed: "CONFIRMED", confirmado: "CONFIRMED",
  preparing: "PREPARING", "em produção": "PREPARING", "em producao": "PREPARING", "em preparação": "PREPARING",
  ready: "READY", pronto: "READY",
  out_for_delivery: "OUT_FOR_DELIVERY", "saiu para entrega": "OUT_FOR_DELIVERY",
  delivered: "DELIVERED", entregue: "DELIVERED",
  cancelled: "CANCELLED", canceled: "CANCELLED", cancelado: "CANCELLED",
};
const normalizeStatus = (raw?: string) => {
  if (!raw) return "PENDING";
  return STATUS_MAP[raw.toLowerCase().trim()] ?? "UNKNOWN";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Bearer token do bot
  const expected = Deno.env.get("EXTERNAL_BOT_TOKEN");
  if (!expected) return json({ error: "EXTERNAL_BOT_TOKEN not configured" }, 500);
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token !== expected) return json({ error: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const { action } = body ?? {};
  if (!action) return json({ error: "missing action" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    if (action === "ingest_order") {
      const { channel, externalOrderId, normalized, raw } = body;
      if (!channel || !externalOrderId || !normalized)
        return json({ error: "channel, externalOrderId and normalized required" }, 400);

      const normalizedStatus = normalizeStatus(normalized.status ?? normalized.rawStatus);
      const hash = await sha256(JSON.stringify(normalized));

      // Upsert por (channel, external_order_id) — dedup
      const { data: existing } = await supabase
        .from("external_orders")
        .select("id, order_hash, internal_order_id, normalized_status")
        .eq("channel", channel)
        .eq("external_order_id", String(externalOrderId))
        .maybeSingle();

      if (existing) {
        const changed = existing.order_hash !== hash;
        if (changed) {
          await supabase.from("external_orders").update({
            raw_payload: raw ?? {},
            normalized_payload: normalized,
            raw_status: normalized.rawStatus ?? null,
            normalized_status: normalizedStatus,
            order_hash: hash,
            last_seen_at: new Date().toISOString(),
          }).eq("id", existing.id);
          await supabase.from("external_order_events").insert({
            external_order_id: existing.id, event_type: "updated", payload: { hash },
          });
        } else {
          await supabase.from("external_orders").update({ last_seen_at: new Date().toISOString() }).eq("id", existing.id);
        }
        return json({ status: "exists", id: existing.id, internal_order_id: existing.internal_order_id, changed });
      }

      // Novo pedido
      const { data: created, error: insErr } = await supabase.from("external_orders").insert({
        channel,
        external_order_id: String(externalOrderId),
        raw_payload: raw ?? {},
        normalized_payload: normalized,
        raw_status: normalized.rawStatus ?? null,
        normalized_status: normalizedStatus,
        order_hash: hash,
      }).select("id").single();
      if (insErr) throw insErr;

      await supabase.from("external_order_events").insert({
        external_order_id: created.id, event_type: "created", payload: { channel, externalOrderId },
      });

      // Promove para pedido real em orders
      const { data: orderId, error: rpcErr } = await supabase.rpc("create_order_from_external", { _external_id: created.id });
      if (rpcErr) {
        await supabase.from("external_order_events").insert({
          external_order_id: created.id, event_type: "failed", payload: { error: rpcErr.message },
        });
        return json({ status: "ingested_but_promotion_failed", id: created.id, error: rpcErr.message }, 207);
      }

      return json({ status: "created", id: created.id, internal_order_id: orderId });
    }

    if (action === "update_status") {
      const { channel, externalOrderId, rawStatus } = body;
      const normalized = normalizeStatus(rawStatus);
      const { data: ext } = await supabase
        .from("external_orders").select("id, internal_order_id, normalized_status")
        .eq("channel", channel).eq("external_order_id", String(externalOrderId)).maybeSingle();
      if (!ext) return json({ error: "external_order not found" }, 404);

      await supabase.from("external_orders").update({
        raw_status: rawStatus, normalized_status: normalized, last_seen_at: new Date().toISOString(),
      }).eq("id", ext.id);
      await supabase.from("external_order_events").insert({
        external_order_id: ext.id, event_type: "status_changed",
        payload: { from: ext.normalized_status, to: normalized, raw: rawStatus },
      });

      // Espelha no orders interno
      if (ext.internal_order_id) {
        const map: Record<string, string> = {
          PENDING: "pending", CONFIRMED: "production", PREPARING: "production",
          READY: "ready", OUT_FOR_DELIVERY: "out_for_delivery",
          DELIVERED: "delivered", CANCELLED: "cancelled",
        };
        const internalStatus = map[normalized];
        if (internalStatus) {
          await supabase.from("orders").update({ status: internalStatus as any }).eq("id", ext.internal_order_id);
        }
      }
      return json({ status: "updated", normalized });
    }

    if (action === "heartbeat") {
      const { channel, status, ordersCaptured, failures, meta } = body;
      if (!channel) return json({ error: "channel required" }, 400);
      await supabase.from("bot_heartbeats").upsert({
        channel,
        status: status ?? "online",
        last_polled_at: new Date().toISOString(),
        orders_captured_total: ordersCaptured ?? 0,
        failures_total: failures ?? 0,
        meta: meta ?? {},
      }, { onConflict: "channel" });
      return json({ status: "ok" });
    }

    if (action === "log_failure") {
      const { channel, errorMessage, screenshotUrl, htmlSnapshotUrl, context } = body;
      await supabase.from("bot_failures").insert({
        channel, error_message: errorMessage ?? "unknown",
        screenshot_url: screenshotUrl, html_snapshot_url: htmlSnapshotUrl, context: context ?? {},
      });
      return json({ status: "logged" });
    }

    if (action === "reprocess") {
      const { externalOrderId } = body;
      const { data: ext } = await supabase.from("external_orders")
        .select("id, internal_order_id").eq("id", externalOrderId).maybeSingle();
      if (!ext) return json({ error: "not found" }, 404);
      if (ext.internal_order_id) return json({ status: "already_promoted", internal_order_id: ext.internal_order_id });
      const { data: orderId, error } = await supabase.rpc("create_order_from_external", { _external_id: ext.id });
      if (error) throw error;
      await supabase.from("external_order_events").insert({
        external_order_id: ext.id, event_type: "reprocessed", payload: { internal_order_id: orderId },
      });
      return json({ status: "reprocessed", internal_order_id: orderId });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e: any) {
    console.error("external-orders-ingest error", e);
    return json({ error: e?.message ?? "internal error" }, 500);
  }
});
