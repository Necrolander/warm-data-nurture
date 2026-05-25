const $ = (id) => document.getElementById(id);

async function refresh() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (resp) => {
    if (!resp) return;
    const { cfg, stats, logs } = resp;
    $("token").value = cfg.botToken || "";
    $("url").value = cfg.ingestUrl || "";
    $("captured").textContent = stats?.captured || 0;
    $("failures").textContent = stats?.failures || 0;
    $("dot").classList.toggle("on", cfg.enabled);
    $("statusTxt").textContent = cfg.enabled
      ? (stats?.lastAt ? "Online · última atividade " + new Date(stats.lastAt).toLocaleTimeString() : "Online")
      : "Pausado";
    $("logs").innerHTML = (logs || []).map(l => {
      const t = new Date(l.ts).toLocaleTimeString();
      const cls = l.kind?.includes("error") ? "err" : "ok";
      const txt = l.kind === "batch"
        ? `enviados ${l.ok}/${l.total}`
        : (l.msg || l.kind);
      return `<div class="log"><span class="${cls}">[${t}]</span> ${l.kind}: ${txt}</div>`;
    }).join("") || '<div class="log">Sem atividade ainda.</div>';
  });
}

$("save").onclick = async () => {
  await chrome.storage.local.set({
    botToken: $("token").value.trim(),
    ingestUrl: $("url").value.trim(),
  });
  refresh();
};
$("test").onclick = () => {
  chrome.runtime.sendMessage({ type: "TEST_CONNECTION" }, (r) => {
    $("statusTxt").textContent = r?.ok ? "✅ Conexão OK" : "❌ " + (r?.error || "falhou");
    setTimeout(refresh, 1500);
  });
};
$("toggle").onclick = async () => {
  const { enabled } = await chrome.storage.local.get(["enabled"]);
  await chrome.storage.local.set({ enabled: enabled === false });
  refresh();
};
$("openPortal").onclick = () => {
  chrome.tabs.create({ url: "https://portal.ifood.com.br/pedidos" });
};

refresh();
setInterval(refresh, 3000);
