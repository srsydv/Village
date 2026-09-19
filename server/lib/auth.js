import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

let oauthClient;

function googleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || "").trim();
}

function sessionSecret() {
  return process.env.AUTH_SECRET || process.env.ACTIVITY_SECRET || "";
}

function oauth() {
  const id = googleClientId();
  if (!id) return null;
  if (!oauthClient) oauthClient = new OAuth2Client(id);
  return oauthClient;
}

export function googleAuthConfig() {
  const clientId = googleClientId();
  return { enabled: Boolean(clientId), googleClientId: clientId };
}

export async function verifyGoogleCredential(credential) {
  const client = oauth();
  if (!client) {
    const err = new Error("Google Sign-In is not configured.");
    err.status = 503;
    throw err;
  }
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: String(credential || ""),
      audience: googleClientId(),
    });
  } catch {
    const err = new Error("Google sign-in could not be verified. Try again.");
    err.status = 401;
    throw err;
  }
  const payload = ticket.getPayload() || {};
  if (!payload.sub || !payload.email) {
    const err = new Error("Google did not return an email for this account.");
    err.status = 401;
    throw err;
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture || "",
  };
}

export function signSession(user) {
  const secret = sessionSecret();
  if (!secret) {
    const err = new Error("AUTH_SECRET is missing.");
    err.status = 503;
    throw err;
  }
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      uid: String(user._id),
      googleId: user.googleId,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function readSession(token) {
  const secret = sessionSecret();
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || !secret) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload?.uid || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function userFromRequest(req) {
  const raw = req.get("authorization") || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : "";
  if (!token) return null;
  return readSession(token);
}

export function optionalAuth(req, _res, next) {
  try {
    req.user = userFromRequest(req);
  } catch {
    req.user = null;
  }
  next();
}

export function isAdminEmail(email) {
  const admin = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  return Boolean(admin && String(email || "").trim().toLowerCase() === admin);
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "Sign in with Google to continue." });
    }
    return next();
  });
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!isAdminEmail(req.user?.email)) {
      return res.status(403).json({ error: "Admin only." });
    }
    return next();
  });
}
