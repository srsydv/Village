import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import {
  createSessionToken,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  requireGroup,
  verifyPassword,
} from "../lib/auth.js";
import { listVillages, lookupPincode, reverseGeocode, uniqueNames } from "../lib/pincode.js";
import {
  fetchOfficialPage,
  isOfficialUrl,
  officialSources,
} from "../lib/official.js";
import {
  addComment,
  addGroupMembers,
  addMessage,
  createChatGroup,
  createPost,
  createRepost,
  createUser,
  findUserByEmail,
  findUserById,
  findUserRepost,
  findUsersByIds,
  getChatGroup,
  getPost,
  lastMessagesForRooms,
  listChatGroups,
  listComments,
  listDistrictPosts,
  listDmPeerIds,
  listKnownVillages,
  listMessages,
  listPostsByAuthor,
  listSavedPosts,
  listUserRepostOriginalIds,
  listVillageMembers,
  listVillagePosts,
  listVillagers,
  recordView,
  removeRepost,
  resolveVillageName,
  searchUsers,
  seedOfficialIfEmpty,
  toggleLike,
  toggleSave,
  updateUser,
} from "../lib/news-store.js";
import { dmRoom, groupRoom, publicUser, villageRoom } from "../lib/news-types.js";
import { emitChat, emitVillageAlert } from "../realtime.js";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const UPLOAD_DIR = path.join(ROOT_DIR, ".data", "uploads", "news");
mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 8) || ".bin";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();

function mediaTypeOf(file) {
  if (!file) return "none";
  if (file.mimetype.startsWith("image/")) return "image";
  if (file.mimetype.startsWith("video/")) return "video";
  if (file.mimetype.startsWith("audio/")) return "audio";
  return "file";
}

function publicUrl(file) {
  if (!file) return "";
  return `/uploads/news/${file.filename}`;
}

async function currentUser(req, res) {
  const session = requireGroup(req, res);
  if (!session) return null;
  const user = await findUserById(session.groupId);
  if (!user) {
    res.status(401).json({ error: "सत्र समाप्त" });
    return null;
  }
  return user;
}

router.get("/pincode/:pin", async (req, res) => {
  try {
    const data = await lookupPincode(req.params.pin);
    return res.json(data);
  } catch (err) {
    return res.status(400).json({ error: err.message || "पिन कोड नहीं मिला" });
  }
});

/** Villages for PIN + post office (India Post localities, same Block + nearby OSM). */
router.get("/villages", async (req, res) => {
  try {
    const data = await listVillages({
      pincode: req.query.pincode,
      postOffice: req.query.postOffice,
    });
    const known = await listKnownVillages(data.pincode, data.postOffice);
    data.villages = uniqueNames([...known, ...data.villages]);
    return res.json(data);
  } catch (err) {
    return res.status(400).json({ error: err.message || "गाँव सूची नहीं मिली" });
  }
});

