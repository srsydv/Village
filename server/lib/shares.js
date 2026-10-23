import { ObjectId } from "mongodb";
import { getDb } from "./mongo.js";
import { getUser, shareCard } from "./users.js";

let indexed = false;

async function sharesCol() {
  const db = await getDb();
  if (!db) {
    const err = new Error("MongoDB is not connected. Add MONGODB_URI to .env.");
    err.status = 503;
    throw err;
  }
  const col = db.collection("tripShares");
  if (!indexed) {
    indexed = true;
    await col.createIndex({ ownerId: 1, tripId: 1, recipientId: 1 }, { unique: true }).catch(() => {});
    await col.createIndex({ recipientId: 1, createdAt: -1 }).catch(() => {});
    await col.createIndex({ ownerId: 1, tripId: 1 }).catch(() => {});
  }
  return col;
}

function publicTrip(trip) {
  if (!trip || typeof trip !== "object") return null;
  const copy = { ...trip };
  delete copy.checks;
  delete copy.visited;
  delete copy.dayNotes;
  return copy;
}

function shareId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

export async function shareTripWith({ ownerId, tripId, recipientId }) {
  const owner = await getUser(ownerId);
  const trip = (owner?.trips || []).find((item) => item?.id === tripId);
  if (!trip) {
    const err = new Error("That trip is not on your account.");
    err.status = 404;
    throw err;
  }
  if (String(ownerId) === String(recipientId)) {
    const err = new Error("You already have this trip.");
    err.status = 400;
    throw err;
  }
  const recipient = await getUser(recipientId);
  if (!recipient) {
    const err = new Error("That person is not on Safar.");
    err.status = 404;
    throw err;
  }
  const col = await sharesCol();
  const now = new Date();
  const filter = { ownerId: String(ownerId), tripId: String(tripId), recipientId: String(recipientId) };
  try {
    await col.updateOne(filter, { $set: { updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
  const row = await col.findOne(filter);
  return outgoingRow(row, recipient);
}

function outgoingRow(row, recipient) {
  return {
    id: String(row._id),
    sharedAt: row.createdAt,
    user: shareCard(recipient),
  };
}

export async function listOutgoing(ownerId, tripId) {
  const col = await sharesCol();
  const rows = await col.find({ ownerId: String(ownerId), tripId: String(tripId) }).sort({ createdAt: -1 }).toArray();
  const people = [];
  for (const row of rows) {
    const recipient = await getUser(row.recipientId);
    if (!recipient) continue;
    people.push(outgoingRow(row, recipient));
  }
  return people;
}

export async function removeShare(ownerId, id) {
  const oid = shareId(id);
  if (!oid) return false;
  const col = await sharesCol();
  const result = await col.deleteOne({ _id: oid, ownerId: String(ownerId) });
  return result.deletedCount > 0;
}

async function presentIncoming(row) {
  const owner = await getUser(row.ownerId);
  const trip = (owner?.trips || []).find((item) => item?.id === row.tripId);
  return {
    id: String(row._id),
    sharedAt: row.createdAt,
    sharedBy: shareCard(owner) || { id: "", name: "Someone", picture: "", username: "" },
    trip: publicTrip(trip),
    unavailable: !trip,
  };
}

export async function listIncoming(recipientId) {
  const col = await sharesCol();
  const rows = await col.find({ recipientId: String(recipientId) }).sort({ createdAt: -1 }).toArray();
  const shares = [];
  for (const row of rows) shares.push(await presentIncoming(row));
  return shares;
}

export async function getIncoming(recipientId, id) {
  const oid = shareId(id);
  if (!oid) return null;
  const col = await sharesCol();
  const row = await col.findOne({ _id: oid, recipientId: String(recipientId) });
  if (!row) return null;
  return presentIncoming(row);
}
