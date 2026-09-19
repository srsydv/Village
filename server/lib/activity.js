import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./mongo.js";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILE = path.join(ROOT_DIR, ".data", "activity.jsonl");
const TTL_SECONDS = 90 * 24 * 60 * 60;
let indexesReady = false;

function clip(value, max = 240) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function visitorFrom(req) {
  return clip(req.get("x-aurea-visitor") || req.body?.visitorId || "", 40);
}

function profileFrom(req) {
  const profile = req.body?.profile || {};
  return {
    name: clip(profile.name || req.get("x-aurea-name"), 80),
    homeCity: clip(profile.homeCity || req.get("x-aurea-home"), 120),
  };
}

export function lastUserText(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user" && messages[i].content) return clip(messages[i].content, 200);
  }
  return "";
}

export function buildEvent(req, extra = {}) {
  const { name, homeCity } = profileFrom(req);
  return {
    at: new Date(),
    action: extra.action,
    name: extra.name || name || clip(req.user?.email, 80),
    homeCity: extra.homeCity || homeCity,
    email: clip(req.user?.email, 120).toLowerCase(),
    visitorId: visitorFrom(req),
    query: clip(extra.query, 200),
    reply: extra.reply ? clip(extra.reply, 6000) : "",
    plan: extra.plan || null,
    places: extra.places || null,
    ok: extra.ok !== false,
    error: extra.error ? clip(extra.error, 180) : "",
    model: clip(extra.model, 60),
  };
}

async function collection() {
  const db = await getDb();
  if (!db) return null;
  const col = db.collection("activity");
  if (!indexesReady) {
    indexesReady = true;
    await col.createIndex({ at: 1 }, { expireAfterSeconds: TTL_SECONDS }).catch(() => {});
    await col.createIndex({ email: 1, at: -1 }).catch(() => {});
  }
  return col;
}

function appendFile(event) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.appendFileSync(FILE, `${JSON.stringify(event)}\n`);
}

export function logActivity(req, extra) {
  const event = buildEvent(req, extra);
  collection()
    .then((col) => {
      if (col) return col.insertOne(event);
      appendFile(event);
      return null;
    })
    .catch((err) => {
      try {
        appendFile(event);
      } catch {
        console.error("Activity log failed", err.message);
      }
    });
}

export async function listActivity(limit = 100) {
  const col = await collection();
  if (col) {
    return col.find({}).sort({ at: -1 }).limit(Math.min(Number(limit) || 100, 300)).toArray();
  }
  if (!fs.existsSync(FILE)) return [];
  const lines = fs.readFileSync(FILE, "utf8").trim().split("\n").filter(Boolean);
  return lines
    .slice(-Math.min(Number(limit) || 100, 300))
    .reverse()
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function emailFilter(email) {
  const key = String(email || "").trim().toLowerCase();
  if (!key) return null;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { email: { $regex: `^${escaped}$`, $options: "i" } };
}

export async function listActivityForEmail(email, limit = 200) {
  const filter = emailFilter(email);
  if (!filter) return [];
  const col = await collection();
  if (col) {
    return col.find(filter).sort({ at: -1 }).limit(Math.min(Number(limit) || 200, 400)).toArray();
  }
  const key = String(email || "").trim().toLowerCase();
  const all = await listActivity(400);
  return all.filter((row) => String(row.email || "").toLowerCase() === key).slice(0, limit);
}

export async function countActivity(filter = {}) {
  const col = await collection();
  if (col) return col.countDocuments(filter);
  const all = await listActivity(400);
  const since = filter.at?.$gte ? new Date(filter.at.$gte).getTime() : 0;
  return all.filter((row) => {
    if (filter.action && row.action !== filter.action) return false;
    if (since && new Date(row.at).getTime() < since) return false;
    return true;
  }).length;
}

export function activityStoreKind() {
  return process.env.MONGODB_URI ? "mongodb" : "file";
}
