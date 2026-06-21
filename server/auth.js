import {
  authenticate,
  createSession,
  createUser,
  deleteSession,
  getSessionUser,
} from "./database.js";

const SESSION_COOKIE = "playfulbet_session";
const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
};

const cookies = (req) => Object.fromEntries(
  (req.headers.cookie || "").split(";").filter(Boolean).map((part) => part.trim().split("=")),
);

const readBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 10_000) reject(new Error("Solicitud demasiado grande"));
  });
  req.on("end", () => {
    try {
      resolve(JSON.parse(body || "{}"));
    } catch {
      reject(new Error("JSON no válido"));
    }
  });
});

const setSession = (res, session) => {
  const maxAge = Math.floor((session.expiresAt - Date.now()) / 1000);
  res.setHeader(
    "set-cookie",
    `${SESSION_COOKIE}=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
  );
};

export function authApi() {
  return async (req, res, next) => {
    if (!req.url.startsWith("/api/auth/")) return next();

    const token = cookies(req)[SESSION_COOKIE];
    if (req.method === "GET" && req.url === "/api/auth/me") {
      return json(res, 200, { user: getSessionUser(token) });
    }
    if (req.method === "POST" && req.url === "/api/auth/logout") {
      deleteSession(token);
      res.setHeader("set-cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
      return json(res, 200, { ok: true });
    }
    if (req.method !== "POST") return json(res, 405, { error: "Método no permitido" });

    try {
      const { username, email, password } = await readBody(req);
      if (!email || !password || password.length < 8) {
        return json(res, 400, { error: "Email y contraseña de al menos 8 caracteres obligatorios" });
      }

      let user;
      if (req.url === "/api/auth/register") {
        if (!username || username.trim().length < 3) {
          return json(res, 400, { error: "El usuario debe tener al menos 3 caracteres" });
        }
        user = createUser(username, email, password);
      } else if (req.url === "/api/auth/login") {
        user = authenticate(email, password);
        if (!user) return json(res, 401, { error: "Credenciales incorrectas" });
      } else {
        return json(res, 404, { error: "Ruta no encontrada" });
      }

      setSession(res, createSession(user.id));
      return json(res, 200, { user });
    } catch (error) {
      const duplicate = String(error.message).includes("UNIQUE");
      return json(res, duplicate ? 409 : 400, {
        error: duplicate ? "El usuario o email ya existe" : error.message,
      });
    }
  };
}
