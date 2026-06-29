import {
  authenticate,
  createOrUpdateGoogleUser,
  createSession,
  createUser,
  deleteSession,
  getSessionUser,
} from "./database.js";
import { SESSION_COOKIE, parseCookies } from "./session.js";

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const encoder = new TextEncoder();
let googleKeysCache = { keys: [], expiresAt: 0 };

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
};

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
      reject(new Error("JSON no valido"));
    }
  });
});

const setSession = (res, session) => {
  const maxAge = Math.floor((session.expiresAt - Date.now()) / 1000);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "set-cookie",
    `${SESSION_COOKIE}=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`,
  );
};

const parseCacheMaxAge = (cacheControl) =>
  Number(/max-age=(\d+)/i.exec(cacheControl || "")?.[1] || 3600);

const decodeBase64Url = (value) =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const decodeJwtPart = (value) => JSON.parse(decodeBase64Url(value).toString("utf8"));

const googleCertKeys = async () => {
  if (googleKeysCache.expiresAt > Date.now() && googleKeysCache.keys.length) {
    return googleKeysCache.keys;
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) throw new Error("No se pudo verificar la sesion de Google");

  const payload = await response.json();
  googleKeysCache = {
    keys: payload.keys || [],
    expiresAt: Date.now() + parseCacheMaxAge(response.headers.get("cache-control")) * 1000,
  };
  return googleKeysCache.keys;
};

const verifyGoogleCredential = async (credential, clientId) => {
  if (!clientId) throw new Error("Google login no esta configurado");

  const parts = String(credential || "").split(".");
  if (parts.length !== 3) throw new Error("Token de Google no valido");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJwtPart(encodedHeader);
  const payload = decodeJwtPart(encodedPayload);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Firma de Google no soportada");

  const jwk = (await googleCertKeys()).find((entry) => entry.kid === header.kid);
  if (!jwk) throw new Error("No se encontro la clave de Google para verificar la sesion");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: jwk.alg || "RS256", use: "sig" },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!valid) throw new Error("Firma de Google no valida");

  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(clientId)) throw new Error("El token de Google no pertenece a esta aplicacion");
  if (!GOOGLE_ISSUERS.has(payload.iss)) throw new Error("Issuer de Google no permitido");
  if (!payload.sub || !payload.email) throw new Error("Google no devolvio identidad suficiente");
  if (payload.exp <= now) throw new Error("La sesion de Google ha expirado");
  if (payload.nbf && payload.nbf > now) throw new Error("La sesion de Google todavia no es valida");
  if (!(payload.email_verified === true || payload.email_verified === "true")) {
    throw new Error("Google no ha verificado ese email");
  }

  return {
    googleSub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split("@")[0],
  };
};

export function authApi({ googleClientId } = {}) {
  return async (req, res, next) => {
    if (!req.url.startsWith("/api/auth/")) return next();

    const token = parseCookies(req)[SESSION_COOKIE];
    if (req.method === "GET" && req.url === "/api/auth/me") {
      return json(res, 200, { user: getSessionUser(token) });
    }
    if (req.method === "POST" && req.url === "/api/auth/logout") {
      deleteSession(token);
      const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
      res.setHeader("set-cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
      return json(res, 200, { ok: true });
    }
    if (req.method !== "POST") return json(res, 405, { error: "Metodo no permitido" });

    try {
      if (req.url === "/api/auth/google") {
        const { credential } = await readBody(req);
        const profile = await verifyGoogleCredential(credential, googleClientId);
        const user = createOrUpdateGoogleUser(profile);
        setSession(res, createSession(user.id));
        return json(res, 200, { user });
      }

      const { username, email, password } = await readBody(req);
      if (!email || !password || password.length < 8) {
        return json(res, 400, { error: "Email y contrasena de al menos 8 caracteres obligatorios" });
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