router.post("/geo", async (req, res) => {
  try {
    const data = await reverseGeocode(req.body.lat, req.body.lng);
    return res.json(data);
  } catch (err) {
    return res.status(400).json({ error: err.message || "स्थान नहीं मिला" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const displayName = String(req.body.displayName || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const pincode = String(req.body.pincode || "").replace(/\D/g, "");
    const requestedVillage = String(req.body.villageName || "").trim();
    if (displayName.length < 1) {
      return res.status(400).json({ error: "नाम डालें" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "सही ईमेल डालें" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "पासवर्ड कम से कम 6 अक्षर का हो" });
    }
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ error: "6 अंक का पिन कोड डालें" });
    }
    if (!requestedVillage) {
      return res.status(400).json({ error: "गाँव का नाम चुनें" });
    }

    const postal = await lookupPincode(pincode);
    const postOffice = String(req.body.postOffice || postal.postOffices[0]?.name || "");
    const villageName = await resolveVillageName({
      pincode: postal.pincode,
      postOffice,
      villageName: requestedVillage,
    });
    const passwordHash = await hashPassword(password);
    const user = await createUser({
      displayName,
      email,
      passwordHash,
      pincode: postal.pincode,
      state: postal.state,
      district: postal.district,
      postOffice,
      villageName,
      lat: Number.isFinite(Number(req.body.lat)) ? Number(req.body.lat) : null,
      lng: Number.isFinite(Number(req.body.lng)) ? Number(req.body.lng) : null,
    });
    await seedOfficialIfEmpty(user.pincode, user.district, user.state);
    const token = createSessionToken(user._id, user.pincode);
    return res.json({ user: publicUser(user), token });
  } catch (err) {
    console.error("news register", err);
    const status = err.status === 409 ? 409 : 500;
    return res.status(status).json({ error: err.message || "रजिस्टर नहीं हुआ" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "ईमेल और पासवर्ड डालें" });
    }
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "यह ईमेल नहीं मिला — पहले खाता बनाएं" });
    const secret = user.passwordHash || user.pinHash;
    const ok = secret ? await verifyPassword(password, secret) : false;
    if (!ok) return res.status(401).json({ error: "गलत पासवर्ड" });
    const token = createSessionToken(user._id, user.pincode);
    return res.json({ user: publicUser(user), token });
  } catch (err) {
    return res.status(500).json({ error: "लॉगिन नहीं हुआ" });
  }
});

router.get("/me", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  return res.json({ user: publicUser(user) });
});

router.patch("/me", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  try {
    const updated = await updateUser(user._id, {
      displayName: req.body.displayName,
    });
    return res.json({ user: publicUser(updated) });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message || "सेव नहीं हुआ" });
  }
});

router.post("/me/avatar", upload.single("avatar"), async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  if (!req.file) return res.status(400).json({ error: "फोटो चुनें" });
  if (!String(req.file.mimetype || "").startsWith("image/")) {
    return res.status(400).json({ error: "केवल फोटो लगाएं" });
  }
  const avatarUrl = publicUrl(req.file);
  const updated = await updateUser(user._id, { avatarUrl });
  return res.json({ user: publicUser(updated) });
});

router.delete("/me/avatar", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const updated = await updateUser(user._id, { avatarUrl: "" });
  return res.json({ user: publicUser(updated) });
});

router.get("/villagers", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const people = await listVillagers(user.pincode, user.villageName, user._id);
  return res.json({
    villagers: people.map((p) => publicUser(p)),
  });
});

router.get("/official", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  await seedOfficialIfEmpty(user.pincode, user.district, user.state);
  const [notices, sources] = await Promise.all([
    listDistrictPosts(user.pincode, user.district),
    Promise.resolve(
      officialSources({
        pincode: user.pincode,
        district: user.district,
        state: user.state,
      }),
    ),
  ]);
  return res.json({ notices, sources, district: user.district, pincode: user.pincode });
});

router.get("/reader", async (req, res) => {
  try {
    const url = String(req.query.url || "");
    const page = await fetchOfficialPage(url);
    return res.json(page);
  } catch (err) {
    return res.status(400).json({ error: err.message || "पढ़ा नहीं जा सका" });
  }
});

