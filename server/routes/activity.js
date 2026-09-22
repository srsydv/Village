import { Router } from "express";
import { listActivity, activityStoreKind } from "../lib/activity.js";
import { listSearches } from "../lib/searches.js";
import { listUsers } from "../lib/users.js";

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
        <td>${escapeHtml(row.name || "—")}<div class="muted">${escapeHtml(row.email)}</div></td>
        <td>${escapeHtml(row.homeCity)}</td>
        <td>${escapeHtml(row.visitorId)}</td>
        <td>${escapeHtml(row.query)}</td>
        <td>${row.ok === false ? "fail" : "ok"}</td>
        <td>${escapeHtml(row.model || row.error)}</td>
      </tr>`;
    })
    .join("");
  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Safar activity</title>
<style>
  body { font-family: ui-sans-serif, system-ui; background:#070b14; color:#f6efe4; margin:0; padding:1.5rem; }
  table { border-collapse: collapse; width:100%; font-size:14px; }
  th, td { border-bottom:1px solid #243049; text-align:left; padding:8px 10px; vertical-align:top; }
  th { color:#8b93a7; font-weight:600; }
  .muted { color:#8b93a7; }
  a { color:#e8c99a; }
</style></head>
<body>
  <p class="muted"><a href="/ops/users?secret=${encodeURIComponent(String(req.query.secret || ""))}">Users</a> · <a href="/ops/searches?secret=${encodeURIComponent(String(req.query.secret || ""))}">Searches</a> · Store: ${escapeHtml(activityStoreKind())} · ${rows.length} latest events (IST)</p>
  <table>
    <thead><tr><th>When</th><th>Action</th><th>Who</th><th>From</th><th>Visitor</th><th>What</th><th>Status</th><th>Note</th></tr></thead>
    <tbody>${body || "<tr><td colspan=8>No activity yet. Use Ask or Plan first.</td></tr>"}</tbody>
  </table>
</body></html>`);
});

router.get("/ops/users", async (req, res) => {
  if (!authorized(req)) {
    res.status(401).type("html").send("<p>Add ?secret= from ACTIVITY_SECRET in .env</p>");
    return;
  }
  const rows = await listUsers(200);
  const body = rows
    .map((row) => {
      const at = row.updatedAt ? new Date(row.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "";
      return `<tr>
        <td>${escapeHtml(at)}</td>
        <td>${escapeHtml(row.name || "—")}</td>
        <td>${escapeHtml(row.email)}</td>
        <td>${escapeHtml(row.homeCity)}</td>
        <td>${escapeHtml(row.currency)}</td>
      </tr>`;
    })
    .join("");
  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Safar users</title>
<style>
  body { font-family: ui-sans-serif, system-ui; background:#070b14; color:#f6efe4; margin:0; padding:1.5rem; }
  table { border-collapse: collapse; width:100%; font-size:14px; }
  th, td { border-bottom:1px solid #243049; text-align:left; padding:8px 10px; vertical-align:top; }
  th { color:#8b93a7; font-weight:600; }
  .muted { color:#8b93a7; }
  a { color:#e8c99a; }
</style></head>
<body>
  <p class="muted"><a href="/ops/activity?secret=${encodeURIComponent(String(req.query.secret || ""))}">Activity</a> · <a href="/ops/searches?secret=${encodeURIComponent(String(req.query.secret || ""))}">Searches</a> · Users · ${rows.length} accounts (IST)</p>
  <table>
    <thead><tr><th>Updated</th><th>Name</th><th>Email</th><th>Hometown</th><th>Currency</th></tr></thead>
    <tbody>${body || "<tr><td colspan=5>No signed-in users yet. Complete Google Sign-In first.</td></tr>"}</tbody>
  </table>
</body></html>`);
});

router.get("/ops/searches", async (req, res) => {
  if (!authorized(req)) {
    res.status(401).type("html").send("<p>Add ?secret= from ACTIVITY_SECRET in .env</p>");
    return;
  }
  const secret = encodeURIComponent(String(req.query.secret || ""));
  const rows = await listSearches(300);
  const body = rows
    .map((row) => {
      const at = row.at ? new Date(row.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "";
      const when = [row.startDate, row.days && `${row.days}d`].filter(Boolean).join(" · ");
      return `<tr>
        <td>${escapeHtml(at)}</td>
        <td>${escapeHtml(row.kind)}</td>
        <td>${escapeHtml(row.name || "—")}<div class="muted">${escapeHtml(row.email)}</div></td>
        <td>${escapeHtml(row.homeCity)}</td>
        <td>${escapeHtml(row.destination)}${row.country ? `<div class="muted">${escapeHtml(row.country)}</div>` : ""}</td>
        <td>${escapeHtml(when)}<div class="muted">${escapeHtml(row.travelers)}</div></td>
        <td>${escapeHtml(row.budget || row.resultBudget)}<div class="muted">${escapeHtml(row.style)}</div></td>
        <td>${row.ok === false ? "fail" : "ok"}<div class="muted">${escapeHtml(row.resultTitle || row.error || row.model)}</div></td>
      </tr>`;
    })
    .join("");
  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Safar searches</title>
<style>
  body { font-family: ui-sans-serif, system-ui; background:#070b14; color:#f6efe4; margin:0; padding:1.5rem; }
  table { border-collapse: collapse; width:100%; font-size:14px; }
  th, td { border-bottom:1px solid #243049; text-align:left; padding:8px 10px; vertical-align:top; }
  th { color:#8b93a7; font-weight:600; }
  .muted { color:#8b93a7; }
  a { color:#e8c99a; }
</style></head>
<body>
  <p class="muted"><a href="/ops/activity?secret=${secret}">Activity</a> · <a href="/ops/users?secret=${secret}">Users</a> · Searches · ${rows.length} latest (IST, 90 days)</p>
  <table>
    <thead><tr><th>When</th><th>Kind</th><th>Who</th><th>From</th><th>Destination</th><th>Dates</th><th>Budget</th><th>Result</th></tr></thead>
    <tbody>${body || "<tr><td colspan=8>No plan searches yet. Generate a plan in the app.</td></tr>"}</tbody>
  </table>
</body></html>`);
});

export default router;
