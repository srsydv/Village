export function when(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function relTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 45_000) return "just now";
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 60_000))}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 3_600_000))}h ago`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 86_400_000))}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function dayLabel(value) {
  if (!value) return "Earlier";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function groupByDay(rows, key = "at") {
  const groups = [];
  for (const row of rows || []) {
    const label = dayLabel(row[key]);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

export function actionMeta(action) {
  if (action === "ask") return { label: "Asked", tone: "ask" };
  if (action === "plan") return { label: "Planned", tone: "plan" };
  if (action === "places") return { label: "Looked up", tone: "places" };
  return { label: action || "Activity", tone: "other" };
}

export function placeKey(value) {
  return String(value || "")
    .toLowerCase()
    .split(",")[0]
    .replace(/[^a-z0-9\u0900-\u097f]+/g, " ")
    .trim();
}

export function samePlace(a, b) {
  const left = placeKey(a);
  const right = placeKey(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function findTripForActivity(row, trips) {
  const query = row?.query || row?.destination;
  return (trips || []).find((trip) => {
    const plan = trip?.plan || trip;
    return (
      samePlace(query, plan?.destination) ||
      samePlace(query, plan?.title) ||
      samePlace(query, trip?.destination)
    );
  });
}

export function findChatForActivity(row, chats) {
  const needle = String(row?.query || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
  if (!needle) return null;
  for (const chat of chats || []) {
    const messages = chat.messages || [];
    const index = messages.findIndex(
      (message) =>
        message?.role === "user" &&
        String(message.content || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .includes(needle.slice(0, 28)),
    );
    if (index >= 0) return { chat, index };
  }
  return null;
}

export function findSearchForActivity(row, searches) {
  const at = row?.at ? new Date(row.at).getTime() : 0;
  return (searches || []).find((search) => {
    if (!samePlace(row.query || row.destination, search.destination)) return false;
    if (row.action === "plan" && search.kind && search.kind !== "plan") return false;
    if (row.action === "places" && search.kind && search.kind !== "places") return false;
    if (!at || !search.at) return true;
    return Math.abs(new Date(search.at).getTime() - at) < 10 * 60 * 1000;
  });
}
export function lastUserAsk(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.role === "user" && list[i].content) return String(list[i].content);
  }
  return "";
}

export function cardValue(cards, key) {
  return cards?.find((card) => card.key === key)?.value ?? 0;
}
