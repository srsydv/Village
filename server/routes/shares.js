import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { getIncoming, listIncoming, listOutgoing, removeShare, shareTripWith } from "../lib/shares.js";
import { findUserByLookup, shareCard } from "../lib/users.js";

const router = Router();
const lookups = new Map();

function allowLookup(uid) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const hit = lookups.get(uid);
  if (!hit || now - hit.start > windowMs) {
    lookups.set(uid, { start: now, count: 1 });
    return true;
  }
  hit.count += 1;
  return hit.count <= 20;
}

router.post("/lookup", requireAuth, async (req, res) => {
  if (!allowLookup(req.user.uid)) {
    return res.status(429).json({ error: "Too many searches. Wait a few minutes." });
  }
  const user = await findUserByLookup(req.body?.query);
  if (!user) return res.json({ found: false });
  if (String(user._id) === String(req.user.uid)) return res.json({ found: false, self: true });
  return res.json({ found: true, user: shareCard(user) });
});

router.post("/", requireAuth, async (req, res) => {
  const tripId = String(req.body?.tripId || "").trim();
  const userId = String(req.body?.userId || "").trim();
  if (!tripId || !userId) return res.status(400).json({ error: "Choose a person and a trip." });
  const share = await shareTripWith({ ownerId: req.user.uid, tripId, recipientId: userId });
  return res.json({ share });
});

router.get("/outgoing", requireAuth, async (req, res) => {
  const tripId = String(req.query.tripId || "").trim();
  if (!tripId) return res.status(400).json({ error: "Missing trip." });
  const shares = await listOutgoing(req.user.uid, tripId);
  return res.json({ shares });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const removed = await removeShare(req.user.uid, req.params.id);
  if (!removed) return res.status(404).json({ error: "That share is already gone." });
  return res.json({ ok: true });
});

router.get("/incoming", requireAuth, async (req, res) => {
  const shares = await listIncoming(req.user.uid);
  return res.json({ shares });
});

router.get("/incoming/:id", requireAuth, async (req, res) => {
  const share = await getIncoming(req.user.uid, req.params.id);
  if (!share) return res.status(404).json({ error: "This trip is no longer shared with you." });
  return res.json({ share });
});

export default router;
