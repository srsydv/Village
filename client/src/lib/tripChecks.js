const DAY_PARTS = [
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["evening", "Evening"],
  ["food", "Food"],
];

export function visaText(visa) {
  if (!visa) return "";
  if (typeof visa === "string") return visa.trim();
  return [visa.youApply, visa.type, visa.timeline, visa.summary].filter(Boolean).join(" ").trim();
}

export function visaNeedsAction(visa) {
  const text = visaText(visa).toLowerCase();
  if (!text) return false;
  if (
    /no visa|visa[ -]?free|not required|not applicable|n\/a|domestic|without a visa|does not need|doesn't need|no entry visa|visa is not|within india|same country|own country/.test(
      text,
    )
  ) {
    return false;
  }
  return true;
}

export function isDomesticTrip(trip, profile) {
  if (!visaNeedsAction(trip?.plan?.visa) && /domestic|not applicable|within india|same country|own country/.test(visaText(trip?.plan?.visa).toLowerCase())) {
    return true;
  }
  const country = String(trip?.plan?.country || "").trim().toLowerCase();
  const nationality = String(profile?.nationality || "").trim().toLowerCase();
  if (!country || !nationality) return false;
  return country === nationality || country.includes(nationality) || nationality.includes(country);
}

export function tidyTripTitle(title) {
  return String(title || "")
    .replace(/(?:\s*\(copy\))+$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function prepTasks(trip, profile) {
  const tasks = [];
  if (!isDomesticTrip(trip, profile)) {
    tasks.push({ id: "doc:passport", label: "Passport" });
    if (visaNeedsAction(trip?.plan?.visa)) {
      tasks.push({ id: "doc:visa", label: "Visa", detail: visaText(trip.plan.visa) });
    }
  }
  if (!trip?.picks?.stay) {
    tasks.push({ id: "stay:pick", label: "Pick a stay", link: true });
  }
  (trip?.plan?.packing || []).forEach((line, index) => {
    const label = String(line || "").trim();
    if (label) tasks.push({ id: `pack:${index}`, label });
  });
  return tasks;
}

export function dayNumber(day, index) {
  const n = Number(day?.day);
  return Number.isFinite(n) && n > 0 ? n : index + 1;
}

export function dayVisitId(day, index, part) {
  return `day:${dayNumber(day, index)}:${part}`;
}

export function dayVisitItems(day, index) {
  return DAY_PARTS.filter(([part]) => String(day?.[part] || "").trim()).map(([part, label]) => ({
    id: dayVisitId(day, index, part),
    label,
    text: String(day[part]).trim(),
    day: dayNumber(day, index),
  }));
}

export function pickVisitId(kind, place) {
  return `pick:${kind}:${place?.id || place?.name || "place"}`;
}

export function pickVisitItems(picks) {
  const items = [];
  if (picks?.stay) {
    items.push({ id: pickVisitId("stay", picks.stay), label: picks.stay.name || "Stay", detail: "Stay" });
  }
  for (const place of picks?.food || []) {
    items.push({ id: pickVisitId("food", place), label: place.name || "Food", detail: "Food" });
  }
  for (const place of picks?.sights || []) {
    items.push({ id: pickVisitId("sight", place), label: place.name || "Sight", detail: "Sight" });
  }
  return items;
}

export function allVisitItems(trip) {
  const days = (trip?.plan?.days || []).flatMap((day, index) =>
    dayVisitItems(day, index).map((item) => ({
      ...item,
      detail: `Day ${item.day} · ${item.label}`,
      label: item.text,
    })),
  );
  return [...days, ...pickVisitItems(trip?.picks)];
}

export function toggleMap(map, id) {
  const next = { ...(map || {}) };
  if (next[id]) delete next[id];
  else next[id] = true;
  return next;
}

export function clearDayVisits(visited, dayNum) {
  const prefix = `day:${dayNum}:`;
  const next = { ...(visited || {}) };
  for (const key of Object.keys(next)) {
    if (key.startsWith(prefix)) delete next[key];
  }
  return next;
}

export function checkedCount(ids, map) {
  return ids.filter((id) => map?.[id]).length;
}
