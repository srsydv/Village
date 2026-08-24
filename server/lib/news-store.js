import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import { displayVillage, foldVillage, newId } from "./news-types.js";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_DIR = path.join(ROOT_DIR, ".data");
const DATA_FILE = path.join(DATA_DIR, "news.json");

let memoryCache = null;
let mongoClient = null;
let mongoDb = null;
let mongoConnecting = null;
let mongoFailUntil = 0;

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
    memoryCache.places ||= [];
  } catch {
    memoryCache = {
      users: [],
      posts: [],
      comments: [],
      messages: [],
      groups: [],
      official: [],
      places: [],
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
  if (Date.now() < mongoFailUntil) return null;
  if (mongoConnecting) return mongoConnecting;

  mongoConnecting = (async () => {
    try {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
      });
      await client.connect();
      mongoClient = client;
      mongoDb = client.db(process.env.MONGODB_DB || "village_samooh");
      await mongoDb.collection("news_users").createIndex({ pincode: 1, villageName: 1 });
      await mongoDb.collection("news_users").createIndex({ email: 1 }, { unique: true, sparse: true });
      await mongoDb.collection("news_users").createIndex({ location: "2dsphere" });
      await mongoDb.collection("news_posts").createIndex({ pincode: 1, villageName: 1, createdAt: -1 });
      await mongoDb.collection("news_comments").createIndex({ postId: 1, createdAt: 1 });
      await mongoDb.collection("news_messages").createIndex({ roomId: 1, createdAt: 1 });
      await mongoDb.collection("news_groups").createIndex({ memberIds: 1 });
      await mongoDb.collection("news_official").createIndex({ pincode: 1, district: 1, createdAt: -1 });
      await mongoDb.collection("news_places").createIndex({ pincode: 1, nameKey: 1 });
      await mongoDb.collection("news_places").createIndex(
        { pincode: 1, postOfficeKey: 1, nameKey: 1 },
        { unique: true },
      );
      mongoFailUntil = 0;
      return mongoDb;
    } catch (err) {
      console.error("Mongo unavailable, using local file store:", err.message);
      mongoFailUntil = Date.now() + 30_000;
      mongoClient = null;
      mongoDb = null;
      return null;
    } finally {
      mongoConnecting = null;
    }
  })();

  return mongoConnecting;
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
    postOffice: displayVillage(input.postOffice || ""),
    villageName: displayVillage(input.villageName),
    villageKey: foldVillage(input.villageName),
    avatarUrl: "",
    savedPostIds: [],
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

export async function updateUser(id, patch) {
  const updates = {};
  if (patch.displayName != null) {
    const name = String(patch.displayName || "").trim();
    if (name.length < 1) {
      const err = new Error("नाम डालें");
      err.status = 400;
      throw err;
    }
    updates.displayName = name;
  }
  if (patch.avatarUrl !== undefined) {
    updates.avatarUrl = String(patch.avatarUrl || "");
  }
  if (!Object.keys(updates).length) return findUserById(id);

  const db = await getMongo();
  if (db) {
    await db.collection("news_users").updateOne({ _id: id }, { $set: updates });
    return findUserById(id);
  }
  const store = await ensureFileStore();
  const user = store.users.find((u) => u._id === id);
  if (!user) return null;
  Object.assign(user, updates);
  await persist();
  return user;
}

