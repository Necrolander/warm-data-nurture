import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.3";
import { jwtVerify } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tokenSecret = new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "driver-session-secret");
const MAX_ACTIVE_ORDERS = 3;

const BaseSchema = z.object({
  action: z.string().min(1),
  token: z.string().min(20),
});

const SetOnlineSchema = z.object({
  action: z.literal("set_online"),
  token: z.string().min(20),
  online: z.boolean(),
});

const LocationSchema = z.object({
  action: z.literal("location_update"),
  token: z.string().min(20),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const StartDeliverySchema = z.object({
  action: z.literal("start_delivery"),
  token: z.string().min(20),
  orderId: z.string().uuid(),
});

const CompleteDeliverySchema = z.object({
  action: z.literal("complete_delivery"),
  token: z.string().min(20),
  orderId: z.string().uuid(),
  confirmCode: z.string().trim().min(4).max(8),
});

const CompleteRouteSchema = z.object({
  action: z.literal("complete_route"),
  token: z.string().min(20),
  routeId: z.string().uuid().optional(),
});

const ReportIssueSchema = z.object({
  action: z.literal("report_issue"),
  token: z.string().min(20),
  orderId: z.string().uuid(),
  issueType: z.string().min(1).max(80),
});

const ChatListSchema = z.object({
  action: z.literal("chat_list"),
  token: z.string().min(20),
  orderId: z.string().uuid().nullable().optional(),
});

const ChatSendSchema = z.object({
  action: z.literal("chat_send"),
  token: z.string().min(20),
  orderId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(1000),
  isEmergency: z.boolean().optional(),
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyDriverToken(token: string) {
  const { payload } = await jwtVerify(token, tokenSecret);
  if (payload.role !== "delivery_driver" || typeof payload.sub !== "string") {
    throw new Error("Sessão do entregador inválida");
  }
  return {
    driverId: payload.sub,
    name: typeof payload.name === "string" ? payload.name : "Entregador",
  };
}

async function invokeWhatsAppBot(payload: Record<string, unknown>) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-bot`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best effort only.
  }
}

async function getDriverRecord(supabaseAdmin: ReturnType<typeof createClient>, driverId: string) {
  const { data: driver, error } = await supabaseAdmin
    .from("delivery_persons")
    .select("*")
    .eq("id", driverId)
    .single();

  if (error || !driver || !driver.is_active) {
    throw new Error("Entregador não encontrado ou inativo");
  }

  return driver;
}

async function syncDriverOperationalState(
  supabaseAdmin: ReturnType<typeof createClient>,
  driverId: string,
  onlineOverride?: boolean,
) {
  const driver = await getDriverRecord(supabaseAdmin, driverId);
  const isOnline = onlineOverride ?? Boolean(driver.is_online);

  const [{ count: activeRoutes }, { count: activeOrders }, { data: routeRow }] = await Promise.all([
    supabaseAdmin
      .from("routes")
      .select("id", { head: true, count: "exact" })
      .eq("driver_id", driverId)
      .in("status", ["assigned", "in_delivery"]),
    supabaseAdmin
      .from("orders")
      .select("id", { head: true, count: "exact" })
      .eq("delivery_person_id", driverId)
      .in("status", ["ready", "out_for_delivery"]),
    supabaseAdmin
      .from("routes")
      .select("id")
      .eq("driver_id", driverId)
      .in("status", ["assigned", "in_delivery"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const status = !isOnline
    ? "offline"
    : (activeRoutes || 0) > 0 || (activeOrders || 0) > 0
      ? "on_route"
      : "available";

  await supabaseAdmin
    .from("delivery_persons")
    .update({
      is_online: isOnline,
      status,
      current_route_id: routeRow?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", driverId);

  return { is_online: isOnline, status, current_route_id: routeRow?.id ?? null };
}

async function buildDashboardData(supabaseAdmin: ReturnType<typeof createClient>, driverId: string) {
  const driver = await getDriverRecord(supabaseAdmin, driverId);

  const [{ data: currentOrders }, { data: activeRouteRows }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("*")
      .eq("delivery_person_id", driverId)
      .in("status", ["ready", "out_for_delivery"])
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("routes")
      .select("*")
      .eq("driver_id", driverId)
      .in("status", ["assigned", "in_delivery"])
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const currentOrderIds = (currentOrders || []).map((order) => order.id);
  const currentOrderItems: Record<string, unknown[]> = {};

  if (currentOrderIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .in("order_id", currentOrderIds);

    for (const item of items || []) {
      if (!currentOrderItems[item.order_id]) currentOrderItems[item.order_id] = [];
      currentOrderItems[item.order_id].push(item);
    }
  }

  const activeRoute = activeRouteRows?.[0] || null;
  let routeStops: Array<Record<string, unknown>> = [];
  let currentStopIndex = 0;

  if (activeRoute) {
    const { data: stops } = await supabaseAdmin
      .from("route_orders")
      .select("*")
      .eq("route_id", activeRoute.id)
      .order("stop_order");

    const routeOrderIds = (stops || []).map((stop) => stop.order_id);
    const [{ data: routeOrders }, { data: routeItems }] = await Promise.all([
      routeOrderIds.length > 0
        ? supabaseAdmin.from("orders").select("*").in("id", routeOrderIds)
        : Promise.resolve({ data: [] as any[] }),
      routeOrderIds.length > 0
        ? supabaseAdmin.from("order_items").select("*").in("order_id", routeOrderIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    routeStops = (stops || []).map((stop) => ({
      ...stop,
      order: (routeOrders || []).find((order) => order.id === stop.order_id) || null,
      items: (routeItems || []).filter((item) => item.order_id === stop.order_id),
    }));

    const firstPending = routeStops.findIndex((stop) => (stop.order as Record<string, unknown> | null)?.status !== "delivered");
    currentStopIndex = firstPending >= 0 ? firstPending : routeStops.length;
  }

  let availableOrders: unknown[] = [];
  const availableOrderItems: Record<string, unknown[]> = {};

  if (driver.is_online) {
    const { data } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("status", "ready")
      .is("delivery_person_id", null)
      .eq("order_type", "delivery")
      .order("created_at", { ascending: true });

    availableOrders = data || [];
    const availableOrderIds = (availableOrders as Array<Record<string, unknown>>).map((order) => String(order.id));

    if (availableOrderIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("*")
        .in("order_id", availableOrderIds);

      for (const item of items || []) {
        if (!availableOrderItems[item.order_id]) availableOrderItems[item.order_id] = [];
        availableOrderItems[item.order_id].push(item);
      }
    }
  }

  return {
    driver,
    currentOrders: currentOrders || [],
    currentOrderItems,
    availableOrders,
    availableOrderItems,
    activeRoute,
    routeStops,
    currentStopIndex,
  };
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => null);
    const parsedBase = BaseSchema.safeParse(body);

    if (!parsedBase.success) {
      return response({ error: "Requisição inválida" }, 400);
    }

    const { driverId } = await verifyDriverToken(parsedBase.data.token);

    switch (parsedBase.data.action) {
      case "dashboard": {
        const dashboard = await buildDashboardData(supabaseAdmin, driverId);
        return response(dashboard);
      }

      case "set_online": {
        const parsed = SetOnlineSchema.safeParse(body);
        if (!parsed.success) return response({ error: "Dados inválidos" }, 400);

        await syncDriverOperationalState(supabaseAdmin, driverId, parsed.data.online);
        const dashboard = await buildDashboardData(supabaseAdmin, driverId);
        return response(dashboard);
      }

      case "location_update": {
        const parsed = LocationSchema.safeParse(body);
        if (!parsed.success) return response({ error: "Localização inválida" }, 400);

        await getDriverRecord(supabaseAdmin, driverId);

        await supabaseAdmin.from("delivery_persons").update({
          current_lat: parsed.data.latitude,
          current_lng: parsed.data.longitude,
          location_updated_at: new Date().toISOString(),
        }).eq("id", driverId);

        await supabaseAdmin.from("driver_locations").insert({
          driver_id: driverId,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
        });

        const { data: activeOrders } = await supabaseAdmin
          .from("orders")
          .select("id, order_number, delivery_lat, delivery_lng, arrived_at_destination")
          .eq("delivery_person_id", driverId)
          .eq("status", "out_for_delivery");

        const arrivedOrderNumbers: number[] = [];

        for (const order of activeOrders || []) {
          await supabaseAdmin
            .from("delivery_tracking")
            .update({ current_lat: parsed.data.latitude, current_lng: parsed.data.longitude })
            .eq("order_id", order.id)
            .eq("is_active", true);

          if (
            order.delivery_lat &&
            order.delivery_lng &&
            !order.arrived_at_destination &&
            distanceMeters(parsed.data.latitude, parsed.data.longitude, order.delivery_lat, order.delivery_lng) <= 50
          ) {
            await supabaseAdmin
              .from("orders")
              .update({ arrived_at_destination: true })
              .eq("id", order.id);

            arrivedOrderNumbers.push(order.order_number);
            await invokeWhatsAppBot({ action: "notify_status", order_id: order.id, new_status: "arrived" });
          }
        }

        return response({ success: true, arrivedOrderNumbers });
      }

      case "start_delivery": {
        const parsed = StartDeliverySchema.safeParse(body);
        if (!parsed.success) return response({ error: "Pedido inválido" }, 400);

        await getDriverRecord(supabaseAdmin, driverId);

        const [{ data: order }, { count: activeCount }] = await Promise.all([
          supabaseAdmin
            .from("orders")
            .select("id, status, order_number, order_type, delivery_person_id, delivery_code")
            .eq("id", parsed.data.orderId)
            .single(),
          supabaseAdmin
            .from("orders")
            .select("id", { head: true, count: "exact" })
            .eq("delivery_person_id", driverId)
            .in("status", ["ready", "out_for_delivery"]),
        ]);

        if (!order || order.order_type !== "delivery") {
          return response({ error: "Pedido não disponível para entrega" }, 400);
        }

        if (order.delivery_person_id && order.delivery_person_id !== driverId) {
          return response({ error: "Este pedido já foi atribuído a outro motoboy" }, 409);
        }

        if (!["ready", "out_for_delivery"].includes(order.status)) {
          return response({ error: "Pedido não está pronto para entrega" }, 400);
        }

        const activeOrdersCount = (activeCount || 0) - (order.delivery_person_id === driverId ? 1 : 0);
        if (activeOrdersCount >= MAX_ACTIVE_ORDERS) {
          return response({ error: `Máximo de ${MAX_ACTIVE_ORDERS} pedidos ativos atingido` }, 409);
        }

        const deliveryCode = order.delivery_code || String(Math.floor(1000 + Math.random() * 9000));

        await supabaseAdmin.from("orders").update({
          delivery_person_id: driverId,
          status: "out_for_delivery",
          checklist_confirmed: true,
          delivery_code: deliveryCode,
        }).eq("id", order.id);

        const { data: existingTracking } = await supabaseAdmin
          .from("delivery_tracking")
          .select("id")
          .eq("order_id", order.id)
          .eq("is_active", true)
          .maybeSingle();

        if (!existingTracking) {
          await supabaseAdmin.from("delivery_tracking").insert({
            order_id: order.id,
            delivery_person_id: driverId,
            is_active: true,
          });
        }

        await syncDriverOperationalState(supabaseAdmin, driverId, true);
        await invokeWhatsAppBot({ action: "notify_status", order_id: order.id, new_status: "out_for_delivery" });
        await invokeWhatsAppBot({ action: "notify_status", order_id: order.id, new_status: "delivery_code", delivery_code: deliveryCode });

        const dashboard = await buildDashboardData(supabaseAdmin, driverId);
        return response({ success: true, deliveryCode, ...dashboard });
      }

      case "complete_delivery": {
        const parsed = CompleteDeliverySchema.safeParse(body);
        if (!parsed.success) return response({ error: "Código de confirmação inválido" }, 400);

        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, order_number, delivery_person_id, delivery_code, route_id")
          .eq("id", parsed.data.orderId)
          .single();

        if (!order || order.delivery_person_id !== driverId) {
          return response({ error: "Pedido não pertence a este motoboy" }, 403);
        }

        if ((order.delivery_code || "") !== parsed.data.confirmCode.trim()) {
          return response({ error: "Código incorreto! Peça o código correto ao cliente." }, 400);
        }

        await supabaseAdmin.from("orders").update({ status: "delivered" }).eq("id", order.id);
        await supabaseAdmin.from("delivery_tracking").update({ is_active: false }).eq("order_id", order.id);

        const { data: existingHistory } = await supabaseAdmin
          .from("delivery_history")
          .select("id")
          .eq("order_id", order.id)
          .limit(1)
          .maybeSingle();

        if (!existingHistory) {
          await supabaseAdmin.from("delivery_history").insert({
            order_id: order.id,
            route_id: order.route_id,
            driver_id: driverId,
          });
        }

        await syncDriverOperationalState(supabaseAdmin, driverId, true);
        await invokeWhatsAppBot({ action: "notify_status", order_id: order.id, new_status: "delivered" });

        const dashboard = await buildDashboardData(supabaseAdmin, driverId);
        return response({ success: true, orderNumber: order.order_number, ...dashboard });
      }

      case "complete_route": {
        const parsed = CompleteRouteSchema.safeParse(body);
        if (!parsed.success) return response({ error: "Rota inválida" }, 400);

        let routeId = parsed.data.routeId;
        if (!routeId) {
          const { data: route } = await supabaseAdmin
            .from("routes")
            .select("id")
            .eq("driver_id", driverId)
            .in("status", ["assigned", "in_delivery"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          routeId = route?.id;
        }

        if (routeId) {
          await supabaseAdmin.from("routes").update({ status: "completed" }).eq("id", routeId).eq("driver_id", driverId);
        }

        await syncDriverOperationalState(supabaseAdmin, driverId, true);
        const dashboard = await buildDashboardData(supabaseAdmin, driverId);
        return response({ success: true, ...dashboard });
      }

      case "report_issue": {
        const parsed = ReportIssueSchema.safeParse(body);
        if (!parsed.success) return response({ error: "Dados inválidos" }, 400);

        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, delivery_person_id")
          .eq("id", parsed.data.orderId)
          .single();

        if (!order || order.delivery_person_id !== driverId) {
          return response({ error: "Pedido não pertence a este motoboy" }, 403);
        }

        await supabaseAdmin.from("delivery_issues").insert({
          order_id: parsed.data.orderId,
          delivery_person_id: driverId,
          issue_type: parsed.data.issueType,
        });

        return response({ success: true });
      }

      case "history": {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data } = await supabaseAdmin
          .from("orders")
          .select("*")
          .eq("delivery_person_id", driverId)
          .eq("status", "delivered")
          .gte("created_at", today.toISOString())
          .order("created_at", { ascending: false });

        return response({ orders: data || [] });
      }

      case "chat_list": {
        const parsed = ChatListSchema.safeParse(body);
        if (!parsed.success) return response({ error: "Dados inválidos" }, 400);

        let query = supabaseAdmin
          .from("driver_messages")
          .select("*")
          .eq("driver_id", driverId)
          .order("created_at", { ascending: true })
          .limit(100);

        if (parsed.data.orderId) {
          query = query.eq("order_id", parsed.data.orderId);
        }

        const { data: messages } = await query;
        const unreadAdminIds = (messages || [])
          .filter((message) => message.sender === "admin" && !message.read_by_driver)
          .map((message) => message.id);

        if (unreadAdminIds.length > 0) {
          await supabaseAdmin.from("driver_messages").update({ read_by_driver: true }).in("id", unreadAdminIds);
        }

        return response({ messages: (messages || []).map((message) => ({ ...message, read_by_driver: true })) });
      }

      case "chat_send": {
        const parsed = ChatSendSchema.safeParse(body);
        if (!parsed.success) return response({ error: "Mensagem inválida" }, 400);

        const { data: message, error } = await supabaseAdmin
          .from("driver_messages")
          .insert({
            driver_id: driverId,
            order_id: parsed.data.orderId || null,
            sender: "driver",
            message: parsed.data.message.trim(),
            is_emergency: parsed.data.isEmergency || false,
          })
          .select("*")
          .single();

        if (error) return response({ error: "Não foi possível enviar a mensagem" }, 500);
        return response({ success: true, message });
      }

      default:
        return response({ error: "Ação inválida" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno no app do entregador";
    const status = /inválida|inválido|não encontrado|inativo|expirou/i.test(message) ? 401 : 500;
    return response({ error: message }, status);
  }
});
