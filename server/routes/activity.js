import { Router } from "express";
import { listActivity, activityStoreKind } from "../lib/activity.js";

const router = Router();

function authorized(req) {
  const expected = process.env.ACTIVITY_SECRET;
  if (!expected) return false;
  const got = req.query.secret || req.get("x-activity-secret") || "";
  return got === expected;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

router.get("/api/activity", async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: "Not allowed." });
  const rows = await listActivity(req.query.limit);
  return res.json({ store: activityStoreKind(), count: rows.length, activity: rows });
});

router.get("/ops/activity", async (req, res) => {
  if (!authorized(req)) {
    res.status(401).type("html").send("<p>Add ?secret= from ACTIVITY_SECRET in .env</p>");
    return;
  }
  const rows = await listActivity(200);
  const body = rows
    .map((row) => {
      const at = row.at ? new Date(row.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "";
      return `<tr>
        <td>${escapeHtml(at)}</td>
        <td>${escapeHtml(row.action)}</td>
        <td>${escapeHtml(row.name || "—")}</td>
        <td>${escapeHtml(row.homeCity)}</td>
        <td>${escapeHtml(row.visitorId)}</td>
        <td>${escapeHtml(row.query)}</td>
        <td>${row.ok === false ? "fail" : "ok"}</td>
        <td>${escapeHtml(row.model || row.error)}</td>
      </tr>`;
    })
    .join("");
  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Aurea activity</title>
<style>
  body { font-family: ui-sans-serif, system-ui; background:#070b14; color:#f6efe4; margin:0; padding:1.5rem; }
  table { border-collapse: collapse; width:100%; font-size:14px; }
  th, td { border-bottom:1px solid #243049; text-align:left; padding:8px 10px; vertical-align:top; }
  th { color:#8b93a7; font-weight:600; }
  .muted { color:#8b93a7; }
</style></head>
<body>
  <p class="muted">Store: ${escapeHtml(activityStoreKind())} · ${rows.length} latest events (IST)</p>
  <table>
    <thead><tr><th>When</th><th>Action</th><th>Who</th><th>From</th><th>Visitor</th><th>What</th><th>Status</th><th>Note</th></tr></thead>
    <tbody>${body || "<tr><td colspan=8>No activity yet. Use Ask or Plan first.</td></tr>"}</tbody>
  </table>
</body></html>`);
});

export default router;
