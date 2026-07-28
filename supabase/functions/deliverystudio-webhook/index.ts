import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SECRET = Deno.env.get('DELIVERYSTUDIO_WEBHOOK_SECRET') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Try common signature header names used by the DeliveryStudio panel
const SIG_HEADERS = [
  'x-deliverystudio-signature',
  'x-ds-signature',
  'x-signature',
  'x-hub-signature-256',
];

const DELIVERY_ID_HEADERS = [
  'x-deliverystudio-delivery',
  'x-ds-delivery',
  'x-delivery-id',
];

async function hmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function pickHeader(req: Request, names: string[]): string | null {
  for (const n of names) {
    const v = req.headers.get(n);
    if (v) return v;
  }
  return null;
}

function parseSigHeader(raw: string): { t?: string; v1?: string } {
  // Format: "t=<epoch>,v1=<hex>" (DeliveryStudio). Fallback: "sha256=<hex>" or plain hex.
  const parts = raw.split(',').map((p) => p.trim());
  const out: { t?: string; v1?: string } = {};
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim().toLowerCase();
    const v = p.slice(eq + 1).trim();
    if (k === 't') out.t = v;
    else if (k === 'v1' || k === 'sha256') out.v1 = v.toLowerCase();
  }
  if (!out.v1) {
    // plain hex fallback
    const hex = raw.trim().toLowerCase();
    if (/^[0-9a-f]{64}$/.test(hex)) out.v1 = hex;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, service: 'deliverystudio-webhook', ts: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await req.text();
  const timestampHeader = req.headers.get('x-deliverystudio-timestamp') ?? undefined;
  const eventHeader = req.headers.get('x-deliverystudio-event') ?? undefined;
  const sourceIp =
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const EXPECTED_IPS = new Set(['187.77.45.222']);
  if (sourceIp !== 'unknown' && !EXPECTED_IPS.has(sourceIp)) {
    console.warn(`DeliveryStudio webhook: unexpected source IP ${sourceIp}`);
  }

  // Signature verification: signed payload = `${t}.${rawBody}`
  let signatureValid = false;
  const providedSig = pickHeader(req, SIG_HEADERS);
  if (SECRET && providedSig) {
    try {
      const parsed = parseSigHeader(providedSig);
      const ts = parsed.t ?? timestampHeader;
      if (parsed.v1) {
        // Preferred: t=..,v1=.. with signed payload `${t}.${body}`
        if (ts) {
          const expected = await hmacHex(SECRET, `${ts}.${rawBody}`);
          signatureValid = timingSafeEqual(expected, parsed.v1);
        }
        // Fallback: HMAC over raw body only (older/simpler schemes)
        if (!signatureValid) {
          const expectedBodyOnly = await hmacHex(SECRET, rawBody);
          signatureValid = timingSafeEqual(expectedBodyOnly, parsed.v1);
        }
      }
    } catch (_e) {
      signatureValid = false;
    }
    if (!signatureValid) {
      console.warn('DeliveryStudio webhook: invalid signature');
      return new Response(JSON.stringify({ error: 'invalid_signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else if (SECRET) {
    console.warn('DeliveryStudio webhook: missing signature header');
    return new Response(JSON.stringify({ error: 'missing_signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let envelope: any = {};
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const deliveryId =
    pickHeader(req, DELIVERY_ID_HEADERS) ||
    envelope?.deliveryId ||
    envelope?.id ||
    crypto.randomUUID();

  const event: string = eventHeader || envelope?.event || envelope?.type || 'unknown';
  const order = envelope?.order ?? envelope?.data?.order ?? envelope?.data ?? {};
  const orderPublicId: string | null = order?.publicId ?? order?.id ?? null;
  const status: string | null = order?.status ?? envelope?.status ?? null;

  // Idempotent insert
  const { error: insertErr } = await supabase
    .from('deliverystudio_webhooks')
    .insert({
      delivery_id: String(deliveryId),
      event,
      order_public_id: orderPublicId,
      status,
      payload: envelope,
      signature_valid: signatureValid,
      processed_at: new Date().toISOString(),
    });

  if (insertErr) {
    // 23505 = unique_violation -> already received (idempotent success)
    if ((insertErr as any).code === '23505') {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('DeliveryStudio webhook insert error:', insertErr);
    // Still ACK to avoid retries hammering us; log for investigation
    return new Response(JSON.stringify({ ok: true, stored: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
