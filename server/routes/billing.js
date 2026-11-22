import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { isPlayProduct, verifyPlaySubscription } from "../lib/play.js";
import { getUser, saveSubscription, subscriptionView } from "../lib/users.js";

const router = Router();

router.get("/status", requireAuth, async (req, res, next) => {
  try {
    const user = await getUser(req.user.uid);
    res.json({ subscription: subscriptionView(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/verify", requireAuth, async (req, res, next) => {
  try {
    const productId = String(req.body?.productId || "");
    const purchaseToken = String(req.body?.purchaseToken || "");
    if (!isPlayProduct(productId)) {
      return res.status(400).json({ error: "Unknown plan." });
    }
    const subscription = await verifyPlaySubscription(productId, purchaseToken);
    await saveSubscription(req.user.uid, subscription);
    const user = await getUser(req.user.uid);
    res.json({ subscription: subscriptionView(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
