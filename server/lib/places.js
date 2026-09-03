const UA = "AureaTravel/1.0 (travel concierge; https://localhost)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const WIKI = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const WEATHER = "https://api.open-meteo.com/v1/forecast";

const cache = new Map();
const TTL = 20 * 60 * 1000;

function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const pending = fn().then((value) => {
    cache.set(key, { value, exp: Date.now() + TTL });
    return value;
  });
  cache.set(key, { value: pending, exp: Date.now() + 15_000 });
  return pending;
}

async function fetchJson(url, opts = {}, ms = 14000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...(opts.headers || {}) },
    });
    if (!res.ok) {
      const err = new Error(`Upstream ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function coordsOf(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return { lat: null, lon: null };
}

function haversineKm(a, b) {
  if (!a.lat || !b.lat) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 10) / 10;
}

function pretty(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll(";", ", ")
    .trim();
}

function classify(tags = {}) {
  const tourism = tags.tourism || "";
  const amenity = tags.amenity || "";
  if (["hotel", "guest_house", "hostel", "motel", "apartment"].includes(tourism) || amenity === "hotel") {
    return "stay";
  }
  if (["restaurant", "cafe", "fast_food", "food_court"].includes(amenity)) return "food";
  if (
    ["attraction", "museum", "viewpoint", "gallery", "zoo", "theme_park", "artwork"].includes(tourism) ||
    tags.historic
  ) {
    return "sights";
  }
  return null;
}

function toPlace(el, city, origin) {
  const tags = el.tags || {};
  const kind = classify(tags);
  const name = tags.name || tags["name:en"];
  if (!kind || !name) return null;
  const { lat, lon } = coordsOf(el);
  const km = haversineKm(origin, { lat, lon });
  return {
    id: `${el.type || "n"}/${el.id}`,
    kind,
    name,
    type:
      pretty(tags.tourism || tags.amenity || tags.historic) ||
      (kind === "stay" ? "Stay" : kind === "food" ? "Food" : "Sight"),
    cuisine: pretty(tags.cuisine),
    stars: tags.stars || "",
    area: pretty(tags["addr:street"] || tags["addr:suburb"] || tags["addr:neighbourhood"] || tags["addr:city"] || city),
    address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"], tags["addr:city"]]
      .filter(Boolean)
      .join(", "),
    phone: tags.phone || tags["contact:phone"] || "",
    website: tags.website || tags["contact:website"] || "",
    lat,
    lon,
    distanceKm: km,
    city,
  };
}

export async function geocode(query) {
  const q = String(query || "").trim();
  if (!q) {
    const err = new Error("Enter a city or destination.");
    err.status = 400;
    throw err;
  }
  return cached(`geo:${q.toLowerCase()}`, async () => {
    const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`;
    const rows = await fetchJson(url);
    const hit = rows?.[0];
    if (!hit) {
      const err = new Error("That place could not be found. Try a city name.");
      err.status = 404;
      throw err;
    }
    const addr = hit.address || {};
    return {
      query: q,
      name: hit.name || addr.city || addr.town || addr.village || q,
      displayName: hit.display_name,
      city: addr.city || addr.town || addr.village || addr.state_district || hit.name || q,
      country: addr.country || "",
      lat: Number(hit.lat),
      lon: Number(hit.lon),
    };
  });
}

async function overpassAround(lat, lon) {
  const body = `[out:json][timeout:28];
(
  nwr["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"](around:8000,${lat},${lon});
  nwr["amenity"~"^(restaurant|cafe|fast_food)$"](around:5000,${lat},${lon});
  nwr["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park)$"](around:10000,${lat},${lon});
  nwr["historic"~"^(monument|castle|palace|temple|fort|ruins|memorial)$"](around:10000,${lat},${lon});
);
out center tags;`;

  let lastError;
  for (const endpoint of OVERPASS) {
    try {
      return await fetchJson(
        endpoint,
        { method: "POST", headers: { "Content-Type": "text/plain" }, body },
        28000,
      );
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Places lookup is busy. Try again in a moment.");
}

const WEATHER_LABEL = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Icy fog",
  51: "Light drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Snow",
  80: "Showers",
  95: "Thunderstorm",
};

export async function weatherAt(lat, lon) {
  return cached(`wx:${lat.toFixed(2)},${lon.toFixed(2)}`, async () => {
    const url = `${WEATHER}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`;
    const data = await fetchJson(url);
    const daily = (data.daily?.time || []).map((date, i) => ({
      date,
      high: data.daily.temperature_2m_max?.[i],
      low: data.daily.temperature_2m_min?.[i],
      label: WEATHER_LABEL[data.daily.weather_code?.[i]] || "Mixed",
    }));
    return {
      nowC: data.current?.temperature_2m,
      nowLabel: WEATHER_LABEL[data.current?.weather_code] || "Mixed",
      daily,
    };
  });
}

async function wikiSummary(name) {
  try {
    const data = await fetchJson(`${WIKI}${encodeURIComponent(name)}`, {}, 8000);
    return {
      title: data.title,
      extract: data.extract,
      image: data.thumbnail?.source || data.originalimage?.source || "",
    };
  } catch {
    return null;
  }
}

function takeUnique(list, limit) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

export async function lookupDestination(query) {
  const geo = await geocode(query);
  const origin = { lat: geo.lat, lon: geo.lon };

  return cached(`dest:${geo.lat.toFixed(3)},${geo.lon.toFixed(3)}`, async () => {
    const [osm, weather, about] = await Promise.all([
      overpassAround(geo.lat, geo.lon),
      weatherAt(geo.lat, geo.lon).catch(() => null),
      wikiSummary(geo.city || geo.name),
    ]);

    const places = (osm.elements || [])
      .map((el) => toPlace(el, geo.city || geo.name, origin))
      .filter(Boolean)
      .sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));

    return {
      place: geo,
      about,
      weather,
      stays: takeUnique(
        places.filter((p) => p.kind === "stay"),
        16,
      ),
      food: takeUnique(
        places.filter((p) => p.kind === "food"),
        18,
      ),
      sights: takeUnique(
        places.filter((p) => p.kind === "sights"),
        16,
      ),
      source: "OpenStreetMap + Open-Meteo",
    };
  });
}
