import { localIso, tripDates } from "./calendar.js";

const PREF_KEY = "safar.phoneReminders";
const IDS_KEY = "safar.phoneReminderIds";
const CHANNEL_ID = "trip-plans";
const MORNING_HOUR = 8;
const EVE_HOUR = 19;
const HORIZON_MS = 60 * 24 * 60 * 60 * 1000;
const MAX_NOTIFICATIONS = 40;

let chain = Promise.resolve();

function enqueue(task) {
  const run = chain.then(task, task);
  chain = run.then(
    () => {},
    () => {},
  );
  return run;
}

function nativeNotifications() {
  if (typeof window === "undefined" || !window.Capacitor?.isNativePlatform?.()) return null;
  return window.Capacitor?.Plugins?.LocalNotifications || null;
}

export function remindersAvailable() {
  return Boolean(nativeNotifications());
}

export function phoneRemindersOn() {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function writePref(value) {
  try {
    localStorage.setItem(PREF_KEY, value);
  } catch {
    /* ignore */
  }
}

function readIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(IDS_KEY) || "[]");
    return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  try {
    localStorage.setItem(IDS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function placeName(trip) {
  const raw = trip?.plan?.destination || trip?.plan?.title || "Trip";
  return String(raw).split(",")[0].trim() || "Trip";
}

function shiftIso(iso, days) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return localIso(new Date(y, m - 1, d + Number(days || 0), 12));
}

function atLocal(iso, hour) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d, hour, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clip(text, max = 160) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function dayLine(day, note) {
  return clip(
    [day?.title, day?.morning && `Morning: ${day.morning}`, note && `Note: ${note}`].filter(Boolean).join(" · "),
  );
}

function stableId(key, used) {
  let hash = 2166136261;
  const text = String(key || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let id = (hash >>> 0) % 2000000000 || 1;
  while (used.has(id)) id = (id % 2000000000) + 1;
  used.add(id);
  return id;
}

export function buildReminders(trips, now = new Date()) {
  const used = new Set();
  const soon = now.getTime() + 30 * 1000;
  const horizon = now.getTime() + HORIZON_MS;
  const items = [];

  for (const trip of Array.isArray(trips) ? trips : []) {
    const span = tripDates(trip);
    if (!span) continue;
    const name = placeName(trip);
    const eve = atLocal(shiftIso(span.start, -1), EVE_HOUR);
    if (eve && eve.getTime() > soon && eve.getTime() < horizon) {
      const summary = clip(trip.plan?.summary || trip.plan?.days?.[0]?.title || "Your plan is saved in Safar.");
      items.push({
        id: stableId(`eve:${trip.id}:${span.start}`, used),
        title: clip(`${name} starts tomorrow`, 48),
        body: summary || "Open Safar for the plan.",
        at: eve,
        extra: { kind: "safar", tripId: String(trip.id || ""), day: span.start },
      });
    }

    span.dates.forEach((iso, index) => {
      const at = atLocal(iso, MORNING_HOUR);
      if (!at || at.getTime() <= soon || at.getTime() >= horizon) return;
      const day = trip.plan?.days?.[index] || null;
      const note = trip.dayNotes?.[iso] || "";
      const number = index + 1;
      items.push({
        id: stableId(`day:${trip.id}:${iso}`, used),
        title: clip(`Day ${number} · ${name}`, 48),
        body: dayLine(day, note) || "Open Safar for today’s plan.",
        at,
        extra: { kind: "safar", tripId: String(trip.id || ""), day: iso },
      });
    });
  }

  return items.sort((a, b) => a.at - b.at).slice(0, MAX_NOTIFICATIONS);
}

export function upcomingReminderCount(trips, now = new Date()) {
  return buildReminders(trips, now).length;
}

function icsEscape(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line) {
  if (line.length <= 73) return line;
  const parts = [line.slice(0, 73)];
  let index = 73;
  while (index < line.length) {
    parts.push(` ${line.slice(index, index + 72)}`);
    index += 72;
  }
  return parts.join("\r\n");
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function dayStamp(iso) {
  return String(iso || "").replace(/-/g, "");
}

function dayDescription(day, note) {
  return [
    day?.title,
    day?.morning && `Morning: ${day.morning}`,
    day?.afternoon && `Afternoon: ${day.afternoon}`,
    day?.evening && `Evening: ${day.evening}`,
    day?.food && `Food: ${day.food}`,
    note && `Note: ${note}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildIcs(trips, now = new Date()) {
  const events = [];
  const stamped = stamp(now);
  for (const trip of Array.isArray(trips) ? trips : []) {
    const span = tripDates(trip);
    if (!span) continue;
    const name = placeName(trip);
    span.dates.forEach((iso, index) => {
      const day = trip.plan?.days?.[index] || null;
      const note = trip.dayNotes?.[iso] || "";
      const number = index + 1;
      const summary = day?.title ? `Day ${number} · ${name} — ${day.title}` : `Day ${number} · ${name}`;
      const alarms = [
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsEscape(`Day ${number} · ${name}`)}`,
        "TRIGGER:PT8H",
        "END:VALARM",
      ];
      if (index === 0) {
        alarms.push(
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${icsEscape(`${name} starts tomorrow`)}`,
          "TRIGGER:-PT5H",
          "END:VALARM",
        );
      }
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:safar-${trip.id}-${iso}@safar`,
          `DTSTAMP:${stamped}`,
          `DTSTART;VALUE=DATE:${dayStamp(iso)}`,
          `DTEND;VALUE=DATE:${dayStamp(shiftIso(iso, 1))}`,
          `SUMMARY:${icsEscape(summary)}`,
          `DESCRIPTION:${icsEscape(dayDescription(day, note) || "Plan from Safar")}`,
          ...alarms,
          "END:VEVENT",
        ].map(fold),
      );
    });
  }
  if (!events.length) return "";
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Safar//Plans//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...events.flat(), "END:VCALENDAR"]
    .join("\r\n")
    .concat("\r\n");
}

