import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { phone, message, customer_name } = await req.json();
    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create session
    let { data: session } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("phone", phone)
      .eq("is_active", true)
      .single();

    if (!session) {
      const { data: newSession } = await supabase
        .from("chat_sessions")
        .insert({ phone, customer_name: customer_name || null, state: "greeting" })
        .select()
        .single();
      session = newSession;
    }

    if (!session) {
      return new Response(JSON.stringify({ error: "Failed to create session" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log incoming message
    await supabase.from("chat_messages").insert({
      session_id: session.id, direction: "incoming", message,
    });

    // Update last message timestamp
    await supabase.from("chat_sessions").update({ last_message_at: new Date().toISOString() }).eq("id", session.id);

    // Fetch store data for bot
    const [categoriesRes, productsRes, settingsRes, scheduleRes] = await Promise.all([
      supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("products").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("store_settings").select("*"),
      supabase.from("store_schedule").select("*").order("day_of_week"),
    ]);

    const categories = categoriesRes.data || [];
    const products = productsRes.data || [];
    const settings: Record<string, string> = {};
    (settingsRes.data || []).forEach((s: any) => { settings[s.key] = s.value; });
    const schedule = scheduleRes.data || [];

    // Check store open
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const todaySchedule = schedule.find((s: any) => s.day_of_week === dayOfWeek);
    const isStoreOpen = settings.store_open !== "false" && todaySchedule?.is_open && currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;

    // Process message based on state
    const response = await processMessage(supabase, session, message, categories, products, settings, isStoreOpen);

    // Log outgoing message
    await supabase.from("chat_messages").insert({
      session_id: session.id, direction: "outgoing", message: response,
    });

    return new Response(JSON.stringify({ response, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Bot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processMessage(
  supabase: any, session: any, message: string,
  categories: any[], products: any[], settings: Record<string, string>,
  isStoreOpen: boolean
): Promise<string> {
  const msg = message.trim().toLowerCase();
  const state = session.state;
  const cart: any[] = session.cart || [];

  // Global commands (work in any state)
  if (["0", "voltar", "inicio", "menu", "oi", "olá", "ola", "hi"].includes(msg)) {
    await updateSession(supabase, session.id, { state: "greeting" });
    return getGreeting(session.customer_name, isStoreOpen);
  }

  if (["5", "atendente", "humano", "ajuda"].includes(msg)) {
    await updateSession(supabase, session.id, { state: "human" });
    return "👤 Um atendente humano vai te responder em breve!\n\nAguarde um momento, por favor. 🙏";
  }

  switch (state) {
    case "greeting":
      return await handleGreeting(supabase, session, msg, categories, products, settings, isStoreOpen);
    case "menu_categories":
      return await handleMenuCategories(supabase, session, msg, categories, products);
    case "menu_items":
      return await handleMenuItems(supabase, session, msg, products, categories);
    case "item_quantity":
      return await handleItemQuantity(supabase, session, msg, products);
    case "cart_review":
      return await handleCartReview(supabase, session, msg, categories, products, settings);
    case "address":
      return await handleAddress(supabase, session, msg);
    case "location":
      return await handleLocation(supabase, session, msg);
    case "payment":
      return await handlePayment(supabase, session, msg, settings);
    case "confirm":
      return await handleConfirm(supabase, session, msg, settings);
    case "human":
      return "⏳ Aguardando atendente humano...\n\nDigite *0* para voltar ao menu automático.";
    default:
      await updateSession(supabase, session.id, { state: "greeting" });
      return getGreeting(session.customer_name, isStoreOpen);
  }
}

function getGreeting(name: string | null, isStoreOpen: boolean): string {
  const status = isStoreOpen ? "🟢 *Estamos abertos!*" : "🔴 *Estamos fechados no momento*";
  return `Olá${name ? ` ${name}` : ""} 👋 Bem-vindo à *Truebox Hamburgueria*!\n\n${status}\n\nPosso te ajudar com:\n\n1️⃣ Fazer um pedido\n2️⃣ Ver cardápio\n3️⃣ Promoções do dia\n4️⃣ Acompanhar pedido\n5️⃣ Falar com atendente\n\nDigite o *número* da opção desejada.`;
}

async function handleGreeting(
  supabase: any, session: any, msg: string,
  categories: any[], products: any[], settings: Record<string, string>, isStoreOpen: boolean
): Promise<string> {
  switch (msg) {
    case "1": // Fazer pedido
      if (!isStoreOpen) return "😕 Estamos fechados no momento. Volte no nosso horário de funcionamento!\n\nDigite *0* para voltar.";
      await updateSession(supabase, session.id, { state: "menu_categories", cart: [] });
      return buildCategoryMenu(categories);
    case "2": // Ver cardápio
      await updateSession(supabase, session.id, { state: "menu_categories" });
      return buildCategoryMenu(categories);
    case "3": // Promoções
      return "🔥 *Promoções do dia:*\n\n🍔 Quarta do Clone - Compre 1 e ganhe outro!\n🎉 Combos a partir de R$49,90\n\nDigite *1* para fazer um pedido ou *0* para voltar.";
    case "4": // Acompanhar pedido
      if (session.order_id) {
        const { data: order } = await supabase.from("orders").select("*").eq("id", session.order_id).single();
        if (order) {
          const statusMap: Record<string, string> = {
            pending: "⏳ Aguardando confirmação",
            production: "🍳 Em preparo",
            ready: "✅ Pronto!",
            out_for_delivery: "🛵 Saiu para entrega",
            delivered: "📦 Entregue",
            cancelled: "❌ Cancelado",
          };
          return `📋 *Pedido #${order.order_number}*\n\nStatus: ${statusMap[order.status] || order.status}\n\nDigite *0* para voltar.`;
        }
      }
      return "🤔 Não encontrei nenhum pedido recente.\n\nDigite *1* para fazer um novo pedido ou *0* para voltar.";
    default:
      return getGreeting(session.customer_name, isStoreOpen);
  }
}

function buildCategoryMenu(categories: any[]): string {
  const deliveryCategories = categories.filter((c: any) => true); // All categories for now
  let text = "📋 *Nosso Cardápio*\n\nEscolha uma categoria:\n\n";
  deliveryCategories.forEach((cat: any, i: number) => {
    text += `${i + 1}️⃣ ${cat.icon || ""} ${cat.name}\n`;
  });
  text += "\nDigite o *número* da categoria ou *0* para voltar.";
  return text;
}

async function handleMenuCategories(
  supabase: any, session: any, msg: string,
  categories: any[], products: any[]
): Promise<string> {
  const idx = parseInt(msg) - 1;
  if (isNaN(idx) || idx < 0 || idx >= categories.length) {
    return "⚠️ Opção inválida. " + buildCategoryMenu(categories);
  }
  const cat = categories[idx];
  const catProducts = products.filter((p: any) => p.category === cat.slug &&
    (!p.visibility_channels || p.visibility_channels.length === 0 || p.visibility_channels.includes("delivery")));

  if (catProducts.length === 0) {
    return `😕 Nenhum produto disponível em *${cat.name}* no momento.\n\n` + buildCategoryMenu(categories);
  }

  await updateSession(supabase, session.id, { state: "menu_items", selected_category: cat.slug });

  let text = `${cat.icon || "📦"} *${cat.name}*\n\n`;
  catProducts.forEach((p: any, i: number) => {
    text += `${i + 1}. *${p.name}*\n`;
    if (p.description) text += `   ${p.description.substring(0, 60)}\n`;
    text += `   💰 R$ ${Number(p.price).toFixed(2).replace(".", ",")}\n\n`;
  });
  text += "Digite o *número* do item para adicionar ao pedido.\nDigite *0* para voltar às categorias.";
  return text;
}

async function handleMenuItems(
  supabase: any, session: any, msg: string,
  products: any[], categories: any[]
): Promise<string> {
  if (msg === "0") {
    await updateSession(supabase, session.id, { state: "menu_categories", selected_category: null });
    return buildCategoryMenu(categories);
  }

  const catProducts = products.filter((p: any) => p.category === session.selected_category &&
    (!p.visibility_channels || p.visibility_channels.length === 0 || p.visibility_channels.includes("delivery")));

  const idx = parseInt(msg) - 1;
  if (isNaN(idx) || idx < 0 || idx >= catProducts.length) {
    return "⚠️ Opção inválida. Digite o número do produto ou *0* para voltar.";
  }

  const product = catProducts[idx];
  const cart = session.cart || [];
  cart.push({
    product_id: product.id,
    name: product.name,
    price: Number(product.price),
    quantity: 1,
  });

  await updateSession(supabase, session.id, { cart, state: "cart_review" });

  return `✅ *${product.name}* adicionado!\n\n` + buildCartSummary(cart) +
    "\n\nO que deseja fazer?\n\n➕ Digite *mais* para adicionar outro item\n❌ Digite *remover [número]* para remover item\n✅ Digite *finalizar* para fechar o pedido\n0️⃣ Digite *0* para cancelar tudo";
}

async function handleItemQuantity(
  supabase: any, session: any, msg: string, products: any[]
): Promise<string> {
  // Redirect to cart review
  await updateSession(supabase, session.id, { state: "cart_review" });
  return await handleCartReview(supabase, session, msg, [], products, {});
}

function buildCartSummary(cart: any[]): string {
  if (cart.length === 0) return "🛒 Carrinho vazio";
  let text = "🛒 *Seu Pedido:*\n\n";
  let total = 0;
  cart.forEach((item: any, i: number) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    text += `${i + 1}. ${item.quantity}x ${item.name} — R$ ${subtotal.toFixed(2).replace(".", ",")}\n`;
  });
  text += `\n💰 *Total: R$ ${total.toFixed(2).replace(".", ",")}*`;
  return text;
}

async function handleCartReview(
  supabase: any, session: any, msg: string,
  categories: any[], products: any[], settings: Record<string, string>
): Promise<string> {
  const cart = session.cart || [];

  if (msg === "mais" || msg === "+") {
    await updateSession(supabase, session.id, { state: "menu_categories" });
    return buildCategoryMenu(categories);
  }

  if (msg.startsWith("remover")) {
    const numStr = msg.replace("remover", "").trim();
    const num = parseInt(numStr) - 1;
    if (!isNaN(num) && num >= 0 && num < cart.length) {
      const removed = cart.splice(num, 1)[0];
      await updateSession(supabase, session.id, { cart });
      if (cart.length === 0) {
        await updateSession(supabase, session.id, { state: "greeting" });
        return `❌ *${removed.name}* removido. Carrinho vazio!\n\nDigite *1* para fazer um novo pedido.`;
      }
      return `❌ *${removed.name}* removido!\n\n` + buildCartSummary(cart) +
        "\n\n➕ *mais* — adicionar item\n❌ *remover [nº]* — remover item\n✅ *finalizar* — fechar pedido";
    }
    return "⚠️ Número inválido. " + buildCartSummary(cart);
  }

  if (msg === "finalizar" || msg === "fechar" || msg === "ok") {
    if (cart.length === 0) return "🛒 Carrinho vazio! Digite *1* para fazer um pedido.";
    await updateSession(supabase, session.id, { state: "address" });
    return buildCartSummary(cart) + "\n\n📍 *Agora preciso do seu endereço de entrega.*\n\nEnvie o endereço completo (Rua, Número, Bairro):";
  }

  return buildCartSummary(cart) +
    "\n\n➕ *mais* — adicionar item\n❌ *remover [nº]* — remover item\n✅ *finalizar* — fechar pedido\n0️⃣ *0* — cancelar tudo";
}

async function handleAddress(supabase: any, session: any, msg: string): Promise<string> {
  if (msg.length < 5) {
    return "⚠️ Endereço muito curto. Por favor, envie o endereço completo (Rua, Número, Bairro):";
  }

  await updateSession(supabase, session.id, { state: "payment", delivery_address: msg });

  return `📍 Endereço salvo: *${msg}*\n\n💳 *Como deseja pagar?*\n\n1️⃣ PIX\n2️⃣ Cartão na entrega\n3️⃣ Dinheiro\n\nDigite o *número* da opção.`;
}

async function handlePayment(supabase: any, session: any, msg: string, settings: Record<string, string>): Promise<string> {
  const paymentMap: Record<string, { key: string; label: string }> = {
    "1": { key: "pix", label: "PIX" },
    "2": { key: "credit_card", label: "Cartão na entrega" },
    "3": { key: "cash", label: "Dinheiro" },
    "pix": { key: "pix", label: "PIX" },
    "cartao": { key: "credit_card", label: "Cartão na entrega" },
    "dinheiro": { key: "cash", label: "Dinheiro" },
  };

  const payment = paymentMap[msg];
  if (!payment) {
    return "⚠️ Opção inválida.\n\n1️⃣ PIX\n2️⃣ Cartão na entrega\n3️⃣ Dinheiro";
  }

  await updateSession(supabase, session.id, { state: "confirm", payment_method: payment.key });

  const cart = session.cart || [];
  const total = cart.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

  let text = "📋 *Resumo do Pedido:*\n\n";
  text += buildCartSummary(cart);
  text += `\n\n📍 *Entrega:* ${session.delivery_address}`;
  text += `\n💳 *Pagamento:* ${payment.label}`;
  text += `\n💰 *Total: R$ ${total.toFixed(2).replace(".", ",")}*`;

  if (payment.key === "pix") {
    const pixKey = settings.pix_key || "truebox@pix.com";
    text += `\n\n🔑 *Chave PIX:* ${pixKey}`;
  }

  text += "\n\n✅ Digite *confirmar* para enviar o pedido\n❌ Digite *0* para cancelar";

  return text;
}

async function handleConfirm(supabase: any, session: any, msg: string, settings: Record<string, string>): Promise<string> {
  if (msg !== "confirmar" && msg !== "sim" && msg !== "s") {
    return "Digite *confirmar* para enviar o pedido ou *0* para cancelar.";
  }

  const cart = session.cart || [];
  const total = cart.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

  // Create order
  const { data: order, error: orderError } = await supabase.from("orders").insert({
    customer_name: session.customer_name || "Cliente WhatsApp",
    customer_phone: session.phone,
    order_type: "delivery",
    status: "pending",
    subtotal: total,
    delivery_fee: 0,
    total: total,
    payment_method: session.payment_method,
    observation: `Endereço: ${session.delivery_address}`,
  }).select().single();

  if (orderError || !order) {
    console.error("Order creation error:", orderError);
    return "😕 Erro ao criar pedido. Tente novamente ou digite *5* para falar com um atendente.";
  }

  // Create order items
  for (const item of cart) {
    await supabase.from("order_items").insert({
      order_id: order.id,
      product_name: item.name,
      product_price: item.price,
      quantity: item.quantity,
      extras: [],
    });
  }

  // Update session
  await updateSession(supabase, session.id, {
    state: "greeting",
    order_id: order.id,
    cart: [],
    is_active: false,
  });

  // Create new session for future messages
  await supabase.from("chat_sessions").insert({
    phone: session.phone,
    customer_name: session.customer_name,
    state: "greeting",
    order_id: order.id,
  });

  return `🎉 *Pedido #${order.order_number} confirmado!*\n\n` +
    `Vamos preparar com carinho! 🍔\n\n` +
    `Você receberá atualizações sobre o status do seu pedido.\n\n` +
    `Para acompanhar, digite *4* a qualquer momento.\n\n` +
    `Obrigado por escolher a Truebox! ❤️`;
}

async function updateSession(supabase: any, sessionId: string, data: any) {
  await supabase.from("chat_sessions").update({
    ...data,
    updated_at: new Date().toISOString(),
  }).eq("id", sessionId);
}
