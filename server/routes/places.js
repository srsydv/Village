import { Router } from "express";
import { logActivity } from "../lib/activity.js";
import { lookupDestination, suggestPlaces } from "../lib/places.js";

const router = Router();

router.get("/suggest", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json({ places: [] });
  try {
    const places = await suggestPlaces(q);
    return res.json({ places });
  } catch (err) {
    const status = err.status === 400 ? err.status : 502;
    return res.status(status).json({
      error: err.message || "Could not look up that place.",
      places: [],
    });
  }
});

router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Add a destination, e.g. Jaipur or Kyoto." });
  try {
    const data = await lookupDestination(q);
    logActivity(req, { action: "places", query: q, ok: true });
    return res.json(data);
  } catch (err) {
    logActivity(req, { action: "places", query: q, ok: false, error: err.message });
    const status = err.status === 404 || err.status === 400 ? err.status : 502;
    return res.status(status).json({
      error: err.message || "Could not load hotels, food, and sights for that place.",
    });
  }
});

export default router;
