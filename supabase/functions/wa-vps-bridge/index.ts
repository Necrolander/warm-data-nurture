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
          .select("id, phone, message, attempts, kind, order_id, media_url, media_type, media_mime")
          .eq("status", "pending")
          .lt("attempts", 5)
          .order("created_at", { ascending: true })
          .limit(limit);
        return json({ outbox: data ?? [] });
      }

      case "upload_media": {
        // VPS envia { phone, kind: 'image'|'audio', mime, filename, data_base64 }
        const { phone, kind, mime, filename, data_base64 } = body;
        if (!data_base64 || !filename) return json({ error: "data_base64 + filename obrigatórios" }, 400);
        const bytes = Uint8Array.from(atob(data_base64), (c) => c.charCodeAt(0));
        const path = `${kind || "media"}/${phone || "unknown"}/${Date.now()}-${filename}`;
        const { error: upErr } = await supabase.storage
          .from("wa-media")
          .upload(path, bytes, { contentType: mime || "application/octet-stream", upsert: false });
        if (upErr) return json({ error: upErr.message }, 500);
        const { data: pub } = supabase.storage.from("wa-media").getPublicUrl(path);
        return json({ ok: true, url: pub.publicUrl, path });
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
        const {
          from_phone, message, wa_message_id, customer_name,
          media_type, media_url, media_mime, location_lat, location_lng,
        } = body;
        if (!from_phone) return json({ error: "from_phone required" }, 400);

        const insertPayload: any = {
          direction: "in",
          from_phone,
          message: message || (media_type ? `[${media_type}]` : ""),
          wa_message_id,
          raw: body.raw ?? {},
        };
        if (media_type) insertPayload.media_type = media_type;
        if (media_url) insertPayload.media_url = media_url;
        if (media_mime) insertPayload.media_mime = media_mime;
        if (typeof location_lat === "number") insertPayload.location_lat = location_lat;
        if (typeof location_lng === "number") insertPayload.location_lng = location_lng;

        const { data: inserted } = await supabase
          .from("wa_messages")
          .insert(insertPayload)
          .select("id")
          .maybeSingle();

        const { data: sess } = await supabase
          .from("wa_sessions")
          .select("messages_received_total")
          .eq("channel", "whatsapp")
          .maybeSingle();
        await supabase
          .from("wa_sessions")
          .update({ messages_received_total: (sess?.messages_received_total ?? 0) + 1 })
          .eq("channel", "whatsapp");

        // Salva contato
        if (customer_name) {
          try {
            await supabase
              .from("customers")
              .upsert(
                { phone: from_phone, name: customer_name, last_order_at: new Date().toISOString() },
                { onConflict: "phone" }
              );
          } catch (_) {}
        }

        // Análise de imagem em background (não bloqueia resposta)
        if (media_type === "image" && media_url && inserted?.id) {
          fetch(`${SUPABASE_URL}/functions/v1/wa-image-analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ message_id: inserted.id, image_url: media_url }),
          }).catch((e) => console.error("wa-image-analyze trigger fail", e));
        }

        // Áudio: apenas armazena, NÃO dispara o bot (admin escuta manualmente)
        if (media_type === "audio") {
          return json({ ok: true, dispatched: false, reason: "audio_manual" });
        }

        // Localização: converte em texto "lat,lng" pro fluxo do bot processar
        let textForBot = message || "";
        if (media_type === "location" && typeof location_lat === "number" && typeof location_lng === "number") {
          textForBot = `${location_lat},${location_lng}`;
        }
        if (media_type === "image") {
          // Não dispara bot pra imagem; admin trata
          return json({ ok: true, dispatched: false, reason: "image_admin" });
        }
        if (!textForBot) return json({ ok: true, dispatched: false });

        // Despacha pro fluxo whatsapp-bot
        try {
          const url = `${SUPABASE_URL}/functions/v1/whatsapp-bot`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ phone: from_phone, message: textForBot, customer_name }),
          });
          const reply = await res.json().catch(() => ({}));
          const replyText = reply?.response || reply?.reply || reply?.notification;
          if (replyText) {
            await supabase.from("whatsapp_outbox").insert({
              phone: from_phone,
              message: replyText,
              kind: "bot_reply",
              status: "pending",
            });
          }
          return json({ ok: true, dispatched: true, has_reply: !!replyText });
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
          media_type: body.media_type ?? null,
          media_url: body.media_url ?? null,
          media_mime: body.media_mime ?? null,
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
