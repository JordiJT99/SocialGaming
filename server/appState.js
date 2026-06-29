import { getAppState, saveAppState } from "./database.js";
import { getRequestUser } from "./session.js";

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 1_000_000) reject(new Error("Solicitud demasiado grande"));
  });
  req.on("end", () => {
    try {
      resolve(JSON.parse(raw || "{}"));
    } catch {
      reject(new Error("JSON no valido"));
    }
  });
});

const sanitizeStore = (state, user) => {
  const safe = structuredClone(state || {});
  if (Array.isArray(safe.users) && safe.users[0]) {
    safe.users[0] = {
      ...safe.users[0],
      username: user.username,
      email: user.email,
      joinedAt: user.joinedAt || safe.users[0].joinedAt,
    };
  }
  return safe;
};

export function appStateApi() {
  return async (req, res, next) => {
    if (!req.url.startsWith("/api/app-state")) return next();

    const user = getRequestUser(req);
    if (!user) return json(res, 401, { error: "Sesion no valida" });

    try {
      if (req.method === "GET" && req.url === "/api/app-state") {
        const stored = getAppState(user.id);
        return json(res, 200, stored || { state: null, updatedAt: null });
      }
      if (req.method !== "POST" || req.url !== "/api/app-state") {
        return json(res, 405, { error: "Metodo no permitido" });
      }
      const body = await readBody(req);
      if (!body || typeof body.state !== "object" || Array.isArray(body.state)) {
        return json(res, 400, { error: "Estado invalido" });
      }
      saveAppState(user.id, sanitizeStore(body.state, user));
      return json(res, 200, { ok: true, updatedAt: Date.now() });
    } catch (error) {
      return json(res, 400, { error: error.message || "No se pudo guardar el estado" });
    }
  };
}
