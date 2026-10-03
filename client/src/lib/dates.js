export function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(iso, extraDays) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(extraDays || 0));
  return d.toISOString().slice(0, 10);
}

export function tripEndIso(startIso, days) {
  const n = Math.max(1, Number(days) || 1);
  return addDaysIso(startIso, n - 1);
}

export function formatDay(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatTripSpan(startIso, days) {
  const n = Number(days) || 0;
  if (!startIso) return n ? `${n} days` : "";
  const end = tripEndIso(startIso, n);
  if (!end) return `${formatDay(startIso)} · ${n} days`;
  return `${formatDay(startIso)} – ${formatDay(end)}`;
}

export function daysUntil(iso, now = new Date()) {
  if (!iso) return null;
  const start = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / 86400000);
}

export function isoWeekKey(now = new Date()) {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day + 3);
  const weekYear = date.getFullYear();
  const yearStart = new Date(weekYear, 0, 4);
  yearStart.setHours(12, 0, 0, 0);
  const week = 1 + Math.round(((date - yearStart) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

export function timeAgo(ts) {
  const then = Number(ts) || 0;
  if (!then) return "";
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDay(new Date(then).toISOString().slice(0, 10));
}

export function travelerLine(adults, kids) {
  const a = Math.max(1, Number(adults) || 1);
  const k = Math.max(0, Number(kids) || 0);
  const adultBit = `${a} adult${a === 1 ? "" : "s"}`;
  if (!k) return adultBit;
  return `${adultBit}, ${k} child${k === 1 ? "" : "ren"}`;
}
