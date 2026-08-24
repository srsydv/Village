import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import groupsRouter from "./routes/groups.js";
import membersRouter from "./routes/members.js";
import syncRouter from "./routes/sync.js";
import sevaRouter from "./routes/seva.js";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT_DIR, ".env") });
dotenv.config({ path: path.join(ROOT_DIR, ".env.local") });

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/groups", groupsRouter);
app.use("/api/members", membersRouter);
app.use("/api/sync", syncRouter);
app.use("/api/seva", sevaRouter);

if (process.env.NODE_ENV === "production") {
  const dist = path.join(ROOT_DIR, "client", "dist");
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Village API http://127.0.0.1:${PORT}`);
});
