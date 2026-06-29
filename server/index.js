import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { URL } from "node:url";
import { authApi } from "./auth.js";
import { appStateApi } from "./appState.js";
import { db, getApiCache, setApiCache } from "./database.js";
import { economyApi } from "./economy.js";
import { startFantasyJobs, fantasyApi } from "./fantasy.js";
import { startOddsJobs, oddsApi } from "./odds.js";

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const isDevRuntime = process.argv.includes("--dev");
const DIST_DIR = resolve(process.cwd(), "dist");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
const ODDS_API_KEY = process.env.THE_ODDS_API_KEY || "";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || "";
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || "";
const FANTASY_ESPN_LEAGUE = process.env.FANTASY_ESPN_LEAGUE || "esp.1";
const STATIC_CACHE_TTL = 2 * 60 * 1000;
const MATCH_CACHE_TTL = 60 * 1000;
const ESPN_CACHE_TTL = 15 * 1000;
const rateBuckets = new Map();
const runtime = {
  startedAt: Date.now(),
  jobs: {
    fantasy: null,
    odds: null,
    cleanup: null,
  },
  lastErrors: [],
};

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
};

const log = (event, payload = {}) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
};

const noteError = (scope, error) => {
  runtime.lastErrors = [{ scope, message: error.message, at: Date.now() }, ...runtime.lastErrors].slice(0, 10);
  log("error", { scope, message: error.message });
};

const isMatchEndpoint = (url) =>
  /^\/(football-data|api-football)\/(matches|fixtures|competitions\/[^/]+\/matches)\b/.test(url);

const cacheTtl = (url) => {
  if (url.startsWith("/espn/")) return ESPN_CACHE_TTL;
  return isMatchEndpoint(url) ? MATCH_CACHE_TTL : STATIC_CACHE_TTL;
};

const proxyConfigs = [
  {
    prefix: "/api-football",
    target: "https://v3.football.api-sports.io",
    rewrite: (pathname) => pathname.replace(/^\/api-football/, ""),
    headers: () => (API_FOOTBALL_KEY ? { "x-apisports-key": API_FOOTBALL_KEY } : {}),
  },
  {
    prefix: "/football-data",
    target: "https://api.football-data.org/v4",
    rewrite: (pathname) => pathname.replace(/^\/football-data/, ""),
    headers: () => (FOOTBALL_DATA_KEY ? { "X-Auth-Token": FOOTBALL_DATA_KEY } : {}),
  },
  {
    prefix: "/sports-db",
    target: "https://www.thesportsdb.com",
    rewrite: (pathname) => pathname.replace(/^\/sports-db/, ""),
  },
  {
    prefix: "/espn",
    target: "https://site.api.espn.com",
    rewrite: (pathname) => pathname.replace(/^\/espn/, ""),
  },
  {
    prefix: "/odds-api",
    target: "https://api.odds-api.io/v3",
    rewrite: (pathname) => pathname.replace(/^\/odds-api/, ""),
    query: (url) => {
      if (!ODDS_API_KEY) return url.search;
      const query = new URLSearchParams(url.search);
      query.set("apiKey", ODDS_API_KEY);
      return `?${query.toString()}`;
    },
  },
  {
    prefix: "/jolpi",
    target: "https://api.jolpi.ca",
    rewrite: (pathname) => pathname.replace(/^\/jolpi/, ""),
  },
  {
    prefix: "/motogp",
    target: "https://www.motogp.com",
    rewrite: (pathname) => pathname.replace(/^\/motogp/, ""),
    headers: () => ({
      "user-agent": "Mozilla/5.0 (Playfulbet Sports App)",
      accept: "text/html",
    }),
  },
];

const middlewares = [
  authApi({ googleClientId: GOOGLE_CLIENT_ID }),
  appStateApi(),
  economyApi(),
  fantasyApi(FANTASY_ESPN_LEAGUE),
  oddsApi(ODDS_API_KEY),
];

async function runMiddlewares(req, res, stack, done) {
  let index = -1;
  const next = async () => {
    index += 1;
    if (index >= stack.length) return done();
    return stack[index](req, res, next);
  };
  return next();
}

function cleanupRateBuckets(now = Date.now()) {
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}

function applyRateLimit(req, res) {
  if (req.method === "GET" || req.method === "HEAD") return false;
  const path = req.url.split("?")[0];
  let rule = null;
  if (/^\/api\/auth\/(login|register|google)$/.test(path)) rule = { limit: 20, windowMs: 10 * 60 * 1000 };
  else if (/^\/api\/(fantasy|economy)\//.test(path)) rule = { limit: 120, windowMs: 10 * 60 * 1000 };
  else return false;

  cleanupRateBuckets();
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress || "local";
  const key = `${ip}:${path}`;
  const bucket = rateBuckets.get(key);
  const now = Date.now();
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return false;
  }
  if (bucket.count >= rule.limit) {
    res.setHeader("retry-after", Math.ceil((bucket.resetAt - now) / 1000));
    json(res, 429, { error: "Demasiadas solicitudes. Intentalo mas tarde." });
    return true;
  }
  bucket.count += 1;
  return false;
}

