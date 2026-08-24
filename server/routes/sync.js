import { Router } from "express";
import { requireGroup } from "../lib/auth.js";
import { getGroupSnapshot, publicGroup, upsertTransactions } from "../lib/store.js";
import { VALID_TYPES } from "../lib/types.js";

const router = Router();

function snapshotBody(snapshot) {
  return {
    members: snapshot.members,
    transactions: snapshot.transactions,
    group: publicGroup(snapshot.group),
  };
}

router.get("/", async (req, res) => {
  const session = requireGroup(req, res);
  if (!session) return;
  const snapshot = await getGroupSnapshot(session.groupId);
  return res.json(snapshotBody(snapshot));
});

router.post("/", async (req, res) => {
  const session = requireGroup(req, res);
  if (!session) return;

  try {
    const incoming = Array.isArray(req.body.transactions)
      ? req.body.transactions
      : [];

    const normalized = incoming
      .map((t) => ({
        groupId: session.groupId,
        memberId: String(t.memberId || ""),
        type: t.type,
        amountPaise: Number(t.amountPaise),
        createdAt: t.createdAt || new Date().toISOString(),
        createdBy: String(t.createdBy || "facilitator"),
        clientId: String(t.clientId || ""),
      }))
      .filter(
        (t) =>
          t.clientId &&
          t.memberId &&
          VALID_TYPES.includes(t.type) &&
          Number.isFinite(t.amountPaise) &&
          t.amountPaise > 0,
      );

    const { inserted, skippedClientIds } = await upsertTransactions(normalized);
    const snapshot = await getGroupSnapshot(session.groupId);

    return res.json({
      insertedCount: inserted.length,
      skippedClientIds,
      ...snapshotBody(snapshot),
    });
  } catch (err) {
    console.error("sync", err);
    return res.status(500).json({ error: "सिंक नहीं हुआ" });
  }
});

export default router;
