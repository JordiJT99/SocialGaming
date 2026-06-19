import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.API_FOOTBALL_KEY;
  const footballDataKey = env.FOOTBALL_DATA_KEY;
  const oddsApiKey = env.THE_ODDS_API_KEY;

  return {
    plugins: [react()],
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
        "/the-odds-api": {
          target: "https://api.the-odds-api.com/v4",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/the-odds-api/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (!oddsApiKey) return;
              const separator = proxyReq.path.includes("?") ? "&" : "?";
              proxyReq.path = `${proxyReq.path}${separator}apiKey=${encodeURIComponent(oddsApiKey)}`;
            });
          },
        },
      },
    },
  };
});
