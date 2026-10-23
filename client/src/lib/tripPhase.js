import { daysUntil } from "./dates.js";

export function tripLength(plan) {
  const fromCount = Number(plan?.daysCount);
  const counted = Number.isFinite(fromCount) && fromCount > 0 ? fromCount : 0;
  const listed = Array.isArray(plan?.days) ? plan.days.length : 0;
  return Math.max(counted, listed);
}

export function tripPhase(trip, now = new Date()) {
  const start = trip?.plan?.startDate;
  const until = daysUntil(start, now);
  if (until == null) return "undated";
  const length = tripLength(trip.plan) || 1;
  if (until > 14) return "later";
  if (until > 0) return "prep";
  if (-until < length) return "on-trip";
  return "finished";
}

export function tripDayIndex(trip, now = new Date()) {
  if (tripPhase(trip, now) !== "on-trip") return null;
  const until = daysUntil(trip?.plan?.startDate, now);
  const index = -until || 0;
  const listed = trip?.plan?.days?.length || 0;
  if (!listed || index < 0 || index >= listed) return null;
  return index;
}

export function deskTrip(trips, now = new Date()) {
  const rows = (Array.isArray(trips) ? trips : []).map((trip) => ({
    trip,
    phase: tripPhase(trip, now),
    until: daysUntil(trip?.plan?.startDate, now),
  }));
  const onTrip = rows
    .filter((row) => row.phase === "on-trip")
    .sort((a, b) => (b.until ?? 0) - (a.until ?? 0))[0];
  if (onTrip) return onTrip;
  const prep = rows
    .filter((row) => row.phase === "prep")
    .sort((a, b) => (a.until ?? 0) - (b.until ?? 0))[0];
  return prep || null;
}
