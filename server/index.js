import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import travelRouter from "./routes/travel.js";
import placesRouter from "./routes/places.js";
import activityRouter from "./routes/activity.js";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT_DIR, ".env") });
dotenv.config({ path: path.join(ROOT_DIR, ".env.local") });

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const isProd = process.env.NODE_ENV === "production";

if (isProd) app.set("trust proxy", 1);

function allowedOrigins() {
  const list = new Set(["https://localhost", "http://localhost", "capacitor://localhost"]);
  const extra = `${process.env.CORS_ORIGINS || ""},${process.env.PUBLIC_APP_URL || ""}`;
  for (const origin of extra.split(",")) {
    const trimmed = origin.trim().replace(/\/$/, "");
    if (trimmed) list.add(trimmed);
  }
  return [...list];
}

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || !isProd) return cb(null, true);
      const ok = allowedOrigins().includes(origin);
      cb(ok ? null : new Error("Origin not allowed"), ok);
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

const buckets = new Map();
app.use("/api/travel", (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const max = Number(process.env.TRAVEL_RATE_LIMIT) || 40;
  const hit = buckets.get(ip);
  if (!hit || now - hit.start > windowMs) {
    buckets.set(ip, { start: now, count: 1 });
    return next();
  }
  hit.count += 1;
  if (hit.count > max) {
    return res.status(429).json({ error: "Too many plans and chats from this network. Please wait a few minutes." });
  }
  return next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "aurea",
    gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  });
});

app.use(activityRouter);
app.use("/api/travel", travelRouter);
app.use("/api/places", placesRouter);

app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.message === "Origin not allowed") {
    return res.status(403).json({ error: "This app origin is not allowed." });
  }
  console.error("API error", err);
  const status = err.status || err.statusCode || 500;
  return res.status(status).json({ error: err.message || "Server error" });
});

if (isProd) {
  const dist = path.join(ROOT_DIR, "client", "dist");
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Aurea API http://${HOST}:${PORT}`);
});
