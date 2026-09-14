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

export function travelerLine(adults, kids) {
  const a = Math.max(1, Number(adults) || 1);
  const k = Math.max(0, Number(kids) || 0);
  const adultBit = `${a} adult${a === 1 ? "" : "s"}`;
  if (!k) return adultBit;
  return `${adultBit}, ${k} child${k === 1 ? "" : "ren"}`;
}
