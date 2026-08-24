import Dexie from "dexie";

class GramSevaDB extends Dexie {
  constructor() {
    super("gramseva_village");
    this.version(1).stores({
      workers: "clientId, villageId, pendingSync",
      jobs: "clientId, villageId, pendingSync, status, createdAt",
      meta: "key",
    });
  }
}

export const sevaDb = typeof window !== "undefined" ? new GramSevaDB() : null;

export async function setSevaMeta(key, value) {
  if (!sevaDb) return;
  await sevaDb.meta.put({ key, value });
}

export async function getSevaMeta(key) {
  if (!sevaDb) return null;
  const row = await sevaDb.meta.get(key);
  return row?.value ?? null;
}
