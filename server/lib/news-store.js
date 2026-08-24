import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import { newId } from "./news-types.js";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_DIR = path.join(ROOT_DIR, ".data");
const DATA_FILE = path.join(DATA_DIR, "news.json");

let memoryCache = null;
let mongoClient = null;
let mongoDb = null;

async function ensureFileStore() {
  if (memoryCache) return memoryCache;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    memoryCache = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    memoryCache.users ||= [];
    memoryCache.posts ||= [];
    memoryCache.comments ||= [];
    memoryCache.messages ||= [];
    memoryCache.groups ||= [];
    memoryCache.official ||= [];
  } catch {
    memoryCache = {
      users: [],
      posts: [],
      comments: [],
      messages: [],
      groups: [],
      official: [],
    };
    await persist();
  }
  return memoryCache;
}

async function persist() {
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
  await mongoDb.collection("news_users").createIndex({ pincode: 1, villageName: 1 });
  await mongoDb.collection("news_users").createIndex({ email: 1 }, { unique: true, sparse: true });
  await mongoDb.collection("news_users").createIndex({ location: "2dsphere" });
  await mongoDb.collection("news_posts").createIndex({ pincode: 1, villageName: 1, createdAt: -1 });
  await mongoDb.collection("news_comments").createIndex({ postId: 1, createdAt: 1 });
  await mongoDb.collection("news_messages").createIndex({ roomId: 1, createdAt: 1 });
  await mongoDb.collection("news_groups").createIndex({ memberIds: 1 });
  await mongoDb.collection("news_official").createIndex({ pincode: 1, district: 1, createdAt: -1 });
  return mongoDb;
}

export async function createUser(input) {
  const email = String(input.email || "").trim().toLowerCase();
  if (email && (await findUserByEmail(email))) {
    const err = new Error("यह ईमेल पहले से जुड़ा है");
    err.status = 409;
    throw err;
  }
  const user = {
    _id: newId(),
    displayName: input.displayName.trim(),
    email,
    passwordHash: input.passwordHash,
    pinHash: input.pinHash || input.passwordHash,
    pincode: input.pincode,
    state: input.state,
    district: input.district,
    postOffice: input.postOffice || "",
    villageName: input.villageName.trim(),
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    createdAt: new Date().toISOString(),
  };
  if (Number.isFinite(input.lng) && Number.isFinite(input.lat)) {
    user.location = { type: "Point", coordinates: [input.lng, input.lat] };
  }
  const db = await getMongo();
  if (db) {
    try {
      await db.collection("news_users").insertOne(user);
    } catch (err) {
      if (err?.code === 11000) {
        const dup = new Error("यह ईमेल पहले से जुड़ा है");
        dup.status = 409;
        throw dup;
      }
      throw err;
    }
    return user;
  }
  const store = await ensureFileStore();
  store.users.push(user);
  await persist();
  return user;
}

export async function findUserById(id) {
  const db = await getMongo();
  if (db) return db.collection("news_users").findOne({ _id: id });
  const store = await ensureFileStore();
  return store.users.find((u) => u._id === id) ?? null;
}

export async function findUserByEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  const db = await getMongo();
  if (db) return db.collection("news_users").findOne({ email: normalized });
  const store = await ensureFileStore();
  return store.users.find((u) => (u.email || "").toLowerCase() === normalized) ?? null;
}

export async function findUserByNameVillage(displayName, villageName, pincode) {
  const db = await getMongo();
  const q = {
    displayName: displayName.trim(),
    villageName: villageName.trim(),
    pincode: String(pincode),
  };
  if (db) return db.collection("news_users").findOne(q);
  const store = await ensureFileStore();
  return (
    store.users.find(
      (u) =>
        u.displayName === q.displayName &&
        u.villageName === q.villageName &&
        u.pincode === q.pincode,
    ) ?? null
  );
}

export async function listVillagers(pincode, villageName, excludeId) {
  const db = await getMongo();
  const q = { pincode: String(pincode), villageName };
  if (db) {
    return db
      .collection("news_users")
      .find({ ...q, _id: { $ne: excludeId } })
      .project({ pinHash: 0, passwordHash: 0 })
      .toArray();
  }
  const store = await ensureFileStore();
  return store.users
    .filter((u) => u.pincode === q.pincode && u.villageName === villageName && u._id !== excludeId)
    .map(({ pinHash, passwordHash, ...rest }) => rest);
}