router.get("/reader/frame", async (req, res) => {
  try {
    const url = String(req.query.url || "");
    if (!isOfficialUrl(url)) {
      return res.status(400).send("केवल सरकारी साइट");
    }
    const remote = await fetch(url, {
      headers: { "User-Agent": "VillageNews/1.0", Accept: "text/html" },
      redirect: "follow",
    });
    let html = await remote.text();
    html = html.replace(
      /<head[^>]*>/i,
      `$&<base href="${url}"><meta name="referrer" content="no-referrer">`,
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
    return res.send(html);
  } catch {
    return res.status(502).send("साइट नहीं खुली");
  }
});

router.get("/posts", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const posts = await listVillagePosts(user.pincode, user.villageName);
  const authors = await findUsersByIds([...new Set(posts.map((p) => p.authorId).filter(Boolean))]);
  const byId = Object.fromEntries(authors.map((a) => [a._id, a]));
  const repostedIds = await listUserRepostOriginalIds(user._id);
  const savedSet = new Set(user.savedPostIds || []);
  return res.json({
    posts: posts.map((p) => {
      const rootId = p.isRepost && p.originalPostId ? p.originalPostId : p._id;
      return {
        ...p,
        authorAvatar: byId[p.authorId]?.avatarUrl || "",
        liked: (p.likeIds || []).includes(user._id),
        viewCount: p.viewCount || (p.viewIds || []).length || 0,
        repostCount: p.repostCount || 0,
        reposted: repostedIds.has(rootId) || (p.isRepost && p.authorId === user._id),
        saved: savedSet.has(p._id) || savedSet.has(rootId),
      };
    }),
  });
});

router.get("/posts/saved", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const posts = await listSavedPosts(user._id);
  const authors = await findUsersByIds([...new Set(posts.map((p) => p.authorId).filter(Boolean))]);
  const byId = Object.fromEntries(authors.map((a) => [a._id, a]));
  const repostedIds = await listUserRepostOriginalIds(user._id);
  const savedSet = new Set(user.savedPostIds || []);
  return res.json({
    posts: posts.map((p) => ({
      ...p,
      authorAvatar: byId[p.authorId]?.avatarUrl || "",
      liked: (p.likeIds || []).includes(user._id),
      viewCount: p.viewCount || (p.viewIds || []).length || 0,
      repostCount: p.repostCount || 0,
      reposted: repostedIds.has(p._id),
      saved: savedSet.has(p._id),
    })),
  });
});

async function decoratePost(p, viewer) {
  const authors = await findUsersByIds([p.authorId, p.originalAuthorId].filter(Boolean));
  const byId = Object.fromEntries(authors.map((a) => [a._id, a]));
  const rootId = p.isRepost && p.originalPostId ? p.originalPostId : p._id;
  const repostedIds = await listUserRepostOriginalIds(viewer._id);
  const savedSet = new Set(viewer.savedPostIds || []);
  return {
    ...p,
    authorAvatar: byId[p.authorId]?.avatarUrl || "",
    liked: (p.likeIds || []).includes(viewer._id),
    viewCount: p.viewCount || (p.viewIds || []).length || 0,
    repostCount: p.repostCount || 0,
    reposted: repostedIds.has(rootId) || (p.isRepost && p.authorId === viewer._id),
    saved: savedSet.has(p._id) || savedSet.has(rootId),
  };
}

router.get("/posts/:id", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const post = await getPost(req.params.id);
  if (!post) return res.status(404).json({ error: "पोस्ट नहीं मिली" });
  return res.json({ post: await decoratePost(post, user) });
});

router.get("/users/:id", async (req, res) => {
  const me = await currentUser(req, res);
  if (!me) return;
  const profile = await findUserById(req.params.id);
  if (!profile) return res.status(404).json({ error: "यूज़र नहीं मिला" });
  const posts = await listPostsByAuthor(profile._id, 60);
  const decorated = await Promise.all(posts.map((p) => decoratePost(p, me)));
  const originals = posts.filter((p) => !p.isRepost);
  const likes = originals.reduce((n, p) => n + (p.likeCount || 0), 0);
  const views = originals.reduce((n, p) => n + (p.viewCount || (p.viewIds || []).length || 0), 0);
  return res.json({
    user: publicUser(profile),
    stats: {
      posts: originals.length,
      likes,
      views,
      reposts: posts.filter((p) => p.isRepost).length,
    },
    posts: decorated,
    isSelf: profile._id === me._id,
  });
});

