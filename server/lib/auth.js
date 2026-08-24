import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "village-samooh-dev-secret-change-me";

export async function hashPin(pin) {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin, pinHash) {
  return bcrypt.compare(pin, pinHash);
}

export const hashPassword = hashPin;
export const verifyPassword = verifyPin;

export function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function createSessionToken(groupId, groupCode) {
  const payload = `${groupId}.${groupCode}.${Date.now()}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifySessionToken(token) {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parts = raw.split(".");
    if (parts.length !== 4) return null;
    const [groupId, groupCode, ts, sig] = parts;
    const payload = `${groupId}.${groupCode}.${ts}`;
    const expected = createHmac("sha256", SESSION_SECRET)
      .update(payload)
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { groupId, groupCode };
  } catch {
    return null;
  }
}

export function getBearerToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function requireGroup(req, res) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "लॉगिन ज़रूरी है" });
    return null;
  }
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: "सत्र समाप्त" });
    return null;
  }
  return session;
}
