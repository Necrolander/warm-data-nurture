import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IFOOD_API = "https://merchant-api.ifood.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const clientId = Deno.env.get("IFOOD_CLIENT_ID");
  const clientSecret = Deno.env.get("IFOOD_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: "iFood credentials not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "poll_orders";

    // Get merchant_id from store_settings
    const { data: merchantSetting } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "ifood_merchant_id")
      .single();

    const merchantId = merchantSetting?.value;
    if (!merchantId && !["save_settings", "get_merchants"].includes(action)) {
      return new Response(JSON.stringify({ error: "Merchant ID não configurado", code: "NO_MERCHANT_ID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or refresh token
    const token = await getToken(supabase, clientId, clientSecret);

    let result: any;

    switch (action) {
      case "poll_orders":
        result = await pollOrders(supabase, token, merchantId!);
        break;
      case "poll_reviews":
        result = await pollReviews(supabase, token, merchantId!);
        break;
      case "auto_reply_reviews":
        result = await autoReplyReviews(supabase, token, merchantId!);
        break;
      case "save_settings":
        result = await saveSettings(supabase, body);
        break;
      case "get_merchants":
        result = await getMerchants(token);
        break;
      default:
        result = { error: "Unknown action" };
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("iFood sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getToken(supabase: any, clientId: string, clientSecret: string): Promise<string> {
  // Check for existing valid token
  const { data: existing } = await supabase
    .from("ifood_tokens")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing.access_token;

  // Request new token
  const resp = await fetch(`${IFOOD_API}/authentication/v1.0/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grantType=client_credentials&clientId=${clientId}&clientSecret=${clientSecret}`,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`iFood auth failed [${resp.status}]: ${errText}`);
  }

  const data = await resp.json();
  const expiresAt = new Date(Date.now() + (data.expiresIn || 21600) * 1000).toISOString();

  // Store token
  await supabase.from("ifood_tokens").insert({
    access_token: data.accessToken,
    expires_at: expiresAt,
  });

  // Clean old tokens
  await supabase.from("ifood_tokens").delete().lt("expires_at", new Date().toISOString());

  return data.accessToken;
}

async function pollOrders(supabase: any, token: string, merchantId: string) {
  // Poll events
  const resp = await fetch(`${IFOOD_API}/order/v1.0/events:polling`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const responseText = await resp.text();

  if (!resp.ok) {
    throw new Error(`iFood polling failed [${resp.status}]: ${responseText}`);
  }

  // iFood may return empty body when no events
  let events: any[] = [];
  if (responseText && responseText.trim().length > 0) {
    try {
      events = JSON.parse(responseText);
    } catch (e) {
      console.warn("Failed to parse polling response:", responseText.substring(0, 200));
      return { message: "No parseable events", orders_created: 0 };
    }
  }

  if (!Array.isArray(events) || events.length === 0) return { message: "No new events", orders_created: 0 };

  let ordersCreated = 0;
  const eventIds: string[] = [];

  for (const event of events) {
    // Skip already processed
    const { data: existing } = await supabase
      .from("ifood_events_log")
      .select("id")
      .eq("event_id", event.id)
      .single();

    if (existing) continue;

    // Log event
    await supabase.from("ifood_events_log").insert({
      event_id: event.id,
      event_type: event.code || event.fullCode,
      order_id: event.orderId,
    });

    eventIds.push(event.id);

    // Only process PLACED events (new orders)
    if (event.code === "PLACED" || event.fullCode === "PLACED") {
      try {
        const orderData = await fetchOrderDetails(token, event.orderId);
        await createOrderFromIfood(supabase, orderData);
        ordersCreated++;
      } catch (e: any) {
        console.error(`Failed to process order ${event.orderId}:`, e.message);
      }
    }
  }

  // Acknowledge events
  if (eventIds.length > 0) {
    await fetch(`${IFOOD_API}/order/v1.0/events/acknowledgment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventIds.map(id => ({ id }))),
    });
  }

  return { message: `Processed ${events.length} events`, orders_created: ordersCreated, events_count: events.length };
}

async function fetchOrderDetails(token: string, orderId: string) {
  const resp = await fetch(`${IFOOD_API}/order/v1.0/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Failed to fetch order ${orderId}`);
  return resp.json();
}

async function createOrderFromIfood(supabase: any, ifoodOrder: any) {
  const customerName = ifoodOrder.customer?.name || "Cliente iFood";
  const customerPhone = ifoodOrder.customer?.phone?.number
    ? `55${ifoodOrder.customer.phone.number}` : "0000000000";

  const items = ifoodOrder.items || [];
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice || item.price || 0), 0);
  const deliveryFee = ifoodOrder.delivery?.deliveryFee || ifoodOrder.total?.deliveryFee || 0;
  const total = ifoodOrder.total?.orderAmount || subtotal + deliveryFee;

  // Determine order type
  let orderType: "delivery" | "pickup" | "dine_in" = "delivery";
  if (ifoodOrder.orderType === "TAKEOUT" || ifoodOrder.orderType === "INDOOR") {
    orderType = ifoodOrder.orderType === "INDOOR" ? "dine_in" : "pickup";
  }

  // Determine payment method
  let paymentMethod: string | null = null;
  const payments = ifoodOrder.payments?.methods || ifoodOrder.payments || [];
  if (payments.length > 0) {
    const method = payments[0].method || payments[0].type || "";
    if (method.includes("PIX")) paymentMethod = "pix";
    else if (method.includes("CREDIT") || method.includes("CRÉDITO")) paymentMethod = "credit_card";
    else if (method.includes("DEBIT") || method.includes("DÉBITO")) paymentMethod = "debit_card";
    else if (method.includes("CASH") || method.includes("DINHEIRO")) paymentMethod = "cash";
  }

  // Create order
  const { data: order, error: orderError } = await supabase.from("orders").insert({
    customer_name: customerName,
    customer_phone: customerPhone,
    order_type: orderType,
    payment_method: paymentMethod,
    subtotal,
    delivery_fee: deliveryFee,
    total,
    order_source: "ifood",
    reference: ifoodOrder.id,
    observation: ifoodOrder.extraInfo || null,
    delivery_lat: ifoodOrder.delivery?.deliveryAddress?.coordinates?.latitude || null,
    delivery_lng: ifoodOrder.delivery?.deliveryAddress?.coordinates?.longitude || null,
    status: "pending",
  }).select("id").single();

  if (orderError) throw orderError;

  // Create order items
  const orderItems = items.map((item: any) => ({
    order_id: order.id,
    product_name: item.name,
    product_price: item.unitPrice || item.price || 0,
    quantity: item.quantity || 1,
    observation: item.observations || null,
    extras: (item.options || item.subItems || []).map((opt: any) => ({
      name: opt.name,
      price: opt.price || 0,
      quantity: opt.quantity || 1,
    })),
  }));

  if (orderItems.length > 0) {
    await supabase.from("order_items").insert(orderItems);
  }

  // Confirm order on iFood
  try {
    const token = await getTokenFromDb(supabase);
    if (token) {
      await fetch(`${IFOOD_API}/order/v1.0/orders/${ifoodOrder.id}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch (e) {
    console.error("Failed to confirm on iFood:", e);
  }

  return order;
}

async function getTokenFromDb(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("ifood_tokens")
    .select("access_token")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data?.access_token || null;
}

async function pollReviews(supabase: any, token: string, merchantId: string) {
  const resp = await fetch(`${IFOOD_API}/review/v1.0/merchants/${merchantId}/reviews?pageSize=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`iFood reviews failed [${resp.status}]: ${errText}`);
  }

  const reviews = await resp.json();
  let newCount = 0;

  for (const review of (reviews || [])) {
    const { data: existing } = await supabase
      .from("ifood_reviews")
      .select("id")
      .eq("review_id", review.id)
      .single();

    if (!existing) {
      await supabase.from("ifood_reviews").insert({
        review_id: review.id,
        merchant_id: merchantId,
        order_id: review.orderId || null,
        customer_name: review.customerName || null,
        rating: review.rating || null,
        comment: review.comment || null,
      });
      newCount++;
    }
  }

  return { message: `Found ${newCount} new reviews`, total: (reviews || []).length };
}

async function autoReplyReviews(supabase: any, token: string, merchantId: string) {
  // Get auto-reply templates from store_settings
  const { data: positiveSetting } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "ifood_review_positive_reply")
    .single();

  const { data: negativeSetting } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "ifood_review_negative_reply")
    .single();

  const positiveReply = positiveSetting?.value || "Obrigado pela avaliação! 😊 Ficamos felizes que gostou. Esperamos você novamente!";
  const negativeReply = negativeSetting?.value || "Sentimos muito pela sua experiência. Vamos melhorar! Entre em contato conosco para resolvermos.";

  // Get unresponded reviews
  const { data: pendingReviews } = await supabase
    .from("ifood_reviews")
    .select("*")
    .eq("response_sent", false)
    .not("comment", "is", null);

  let repliedCount = 0;

  for (const review of (pendingReviews || [])) {
    const isPositive = (review.rating || 0) >= 4;
    const replyText = isPositive ? positiveReply : negativeReply;

    // Replace placeholders
    const finalReply = replyText
      .replace("{nome}", review.customer_name || "Cliente")
      .replace("{nota}", String(review.rating || ""));

    try {
      const resp = await fetch(
        `${IFOOD_API}/review/v1.0/merchants/${merchantId}/reviews/${review.review_id}/answers`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description: finalReply }),
        }
      );

      if (resp.ok) {
        await supabase.from("ifood_reviews").update({
          response_sent: true,
          response_text: finalReply,
          responded_at: new Date().toISOString(),
        }).eq("id", review.id);
        repliedCount++;
      } else {
        const errText = await resp.text();
        console.error(`Failed to reply review ${review.review_id}: ${errText}`);
      }
    } catch (e: any) {
      console.error(`Error replying review:`, e.message);
    }
  }

  return { replied: repliedCount, pending: (pendingReviews || []).length };
}

async function saveSettings(supabase: any, body: any) {
  const settings = body.settings || {};
  for (const [key, value] of Object.entries(settings)) {
    await supabase.from("store_settings").upsert(
      { key, value: String(value) },
      { onConflict: "key" }
    );
  }
  return { success: true };
}

async function getMerchants(token: string) {
  const resp = await fetch(`${IFOOD_API}/merchant/v1.0/merchants`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`iFood merchants failed [${resp.status}]: ${errText}`);
  }
  return resp.json();
}
