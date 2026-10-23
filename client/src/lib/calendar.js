import { tripLength } from "./tripPhase.js";
import { dayNumber, dayVisitItems, pickVisitItems, prepTasks } from "./tripChecks.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekdayLabels() {
  return WEEKDAYS;
}

export function localIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function currentMonthKey(now = new Date()) {
  return localIso(now).slice(0, 7);
}

export function monthKeyFromIso(iso) {
  return String(iso || "").slice(0, 7);
}

export function shiftMonth(key, delta) {
  const [y, m] = String(key || currentMonthKey()).split("-").map(Number);
  const date = new Date(y, (m || 1) - 1 + Number(delta || 0), 1, 12);
  return currentMonthKey(date);
}

export function monthTitle(key) {
  const [y, m] = String(key || "").split("-").map(Number);
  if (!y || !m) return "";
  return new Date(y, m - 1, 1, 12).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatDayHeading(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function addIso(iso, days) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d + Number(days || 0), 12);
  return localIso(date);
}

function tripLabel(trip) {
  const raw = trip?.plan?.destination || trip?.plan?.title || "Trip";
  return String(raw).split(",")[0].trim() || "Trip";
}

export function tripDates(trip) {
  const start = trip?.plan?.startDate;
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const length = tripLength(trip.plan) || 1;
  const dates = [];
  for (let i = 0; i < length; i += 1) dates.push(addIso(start, i));
  return { start, end: dates[dates.length - 1], dates, length };
}

function markedOn(trip, span) {
  const marked = new Set();
  span.dates.forEach((iso, index) => {
    const day = trip.plan?.days?.[index];
    if (!day) return;
    if (dayVisitItems(day, index).some((part) => trip.visited?.[part.id])) marked.add(iso);
  });
  return marked;
}

