import { Router } from "express";
import { createSessionToken, hashPin, verifyPin } from "../lib/auth.js";
import { createGroup, findGroupByCode, publicGroup } from "../lib/store.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const pin = String(req.body.pin || "").trim();
    const village = req.body.village ? String(req.body.village).trim() : undefined;

    if (name.length < 2) {
      return res.status(400).json({
        error: "समूह का नाम कम से कम 2 अक्षर का होना चाहिए",
      });
    }
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: "पिन 4 अंकों का होना चाहिए" });
    }

    const pinHash = await hashPin(pin);
    const group = await createGroup({ name, pinHash, village });
    const token = createSessionToken(group._id, group.code);
    return res.json({ group: publicGroup(group), token });
  } catch (err) {
    console.error("create group", err);
    return res.status(500).json({ error: "समूह नहीं बन पाया" });
  }
});

router.post("/:code/join", async (req, res) => {
  try {
    const pin = String(req.body.pin || "").trim();
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: "पिन 4 अंकों का होना चाहिए" });
    }

    const group = await findGroupByCode(req.params.code);
    if (!group) {
      return res.status(404).json({ error: "समूह नहीं मिला" });
    }

    const ok = await verifyPin(pin, group.pinHash);
    if (!ok) {
      return res.status(401).json({ error: "गलत पिन" });
    }

    const token = createSessionToken(group._id, group.code);
    return res.json({ group: publicGroup(group), token });
  } catch (err) {
    console.error("join group", err);
    return res.status(500).json({ error: "जॉइन नहीं हो पाया" });
  }
});

export default router;
