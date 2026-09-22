let client;
let connecting;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (client) return client.db(process.env.MONGODB_DB || "safar");
  if (connecting) return connecting;

  connecting = connect(uri);
  try {
    return await connecting;
  } catch (err) {
    connecting = null;
    console.error("MongoDB connect failed", err.message);
    return null;
  }
}

async function connect(uri) {
  const { MongoClient } = await import("mongodb");
  const next = new MongoClient(uri, {
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 30_000,
    connectTimeoutMS: 8_000,
    serverSelectionTimeoutMS: 8_000,
  });
  await next.connect();
  client = next;
  connecting = null;
  return client.db(process.env.MONGODB_DB || "safar");
}
