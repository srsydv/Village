import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import { nanoid } from "nanoid";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_DIR = path.join(ROOT_DIR, ".data");
const DATA_FILE = path.join(DATA_DIR, "samooh.json");

let memoryCache = null;
let mongoClient = null;
let mongoDb = null;

async function ensureFileStore() {
  if (memoryCache) return memoryCache;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DATA_FILE, "utf8");
    memoryCache = JSON.parse(raw);
  } catch {
    memoryCache = { groups: [], members: [], transactions: [] };
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
  await mongoDb.collection("transactions").createIndex({ clientId: 1 }, { unique: true });
  await mongoDb.collection("groups").createIndex({ code: 1 }, { unique: true });
  return mongoDb;
}

function newId() {
  return nanoid(12);
}

function groupCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export async function createGroup(input) {
  const db = await getMongo();
  const group = {
    _id: newId(),
    code: groupCode(),
    name: input.name.trim(),
    pinHash: input.pinHash,
    village: input.village?.trim() || undefined,
    language: "hi",
    createdAt: new Date().toISOString(),
  };

  if (db) {
    await db.collection("groups").insertOne(group);
    return group;
  }

  const store = await ensureFileStore();
  while (store.groups.some((g) => g.code === group.code)) {
    group.code = groupCode();
  }
  store.groups.push(group);
  await persistFileStore();
  return group;
}

export async function findGroupByCode(code) {
  const normalized = code.trim().toUpperCase();
  const db = await getMongo();
  if (db) {
    return db.collection("groups").findOne({ code: normalized });
  }
  const store = await ensureFileStore();
  return store.groups.find((g) => g.code === normalized) ?? null;
}

export async function findGroupById(id) {
  const db = await getMongo();
  if (db) {
    return db.collection("groups").findOne({ _id: id });
  }
  const store = await ensureFileStore();
  return store.groups.find((g) => g._id === id) ?? null;
}

export async function listMembers(groupId) {
  const db = await getMongo();
  if (db) {
    return db
      .collection("members")
      .find({ groupId, isActive: true })
      .sort({ createdAt: 1 })
      .toArray();
  }
  const store = await ensureFileStore();
  return store.members
    .filter((m) => m.groupId === groupId && m.isActive)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createMember(input) {
  const member = {
    _id: newId(),
    groupId: input.groupId,
    displayName: input.displayName.trim(),
    avatarKey: input.avatarKey,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const db = await getMongo();
  if (db) {
    await db.collection("members").insertOne(member);
    return member;
  }

  const store = await ensureFileStore();
  store.members.push(member);
  await persistFileStore();
  return member;
}

export async function listTransactions(groupId) {
  const db = await getMongo();
  if (db) {
    return db
      .collection("transactions")
      .find({ groupId })
      .sort({ createdAt: -1 })
      .toArray();
  }
  const store = await ensureFileStore();
  return store.transactions
    .filter((t) => t.groupId === groupId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function upsertTransactions(txs) {
  const inserted = [];
  const skippedClientIds = [];
  const db = await getMongo();

  if (db) {
    for (const tx of txs) {
      const existing = await db.collection("transactions").findOne({
        clientId: tx.clientId,
      });
      if (existing) {
        skippedClientIds.push(tx.clientId);
        continue;
      }
      const doc = {
        ...tx,
        _id: newId(),
        syncedAt: new Date().toISOString(),
      };
      await db.collection("transactions").insertOne(doc);
      inserted.push(doc);
    }
    return { inserted, skippedClientIds };
  }

  const store = await ensureFileStore();
  for (const tx of txs) {
    if (store.transactions.some((t) => t.clientId === tx.clientId)) {
      skippedClientIds.push(tx.clientId);
      continue;
    }
    const doc = {
      ...tx,
      _id: newId(),
      syncedAt: new Date().toISOString(),
    };
    store.transactions.push(doc);
    inserted.push(doc);
  }
  await persistFileStore();
  return { inserted, skippedClientIds };
}

export async function getGroupSnapshot(groupId) {
  const [group, members, transactions] = await Promise.all([
    findGroupById(groupId),
    listMembers(groupId),
    listTransactions(groupId),
  ]);
  return { group, members, transactions };
}

export function publicGroup(group) {
  if (!group) return null;
  return {
    _id: group._id,
    code: group.code,
    name: group.name,
    village: group.village,
    language: group.language,
  };
}