export async function searchUsers(query, excludeId, limit = 20) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const db = await getMongo();
  const projection = { pinHash: 0, passwordHash: 0 };
  if (db) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    return db
      .collection("news_users")
      .find({
        _id: { $ne: excludeId },
        $or: [{ displayName: rx }, { email: rx }],
      })
      .project(projection)
      .limit(limit)
      .toArray();
  }
  const store = await ensureFileStore();
  const needle = q.toLocaleLowerCase("en-IN");
  return store.users
    .filter((u) => {
      if (u._id === excludeId) return false;
      const name = String(u.displayName || "").toLocaleLowerCase("en-IN");
      const email = String(u.email || "").toLocaleLowerCase("en-IN");
      return name.includes(needle) || email.includes(needle);
    })
    .slice(0, limit)
    .map(({ pinHash, passwordHash, ...rest }) => rest);
}

export async function createPost(input) {
  const post = {
    _id: newId(),
    authorId: input.authorId,
    authorName: input.authorName,
    villageName: input.villageName,
    pincode: input.pincode,
    district: input.district,
    state: input.state,
    text: input.text || "",
    mediaUrl: input.mediaUrl || "",
    mediaType: input.mediaType || "none",
    audioUrl: input.audioUrl || "",
    likeIds: [],
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date().toISOString(),
  };
  const db = await getMongo();
  if (db) {
    await db.collection("news_posts").insertOne(post);
    return post;
  }
  const store = await ensureFileStore();
  store.posts.push(post);
  await persist();
  return post;
}

