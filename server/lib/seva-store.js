import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import { nanoid } from "nanoid";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_DIR = path.join(ROOT_DIR, ".data");
const DATA_FILE = path.join(DATA_DIR, "gramseva.json");

let memoryCache = null;
let mongoClient = null;
let mongoDb = null;

async function ensureFileStore() {
  if (memoryCache) return memoryCache;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DATA_FILE, "utf8");
    memoryCache = JSON.parse(raw);
    memoryCache.villages ||= [];
    memoryCache.workers ||= [];
    memoryCache.jobs ||= [];
  } catch {
    memoryCache = { villages: [], workers: [], jobs: [] };
    await persistFileStore();
  }
  return memoryCache;
}

async function persistFileStore() {
  if (!memoryCache) return;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(memoryCache, null, 2), "utf8");
}

async function getMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (mongoDb) return mongoDb;
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  mongoDb = mongoClient.db(process.env.MONGODB_DB || "village_samooh");
  await mongoDb.collection("seva_jobs").createIndex({ clientId: 1 }, { unique: true });
  await mongoDb.collection("seva_workers").createIndex({ clientId: 1 }, { unique: true });
  await mongoDb.collection("seva_villages").createIndex({ code: 1 }, { unique: true });
  return mongoDb;
}

function newId() {
  return nanoid(12);
}

function villageCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export async function createVillage(input) {
  const db = await getMongo();
  const village = {
    _id: newId(),
    code: villageCode(),
    name: input.name.trim(),
    pinHash: input.pinHash,
    language: "hi",
    createdAt: new Date().toISOString(),
  };

  if (db) {
    await db.collection("seva_villages").insertOne(village);
    return village;
  }

  const store = await ensureFileStore();
  while (store.villages.some((v) => v.code === village.code)) {
    village.code = villageCode();
  }
  store.villages.push(village);
  await persistFileStore();
  return village;
}

export async function findVillageByCode(code) {
  const normalized = code.trim().toUpperCase();
  const db = await getMongo();
  if (db) return db.collection("seva_villages").findOne({ code: normalized });
  const store = await ensureFileStore();
  return store.villages.find((v) => v.code === normalized) ?? null;
}

export async function findVillageById(id) {
  const db = await getMongo();
  if (db) return db.collection("seva_villages").findOne({ _id: id });
  const store = await ensureFileStore();
  return store.villages.find((v) => v._id === id) ?? null;
}

export async function listWorkers(villageId) {
  const db = await getMongo();
  if (db) {
    return db
      .collection("seva_workers")
      .find({ villageId, isActive: true })
      .sort({ createdAt: 1 })
      .toArray();
  }
  const store = await ensureFileStore();
  return store.workers
    .filter((w) => w.villageId === villageId && w.isActive !== false)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listJobs(villageId) {
  const db = await getMongo();
  if (db) {
    return db
      .collection("seva_jobs")
      .find({ villageId })
      .sort({ createdAt: -1 })
      .toArray();
  }
  const store = await ensureFileStore();
  return store.jobs
    .filter((j) => j.villageId === villageId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function upsertWorkers(rows) {
  const inserted = [];
  const skippedClientIds = [];
  const db = await getMongo();

  if (db) {
    for (const row of rows) {
      const existing = await db.collection("seva_workers").findOne({
        clientId: row.clientId,
      });
      if (existing) {
        await db.collection("seva_workers").updateOne(
          { clientId: row.clientId },
          {
            $set: {
              displayName: row.displayName,
              skillKey: row.skillKey,
              phone: row.phone,
              isActive: row.isActive !== false,
              updatedAt: new Date().toISOString(),
            },
          },
        );
        skippedClientIds.push(row.clientId);
        continue;
      }
      const doc = {
        ...row,
        _id: newId(),
        isActive: row.isActive !== false,
        syncedAt: new Date().toISOString(),
      };
      await db.collection("seva_workers").insertOne(doc);
      inserted.push(doc);
    }
    return { inserted, skippedClientIds };
  }

  const store = await ensureFileStore();
  for (const row of rows) {
    const existing = store.workers.find((w) => w.clientId === row.clientId);
    if (existing) {
      existing.displayName = row.displayName;
      existing.skillKey = row.skillKey;
      existing.phone = row.phone;
      existing.isActive = row.isActive !== false;
      existing.updatedAt = new Date().toISOString();
      skippedClientIds.push(row.clientId);
      continue;
    }
    const doc = {
      ...row,
      _id: newId(),
      isActive: row.isActive !== false,
      syncedAt: new Date().toISOString(),
    };
    store.workers.push(doc);
    inserted.push(doc);
  }
  await persistFileStore();
  return { inserted, skippedClientIds };
}

export async function upsertJobs(rows) {
  const inserted = [];
  const skippedClientIds = [];
  const db = await getMongo();

  if (db) {
    for (const row of rows) {
      const existing = await db.collection("seva_jobs").findOne({
        clientId: row.clientId,
      });
      if (existing) {
        const incomingAt = row.updatedAt || row.createdAt;
        const existingAt = existing.updatedAt || existing.createdAt;
        if (!incomingAt || incomingAt >= existingAt) {
          await db.collection("seva_jobs").updateOne(
            { clientId: row.clientId },
            {
              $set: {
                skillKey: row.skillKey,
                posterName: row.posterName,
                payPaise: row.payPaise || 0,
                status: row.status,
                workerClientId: row.workerClientId || "",
                updatedAt: new Date().toISOString(),
              },
            },
          );
        }
        skippedClientIds.push(row.clientId);
        continue;
      }
      const doc = {
        ...row,
        _id: newId(),
        payPaise: row.payPaise || 0,
        status: row.status || "open",
        workerClientId: row.workerClientId || "",
        syncedAt: new Date().toISOString(),
      };
      await db.collection("seva_jobs").insertOne(doc);
      inserted.push(doc);
    }
    return { inserted, skippedClientIds };
  }

  const store = await ensureFileStore();
  for (const row of rows) {
    const existing = store.jobs.find((j) => j.clientId === row.clientId);
    if (existing) {
      const incomingAt = row.updatedAt || row.createdAt;
      const existingAt = existing.updatedAt || existing.createdAt;
      if (!incomingAt || incomingAt >= existingAt) {
        existing.skillKey = row.skillKey;
        existing.posterName = row.posterName;
        existing.payPaise = row.payPaise || 0;
        existing.status = row.status;
        existing.workerClientId = row.workerClientId || "";
        existing.updatedAt = new Date().toISOString();
      }
      skippedClientIds.push(row.clientId);
      continue;
    }
    const doc = {
      ...row,
      _id: newId(),
      payPaise: row.payPaise || 0,
      status: row.status || "open",
      workerClientId: row.workerClientId || "",
      syncedAt: new Date().toISOString(),
    };
    store.jobs.push(doc);
    inserted.push(doc);
  }
  await persistFileStore();
  return { inserted, skippedClientIds };
}

export async function getSevaSnapshot(villageId) {
  const [village, workers, jobs] = await Promise.all([
    findVillageById(villageId),
    listWorkers(villageId),
    listJobs(villageId),
  ]);
  return { village, workers, jobs };
}

export function publicVillage(village) {
  if (!village) return null;
  return {
    _id: village._id,
    code: village.code,
    name: village.name,
    language: village.language,
  };
}