router.post(
  "/posts",
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const user = await currentUser(req, res);
      if (!user) return;
      const text = String(req.body.text || "").trim();
      const mediaFile = req.files?.media?.[0] || null;
      const audioFile = req.files?.audio?.[0] || null;
      let type = mediaTypeOf(mediaFile);
      let mediaUrl = publicUrl(mediaFile);
      let audioUrl = publicUrl(audioFile);
      if (type === "audio" && !audioUrl) {
        audioUrl = mediaUrl;
        mediaUrl = "";
        type = "none";
      }
      if (!text && type === "none" && !audioUrl) {
        return res.status(400).json({ error: "लिखें, फोटो/वीडियो, या आवाज़ जोड़ें" });
      }
      const post = await createPost({
        authorId: user._id,
        authorName: user.displayName,
        villageName: user.villageName,
        pincode: user.pincode,
        district: user.district,
        state: user.state,
        text,
        mediaUrl,
        mediaType: type,
        audioUrl,
      });
      emitVillageAlert(user.pincode, user.villageName, {
        type: "post",
        postId: post._id,
        authorName: user.displayName,
        villageName: user.villageName,
        preview: text.slice(0, 80) || "नई खबर",
        createdAt: post.createdAt,
      });
      return res.json({ post: { ...post, liked: false } });
    } catch (err) {
      console.error("create post", err);
      return res.status(500).json({ error: err.message || "पोस्ट नहीं बनी" });
    }
  },
);

router.post("/posts/:id/like", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const result = await toggleLike(req.params.id, user._id);
  if (!result) return res.status(404).json({ error: "पोस्ट नहीं मिली" });
  return res.json(result);
});

router.post("/posts/:id/view", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const result = await recordView(req.params.id, user._id);
  if (!result) return res.status(404).json({ error: "पोस्ट नहीं मिली" });
  return res.json(result);
});

router.post("/posts/:id/save", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const result = await toggleSave(user._id, req.params.id);
  if (!result) return res.status(404).json({ error: "पोस्ट नहीं मिली" });
  const fresh = await findUserById(user._id);
  return res.json({ ...result, user: publicUser(fresh) });
});

router.post("/posts/:id/repost", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const original = await getPost(req.params.id);
  if (!original) return res.status(404).json({ error: "पोस्ट नहीं मिली" });
  const rootId = original.isRepost && original.originalPostId ? original.originalPostId : original._id;
  const existing = await findUserRepost(user._id, rootId);
  if (existing) {
    await removeRepost(user._id, rootId);
    const root = await getPost(rootId);
    return res.json({ reposted: false, repostCount: root?.repostCount || 0 });
  }
  const root = (await getPost(rootId)) || original;
  const { post } = await createRepost(user, root);
  const updated = await getPost(rootId);
  emitVillageAlert(user.pincode, user.villageName, {
    type: "repost",
    postId: post._id,
    authorName: user.displayName,
    villageName: user.villageName,
    preview: (root.text || "").slice(0, 80) || "रीपोस्ट",
    createdAt: post.createdAt,
  });
  return res.json({
    reposted: true,
    repostCount: updated?.repostCount || 0,
    post,
  });
});

router.post("/posts/:id/send", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const peerId = String(req.body.peerId || "");
  if (!peerId || peerId === user._id) {
    return res.status(400).json({ error: "किसे भेजना है चुनें" });
  }
  const peer = await findUserById(peerId);
  if (!peer) return res.status(404).json({ error: "यूज़र नहीं मिला" });
  const post = await getPost(req.params.id);
  if (!post) return res.status(404).json({ error: "पोस्ट नहीं मिली" });
  const note = String(req.body.note || "").trim();
  const roomId = dmRoom(user._id, peerId);
  const sharedPost = {
    _id: post._id,
    authorId: post.isRepost ? post.originalAuthorId || post.authorId : post.authorId,
    authorName: post.isRepost ? post.originalAuthorName || post.authorName : post.authorName,
    text: post.text || "",
    mediaUrl: post.mediaUrl || "",
    mediaType: post.mediaType || "none",
    audioUrl: post.audioUrl || "",
    villageName: post.villageName || "",
  };
  const msg = await addMessage({
    roomId,
    fromId: user._id,
    fromName: user.displayName,
    text: note || `📰 ${sharedPost.authorName}`,
    sharedPost,
  });
  emitChat(roomId, msg, [peerId, user._id]);
  return res.json({ message: msg, roomId, peerId });
});

