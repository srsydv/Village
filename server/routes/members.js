import { Router } from "express";
import { requireGroup } from "../lib/auth.js";
import { createMember, listMembers } from "../lib/store.js";
import { AVATARS } from "../lib/types.js";

const router = Router();

router.get("/", async (req, res) => {
  const session = requireGroup(req, res);
  if (!session) return;
  const members = await listMembers(session.groupId);
  return res.json({ members });
});

router.post("/", async (req, res) => {
  const session = requireGroup(req, res);
  if (!session) return;

  try {
    const displayName = String(req.body.displayName || "").trim();
    const avatarKey = String(req.body.avatarKey || "sun");

    if (displayName.length < 1) {
      return res.status(400).json({ error: "नाम डालें" });
    }
    if (!AVATARS.some((a) => a.key === avatarKey)) {
      return res.status(400).json({ error: "गलत अवतार" });
    }

    const member = await createMember({
      groupId: session.groupId,
      displayName,
      avatarKey,
    });
    return res.json({ member });
  } catch (err) {
    console.error("create member", err);
    return res.status(500).json({ error: "सदस्य नहीं जुड़ पाया" });
  }
});

export default router;