export async function listKnownVillages(pincode, postOffice) {
  const pin = String(pincode);
  const officeKey = foldVillage(postOffice);
  const names = [];
  const db = await getMongo();
  if (db) {
    const [places, users] = await Promise.all([
      db.collection("news_places").find({ pincode: pin }).toArray(),
      db.collection("news_users").find({ pincode: pin }).project({ villageName: 1, postOffice: 1 }).toArray(),
    ]);
    const placeRows = officeKey
      ? places.filter((r) => !r.postOfficeKey || r.postOfficeKey === officeKey)
      : places;
    const userRows = officeKey
      ? users.filter((u) => !u.postOffice || foldVillage(u.postOffice) === officeKey)
      : users;
    names.push(...placeRows.map((r) => r.name), ...userRows.map((u) => u.villageName));
    names.push(...places.map((r) => r.name), ...users.map((u) => u.villageName));
  } else {
    const store = await ensureFileStore();
    store.places ||= [];
    const places = store.places.filter((r) => r.pincode === pin);
    const users = store.users.filter((u) => u.pincode === pin);
    const placeRows = officeKey
      ? places.filter((r) => !r.postOfficeKey || r.postOfficeKey === officeKey)
      : places;
    const userRows = officeKey
      ? users.filter((u) => !u.postOffice || foldVillage(u.postOffice) === officeKey)
      : users;
    names.push(...placeRows.map((r) => r.name), ...userRows.map((u) => u.villageName));
    names.push(...places.map((r) => r.name), ...users.map((u) => u.villageName));
  }
  const seen = new Set();
  const out = [];
  for (const raw of names) {
    const name = displayVillage(raw);
    const key = foldVillage(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export async function resolveVillageName({ pincode, postOffice, villageName }) {
  const pin = String(pincode);
  const name = displayVillage(villageName);
  const nameKey = foldVillage(name);
  if (!nameKey) return name;
  const office = displayVillage(postOffice);
  const officeKey = foldVillage(office);

  const db = await getMongo();
  if (db) {
    const existingPlace = await db.collection("news_places").findOne({ pincode: pin, nameKey });
    const pinUsers = await db
      .collection("news_users")
      .find({ pincode: pin })
      .project({ villageName: 1, villageKey: 1 })
      .toArray();
    const existingUser = pinUsers.find((u) => u.villageKey === nameKey || foldVillage(u.villageName) === nameKey);
    const canonical = existingPlace?.name || existingUser?.villageName || name;
    try {
      await db.collection("news_places").updateOne(
        { pincode: pin, postOfficeKey: officeKey, nameKey },
        {
          $setOnInsert: {
            _id: newId(),
            pincode: pin,
            postOffice: office,
            postOfficeKey: officeKey,
            name: displayVillage(canonical),
            nameKey,
            createdAt: new Date().toISOString(),
          },
        },
        { upsert: true },
      );
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
    return displayVillage(canonical);
  }

  const store = await ensureFileStore();
  store.places ||= [];
  const existingPlace = store.places.find((p) => p.pincode === pin && p.nameKey === nameKey);
  const existingUser = store.users.find((u) => u.pincode === pin && foldVillage(u.villageName) === nameKey);
  const canonical = existingPlace?.name || existingUser?.villageName || name;
  const already = store.places.some(
    (p) => p.pincode === pin && p.postOfficeKey === officeKey && p.nameKey === nameKey,
  );
  if (!already) {
    store.places.push({
      _id: newId(),
      pincode: pin,
      postOffice: office,
      postOfficeKey: officeKey,
      name: displayVillage(canonical),
      nameKey,
      createdAt: new Date().toISOString(),
    });
    await persist();
  }
  return displayVillage(canonical);
}

export async function listVillageMembers(pincode, villageName) {
  const pin = String(pincode);
  const key = foldVillage(villageName);
  const projection = { pinHash: 0, passwordHash: 0 };
  const db = await getMongo();
  if (db) {
    const rows = await db.collection("news_users").find({ pincode: pin }).project(projection).toArray();
    return rows.filter((u) => u.villageKey === key || foldVillage(u.villageName) === key);
  }
  const store = await ensureFileStore();
  return store.users
    .filter((u) => u.pincode === pin && foldVillage(u.villageName) === key)
    .map(({ pinHash, passwordHash, ...rest }) => rest);
}

export async function findUserById(id) {
  const db = await getMongo();
  if (db) return db.collection("news_users").findOne({ _id: id });
  const store = await ensureFileStore();
  return store.users.find((u) => u._id === id) ?? null;
}

export async function findUsersByIds(ids) {
  const unique = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!unique.length) return [];
  const db = await getMongo();
  const projection = { pinHash: 0, passwordHash: 0 };
  if (db) {
    return db
      .collection("news_users")
      .find({ _id: { $in: unique } })
      .project(projection)
      .toArray();
  }
  const store = await ensureFileStore();
  return store.users
    .filter((u) => unique.includes(u._id))
    .map(({ pinHash, passwordHash, ...rest }) => rest);
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
  const pin = String(pincode);
  if (db) {
    const rows = await db
      .collection("news_users")
      .find({ pincode: pin, _id: { $ne: excludeId } })
      .project({ pinHash: 0, passwordHash: 0 })
      .toArray();
    const village = String(villageName || "").toLocaleLowerCase("en-IN");
    return rows.sort((a, b) => {
      const aSame = String(a.villageName || "").toLocaleLowerCase("en-IN") === village ? 0 : 1;
      const bSame = String(b.villageName || "").toLocaleLowerCase("en-IN") === village ? 0 : 1;
      return aSame - bSame;
    });
  }
  const store = await ensureFileStore();
  const village = String(villageName || "").toLocaleLowerCase("en-IN");
  return store.users
    .filter((u) => u.pincode === pin && u._id !== excludeId)
    .sort((a, b) => {
      const aSame = String(a.villageName || "").toLocaleLowerCase("en-IN") === village ? 0 : 1;
      const bSame = String(b.villageName || "").toLocaleLowerCase("en-IN") === village ? 0 : 1;
      return aSame - bSame;
    })
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
    villageName: displayVillage(input.villageName),
    villageKey: foldVillage(input.villageName),
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
    viewIds: [],
    viewCount: 0,
    repostCount: 0,
    isRepost: Boolean(input.isRepost),
    originalPostId: input.originalPostId || "",
    originalAuthorId: input.originalAuthorId || "",
    originalAuthorName: input.originalAuthorName || "",
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
  const pin = String(pincode);
  const key = foldVillage(villageName);
  const db = await getMongo();
  if (db) {
    const rows = await db
      .collection("news_posts")
      .find({ pincode: pin })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return rows
      .filter((p) => p.villageKey === key || foldVillage(p.villageName) === key)
      .slice(0, limit);
  }
  const store = await ensureFileStore();
  return store.posts
    .filter((p) => p.pincode === pin && foldVillage(p.villageName) === key)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function listPostsByAuthor(authorId, limit = 60) {
  const id = String(authorId);
  const db = await getMongo();
  if (db) {
    return db
      .collection("news_posts")
      .find({ authorId: id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
  const store = await ensureFileStore();
  return store.posts
    .filter((p) => p.authorId === id)
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

export async function recordView(postId, userId) {
  const post = await getPost(postId);
  if (!post) return null;
  const viewIds = post.viewIds || [];
  if (viewIds.includes(userId)) {
    return { viewCount: post.viewCount || viewIds.length, viewed: true };
  }
  const next = [...viewIds, userId];
  const viewCount = next.length;
  const db = await getMongo();
  if (db) {
    await db.collection("news_posts").updateOne({ _id: postId }, { $set: { viewIds: next, viewCount } });
  } else {
    post.viewIds = next;
    post.viewCount = viewCount;
    await persist();
  }
  return { viewCount, viewed: true };
}

export async function toggleSave(userId, postId) {
  const user = await findUserById(userId);
  if (!user) return null;
  const post = await getPost(postId);
  if (!post) return null;
  const saved = (user.savedPostIds || []).includes(postId);
  const savedPostIds = saved
    ? (user.savedPostIds || []).filter((id) => id !== postId)
    : [...(user.savedPostIds || []), postId];
  const db = await getMongo();
  if (db) {
    await db.collection("news_users").updateOne({ _id: userId }, { $set: { savedPostIds } });
  } else {
    user.savedPostIds = savedPostIds;
    await persist();
  }
  return { saved: !saved, saveCount: savedPostIds.length };
}

export async function listSavedPosts(userId, limit = 50) {
  const user = await findUserById(userId);
  if (!user) return [];
  const ids = [...(user.savedPostIds || [])].reverse().slice(0, limit);
  if (!ids.length) return [];
  const db = await getMongo();
  if (db) {
    const rows = await db.collection("news_posts").find({ _id: { $in: ids } }).toArray();
    const byId = Object.fromEntries(rows.map((p) => [p._id, p]));
    return ids.map((id) => byId[id]).filter(Boolean);
  }
  const store = await ensureFileStore();
  const byId = Object.fromEntries(store.posts.map((p) => [p._id, p]));
  return ids.map((id) => byId[id]).filter(Boolean);
}

export async function listUserRepostOriginalIds(userId) {
  const db = await getMongo();
  if (db) {
    const rows = await db
      .collection("news_posts")
      .find({ authorId: userId, isRepost: true })
      .project({ originalPostId: 1 })
      .toArray();
    return new Set(rows.map((r) => r.originalPostId).filter(Boolean));
  }
  const store = await ensureFileStore();
  return new Set(
    store.posts.filter((p) => p.authorId === userId && p.isRepost).map((p) => p.originalPostId).filter(Boolean),
  );
}

export async function findUserRepost(userId, originalPostId) {
  const db = await getMongo();
  if (db) {
    return db.collection("news_posts").findOne({
      authorId: userId,
      isRepost: true,
      originalPostId,
    });
  }
  const store = await ensureFileStore();
  return store.posts.find((p) => p.authorId === userId && p.isRepost && p.originalPostId === originalPostId) ?? null;
}

export async function createRepost(user, original) {
  const existing = await findUserRepost(user._id, original._id);
  if (existing) return { post: existing, already: true };
  const rootId = original.isRepost && original.originalPostId ? original.originalPostId : original._id;
  const root = original.isRepost ? (await getPost(rootId)) || original : original;
  const post = await createPost({
    authorId: user._id,
    authorName: user.displayName,
    villageName: user.villageName,
    pincode: user.pincode,
    district: user.district,
    state: user.state,
    text: root.text || "",
    mediaUrl: root.mediaUrl || "",
    mediaType: root.mediaType || "none",
    audioUrl: root.audioUrl || "",
    isRepost: true,
    originalPostId: root._id,
    originalAuthorId: root.authorId,
    originalAuthorName: root.authorName,
  });
  const count = (root.repostCount || 0) + 1;
  const db = await getMongo();
  if (db) {
    await db.collection("news_posts").updateOne({ _id: root._id }, { $set: { repostCount: count } });
  } else {
    root.repostCount = count;
    await persist();
  }
  return { post, already: false };
}

export async function removeRepost(userId, originalPostId) {
  const existing = await findUserRepost(userId, originalPostId);
  if (!existing) return { removed: false };
  const db = await getMongo();
  if (db) {
    await db.collection("news_posts").deleteOne({ _id: existing._id });
    const root = await getPost(originalPostId);
    if (root) {
      const repostCount = Math.max(0, (root.repostCount || 1) - 1);
      await db.collection("news_posts").updateOne({ _id: originalPostId }, { $set: { repostCount } });
    }
  } else {
    const store = await ensureFileStore();
    store.posts = store.posts.filter((p) => p._id !== existing._id);
    const root = store.posts.find((p) => p._id === originalPostId);
    if (root) root.repostCount = Math.max(0, (root.repostCount || 1) - 1);
    await persist();
  }
  return { removed: true };
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
    sharedPost: input.sharedPost || null,
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

export async function addGroupMembers(groupId, memberIds) {
  const extra = [...new Set((memberIds || []).map(String).filter(Boolean))];
  if (!extra.length) return getChatGroup(groupId);
  const db = await getMongo();
  if (db) {
    await db.collection("news_groups").updateOne({ _id: groupId }, { $addToSet: { memberIds: { $each: extra } } });
    return db.collection("news_groups").findOne({ _id: groupId });
  }
  const store = await ensureFileStore();
  store.groups ||= [];
  const group = store.groups.find((g) => g._id === groupId);
  if (!group) return null;
  group.memberIds = [...new Set([...(group.memberIds || []), ...extra])];
  await persist();
  return group;
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
