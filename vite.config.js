import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { authApi } from "./server/auth.js";
import { getApiCache, setApiCache } from "./server/database.js";
import { oddsApi } from "./server/odds.js";
import { fantasyApi } from "./server/fantasy.js";

const STATIC_CACHE_TTL = 2 * 60 * 1000;
const MATCH_CACHE_TTL = 60 * 1000;
const ESPN_CACHE_TTL = 15 * 1000;

const isMatchEndpoint = (url) =>
  /^\/(football-data|api-football)\/(matches|fixtures|competitions\/[^/]+\/matches)\b/.test(url);

const cacheTtl = (url) => {
  if (url.startsWith("/espn/")) return ESPN_CACHE_TTL;
  return isMatchEndpoint(url) ? MATCH_CACHE_TTL : STATIC_CACHE_TTL;
};

const sharedApiCache = {
  name: "shared-api-cache",
  configureServer(server) {
    server.middlewares.use(authApi());
    server.middlewares.use((req, res, next) => {
      if (req.method !== "GET" || !/^\/(odds-api|football-data|api-football|sports-db|espn|jolpi|motogp)\b/.test(req.url)) {
        return next();
      }

      const cacheKey = req.url;
      const ttl = cacheTtl(req.url);
      const cached = getApiCache(cacheKey, ttl);
      if (cached) {
        res.statusCode = cached.status_code;
        Object.entries(JSON.parse(cached.headers)).forEach(([name, value]) => res.setHeader(name, value));
        res.setHeader("x-playfulbet-cache", "HIT");
        return res.end(cached.body);
      }

      const chunks = [];
      const write = res.write.bind(res);
      const end = res.end.bind(res);
      res.write = (chunk, ...args) => {
        if (chunk) chunks.push(Buffer.from(chunk));
        return write(chunk, ...args);
      };
      res.end = (chunk, ...args) => {
        if (chunk) chunks.push(Buffer.from(chunk));
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setApiCache(cacheKey, res.statusCode, res.getHeaders(), Buffer.concat(chunks));
        }
        return end(chunk, ...args);
      };
      next();
    });
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.API_FOOTBALL_KEY;
  const footballDataKey = env.FOOTBALL_DATA_KEY;
  const oddsApiKey = env.THE_ODDS_API_KEY;
  const fantasyLeague = env.FANTASY_ESPN_LEAGUE || "esp.1";

  return {
    plugins: [{
      name: "playfulbet-api",
      configureServer(server) {
        server.middlewares.use(fantasyApi(fantasyLeague));
        server.middlewares.use(oddsApi(oddsApiKey));
      },
    }, sharedApiCache, react()],
    server: {
      proxy: {
        "/api-football": {
          target: "https://v3.football.api-sports.io",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-football/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (apiKey) proxyReq.setHeader("x-apisports-key", apiKey);
            });
          },
        },
        "/football-data": {
          target: "https://api.football-data.org/v4",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/football-data/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (footballDataKey) proxyReq.setHeader("X-Auth-Token", footballDataKey);
            });
          },
        },
        "/sports-db": {
          target: "https://www.thesportsdb.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/sports-db/, ""),
        },
        "/espn": {
          target: "https://site.api.espn.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/espn/, ""),
        },
        "/odds-api": {
          target: "https://api.odds-api.io/v3",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/odds-api/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (!oddsApiKey) return;
              const separator = proxyReq.path.includes("?") ? "&" : "?";
              proxyReq.path = `${proxyReq.path}${separator}apiKey=${encodeURIComponent(oddsApiKey)}`;
            });
          },
        },
        "/jolpi": {
          target: "https://api.jolpi.ca",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/jolpi/, ""),
        },
        "/motogp": {
          target: "https://www.motogp.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/motogp/, ""),
          headers: {
            "User-Agent": "Mozilla/5.0 (Playfulbet Sports App)",
            "Accept": "text/html",
          },
        },
      },
    },
  };
});