function enforceSameOrigin(req, res) {
  if (req.method === "GET" || req.method === "HEAD") return false;
  if (!req.url.startsWith("/api/")) return false;
  const origin = req.headers.origin;
  if (!origin) return false;
  const host = req.headers.host;
  const proto = req.headers["x-forwarded-proto"]?.toString().split(",")[0] || (process.env.NODE_ENV === "production" ? "https" : "http");
  const expectedOrigin = `${proto}://${host}`;
  if (origin !== expectedOrigin) {
    json(res, 403, { error: "Origen no permitido" });
    return true;
  }
  return false;
}

async function handleProxy(req, res) {
  if (req.method !== "GET") return false;
  const parsed = new URL(req.url, "http://localhost");
  const config = proxyConfigs.find((entry) => parsed.pathname.startsWith(entry.prefix));
  if (!config) return false;

  const cacheKey = req.url;
  const cached = getApiCache(cacheKey, cacheTtl(req.url));
  if (cached) {
    res.statusCode = cached.status_code;
    Object.entries(JSON.parse(cached.headers)).forEach(([name, value]) => res.setHeader(name, value));
    res.setHeader("x-playfulbet-cache", "HIT");
    res.end(cached.body);
    return true;
  }

  const targetUrl = new URL(config.target);
  targetUrl.pathname = config.rewrite(parsed.pathname);
  targetUrl.search = typeof config.query === "function" ? config.query(parsed) : parsed.search;

  const response = await fetch(targetUrl, {
    headers: {
      ...(config.headers ? config.headers() : {}),
    },
  });
  const body = Buffer.from(await response.arrayBuffer());
  const headers = Object.fromEntries(response.headers.entries());
  res.statusCode = response.status;
  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
  res.end(body);
  if (response.ok) {
    setApiCache(cacheKey, response.status, headers, body);
  }
  return true;
}

const contentType = (filePath) => ({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
}[extname(filePath).toLowerCase()] || "application/octet-stream");

async function serveStatic(req, res) {
  if (isDevRuntime || !existsSync(DIST_DIR)) return false;
  const parsed = new URL(req.url, "http://localhost");
  const requested = parsed.pathname === "/" ? "/index.html" : parsed.pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(DIST_DIR, safePath);
  try {
    const info = await stat(filePath).catch(() => null);
    if (!info || info.isDirectory()) {
      if (extname(safePath)) return false;
      filePath = join(DIST_DIR, "index.html");
    }
    res.statusCode = 200;
    res.setHeader("content-type", contentType(filePath));
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

function handleHealth(req, res) {
  if (req.url !== "/health") return false;
  const dbOk = !!db.prepare("SELECT 1 AS ok").get()?.ok;
  json(res, 200, {
    ok: dbOk,
    uptimeMs: Date.now() - runtime.startedAt,
    jobs: runtime.jobs,
    lastErrors: runtime.lastErrors,
  });
  return true;
}

function startJobs() {
  startFantasyJobs(FANTASY_ESPN_LEAGUE, {
    onSuccess: (timestamp) => {
      runtime.jobs.fantasy = timestamp;
      log("job", { name: "fantasy-sync", status: "ok" });
    },
    onError: (error) => noteError("fantasy-sync", error),
  });
  startOddsJobs(ODDS_API_KEY, {
    onSuccess: (timestamp) => {
      runtime.jobs.odds = timestamp;
      log("job", { name: "odds-sync", status: "ok" });
    },
    onError: (error) => noteError("odds-sync", error),
  });
}

startJobs();

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    log("request", {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  try {
    if (handleHealth(req, res)) return;
    if (enforceSameOrigin(req, res)) return;
    if (applyRateLimit(req, res)) return;
    await runMiddlewares(req, res, middlewares, async () => {
      try {
        if (await handleProxy(req, res)) return;
        if (await serveStatic(req, res)) return;
        json(res, 404, { error: "Ruta no encontrada" });
      } catch (error) {
        noteError("runtime", error);
        json(res, 500, { error: "Error interno del servidor" });
      }
    });
  } catch (error) {
    noteError("request", error);
    json(res, 500, { error: "Error interno del servidor" });
  }
});

server.listen(PORT, HOST, () => {
  log("server-start", { host: HOST, port: PORT, mode: isDevRuntime ? "dev-runtime" : "production-runtime" });
});
