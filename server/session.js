import { getSessionUser } from "./database.js";

export const SESSION_COOKIE = "playfulbet_session";
const isTestMode = process.env.PLAYFULBET_TEST === "1" || process.env.NODE_ENV === "test";

export const parseCookies = (req) => Object.fromEntries(
  (req.headers.cookie || "").split(";").filter(Boolean).map((part) => part.trim().split("=")),
);

export function getRequestUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const sessionUser = getSessionUser(token);
  if (sessionUser) return sessionUser;
  if (isTestMode && req.headers["x-playfulbet-user"]) {
    return {
      id: String(req.headers["x-playfulbet-user"]),
      username: String(req.headers["x-playfulbet-user"]),
      email: `${String(req.headers["x-playfulbet-user"]).toLowerCase()}@test.local`,
      points: 0,
      joinedAt: null,
    };
  }
  return null;
}