export async function listVillagePosts(pincode, villageName, limit = 50) {
  const db = await getMongo();
  if (db) {
    return db
      .collection("news_posts")
      .find({ pincode: String(pincode), villageName })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
  const store = await ensureFileStore();
  return store.posts
    .filter((p) => p.pincode === String(pincode) && p.villageName === villageName)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function listDistrictPosts(pincode, district, limit = 50) {
  const db = await getMongo();
  if (db) {
    return db
      .collection("news_official")
      .find({
        $or: [{ pincode: String(pincode) }, { district }],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
  const store = await ensureFileStore();
  return store.official
    .filter((p) => p.pincode === String(pincode) || p.district === district)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function seedOfficialIfEmpty(pincode, district, state) {
  const existing = await listDistrictPosts(pincode, district, 1);
  if (existing.length) return;
  const items = [
    {
      _id: newId(),
      pincode: String(pincode),
      district,
      state,
      title: `${district} — सरकारी सूचना`,
      body: `${district} जिले के पिन ${pincode} क्षेत्र के लिए आधिकारिक अपडेट यहाँ दिखेंगे। जिला NIC पोर्टल और भारत सरकार की साइटें नीचे के रीडर में खुलती हैं।`,
      source: "Village",
      url: district ? `https://${String(district).toLowerCase().replace(/[^a-z]/g, "")}.nic.in/` : "https://www.india.gov.in/",
      createdAt: new Date().toISOString(),
    },
  ];
  if (String(pincode) === "276404") {
    items.push({
      _id: newId(),
      pincode: "276404",
      district: "Azamgarh",
      state: "Uttar Pradesh",
      title: "आज़मगढ़ / मुबारकपुर — स्थानीय सूचना बोर्ड",
      body: "पिन 276404 (मुबारकपुर) के निवासी जिला कार्यालय आज़मगढ़ की वेबसाइट पर योजना, राशन और पंचायत सूचना देख सकते हैं। गाँव नूरपुर सरैहजी की अपनी खबरें दूसरे टैब में लिखें।",
      source: "Azamgarh NIC",
      url: "https://azamgarh.nic.in/",
      createdAt: new Date().toISOString(),
    });
  }
  const db = await getMongo();
  if (db) {
    await db.collection("news_official").insertMany(items);
    return;
  }
  const store = await ensureFileStore();
  store.official.push(...items);
  await persist();
}

export async function getPost(id) {
  const db = await getMongo();
  if (db) return db.collection("news_posts").findOne({ _id: id });
  const store = await ensureFileStore();
  return store.posts.find((p) => p._id === id) ?? null;
}

export async function toggleLike(postId, userId) {
  const post = await getPost(postId);
  if (!post) return null;
  const liked = (post.likeIds || []).includes(userId);
  const likeIds = liked
    ? post.likeIds.filter((id) => id !== userId)
    : [...(post.likeIds || []), userId];
  const likeCount = likeIds.length;
  const db = await getMongo();
  if (db) {
    await db.collection("news_posts").updateOne({ _id: postId }, { $set: { likeIds, likeCount } });
  } else {
    post.likeIds = likeIds;
    post.likeCount = likeCount;
    await persist();
  }
  return { liked: !liked, likeCount };
}

export async function addComment(input) {
  const comment = {
    _id: newId(),
    postId: input.postId,
    authorId: input.authorId,
    authorName: input.authorName,
    text: input.text || "",
    audioUrl: input.audioUrl || "",
    createdAt: new Date().toISOString(),
  };
  const db = await getMongo();
  if (db) {
    await db.collection("news_comments").insertOne(comment);
    await db.collection("news_posts").updateOne({ _id: input.postId }, { $inc: { commentCount: 1 } });
    return comment;
  }
  const store = await ensureFileStore();
  store.comments.push(comment);
  const post = store.posts.find((p) => p._id === input.postId);
  if (post) post.commentCount = (post.commentCount || 0) + 1;
  await persist();
  return comment;
}

export async function listComments(postId) {
  const db = await getMongo();
  if (db) {
    return db
      .collection("news_comments")
      .find({ postId })
      .sort({ createdAt: 1 })
      .toArray();
  }
  const store = await ensureFileStore();
  return store.comments
    .filter((c) => c.postId === postId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addMessage(input) {
  const msg = {
    _id: newId(),
    roomId: input.roomId,
    fromId: input.fromId,
    fromName: input.fromName,
    text: input.text || "",
    audioUrl: input.audioUrl || "",
    createdAt: new Date().toISOString(),
  };
  const db = await getMongo();
  if (db) {
    await db.collection("news_messages").insertOne(msg);
    return msg;
  }
  const store = await ensureFileStore();
  store.messages.push(msg);
  await persist();
  return msg;
}

export async function listMessages(roomId, limit = 80) {
  const db = await getMongo();
  if (db) {
    const rows = await db
      .collection("news_messages")
      .find({ roomId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return rows.reverse();
  }
  const store = await ensureFileStore();
  return store.messages
    .filter((m) => m.roomId === roomId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-limit);
}

export async function lastMessagesForRooms(roomIds) {
  const ids = [...new Set(roomIds.filter(Boolean))];
  const map = {};
  if (!ids.length) return map;
  const db = await getMongo();
  if (db) {
    const rows = await db
      .collection("news_messages")
      .aggregate([
        { $match: { roomId: { $in: ids } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$roomId", doc: { $first: "$$ROOT" } } },
      ])
      .toArray();
    for (const row of rows) map[row._id] = row.doc;
    return map;
  }
  const store = await ensureFileStore();
  for (const id of ids) {
    const msgs = store.messages.filter((m) => m.roomId === id);
    if (msgs.length) map[id] = msgs[msgs.length - 1];
  }
  return map;
}

export async function listDmPeerIds(userId) {
  const prefix = "dm:";
  const db = await getMongo();
  const rooms = new Set();
  if (db) {
    const rows = await db
      .collection("news_messages")
      .find({ roomId: { $regex: `^${prefix}` } })
      .project({ roomId: 1 })
      .toArray();
    for (const row of rows) rooms.add(row.roomId);
  } else {
    const store = await ensureFileStore();
    for (const m of store.messages) {
      if (m.roomId?.startsWith(prefix)) rooms.add(m.roomId);
    }
  }
  const peers = [];
  for (const roomId of rooms) {
    const parts = roomId.slice(3).split(":");
    if (parts.includes(userId)) {
      const peerId = parts.find((id) => id !== userId);
      if (peerId) peers.push({ peerId, roomId });
    }
  }
  return peers;
}

export async function createChatGroup(input) {
  const group = {
    _id: newId(),
    name: input.name.trim(),
    memberIds: [...new Set(input.memberIds.filter(Boolean))],
    createdBy: input.createdBy,
    pincode: input.pincode,
    villageName: input.villageName,
    createdAt: new Date().toISOString(),
  };
  const db = await getMongo();
  if (db) {
    await db.collection("news_groups").insertOne(group);
    return group;
  }
  const store = await ensureFileStore();
  store.groups ||= [];
  store.groups.push(group);
  await persist();
  return group;
}

export async function getChatGroup(id) {
  const db = await getMongo();
  if (db) return db.collection("news_groups").findOne({ _id: id });
  const store = await ensureFileStore();
  store.groups ||= [];
  return store.groups.find((g) => g._id === id) ?? null;
}

export async function listChatGroups(userId) {
  const db = await getMongo();
  if (db) {
    return db.collection("news_groups").find({ memberIds: userId }).sort({ createdAt: -1 }).toArray();
  }
  const store = await ensureFileStore();
  store.groups ||= [];
  return store.groups.filter((g) => (g.memberIds || []).includes(userId));
}