router.get("/posts/:id/comments", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const comments = await listComments(req.params.id);
  return res.json({ comments });
});

router.post("/posts/:id/comments", upload.single("audio"), async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const text = String(req.body.text || "").trim();
  const audioUrl = publicUrl(req.file);
  if (!text && !audioUrl) {
    return res.status(400).json({ error: "टिप्पणी लिखें या आवाज़ भेजें" });
  }
  const post = await getPost(req.params.id);
  if (!post) return res.status(404).json({ error: "पोस्ट नहीं मिली" });
  const comment = await addComment({
    postId: req.params.id,
    authorId: user._id,
    authorName: user.displayName,
    text,
    audioUrl,
  });
  return res.json({ comment });
});

router.get("/chat/inbox", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const villagers = await listVillagers(user.pincode, user.villageName, user._id);
  const villagePeople = await listVillageMembers(user.pincode, user.villageName);
  const villageId = villageRoom(user.pincode, user.villageName);
  const groups = await listChatGroups(user._id);
  const dms = await listDmPeerIds(user._id);
  const roomIds = [villageId, ...groups.map((g) => groupRoom(g._id)), ...dms.map((d) => d.roomId)];
  const lastByRoom = await lastMessagesForRooms(roomIds);
  const peopleById = Object.fromEntries(villagers.map((v) => [v._id, v]));
  await Promise.all(
    dms
      .filter((d) => !peopleById[d.peerId])
      .map(async (d) => {
        const peer = await findUserById(d.peerId);
        if (peer) peopleById[d.peerId] = peer;
      }),
  );

  const threads = [
    {
      id: "village",
      kind: "group",
      title: user.villageName,
      subtitle: `${villagePeople.length} सदस्य`,
      roomId: villageId,
      last: lastByRoom[villageId] || null,
    },
    ...groups.map((g) => ({
      id: g._id,
      kind: "group",
      title: g.name,
      subtitle: `${(g.memberIds || []).length} सदस्य`,
      roomId: groupRoom(g._id),
      last: lastByRoom[groupRoom(g._id)] || null,
    })),
    ...dms.map((d) => {
      const peer = peopleById[d.peerId];
      return {
        id: d.peerId,
        kind: "dm",
        title: peer?.displayName || "गाँव वाला",
        subtitle: peer?.email || "निजी बात",
        roomId: d.roomId,
        last: lastByRoom[d.roomId] || null,
        peerId: d.peerId,
        avatarUrl: peer?.avatarUrl || "",
      };
    }),
    ...villagers
      .filter((v) => !dms.some((d) => d.peerId === v._id))
      .map((v) => ({
        id: v._id,
        kind: "dm",
        title: v.displayName,
        subtitle: "नई बात शुरू करें",
        roomId: dmRoom(user._id, v._id),
        last: null,
        peerId: v._id,
        avatarUrl: v.avatarUrl || "",
      })),
  ].sort((a, b) => {
    const at = a.last?.createdAt || "";
    const bt = b.last?.createdAt || "";
    if (a.id === "village") return -1;
    if (b.id === "village") return 1;
    return bt.localeCompare(at);
  });

  return res.json({ threads, villagers: villagers.map((p) => publicUser(p)) });
});

router.get("/chat/search", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json({ users: [] });
  const rows = await searchUsers(q, user._id, 20);
  return res.json({
    users: rows.map((p) => publicUser(p)),
  });
});

