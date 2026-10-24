const KEY = "safar.placeHistory";

export function placeTitle(value) {
  return String(value || "")
    .split(",")[0]
    .trim();
}

export function placeKey(value) {
  return placeTitle(value).toLowerCase().replace(/\s+/g, " ");
}

export function getPlaceHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function rememberPlace({ name, country, label } = {}) {
  const raw = String(label || name || "").trim();
  const title = placeTitle(name || raw);
  if (title.length < 2) return getPlaceHistory();
  const next = [
    {
      name: title,
      country: String(country || "").trim(),
      label: raw || title,
      at: Date.now(),
    },
    ...getPlaceHistory().filter((row) => placeKey(row?.name) !== placeKey(title)),
  ].slice(0, 12);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function collectHistory(trips, stored, homeCity) {
  const home = placeKey(homeCity);
  const rows = [];
  const add = (raw, country, at) => {
    const name = placeTitle(raw);
    const key = placeKey(name);
    if (!key || key.length < 2 || key === home) return;
    const label = String(raw || name).trim();
    const prev = rows.find((row) => placeKey(row.name) === key);
    if (prev) {
      if ((at || 0) >= prev.at) {
        prev.at = at || 0;
        prev.label = label || prev.label;
      }
      if (!prev.country && country) prev.country = String(country).trim();
      return;
    }
    rows.push({
      name,
      country: String(country || "").trim(),
      label,
      at: at || 0,
    });
  };
  for (const trip of trips || []) {
    add(trip?.plan?.destination, trip?.plan?.country, trip?.createdAt || 0);
  }
  for (const row of stored || []) {
    add(row?.label || row?.name, row?.country, row?.at || 0);
  }
  rows.sort((a, b) => b.at - a.at);
  return rows;
}
