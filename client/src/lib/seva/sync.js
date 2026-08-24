import { nanoid } from "nanoid";
import { getSevaMeta, setSevaMeta, sevaDb } from "./db.js";

const SESSION_KEY = "seva_session";
const META_KEY = "seva_group";

export async function saveSevaSession(session) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  await setSevaMeta(META_KEY, JSON.stringify(session));
}

export function loadSevaSession() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSevaSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export async function getLocalWorkers(villageId) {
  if (!sevaDb) return [];
  return sevaDb.workers.where("villageId").equals(villageId).toArray();
}

export async function getLocalJobs(villageId) {
  if (!sevaDb) return [];
  const rows = await sevaDb.jobs.where("villageId").equals(villageId).toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function pendingSevaCount(villageId) {
  if (!sevaDb) return 0;
  const [w, j] = await Promise.all([
    sevaDb.workers
      .where("villageId")
      .equals(villageId)
      .filter((r) => r.pendingSync)
      .count(),
    sevaDb.jobs
      .where("villageId")
      .equals(villageId)
      .filter((r) => r.pendingSync)
      .count(),
  ]);
  return w + j;
}

export async function queueWorker(input) {
  if (!sevaDb) throw new Error("Offline DB unavailable");
  const row = {
    clientId: nanoid(16),
    villageId: input.villageId,
    displayName: input.displayName,
    skillKey: input.skillKey,
    phone: input.phone || "",
    isActive: true,
    createdAt: new Date().toISOString(),
    createdBy: "neighbor",
    pendingSync: true,
  };
  await sevaDb.workers.put(row);
  return row;
}

export async function queueJob(input) {
  if (!sevaDb) throw new Error("Offline DB unavailable");
  const now = new Date().toISOString();
  const row = {
    clientId: nanoid(16),
    villageId: input.villageId,
    skillKey: input.skillKey,
    posterName: input.posterName,
    payPaise: input.payPaise || 0,
    status: "open",
    workerClientId: "",
    createdAt: now,
    updatedAt: now,
    createdBy: "neighbor",
    pendingSync: true,
  };
  await sevaDb.jobs.put(row);
  return row;
}

export async function updateLocalJob(clientId, patch) {
  if (!sevaDb) return;
  const existing = await sevaDb.jobs.get(clientId);
  if (!existing) return;
  await sevaDb.jobs.put({
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
    pendingSync: true,
  });
}

function toLocalWorker(w) {
  return {
    clientId: w.clientId,
    villageId: w.villageId,
    displayName: w.displayName,
    skillKey: w.skillKey,
    phone: w.phone || "",
    isActive: w.isActive !== false,
    createdAt: w.createdAt,
    createdBy: w.createdBy || "neighbor",
    pendingSync: false,
    serverId: w._id,
  };
}

function toLocalJob(j) {
  return {
    clientId: j.clientId,
    villageId: j.villageId,
    skillKey: j.skillKey,
    posterName: j.posterName,
    payPaise: j.payPaise || 0,
    status: j.status || "open",
    workerClientId: j.workerClientId || "",
    createdAt: j.createdAt,
    updatedAt: j.updatedAt || j.createdAt,
    createdBy: j.createdBy || "neighbor",
    pendingSync: false,
    serverId: j._id,
  };
}

export async function mergeSevaSnapshot(villageId, data) {
  if (!sevaDb) return;
  if (data.workers) {
    for (const w of data.workers) {
      const local = await sevaDb.workers.get(w.clientId);
      if (local?.pendingSync) continue;
      await sevaDb.workers.put(toLocalWorker(w));
    }
  }
  if (data.jobs) {
    for (const j of data.jobs) {
      const local = await sevaDb.jobs.get(j.clientId);
      if (local?.pendingSync) continue;
      await sevaDb.jobs.put(toLocalJob(j));
    }
  }
}

export async function syncSevaNow(token, villageId) {
  if (!sevaDb) return { ok: false, error: "no db" };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, error: "offline" };
  }

  const [pendingWorkers, pendingJobs] = await Promise.all([
    sevaDb.workers
      .where("villageId")
      .equals(villageId)
      .filter((w) => w.pendingSync)
      .toArray(),
    sevaDb.jobs
      .where("villageId")
      .equals(villageId)
      .filter((j) => j.pendingSync)
      .toArray(),
  ]);

  const res = await fetch("/api/seva/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      workers: pendingWorkers,
      jobs: pendingJobs,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || "sync failed" };
  }

  const data = await res.json();
  const syncedIds = new Set([
    ...pendingWorkers.map((w) => w.clientId),
    ...pendingJobs.map((j) => j.clientId),
  ]);
  for (const id of syncedIds) {
    const worker = await sevaDb.workers.get(id);
    if (worker) await sevaDb.workers.put({ ...worker, pendingSync: false });
    const job = await sevaDb.jobs.get(id);
    if (job) await sevaDb.jobs.put({ ...job, pendingSync: false });
  }
  await mergeSevaSnapshot(villageId, data);
  return { ok: true, data };
}

export async function pullSevaSnapshot(token, villageId) {
  const res = await fetch("/api/seva/sync", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  await mergeSevaSnapshot(villageId, data);
  return data;
}

export async function cachedSevaSession() {
  const raw = await getSevaMeta(META_KEY);
  if (!raw) return loadSevaSession();
  try {
    return JSON.parse(raw);
  } catch {
    return loadSevaSession();
  }
}
