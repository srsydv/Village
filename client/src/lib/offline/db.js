import Dexie from "dexie";

class SamoohDB extends Dexie {
  constructor() {
    super("samooh_village");
    this.version(1).stores({
      members: "id, groupId",
      transactions: "++id, clientId, groupId, pendingSync, createdAt",
      meta: "key",
    });
  }
}

export const offlineDb = typeof window !== "undefined" ? new SamoohDB() : null;

export async function setMeta(key, value) {
  if (!offlineDb) return;
  await offlineDb.meta.put({ key, value });
}

export async function getMeta(key) {
  if (!offlineDb) return null;
  const row = await offlineDb.meta.get(key);
  return row?.value ?? null;
}
