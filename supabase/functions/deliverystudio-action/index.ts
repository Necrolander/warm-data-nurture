import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const API_BASE = 'https://api.deliverystudio.com.br/v1';
const TOKEN = Deno.env.get('DELIVERYSTUDIO_API_TOKEN') ?? '';

const VALID_ACTIONS = new Set(['accept', 'preparing', 'ready', 'dispatch', 'deliver']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Require an authenticated admin from the app
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
    authHeader.replace('Bearer ', ''),
  );
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: isAdmin } = await supabase.rpc('has_role', {
    _user_id: claims.claims.sub,
    _role: 'admin',
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!TOKEN) {
    return new Response(JSON.stringify({ error: 'missing_api_token' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const orderPublicId = String(body?.orderPublicId ?? '').trim();
  const action = String(body?.action ?? '').trim();
  const reason = body?.reason ? String(body.reason) : undefined;
  const notifyCustomer = typeof body?.notifyCustomer === 'boolean' ? body.notifyCustomer : undefined;

  if (!orderPublicId) {
    return new Response(JSON.stringify({ error: 'orderPublicId_required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let url: string;
  let payload: Record<string, unknown>;

  if (action === 'cancel') {
    url = `${API_BASE}/integrations/orders/${encodeURIComponent(orderPublicId)}/cancel`;
    payload = { reason: reason ?? '', notifyCustomer: notifyCustomer ?? false };
  } else if (VALID_ACTIONS.has(action)) {
    url = `${API_BASE}/integrations/orders/${encodeURIComponent(orderPublicId)}/transition`;
    payload = { action };
  } else {
    return new Response(JSON.stringify({ error: 'invalid_action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }

  if (!upstream.ok) {
    console.error(`DeliveryStudio action ${action} failed [${upstream.status}]`, text);
    return new Response(
      JSON.stringify({ error: 'upstream_error', status: upstream.status, details: parsed }),
      { status: upstream.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ ok: true, data: parsed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
