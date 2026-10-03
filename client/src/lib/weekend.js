import { isoWeekKey } from "./dates.js";

const KEY = "safar.weekend";

export function readWeekend(homeCity, now = new Date()) {
  const city = String(homeCity || "").trim();
  if (!city) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!cached?.idea?.destination) return null;
    if (cached.week !== isoWeekKey(now)) return null;
    if (String(cached.homeCity || "").trim().toLowerCase() !== city.toLowerCase()) return null;
    return cached.idea;
  } catch {
    return null;
  }
}

export function writeWeekend(homeCity, idea, now = new Date()) {
  const city = String(homeCity || "").trim();
  if (!city || !idea?.destination) return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        week: isoWeekKey(now),
        homeCity: city,
        idea,
      }),
    );
  } catch {
    /* ignore quota */
  }
}
