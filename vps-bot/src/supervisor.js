import "dotenv/config";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CONTROL_HOST = process.env.WA_CONTROL_HOST || "0.0.0.0";
const CONTROL_PORT = parseInt(process.env.WA_CONTROL_PORT || "3011", 10);
const CONTROL_TOKEN = process.env.BOT_TOKEN;
const RESTART_DELAY_MS = 2_000;
const STOP_TIMEOUT_MS = 10_000;

if (!CONTROL_TOKEN) {
  console.error("❌ Faltam env vars: BOT_TOKEN");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = (...args) => console.log(`[SUP ${new Date().toISOString()}]`, ...args);

const workers = {
  ifood: {
    name: "ifood",
    script: path.join(__dirname, "index.js"),
    child: null,
    restartTimer: null,
    expectedExit: false,
  },
  whatsapp: {
    name: "whatsapp",
    script: path.join(__dirname, "whatsapp-bot.js"),
    child: null,
    restartTimer: null,
    expectedExit: false,
  },
};

function prefixOutput(workerName, stream, chunk) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    stream(`[${workerName}] ${line}`);
  }
}

function startWorker(workerName) {
  const worker = workers[workerName];
  if (!worker || worker.child) return worker?.child ?? null;

  worker.expectedExit = false;
  log(`🚀 Iniciando worker ${workerName}`);

  const child = spawn(process.execPath, [worker.script], {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => prefixOutput(workerName, console.log, chunk));
  child.stderr.on("data", (chunk) => prefixOutput(workerName, console.error, chunk));

  child.on("exit", (code, signal) => {
    log(`🛑 Worker ${workerName} saiu (code=${code ?? "null"}, signal=${signal ?? "null"})`);
    worker.child = null;

    if (worker.expectedExit) {
      worker.expectedExit = false;
      return;
    }

    worker.restartTimer = setTimeout(() => {
      worker.restartTimer = null;
      startWorker(workerName);
    }, RESTART_DELAY_MS);
  });

  worker.child = child;
  return child;
}

function waitForExit(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.killed) {
      resolve(undefined);
      return;
    }

    const timeout = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch {}
    }, STOP_TIMEOUT_MS);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve(undefined);
    });
  });
}

async function stopWorker(workerName) {
  const worker = workers[workerName];
  if (!worker?.child) return;

  if (worker.restartTimer) {
    clearTimeout(worker.restartTimer);
    worker.restartTimer = null;
  }

  worker.expectedExit = true;
  const child = worker.child;
  log(`⏹️ Parando worker ${workerName}`);
  try {
    child.kill("SIGTERM");
  } catch {}
  await waitForExit(child);
}

async function restartWorker(workerName) {
  await stopWorker(workerName);
  startWorker(workerName);
}

function isAuthorized(req) {
  const auth = req.headers.authorization || "";
  return auth === `Bearer ${CONTROL_TOKEN}`;
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({ raw });
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      ok: true,
      workers: Object.fromEntries(
        Object.entries(workers).map(([name, worker]) => [name, { running: Boolean(worker.child), pid: worker.child?.pid ?? null }]),
      ),
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const body = await readJsonBody(req);

  if (req.url === "/restart-wa") {
    await restartWorker("whatsapp");
    sendJson(res, 200, {
      ok: true,
      action: "restart_wa",
      requested_at: new Date().toISOString(),
      pid: workers.whatsapp.child?.pid ?? null,
      body,
    });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
});

for (const workerName of Object.keys(workers)) {
  startWorker(workerName);
}

server.listen(CONTROL_PORT, CONTROL_HOST, () => {
  log(`🌐 Controle HTTP pronto em http://${CONTROL_HOST}:${CONTROL_PORT}`);
});

async function shutdown() {
  log("👋 Encerrando supervisor");
  server.close();
  await Promise.all(Object.keys(workers).map((workerName) => stopWorker(workerName)));
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);