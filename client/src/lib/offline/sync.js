import { nanoid } from "nanoid";
import { getMeta, offlineDb, setMeta } from "./db.js";

const SESSION_KEY = "session";
const GROUP_KEY = "group";

export async function saveSession(session) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  await setMeta(GROUP_KEY, JSON.stringify(session));
}

export function loadSession() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export async function replaceMembers(members) {
  if (!offlineDb) return;
  const groupId = members[0]?.groupId;
  if (groupId) {
    await offlineDb.members.where("groupId").equals(groupId).delete();
  }
  const rows = members.map((m) => ({
    id: m._id,
    groupId: m.groupId,
    displayName: m.displayName,
    avatarKey: m.avatarKey,
    isActive: m.isActive,
    createdAt: m.createdAt,
  }));
  if (rows.length) await offlineDb.members.bulkPut(rows);
}

export async function upsertLocalMember(member) {
  if (!offlineDb) return;
  await offlineDb.members.put({
    id: member._id,
    groupId: member.groupId,
    displayName: member.displayName,
    avatarKey: member.avatarKey,
    isActive: member.isActive,
    createdAt: member.createdAt,
  });
}

export async function getLocalMembers(groupId) {
  if (!offlineDb) return [];
  return offlineDb.members.where("groupId").equals(groupId).toArray();
}

export async function queueTransaction(input) {
  if (!offlineDb) throw new Error("Offline DB unavailable");
  const row = {
    clientId: nanoid(16),
    groupId: input.groupId,
    memberId: input.memberId,
    type: input.type,
    amountPaise: input.amountPaise,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy || "facilitator",
    pendingSync: true,
  };
  const id = await offlineDb.transactions.add(row);
  return { ...row, id };
}

export async function getLocalTransactions(groupId) {
  if (!offlineDb) return [];
  const rows = await offlineDb.transactions
    .where("groupId")
    .equals(groupId)
    .toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function pendingCount(groupId) {
  if (!offlineDb) return 0;
  return offlineDb.transactions
    .where("groupId")
    .equals(groupId)
    .filter((t) => t.pendingSync)
    .count();
}

export async function mergeServerTransactions(groupId, serverTxs) {
  if (!offlineDb) return;
  const local = await offlineDb.transactions
    .where("groupId")
    .equals(groupId)
    .toArray();
  const byClient = new Map(local.map((t) => [t.clientId, t]));

  for (const tx of serverTxs) {
    const existing = byClient.get(tx.clientId);
    if (existing?.id != null) {
      await offlineDb.transactions.update(existing.id, {
        pendingSync: false,
        serverId: tx._id,
        amountPaise: tx.amountPaise,
        type: tx.type,
        createdAt: tx.createdAt,
      });
    } else {
      await offlineDb.transactions.add({
        clientId: tx.clientId,
        groupId: tx.groupId,
        memberId: tx.memberId,
        type: tx.type,
        amountPaise: tx.amountPaise,
        createdAt: tx.createdAt,
        createdBy: tx.createdBy,
        pendingSync: false,
        serverId: tx._id,
      });
    }
  }
}

export async function syncNow(token, groupId) {
  if (!offlineDb) return { ok: false, error: "no db" };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, error: "offline" };
  }

  const pending = await offlineDb.transactions
    .where("groupId")
    .equals(groupId)
    .filter((t) => t.pendingSync)
    .toArray();

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      transactions: pending.map((t) => ({
        clientId: t.clientId,
        memberId: t.memberId,
        type: t.type,
        amountPaise: t.amountPaise,
        createdAt: t.createdAt,
        createdBy: t.createdBy,
      })),
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || "sync failed" };
  }

  const data = await res.json();
  if (data.members) await replaceMembers(data.members);
  if (data.transactions) await mergeServerTransactions(groupId, data.transactions);

  return { ok: true, data };
}

export async function pullSnapshot(token, groupId) {
  const res = await fetch("/api/sync", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.members) await replaceMembers(data.members);
  if (data.transactions) await mergeServerTransactions(groupId, data.transactions);
  return data;
}

export async function cachedGroup() {
  const raw = await getMeta(GROUP_KEY);
  if (!raw) return loadSession();
  try {
    return JSON.parse(raw);
  } catch {
    return loadSession();
  }
}
