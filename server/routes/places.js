import { Router } from "express";
import { lookupDestination } from "../lib/places.js";

const router = Router();

router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Add a destination, e.g. Jaipur or Kyoto." });
  try {
    const data = await lookupDestination(q);
    return res.json(data);
  } catch (err) {
    const status = err.status === 404 || err.status === 400 ? err.status : 502;
    return res.status(status).json({
      error: err.message || "Could not load hotels, food, and sights for that place.",
    });
  }
});

export default router;
