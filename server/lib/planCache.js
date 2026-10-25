import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeStyle } from "../../client/src/lib/styleBudget.js";
import { getDb } from "./mongo.js";
import { placeKey, sameCityName } from "./planPieces.js";

// Bump when the plan prompt changes enough that old itineraries should not be reused.
const PLAN_CACHE_VERSION = 1;

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILE = path.join(ROOT_DIR, ".data", "generated-plans.jsonl");
let indexesReady = false;
let indexesPromise = null;

function text(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function clip(value, max) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function idList(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map((item) => text(item)).filter(Boolean))].sort();
}

function whole(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function planIsReusable(plan) {
  return Boolean(plan && typeof plan === "object" && Array.isArray(plan.days) && plan.days.length > 0);
}

export function planFingerprint(input = {}) {
  const profile = input.profile && typeof input.profile === "object" ? input.profile : {};
  const days = Number(input.days);
  return {
    v: PLAN_CACHE_VERSION,
    destination: text(input.destination),
    country: text(input.country),
    days: Number.isFinite(days) && days > 0 ? days : text(input.days),
    startDate: text(input.startDate),
    endDate: text(input.endDate),
    travelers: text(input.travelers),
    adults: whole(input.adults),
    kids: whole(input.kids),
    budget: text(input.budget),
    style: normalizeStyle(input.style).toLowerCase(),
    interests: text(input.interests),
    notes: text(input.notes),
    origin: text(input.origin || profile.homeCity),
    homeCity: text(profile.homeCity),
    modes: idList(input.modes),
    stays: idList(input.stays),
    currency: text(profile.currency || input.currency || "inr"),
    nationality: text(profile.nationality),
  };
}

export function planCacheKey(input) {
  return createHash("sha256").update(JSON.stringify(planFingerprint(input))).digest("hex");
}

function samePlace(input, plan) {
  const want = text(input?.destination);
  const got = text(plan?.destination);
  if (!want || !got) return false;
  return got.includes(want) || want.includes(got);
}

export function planMatchesRequest(input, plan) {
  return planIsReusable(plan) && samePlace(input, plan);
}

async function collection() {
  const db = await getDb();
  if (!db) return null;
  const col = db.collection("generatedPlans");
  if (!indexesReady) {
    if (!indexesPromise) {
      indexesPromise = Promise.all([
        col.createIndex({ key: 1 }, { unique: true }),
        col.createIndex({ destinationKey: 1, createdAt: -1 }),
      ])
        .then(() => {
          indexesReady = true;
        })
        .catch((err) => {
          indexesPromise = null;
          throw err;
        });
    }
    await indexesPromise;
  }
  return col;
}

function readFilePlans() {
  if (!fs.existsSync(FILE)) return [];
  return fs
    .readFileSync(FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildDoc(input, plan, model, key) {
  const profile = input.profile && typeof input.profile === "object" ? input.profile : {};
  const fingerprint = planFingerprint(input);
  const now = new Date();
  return {
    key,
    v: PLAN_CACHE_VERSION,
    destination: clip(input.destination, 160),
    destinationKey: placeKey(input.destination),
    country: clip(input.country, 80),
    days: fingerprint.days,
    startDate: clip(input.startDate, 20),
    endDate: clip(input.endDate, 20),
    travelers: clip(input.travelers, 80),
    adults: fingerprint.adults,
    kids: fingerprint.kids,
    budget: clip(input.budget, 80),
    style: normalizeStyle(input.style),
    interests: clip(input.interests, 400),
    notes: clip(input.notes, 800),
    origin: clip(input.origin || profile.homeCity, 120),
    homeCity: clip(profile.homeCity, 120),
    modes: fingerprint.modes,
    stays: fingerprint.stays,
    currency: fingerprint.currency,
    nationality: clip(profile.nationality, 80),
    plan,
    model: clip(model, 60),
    createdAt: now,
    lastUsedAt: now,
    hits: 1,
  };
}

export async function listPlansForPlace(destination) {
  const key = placeKey(destination);
  if (!key) return [];
  try {
    const col = await collection();
    if (col) {
      let rows = await col.find({ destinationKey: key }).sort({ hits: -1, createdAt: -1 }).limit(30).toArray();
      if (!rows.length) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        rows = await col.find({ destination: { $regex: escaped, $options: "i" } }).limit(30).toArray();
      }
      return rows.filter(
        (row) => row?.plan && (sameCityName(row.destination, destination) || sameCityName(row.plan?.destination, destination)),
      );
    }
    return readFilePlans().filter(
      (row) => row?.plan && (sameCityName(row.destination, destination) || sameCityName(row.plan?.destination, destination)),
    );
  } catch {
    return [];
  }
}

export async function findGeneratedPlan(input) {
  try {
    const key = planCacheKey(input);
    const col = await collection();
    if (col) {
      const doc = await col.findOne({ key });
      if (!doc?.plan) return null;
      col.updateOne({ key }, { $inc: { hits: 1 }, $set: { lastUsedAt: new Date() } }).catch(() => {});
      return { plan: doc.plan, model: doc.model || "" };
    }
    const doc = readFilePlans().find((row) => row.key === key && row.plan);
    if (!doc) return null;
    return { plan: doc.plan, model: doc.model || "" };
  } catch {
    return null;
  }
}

export async function saveGeneratedPlan(input, plan, model) {
  if (!planIsReusable(plan)) return false;
  try {
    const key = planCacheKey(input);
    const doc = buildDoc(input, plan, model, key);
    const col = await collection();
    if (col) {
      await col.updateOne({ key }, { $setOnInsert: doc }, { upsert: true });
      return true;
    }
    if (readFilePlans().some((row) => row.key === key)) return true;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.appendFileSync(FILE, `${JSON.stringify(doc)}\n`);
    return true;
  } catch {
    return false;
  }
}