router.post("/chat/groups", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const name = String(req.body.name || "").trim();
  const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(String) : [];
  if (name.length < 1) return res.status(400).json({ error: "समूह का नाम डालें" });
  const others = [...new Set(memberIds.filter((id) => id && id !== user._id))];
  if (!others.length) return res.status(400).json({ error: "कम से कम एक सदस्य जोड़ें" });
  const found = await findUsersByIds(others);
  if (found.length !== others.length) {
    return res.status(400).json({ error: "कुछ सदस्य नहीं मिले" });
  }
  const group = await createChatGroup({
    name,
    memberIds: [user._id, ...others],
    createdBy: user._id,
    pincode: user.pincode,
    villageName: user.villageName,
  });
  return res.json({ group });
});

router.post("/chat/groups/:id/members", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const group = await getChatGroup(req.params.id);
  if (!group || !(group.memberIds || []).includes(user._id)) {
    return res.status(404).json({ error: "समूह नहीं मिला" });
  }
  const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(String) : [];
  const others = [...new Set(memberIds.filter((id) => id && id !== user._id))];
  if (!others.length) return res.status(400).json({ error: "कम से कम एक सदस्य जोड़ें" });
  const found = await findUsersByIds(others);
  if (found.length !== others.length) {
    return res.status(400).json({ error: "कुछ सदस्य नहीं मिले" });
  }
  const updated = await addGroupMembers(group._id, others);
  const members = await findUsersByIds(updated.memberIds || []);
  return res.json({ group: updated, members: members.map((p) => publicUser(p)) });
});

router.get("/chat", async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const peerId = String(req.query.peerId || "");
  const groupId = String(req.query.groupId || "");
  let roomId = villageRoom(user.pincode, user.villageName);
  let title = user.villageName;
  let kind = "group";
  let members = [];
  if (groupId && groupId !== "village") {
    const group = await getChatGroup(groupId);
    if (!group || !(group.memberIds || []).includes(user._id)) {
      return res.status(404).json({ error: "समूह नहीं मिला" });
    }
    roomId = groupRoom(group._id);
    title = group.name;
    kind = "group";
  } else if (peerId) {
    roomId = dmRoom(user._id, peerId);
    const peer = await findUserById(peerId);
    title = peer?.displayName || "निजी बात";
    kind = "dm";
    if (peer) members = [publicUser(peer)];
  }
  const messages = await listMessages(roomId);
  if (kind === "group" && groupId && groupId !== "village") {
    const group = await getChatGroup(groupId);
    members = (await findUsersByIds(group?.memberIds || [])).map((p) => publicUser(p));
  } else if (kind === "group") {
    members = (await listVillageMembers(user.pincode, user.villageName)).map((p) => publicUser(p));
  }
  return res.json({ roomId, messages, title, kind, members });
});

router.post("/chat", upload.single("audio"), async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) return;
  const peerId = String(req.body.peerId || "");
  const groupId = String(req.body.groupId || "");
  const text = String(req.body.text || "").trim();
  const audioUrl = publicUrl(req.file);
  if (!text && !audioUrl) {
    return res.status(400).json({ error: "संदेश लिखें" });
  }
  let roomId = villageRoom(user.pincode, user.villageName);
  let extraUserIds = [];
  if (groupId && groupId !== "village") {
    const group = await getChatGroup(groupId);
    if (!group || !(group.memberIds || []).includes(user._id)) {
      return res.status(404).json({ error: "समूह नहीं मिला" });
    }
    roomId = groupRoom(group._id);
    extraUserIds = group.memberIds || [];
  } else if (peerId) {
    roomId = dmRoom(user._id, peerId);
    extraUserIds = [peerId, user._id];
  } else {
    extraUserIds = (await listVillageMembers(user.pincode, user.villageName)).map((p) => p._id);
  }
  const msg = await addMessage({
    roomId,
    fromId: user._id,
    fromName: user.displayName,
    text,
    audioUrl,
  });
  emitChat(roomId, msg, extraUserIds);
  return res.json({ message: msg, roomId });
});

export default router;
