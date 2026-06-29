import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendOrigin = env.VITE_BACKEND_ORIGIN || "http://127.0.0.1:3001";
  const googleClientId = env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || "";

  return {
    define: {
      "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(googleClientId),
    },
    plugins: [react()],
    server: {
      proxy: {
        "/api": backendOrigin,
        "/espn": backendOrigin,
        "/sports-db": backendOrigin,
        "/football-data": backendOrigin,
        "/api-football": backendOrigin,
        "/odds-api": backendOrigin,
        "/jolpi": backendOrigin,
        "/motogp": backendOrigin,
        "/health": backendOrigin,
      },
    },
  };
});
