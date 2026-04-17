// Bridge entre o worker WhatsApp na VPS e o Lovable Cloud.
// Endpoints POST com { action, ... } usando Bearer IFOOD_BOT_TOKEN (mesmo token do bot iFood).
//
// Actions:
//  - get_session_state           → retorna se deve gerar QR ou já está conectado
//  - update_session              → status, qr_code, phone_number, display_name
//  - get_outbox                  → próximas mensagens pra enviar (pending, attempts<3)
//  - mark_outbox_sent            → status='sent' | 'failed'
//  - log_incoming_message        → registra mensagem recebida + dispara fluxo whatsapp-bot
//  - log_outgoing_message        → registra envio pra auditoria
//  - heartbeat                   → atualiza last_seen_at + counters
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("IFOOD_BOT_TOKEN")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth simples por bearer (mesmo BOT_TOKEN do iFood)
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.slice(7) !== BOT_TOKEN) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = body.action;

  try {
    switch (action) {
      case "get_session_state": {
        const { data } = await supabase
          .from("wa_sessions")
          .select("status, phone_number")
          .eq("channel", "whatsapp")
          .maybeSingle();
        return json({ status: data?.status || "disconnected", phone_number: data?.phone_number });
      }

      case "update_session": {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        const allowed = ["status", "qr_code", "phone_number", "display_name", "last_event"];
        for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
        if (body.qr_code) patch.qr_generated_at = new Date().toISOString();
        if (body.status === "connected") patch.last_seen_at = new Date().toISOString();
        await supabase.from("wa_sessions").update(patch).eq("channel", "whatsapp");
        return json({ ok: true });
      }

      case "heartbeat": {
        const inc: Record<string, unknown> = {
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (body.status) inc.status = body.status;
        await supabase.from("wa_sessions").update(inc).eq("channel", "whatsapp");
        return json({ ok: true });
      }

      case "get_outbox": {
        const limit = Math.min(Number(body.limit ?? 10), 50);
        const { data } = await supabase
          .from("whatsapp_outbox")
          .select("id, phone, message, attempts, kind, order_id")
          .eq("status", "pending")
          .lt("attempts", 5)
          .order("created_at", { ascending: true })
          .limit(limit);
        return json({ outbox: data ?? [] });
      }

      case "mark_outbox_sent": {
        const { id, success, error, wa_message_id } = body;
        if (!id) return json({ error: "id required" }, 400);

        if (success) {
          await supabase
            .from("whatsapp_outbox")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              attempts: (body.attempts ?? 0) + 1,
            })
            .eq("id", id);

          // Log + counter
          await supabase.from("wa_messages").insert({
            direction: "out",
            to_phone: body.phone,
            message: body.message,
            wa_message_id,
            outbox_id: id,
            related_order_id: body.order_id ?? null,
          });
          await supabase.rpc("execute_sql" as never, {} as never).catch(() => {});
          // Increment counter via direct SQL not allowed → fetch + update
          const { data: sess } = await supabase
            .from("wa_sessions")
            .select("messages_sent_total")
            .eq("channel", "whatsapp")
            .maybeSingle();
          await supabase
            .from("wa_sessions")
            .update({ messages_sent_total: (sess?.messages_sent_total ?? 0) + 1 })
            .eq("channel", "whatsapp");
        } else {
          await supabase
            .from("whatsapp_outbox")
            .update({
              status: "failed",
              last_error: error?.slice?.(0, 500) ?? "unknown",
              attempts: (body.attempts ?? 0) + 1,
            })
            .eq("id", id);
        }
        return json({ ok: true });
      }

      case "log_incoming_message": {
        const { from_phone, message, wa_message_id, customer_name } = body;
        if (!from_phone || !message) return json({ error: "from_phone+message required" }, 400);

        await supabase.from("wa_messages").insert({
          direction: "in",
          from_phone,
          message,
          wa_message_id,
          raw: body.raw ?? {},
        });
        const { data: sess } = await supabase
          .from("wa_sessions")
          .select("messages_received_total")
          .eq("channel", "whatsapp")
          .maybeSingle();
        await supabase
          .from("wa_sessions")
          .update({ messages_received_total: (sess?.messages_received_total ?? 0) + 1 })
          .eq("channel", "whatsapp");

        // Despacha pro fluxo whatsapp-bot existente (cardápio + IA + pedidos)
        try {
          const url = `${SUPABASE_URL}/functions/v1/whatsapp-bot`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ phone: from_phone, message, customer_name }),
          });
          const reply = await res.json().catch(() => ({}));
          // Se o whatsapp-bot retornou uma resposta, enfileira pra envio
          if (reply?.reply) {
            await supabase.from("whatsapp_outbox").insert({
              phone: from_phone,
              message: reply.reply,
              kind: "bot_reply",
              status: "pending",
            });
          }
          return json({ ok: true, dispatched: true, has_reply: !!reply?.reply });
        } catch (e) {
          return json({ ok: true, dispatched: false, error: String(e).slice(0, 200) });
        }
      }

      case "log_outgoing_message": {
        await supabase.from("wa_messages").insert({
          direction: "out",
          to_phone: body.to_phone,
          message: body.message,
          wa_message_id: body.wa_message_id,
          related_order_id: body.related_order_id ?? null,
        });
        return json({ ok: true });
      }

      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    console.error("wa-vps-bridge error:", e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