function fileSlug(trips) {
  const name = placeName(trips[0] || {});
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${slug || "plans"}.ics`;
}

function downloadIcs(filename, ics) {
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function addTripsToPhoneCalendar(trips) {
  const dated = (Array.isArray(trips) ? trips : []).filter((trip) => tripDates(trip));
  if (!dated.length) throw new Error("Save a trip with dates first.");
  const ics = buildIcs(dated);
  const filename = dated.length === 1 ? fileSlug(dated) : "safar-plans.ics";
  const title = dated.length === 1 ? placeName(dated[0]) : "Safar plans";
  const file = new File([ics], filename, { type: "text/calendar" });
  try {
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return "shared";
    }
  } catch (err) {
    if (err?.name === "AbortError") return "cancelled";
  }
  downloadIcs(filename, ics);
  return "saved";
}

async function cancelStored(plugin) {
  const ids = readIds();
  if (ids.length) {
    await plugin.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => {});
  }
  writeIds([]);
}

async function syncBody(trips) {
  const plugin = nativeNotifications();
  if (!plugin || !phoneRemindersOn()) return 0;
  const perm = await plugin.checkPermissions();
  if (perm?.display !== "granted") return 0;
  await plugin
    .createChannel?.({
      id: CHANNEL_ID,
      name: "Plans and calendar",
      description: "The evening before a trip and each morning of the plan",
      importance: 4,
      visibility: 1,
    })
    .catch(() => {});
  await cancelStored(plugin);
  const items = buildReminders(trips);
  if (!items.length) return 0;
  await plugin.schedule({
    notifications: items.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      channelId: CHANNEL_ID,
      autoCancel: true,
      extra: item.extra,
      schedule: { at: item.at.toISOString(), allowWhileIdle: true },
    })),
  });
  writeIds(items.map((item) => item.id));
  return items.length;
}

export function syncPhoneReminders(trips) {
  return enqueue(() => syncBody(trips));
}

export async function enablePhoneReminders(trips) {
  const plugin = nativeNotifications();
  if (!plugin) return { ok: false, reason: "web" };
  let display = "prompt";
  try {
    const current = await plugin.checkPermissions();
    display = current?.display || "prompt";
    if (display !== "granted") {
      const next = await plugin.requestPermissions();
      display = next?.display || "denied";
    }
  } catch {
    return { ok: false, reason: "unsupported" };
  }
  if (display !== "granted") return { ok: false, reason: "denied" };
  writePref("1");
  const count = await syncPhoneReminders(trips);
  return { ok: true, count };
}

export function disablePhoneReminders() {
  return enqueue(async () => {
    writePref("0");
    const plugin = nativeNotifications();
    if (plugin) await cancelStored(plugin);
  });
}

export function listenForReminderOpens(onOpen) {
  const plugin = nativeNotifications();
  if (!plugin?.addListener) return () => {};
  let removed = false;
  let handle = null;
  plugin
    .addListener("localNotificationActionPerformed", (event) => {
      onOpen(event?.notification?.extra || {});
    })
    .then((next) => {
      if (removed) next?.remove?.();
      else handle = next;
    })
    .catch(() => {});
  return () => {
    removed = true;
    handle?.remove?.();
  };
}
