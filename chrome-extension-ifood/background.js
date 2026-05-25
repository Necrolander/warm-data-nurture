// Service worker — recebe pedidos do content script e encaminha para a edge function
const DEFAULT_INGEST_URL = "https://yxmirlnvrrintrvicqic.supabase.co/functions/v1/external-orders-ingest";

async function getConfig() {
  const cfg = await chrome.storage.local.get(["ingestUrl", "botToken", "enabled", "pollMs"]);
  return {
    ingestUrl: cfg.ingestUrl || DEFAULT_INGEST_URL,
    botToken: cfg.botToken || "",
    enabled: cfg.enabled !== false,
    pollMs: cfg.pollMs || 15000,
  };
}

async function logEvent(entry) {
  const { logs = [] } = await chrome.storage.local.get(["logs"]);
  logs.unshift({ ts: Date.now(), ...entry });
  await chrome.storage.local.set({ logs: logs.slice(0, 50) });
}

async function bumpStat(key, by = 1) {
  const { stats = {} } = await chrome.storage.local.get(["stats"]);
  stats[key] = (stats[key] || 0) + by;
  stats.lastAt = Date.now();
  await chrome.storage.local.set({ stats });
}

async function callIngest(action, payload) {
  const cfg = await getConfig();
  if (!cfg.botToken) throw new Error("Bot token não configurado");
  const res = await fetch(cfg.ingestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.botToken}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.error || text}`);
  return data;
}

async function ingestOrder(order) {
  return callIngest("ingest_order", {
    channel: "ifood",
    externalOrderId: order.externalOrderId,
    normalized: order.normalized,
    raw: order.raw || {},
  });
}

async function heartbeat(extra = {}) {
  try {
    const { stats = {} } = await chrome.storage.local.get(["stats"]);
    await callIngest("heartbeat", {
      channel: "ifood",
      status: "online",
      ordersCaptured: stats.captured || 0,
      failures: stats.failures || 0,
      meta: { source: "chrome-extension", ...extra },
    });
  } catch (e) {
    await logEvent({ kind: "heartbeat_error", msg: e.message });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "ORDERS_BATCH") {
        const cfg = await getConfig();
        if (!cfg.enabled) return sendResponse({ ok: false, reason: "disabled" });
        let ok = 0, fail = 0;
        for (const order of msg.orders) {
          try {
            await ingestOrder(order);
            ok++;
          } catch (e) {
            fail++;
            await logEvent({ kind: "ingest_error", id: order.externalOrderId, msg: e.message });
          }
        }
        if (ok) await bumpStat("captured", ok);
        if (fail) await bumpStat("failures", fail);
        if (ok) await logEvent({ kind: "batch", ok, fail, total: msg.orders.length });
        sendResponse({ ok: true, sent: ok, failed: fail });
      } else if (msg.type === "TEST_CONNECTION") {
        await heartbeat({ test: true });
        sendResponse({ ok: true });
      } else if (msg.type === "GET_STATE") {
        const cfg = await getConfig();
        const { stats = {}, logs = [] } = await chrome.storage.local.get(["stats", "logs"]);
        sendResponse({ cfg, stats, logs });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true;
});

// Heartbeat periódico
chrome.alarms.create("hb", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "hb") heartbeat(); });
chrome.runtime.onInstalled.addListener(() => heartbeat({ event: "installed" }));