function monthCells(month) {
  const [year, mon] = String(month).split("-").map(Number);
  const first = new Date(year, mon - 1, 1, 12);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(year, mon, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push({ iso: "", day: 0 });
  for (let day = 1; day <= count; day += 1) {
    cells.push({
      iso: `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day,
    });
  }
  while (cells.length % 7) cells.push({ iso: "", day: 0 });
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function weekSegments(week, trips) {
  const segments = [];
  for (const trip of trips) {
    const span = tripDates(trip);
    if (!span) continue;
    const on = new Set(span.dates);
    const marked = markedOn(trip, span);
    let start = -1;
    week.forEach((cell, col) => {
      const hit = Boolean(cell.iso && on.has(cell.iso));
      if (hit && start < 0) start = col;
      if (start >= 0 && (!hit || col === week.length - 1)) {
        const endCol = hit ? col : col - 1;
        if (endCol >= start) {
          segments.push({
            trip,
            span,
            marked,
            label: tripLabel(trip),
            startCol: start,
            endCol,
          });
        }
        start = -1;
      }
    });
  }
  segments.sort((a, b) => a.startCol - b.startCol || b.endCol - b.startCol - (a.endCol - a.startCol));
  const laneEnds = [];
  for (const seg of segments) {
    let lane = laneEnds.findIndex((end) => end < seg.startCol);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(seg.endCol);
    } else {
      laneEnds[lane] = seg.endCol;
    }
    seg.lane = lane;
  }
  return segments;
}

export function monthSummary(trips, month) {
  const prefix = `${month}-`;
  let tripCount = 0;
  const markedDays = new Set();
  for (const trip of trips) {
    const span = tripDates(trip);
    if (!span) continue;
    const inMonth = span.dates.filter((iso) => iso.startsWith(prefix));
    if (!inMonth.length) continue;
    tripCount += 1;
    const marked = markedOn(trip, span);
    inMonth.forEach((iso) => {
      if (marked.has(iso)) markedDays.add(iso);
    });
  }
  if (!tripCount) return "";
  const tripsLabel = `${tripCount} trip${tripCount === 1 ? "" : "s"}`;
  if (!markedDays.size) return tripsLabel;
  const daysLabel = `${markedDays.size} day${markedDays.size === 1 ? "" : "s"} marked`;
  return `${tripsLabel} · ${daysLabel}`;
}

export function buildCalendar(trips, month, now = new Date()) {
  const today = localIso(now);
  const list = Array.isArray(trips) ? trips : [];
  const weeks = monthCells(month).map((week) => {
    const segments = weekSegments(week, list);
    const laneCount = Math.min(2, segments.reduce((max, seg) => Math.max(max, seg.lane + 1), 0));
    return week.map((cell, col) => {
      if (!cell.iso) return { ...cell, bars: [], extra: 0, marked: false, onTrip: false, isToday: false, laneCount };
      const covering = segments.filter((seg) => col >= seg.startCol && col <= seg.endCol);
      const bars = covering
        .filter((seg) => seg.lane < 2)
        .sort((a, b) => a.lane - b.lane)
        .map((seg) => ({
          tripId: seg.trip.id,
          lane: seg.lane,
          label: seg.label,
          showLabel: col === seg.startCol,
          continuesLeft: col > seg.startCol,
          continuesRight: col < seg.endCol,
          alt: seg.lane % 2 === 1,
        }));
      return {
        ...cell,
        bars,
        extra: covering.filter((seg) => seg.lane >= 2).length,
        marked: covering.some((seg) => seg.marked.has(cell.iso)),
        onTrip: covering.some((seg) => seg.span.dates.includes(today)),
        isToday: cell.iso === today,
        laneCount,
      };
    });
  });
  return {
    month,
    title: monthTitle(month),
    summary: monthSummary(list, month),
    weeks,
    today,
  };
}

export function dayEntries(trips, iso, profile, now = new Date()) {
  const today = localIso(now);
  const entries = [];
  for (const trip of Array.isArray(trips) ? trips : []) {
    const span = tripDates(trip);
    if (!span || !span.dates.includes(iso)) continue;
    const index = span.dates.indexOf(iso);
    const day = trip.plan?.days?.[index] || null;
    const isPast = iso < today;
    const parts = (day ? dayVisitItems(day, index) : []).map((part) => {
      const done = Boolean(trip.visited?.[part.id]);
      return {
        ...part,
        done,
        status: done ? (isPast ? `You marked ${part.label.toLowerCase()} done` : "Marked done") : "",
      };
    });
    const ready =
      index === 0
        ? prepTasks(trip, profile)
            .filter((task) => !task.link && trip.checks?.[task.id])
            .map((task) => `${task.label} checked`)
        : [];
    const picks =
      index === 0 ? pickVisitItems(trip.picks).filter((item) => trip.visited?.[item.id]) : [];
    entries.push({
      tripId: trip.id,
      title: trip.plan?.title || trip.plan?.destination || "Trip",
      destination: trip.plan?.destination || "",
      dayNumber: day ? dayNumber(day, index) : index + 1,
      length: span.length,
      dayTitle: day?.title || "",
      parts,
      ready,
      picks,
      note: String(trip.dayNotes?.[iso] || ""),
    });
  }
  return {
    iso,
    isPast: iso < today,
    isToday: iso === today,
    isFuture: iso > today,
    entries,
  };
}

export function monthPeek(trips, now = new Date()) {
  const month = currentMonthKey(now);
  const today = localIso(now);
  const rows = (Array.isArray(trips) ? trips : [])
    .map((trip) => ({ trip, span: tripDates(trip) }))
    .filter((row) => row.span && row.span.dates.some((iso) => iso.startsWith(`${month}-`)));
  if (!rows.length) return null;
  const onToday = rows.find((row) => row.span.dates.includes(today));
  const upcoming = rows
    .filter((row) => row.span.start >= today)
    .sort((a, b) => a.span.start.localeCompare(b.span.start))[0];
  const latest = [...rows].sort((a, b) => b.span.end.localeCompare(a.span.end))[0];
  const chosen = onToday || upcoming || latest;
  const name = tripLabel(chosen.trip);
  let text = name;
  let day = chosen.span.start;
  if (chosen.span.dates.includes(today)) {
    day = today;
    text = `${name} · Day ${chosen.span.dates.indexOf(today) + 1}`;
  } else if (chosen.span.start > today) {
    day = chosen.span.start;
    const weekday = new Date(`${chosen.span.start}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" });
    text = `${name} · starts ${weekday}`;
  } else {
    day = chosen.span.end.startsWith(month) ? chosen.span.end : chosen.span.dates.find((iso) => iso.startsWith(month));
    text = `${name} · ${formatDayHeading(day)}`;
  }
  return { text, day };
}

export function withDayNote(trip, iso, text) {
  const dayNotes = { ...(trip?.dayNotes || {}) };
  const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 160);
  if (clean) dayNotes[iso] = clean;
  else delete dayNotes[iso];
  const next = { ...trip };
  if (Object.keys(dayNotes).length) next.dayNotes = dayNotes;
  else delete next.dayNotes;
  return next;
}

export function hasDatedTrip(trips) {
  return (Array.isArray(trips) ? trips : []).some((trip) => tripDates(trip));
}

export function undatedTripCount(trips) {
  return (Array.isArray(trips) ? trips : []).filter((trip) => !tripDates(trip)).length;
}
