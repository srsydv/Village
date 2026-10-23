export const STAY_STANDARDS = [
  {
    id: "dorm",
    label: "Dorm",
    hint: "A bed in a shared room",
    search: "Hostel dorms",
    filter: "ht_id=203",
  },
  {
    id: "simple",
    label: "Simple private",
    hint: "Your own basic room",
    search: "Guesthouses",
    filter: "ht_id=216",
  },
  {
    id: "comfortable",
    label: "Comfortable",
    hint: "A solid, quiet hotel",
    search: "3-star hotels",
    filter: "class=3",
  },
  {
    id: "polished",
    label: "Polished",
    hint: "Better rooms and a stronger address",
    search: "4-star hotels",
    filter: "class=4",
  },
  {
    id: "refined",
    label: "Refined",
    hint: "Boutique or full service",
    search: "5-star hotels",
    filter: "class=5",
  },
  {
    id: "exceptional",
    label: "Exceptional",
    hint: "A suite, villa, or leading resort",
    search: "Resorts and villas",
    filter: "ht_id=206;ht_id=228",
  },
];

const BY_ID = new Map(STAY_STANDARDS.map((item) => [item.id, item]));

export function parseStays(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  const ids = raw.map((item) => String(item || "").trim()).filter((id) => BY_ID.has(id));
  return [...new Set(ids)];
}

export function stayLabel(id) {
  const item = BY_ID.get(id);
  return item ? `${item.label} — ${item.hint}` : "";
}

export function toggleStay(ids, id) {
  const current = parseStays(ids);
  if (!BY_ID.has(id)) return current;
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

export function staySearchUrl({ id, destination, startDate, endDate, adults }) {
  const item = BY_ID.get(id);
  const place = String(destination || "").split(",")[0].trim();
  if (!item || !place) return "";
  const params = new URLSearchParams({ ss: place });
  if (item.filter) params.set("nflt", item.filter);
  if (startDate) params.set("checkin", startDate);
  if (endDate) params.set("checkout", endDate);
  const count = Math.min(12, Math.max(1, Number(adults) || 1));
  params.set("group_adults", String(count));
  params.set("group_children", "0");
  params.set("no_rooms", "1");
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}
