import { Router } from "express";
import { googleAuthConfig, isAdminEmail, requireAuth, signSession, verifyGoogleCredential } from "../lib/auth.js";
import { deleteUser, getUser, publicUser, saveUserState, upsertGoogleUser } from "../lib/users.js";

const router = Router();

function withAdmin(user) {
  const next = publicUser(user);
  if (!next) return next;
  return { ...next, isAdmin: isAdminEmail(next.email) };
}

router.get("/config", (_req, res) => {
  res.json(googleAuthConfig());
});

router.post("/google", async (req, res) => {
  const google = await verifyGoogleCredential(req.body?.credential);
  const user = await upsertGoogleUser(google);
  if (!user?.name && google.name) {
    await saveUserState(user._id, { name: google.name });
    user.name = google.name;
  }
  const seed = {};
  if (!(user.chats || []).length && Array.isArray(req.body?.chats)) seed.chats = req.body.chats;
  if (!(user.trips || []).length && Array.isArray(req.body?.trips)) seed.trips = req.body.trips;
  if (!user.homeCity && req.body?.homeCity) seed.homeCity = req.body.homeCity;
  if (req.body?.currency) seed.currency = req.body.currency;
  if (!user.nationality && req.body?.nationality) seed.nationality = req.body.nationality;
  const saved = Object.keys(seed).length ? await saveUserState(user._id, seed) : user;
  const next = withAdmin(saved || user);
  return res.json({ token: signSession(saved || user), user: next });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await getUser(req.user.uid);
  if (!user) return res.status(401).json({ error: "Account not found. Sign in again." });
  return res.json({ user: withAdmin(user) });
});

router.put("/me", requireAuth, async (req, res) => {
  const user = await saveUserState(req.user.uid, {
    name: req.body?.name,
    homeCity: req.body?.homeCity,
    currency: req.body?.currency,
    nationality: req.body?.nationality,
    chats: req.body?.chats,
    trips: req.body?.trips,
  });
  if (!user) return res.status(401).json({ error: "Account not found. Sign in again." });
  return res.json({ user: withAdmin(user) });
});

router.delete("/me", requireAuth, async (req, res) => {
  const removed = await deleteUser(req.user.uid);
  if (!removed) return res.status(401).json({ error: "Account not found. Sign in again." });
  return res.json({ ok: true });
});

export default router;
