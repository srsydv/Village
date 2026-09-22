import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./mongo.js";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILE = path.join(ROOT_DIR, ".data", "searches.jsonl");
const TTL_SECONDS = 90 * 24 * 60 * 60;
let indexesReady = false;

function clip(value, max = 180) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function visitorFrom(req) {
  return clip(req.get("x-safar-visitor") || req.get("x-aurea-visitor") || req.body?.visitorId || "", 40);
}

function profileFrom(req) {
  const profile = req.body?.profile || {};
  return {
    name: clip(profile.name || req.get("x-safar-name") || req.get("x-aurea-name"), 80),
    homeCity: clip(profile.homeCity || req.get("x-safar-home") || req.get("x-aurea-home"), 120),
  };
}

async function collection() {
  const db = await getDb();
  if (!db) return null;
  const col = db.collection("searches");
  if (!indexesReady) {
    indexesReady = true;
    await col.createIndex({ at: 1 }, { expireAfterSeconds: TTL_SECONDS }).catch(() => {});
    await col.createIndex({ kind: 1, at: -1 }).catch(() => {});
    await col.createIndex({ email: 1, at: -1 }).catch(() => {});
  }
  return col;
}

function appendFile(event) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.appendFileSync(FILE, `${JSON.stringify(event)}\n`);
}

export function logSearch(req, extra = {}) {
  const { name, homeCity } = profileFrom(req);
  const event = {
    at: new Date(),
    kind: extra.kind || "plan",
    name: extra.name || name || clip(req.user?.email, 80),
    email: clip(req.user?.email, 120).toLowerCase(),
    homeCity: extra.homeCity || homeCity,
    visitorId: visitorFrom(req),
    destination: clip(extra.destination, 160),
    country: clip(extra.country, 80),
    days: clip(extra.days, 12),
    startDate: clip(extra.startDate, 20),
    endDate: clip(extra.endDate, 20),
    travelers: clip(extra.travelers, 80),
    budget: clip(extra.budget, 80),
    style: clip(extra.style, 40),
    interests: clip(extra.interests, 160),
    notes: clip(extra.notes, 200),
    resultTitle: clip(extra.resultTitle, 180),
    resultDuration: clip(extra.resultDuration, 80),
    resultBudget: clip(extra.resultBudget, 80),
    resultPlan: extra.resultPlan || null,
    places: extra.places || null,
    ok: extra.ok !== false,
    error: extra.error ? clip(extra.error, 180) : "",
    model: clip(extra.model, 60),
  };
  collection()
    .then((col) => {
      if (col) return col.insertOne(event);
      appendFile(event);
      return null;
    })
    .catch(() => {
      try {
        appendFile(event);
      } catch {
        /* ignore */
      }
    });
}

export async function listSearches(limit = 200) {
  const col = await collection();
  if (col) {
    return col.find({}).sort({ at: -1 }).limit(Math.min(Number(limit) || 200, 400)).toArray();
  }
  if (!fs.existsSync(FILE)) return [];
  const lines = fs.readFileSync(FILE, "utf8").trim().split("\n").filter(Boolean);
  return lines
    .slice(-Math.min(Number(limit) || 200, 400))
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

export async function listSearchesForEmail(email, limit = 200) {
  const key = String(email || "").trim().toLowerCase();
  if (!key) return [];
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const col = await collection();
  if (col) {
    return col
      .find({ email: { $regex: `^${escaped}$`, $options: "i" } })
      .sort({ at: -1 })
      .limit(Math.min(Number(limit) || 200, 400))
      .toArray();
  }
  const all = await listSearches(400);
  return all.filter((row) => String(row.email || "").toLowerCase() === key).slice(0, limit);
}

export async function countSearches() {
  const col = await collection();
  if (col) return col.countDocuments();
  return (await listSearches(400)).length;
}

export async function topDestinations(limit = 8) {
  const col = await collection();
  if (col) {
    return col
      .aggregate([
        { $match: { destination: { $exists: true, $ne: "" } } },
        { $group: { _id: "$destination", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: Math.min(Number(limit) || 8, 20) },
      ])
      .toArray();
  }
  const all = await listSearches(400);
  const tally = {};
  for (const row of all) {
    const dest = String(row.destination || "").trim();
    if (!dest) continue;
    tally[dest] = (tally[dest] || 0) + 1;
  }
  return Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({ _id: id, count }));
}
