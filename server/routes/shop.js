import { Router } from "express";
import { amazonProducts } from "../lib/amazonShop.js";

const router = Router();

router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const budget = String(req.query.budget || "").trim();
  if (q.length < 2) return res.json({ products: [] });
  try {
    const products = await amazonProducts(q, budget);
    return res.json({ products });
  } catch (err) {
    console.error("Amazon product lookup failed", err.message);
    return res.json({ products: [] });
  }
});

export default router;
