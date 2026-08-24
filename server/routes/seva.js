import { Router } from "express";
import {
  createSessionToken,
  hashPin,
  requireGroup,
  verifyPin,
} from "../lib/auth.js";
import { JOB_STATUSES, SKILLS } from "../lib/seva-types.js";
import {
  createVillage,
  findVillageByCode,
  getSevaSnapshot,
  publicVillage,
  upsertJobs,
  upsertWorkers,
} from "../lib/seva-store.js";

const router = Router();

const skillKeys = SKILLS.map((s) => s.key);

function snapshotBody(snapshot) {
  return {
    village: publicVillage(snapshot.village),
    workers: snapshot.workers,
    jobs: snapshot.jobs,
  };
}

router.post("/villages", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const pin = String(req.body.pin || "").trim();
    if (name.length < 2) {
      return res.status(400).json({ error: "गाँव का नाम डालें" });
    }
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: "पिन 4 अंकों का होना चाहिए" });
    }
    const pinHash = await hashPin(pin);
    const village = await createVillage({ name, pinHash });
    const token = createSessionToken(village._id, village.code);
    return res.json({ village: publicVillage(village), token });
  } catch (err) {
    console.error("create village", err);
    return res.status(500).json({ error: "गाँव नहीं बन पाया" });
  }
});

router.post("/villages/:code/join", async (req, res) => {
  try {
    const pin = String(req.body.pin || "").trim();
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: "पिन 4 अंकों का होना चाहिए" });
    }
    const village = await findVillageByCode(req.params.code);
    if (!village) {
      return res.status(404).json({ error: "गाँव नहीं मिला" });
    }
    const ok = await verifyPin(pin, village.pinHash);
    if (!ok) {
      return res.status(401).json({ error: "गलत पिन" });
    }
    const token = createSessionToken(village._id, village.code);
    return res.json({ village: publicVillage(village), token });
  } catch (err) {
    console.error("join village", err);
    return res.status(500).json({ error: "जॉइन नहीं हो पाया" });
  }
});

router.get("/sync", async (req, res) => {
  const session = requireGroup(req, res);
  if (!session) return;
  const snapshot = await getSevaSnapshot(session.groupId);
  return res.json(snapshotBody(snapshot));
});

router.post("/sync", async (req, res) => {
  const session = requireGroup(req, res);
  if (!session) return;

  try {
    const workersIn = Array.isArray(req.body.workers) ? req.body.workers : [];
    const jobsIn = Array.isArray(req.body.jobs) ? req.body.jobs : [];

    const workers = workersIn
      .map((w) => ({
        villageId: session.groupId,
        clientId: String(w.clientId || ""),
        displayName: String(w.displayName || "").trim(),
        skillKey: String(w.skillKey || "other"),
        phone: String(w.phone || "").replace(/\D/g, "").slice(0, 10),
        isActive: w.isActive !== false,
        createdAt: w.createdAt || new Date().toISOString(),
        createdBy: String(w.createdBy || "neighbor"),
      }))
      .filter(
        (w) =>
          w.clientId &&
          w.displayName &&
          skillKeys.includes(w.skillKey),
      );

    const jobs = jobsIn
      .map((j) => ({
        villageId: session.groupId,
        clientId: String(j.clientId || ""),
        skillKey: String(j.skillKey || "other"),
        posterName: String(j.posterName || "").trim(),
        payPaise: Number(j.payPaise) || 0,
        status: JOB_STATUSES.includes(j.status) ? j.status : "open",
        workerClientId: String(j.workerClientId || ""),
        createdAt: j.createdAt || new Date().toISOString(),
        updatedAt: j.updatedAt || new Date().toISOString(),
        createdBy: String(j.createdBy || "neighbor"),
      }))
      .filter(
        (j) =>
          j.clientId &&
          j.posterName &&
          skillKeys.includes(j.skillKey),
      );

    const workerResult = await upsertWorkers(workers);
    const jobResult = await upsertJobs(jobs);
    const snapshot = await getSevaSnapshot(session.groupId);

    return res.json({
      workersInserted: workerResult.inserted.length,
      jobsInserted: jobResult.inserted.length,
      skippedWorkerIds: workerResult.skippedClientIds,
      skippedJobIds: jobResult.skippedClientIds,
      ...snapshotBody(snapshot),
    });
  } catch (err) {
    console.error("seva sync", err);
    return res.status(500).json({ error: "सिंक नहीं हुआ" });
  }
});

export default router;
