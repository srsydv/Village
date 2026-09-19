import { ObjectId } from "mongodb";
import { getDb } from "./mongo.js";

let indexed = false;

function clip(value, max) {
  return String(value || "").slice(0, max);
}

function capChats(chats) {
  if (!Array.isArray(chats)) return [];
  return chats.slice(0, 24).map((chat) => ({
    id: clip(chat?.id, 40),
    updatedAt: Number(chat?.updatedAt) || Date.now(),
    messages: Array.isArray(chat?.messages)
      ? chat.messages.slice(-16).map((m) => ({
          role: m?.role === "assistant" ? "assistant" : "user",
          content: clip(m?.content, 8000),
        }))
      : [],
  }));
}

function capTrips(trips) {
  if (!Array.isArray(trips)) return [];
  return trips.slice(0, 40);
}

export async function usersCol() {
  const db = await getDb();
  if (!db) {
    const err = new Error("MongoDB is not connected. Add MONGODB_URI to .env.");
    err.status = 503;
    throw err;
  }
  const col = db.collection("users");
  if (!indexed) {
    indexed = true;
    await col.createIndex({ googleId: 1 }, { unique: true }).catch(() => {});
    await col.createIndex({ email: 1 }).catch(() => {});
  }
  return col;
}

export function publicUser(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    email: doc.email || "",
    name: doc.name || "",
    picture: doc.picture || "",
    homeCity: doc.homeCity || "",
    currency: doc.currency || "INR",
    chats: Array.isArray(doc.chats) ? doc.chats : [],
    trips: Array.isArray(doc.trips) ? doc.trips : [],
  };
}

export async function upsertGoogleUser(google) {
  const col = await usersCol();
  const now = new Date();
  const doc = await col.findOneAndUpdate(
    { googleId: google.googleId },
    {
      $set: {
        email: google.email,
        picture: google.picture,
        updatedAt: now,
      },
      $setOnInsert: {
        googleId: google.googleId,
        name: google.name,
        homeCity: "",
        currency: "INR",
        chats: [],
        trips: [],
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  return doc?.value || doc || col.findOne({ googleId: google.googleId });
}

export async function getUser(uid) {
  if (!ObjectId.isValid(uid)) return null;
  const col = await usersCol();
  return col.findOne({ _id: new ObjectId(uid) });
}

export async function listUsers(limit = 100) {
  const col = await usersCol();
  return col
    .find({})
    .project({ chats: 0, trips: 0, googleId: 0 })
    .sort({ updatedAt: -1 })
    .limit(Math.min(Number(limit) || 100, 300))
    .toArray();
}

export async function listUsersForAdmin(limit = 100) {
  const col = await usersCol();
  return col
    .aggregate([
      { $sort: { updatedAt: -1 } },
      { $limit: Math.min(Number(limit) || 100, 300) },
      {
        $project: {
          email: 1,
          name: 1,
          picture: 1,
          homeCity: 1,
          currency: 1,
          createdAt: 1,
          updatedAt: 1,
          chatCount: { $size: { $ifNull: ["$chats", []] } },
          tripCount: { $size: { $ifNull: ["$trips", []] } },
          lastChat: { $arrayElemAt: ["$chats", 0] },
        },
      },
    ])
    .toArray();
}

export async function countUsers() {
  const col = await usersCol();
  return col.countDocuments();
}

export async function userStats() {
  const col = await usersCol();
  const [row] = await col
    .aggregate([
      {
        $group: {
          _id: null,
          users: { $sum: 1 },
          savedTrips: { $sum: { $size: { $ifNull: ["$trips", []] } } },
          chats: { $sum: { $size: { $ifNull: ["$chats", []] } } },
        },
      },
    ])
    .toArray();
  return { users: row?.users || 0, savedTrips: row?.savedTrips || 0, chats: row?.chats || 0 };
}

export async function saveUserState(uid, patch) {
  if (!ObjectId.isValid(uid)) return null;
  const $set = { updatedAt: new Date() };
  if (patch.name != null) $set.name = clip(patch.name, 80);
  if (patch.homeCity != null) $set.homeCity = clip(patch.homeCity, 120);
  if (patch.currency != null) $set.currency = clip(patch.currency, 8);
  if (patch.picture != null) $set.picture = clip(patch.picture, 400);
  if (patch.chats) $set.chats = capChats(patch.chats);
  if (patch.trips) $set.trips = capTrips(patch.trips);
  const col = await usersCol();
  const doc = await col.findOneAndUpdate({ _id: new ObjectId(uid) }, { $set }, { returnDocument: "after" });
  return doc?.value || doc;
}
