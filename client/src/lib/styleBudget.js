// Server imports this file directly. Keep it free of React and browser APIs.

const STYLES = ["Balanced", "Luxury", "Budget", "Adventure", "Family", "Honeymoon"];

const GUIDES = {
  Budget:
    "Travel style: Budget. Cheapest decent choices only: buses or sleeper trains, a dorm or basic room, street food and thalis, free sights. Do not suggest private cabs, boutique hotels, or fine dining.",
  Balanced:
    "Travel style: Balanced. A comfortable middle — not a shoestring trip, and not luxury. Clean guesthouse or 3-star hotel, AC chair-car or 3AC train, or a shared cab on a short hop. Local meals plus simple restaurants. Paid sights that are worth it. Do not suggest private AC cabs, 4-star or 5-star hotels, palace stays, or fine dining.",
  Luxury:
    "Travel style: Luxury. Private transfers, a refined stay, and special meals. Price and describe it clearly above a balanced trip.",
  Adventure:
    "Travel style: Adventure. Simple stays and local transport, with more of the money going to outdoor activities. Do not price or describe it like a luxury holiday.",
  Family:
    "Travel style: Family. A comfortable room the group can share, easy meals, and calm days. Mid-range. Not a luxury resort.",
  Honeymoon:
    "Travel style: Honeymoon. A nicer room, a few special meals, and a private cab when the hop is short. Above balanced, and short of a full luxury trip.",
};

// India on-the-ground prices are the baseline. Other countries scale from that.
const COST_INDEX = {
  india: 1,
  nepal: 1,
  bangladesh: 0.9,
  "sri lanka": 1.25,
  pakistan: 0.9,
  bhutan: 1.2,
  thailand: 1.8,
  vietnam: 1.4,
  cambodia: 1.2,
  indonesia: 1.5,
  malaysia: 1.7,
  philippines: 1.4,
  singapore: 4.5,
  japan: 4,
  "south korea": 3.2,
  "united arab emirates": 3.5,
  maldives: 5,
  "united states": 6,
  "united kingdom": 5.5,
  france: 5,
  germany: 4.5,
  italy: 4.5,
  spain: 4,
  netherlands: 4.8,
  australia: 5,
  canada: 4.8,
  switzerland: 6.5,
};

// Per room per night, India, INR. Dorm is per person.
const STAY_RATES = {
  dorm: { per: "person", low: 400, high: 900 },
  simple: { per: "room", low: 800, high: 1500 },
  comfortable: { per: "room", low: 1800, high: 3200 },
  polished: { per: "room", low: 3500, high: 6000 },
  refined: { per: "room", low: 7000, high: 12000 },
  exceptional: { per: "room", low: 14000, high: 24000 },
};

// India, INR. Room is per room per night. The rest are per adult per day.
const STYLE_RATES = {
  Budget: { room: [900, 1600], food: [250, 450], local: [60, 140], activities: [80, 200] },
  Balanced: { room: [1800, 3200], food: [400, 700], local: [120, 250], activities: [200, 450] },
  Adventure: { room: [1100, 2000], food: [350, 550], local: [100, 220], activities: [350, 750] },
  Family: { room: [2200, 3800], food: [400, 650], local: [150, 280], activities: [180, 400] },
  Honeymoon: { room: [4500, 8000], food: [900, 1600], local: [280, 550], activities: [500, 1000] },
  Luxury: { room: [9000, 16000], food: [1800, 3500], local: [700, 1400], activities: [1200, 2500] },
};

// Per adult, one way, India, INR.
const GROUND = {
  short: {
    Budget: [80, 250],
    Balanced: [200, 600],
    Adventure: [100, 300],
    Family: [200, 600],
    Honeymoon: [200, 600],
    Luxury: [200, 600],
  },
  mid: {
    Budget: [350, 900],
    Balanced: [700, 1600],
    Adventure: [400, 1000],
    Family: [800, 1800],
    Honeymoon: [1200, 2500],
    Luxury: [1800, 4000],
  },
  long: {
    Budget: [700, 1500],
    Balanced: [1400, 2800],
    Adventure: [800, 1600],
    Family: [1500, 3000],
    Honeymoon: [2000, 4000],
    Luxury: [2500, 5000],
  },
};

const FLIGHT = {
  domestic: {
    Budget: [2800, 5500],
    Balanced: [4000, 8000],
    Adventure: [3200, 6500],
    Family: [4000, 8500],
    Honeymoon: [6500, 12000],
    Luxury: [14000, 28000],
  },
  near: {
    Budget: [9000, 18000],
    Balanced: [15000, 30000],
    Adventure: [11000, 22000],
    Family: [15000, 30000],
    Honeymoon: [28000, 50000],
    Luxury: [50000, 110000],
  },
  far: {
    Budget: [22000, 40000],
    Balanced: [35000, 65000],
    Adventure: [25000, 48000],
    Family: [35000, 65000],
    Honeymoon: [60000, 110000],
    Luxury: [120000, 220000],
  },
};

// Round-trip private vehicle on a short hop. Per km is one way.
const VEHICLE = {
  Family: { perKm: [12, 20], min: [2500, 5000], note: "private cab for the family" },
  Honeymoon: { perKm: [16, 26], min: [4000, 7500], note: "private cab" },
  Luxury: { perKm: [22, 38], min: [6000, 11000], note: "private AC cab" },
};

const FX_INR = { INR: 1, USD: 84, EUR: 96, GBP: 112, AED: 23 };

const LABELS = {
  total: "Total",
  flights: "Travel",
  stay: "Stay",
  food: "Food",
  local: "Local",
  activities: "Activities",
  buffer: "Buffer",
};

const CAPTIONS = {
  Budget: "Budget trip · cheapest decent options",
  Balanced: "Balanced trip · a comfortable middle",
  Luxury: "Luxury trip · refined stays and private travel",
  Adventure: "Adventure trip · simple stays, more on activities",
  Family: "Family trip · comfortable rooms and easy days",
  Honeymoon: "Honeymoon trip · a nicer stay and a few special meals",
};

export function normalizeStyle(style) {
  const raw = String(style || "").trim().toLowerCase();
  return STYLES.find((name) => name.toLowerCase() === raw) || "Balanced";
}

export function styleGuide(style) {
  const name = normalizeStyle(style);
  return `${GUIDES[name]} Write the days, meals, and how you get there at this style. budget fields are repriced in the app to match the style, so do not describe a more expensive trip than the style allows.`;
}

export function styleBudgetCaption(style) {
  return CAPTIONS[normalizeStyle(style)];
}

export function budgetLabel(key) {
  return LABELS[key] || String(key || "").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function applyStyleBudget(plan, input = {}) {
  if (!plan || typeof plan !== "object") return plan;
  const priced = priceTrip(input, plan);
  const days = Array.isArray(plan.days)
    ? plan.days.map((day) => (day && typeof day === "object" ? { ...day, cost: priced.dayCost } : day))
    : plan.days;
  return {
    ...plan,
    style: priced.style,
    currency: priced.currency,
    budget: priced.lines,
    days,
  };
}

function priceTrip(input, plan) {
  const style = normalizeStyle(input.style || plan.style);
  const currency = normalizeCurrency(input.profile?.currency || input.currency || plan.currency);
  const days = clampInt(input.days || input.daysCount || plan.daysCount || plan.days?.length, 1, 30, 6);
  const nights = days <= 1 ? 1 : days - 1;
  const { adults, kids } = party(input);
  const heads = adults + kids * 0.6;
  const rooms = Math.max(1, Math.ceil((adults + Math.max(0, kids - 1)) / 2));
  const index = costIndex(input.country || input.destCountry || plan.country);
  const rates = STYLE_RATES[style];
  const stays = stayIds(input.stays);

  const stay = stays.length
    ? stayFromChoices(stays, { nights, rooms, heads, index })
    : scalePair(rates.room, nights * rooms * index);
  const food = scalePair(rates.food, heads * days * index);
  const local = scalePair(rates.local, heads * days * index);
  const activities = scalePair(rates.activities, heads * days * index);
  const travel = travelRange({ input, plan, style, adults, kids, index });

  let parts = {
    flights: travel.range,
    stay,
    food,
    local,
    activities,
  };

  parts = mapPairs(parts, (pair) => pair.map((amount) => fromInr(amount, currency)));
  let rounded = mapPairs(parts, (pair) => roundPair(pair, currency));

  const cap = parseBudgetCap(input.budget, currency);
  const highBeforeBuffer = sumPairs(rounded, 1);
  if (cap && highBeforeBuffer > cap) {
    const factor = cap / (highBeforeBuffer * 1.1);
    rounded = mapPairs(rounded, (pair) => roundPair(pair.map((amount) => amount * factor), currency));
  }

  const subLow = sumPairs(rounded, 0);
  const subHigh = sumPairs(rounded, 1);
  const buffer = roundPair([subLow * 0.08, subHigh * 0.1], currency);
  const total = [subLow + buffer[0], subHigh + buffer[1]];
  const onGround = [rounded.stay[0] + rounded.food[0] + rounded.local[0] + rounded.activities[0], rounded.stay[1] + rounded.food[1] + rounded.local[1] + rounded.activities[1]];
  const dayPair = roundPair([onGround[0] / days, onGround[1] / days], currency);

  const lines = {
    total: formatPair(total, currency),
    stay: formatPair(rounded.stay, currency),
    food: formatPair(rounded.food, currency),
    local: formatPair(rounded.local, currency),
    activities: formatPair(rounded.activities, currency),
    buffer: formatPair(buffer, currency),
  };
  if (travel.range[1] > 0) {
    const travelLine = formatPair(rounded.flights, currency);
    lines.flights = travel.note ? `${travelLine} (${travel.note})` : travelLine;
  }

  const ordered = {
    total: lines.total,
    ...(lines.flights ? { flights: lines.flights } : {}),
    stay: lines.stay,
    food: lines.food,
    local: lines.local,
    activities: lines.activities,
    buffer: lines.buffer,
  };

  return {
    style,
    currency,
    lines: ordered,
    dayCost: `About ${formatPair(dayPair, currency)} for the group`,
  };
}

function travelRange({ input, plan, style, adults, kids, index }) {
  const modes = (Array.isArray(input.modes) ? input.modes : [])
    .map((mode) => String(mode || "").trim().toLowerCase())
    .filter(Boolean);
  const originCountry = String(input.originCountry || "").trim();
  const destCountry = String(input.country || input.destCountry || plan?.country || "").trim();
  const domestic = isDomestic(originCountry, destCountry);
  const measured = tripKm(input);
  const km = measured == null ? (domestic ? 450 : 5000) : measured;
  const band = km < 250 ? "short" : km < 900 ? "mid" : "long";
  const has = (id) => modes.includes(id);
  const groundLocked = (has("train") || has("bus")) && !has("flight");
  const flightLocked = has("flight") && !has("train") && !has("bus");
  const city = placeCity(input.origin || input.profile?.homeCity);

  if (measured != null && measured < 40) {
    return { range: [0, 0], note: "" };
  }

  let useFlight = false;
  if (!domestic) useFlight = !(groundLocked && km < 600);
  else if (flightLocked && km >= 250) useFlight = true;
  else if (groundLocked) useFlight = false;
  else if (band === "short") useFlight = false;
  else if (band === "mid") useFlight = style === "Luxury" || style === "Honeymoon";
  else useFlight = style !== "Budget" && style !== "Adventure";

  const people = adults + kids * 0.5;
  const fromBit = city ? ` from ${city}` : "";

  if (!useFlight && band === "short" && !has("bus") && VEHICLE[style]) {
    const vehicle = VEHICLE[style];
    const low = Math.max(vehicle.min[0], km * 2 * vehicle.perKm[0]);
    const high = Math.max(vehicle.min[1], km * 2 * vehicle.perKm[1], low);
    return {
      range: [low, high],
      note: `${vehicle.note}${fromBit}, round trip`,
    };
  }

  if (useFlight) {
    const table = !domestic ? (km < 4000 ? FLIGHT.near : FLIGHT.far) : FLIGHT.domestic;
    const [low, high] = table[style];
    const cabin = style === "Luxury" ? "flights" : "economy flights";
    return {
      range: [low * 2 * people, high * 2 * people],
      note: `${cabin}${fromBit}, round trip`,
    };
  }

  const groundIndex = domestic && costIndex(destCountry || "India") === 1 ? 1 : index;
  const [low, high] = GROUND[band][style];
  const bus = has("bus") && !has("train") && !has("flight");
  let note = `train${fromBit}, round trip`;
  if (bus || (band === "short" && (style === "Budget" || style === "Adventure"))) {
    note = `bus or sleeper train${fromBit}, round trip`;
  } else if (band === "short") {
    note = `AC train or shared cab${fromBit}, round trip`;
  }
  return {
    range: [low * 2 * people * groundIndex, high * 2 * people * groundIndex],
    note,
  };
}

function stayFromChoices(ids, { nights, rooms, heads, index }) {
  let low = Infinity;
  let high = 0;
  for (const id of ids) {
    const rate = STAY_RATES[id];
    if (!rate) continue;
    const units = rate.per === "person" ? heads : rooms;
    low = Math.min(low, rate.low * nights * units * index);
    high = Math.max(high, rate.high * nights * units * index);
  }
  if (!Number.isFinite(low) || high <= 0) return [0, 0];
  return [low, Math.max(high, low)];
}

function stayIds(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(raw.map((item) => String(item || "").trim()).filter((id) => STAY_RATES[id]))];
}

function scalePair(pair, factor) {
  return [pair[0] * factor, pair[1] * factor];
}

function mapPairs(parts, fn) {
  const next = {};
  for (const [key, pair] of Object.entries(parts)) next[key] = fn(pair, key);
  return next;
}

function sumPairs(parts, index) {
  return Object.values(parts).reduce((sum, pair) => sum + (pair[index] || 0), 0);
}

function roundPair(pair, currency) {
  let low = roundMoney(pair[0], currency);
  let high = roundMoney(pair[1], currency);
  if (high < low) high = low;
  if (high === low && low > 0) high = low + stepFor(low, currency);
  return [low, high];
}

function roundMoney(amount, currency) {
  const value = Math.max(0, Number(amount) || 0);
  if (value === 0) return 0;
  const step = stepFor(value, currency);
  return Math.max(step, Math.round(value / step) * step);
}

function stepFor(amount, currency) {
  if (currency !== "INR") {
    if (amount >= 500) return 25;
    if (amount >= 100) return 10;
    return 5;
  }
  if (amount >= 20000) return 1000;
  if (amount >= 5000) return 500;
  if (amount >= 1000) return 100;
  return 50;
}

function formatPair(pair, currency) {
  return `${formatMoney(pair[0], currency)} – ${formatMoney(pair[1], currency)}`;
}

function formatMoney(amount, currency) {
  const value = Math.round(Number(amount) || 0);
  const symbols = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED " };
  const symbol = symbols[currency] || (currency ? `${currency} ` : "");
  const formatted = currency === "INR" ? value.toLocaleString("en-IN") : value.toLocaleString("en-US");
  return `${symbol}${formatted}`;
}

function fromInr(amount, currency) {
  const fx = FX_INR[currency] || 1;
  return currency === "INR" ? amount : amount / fx;
}

function normalizeCurrency(value) {
  const code = String(value || "INR").trim().toUpperCase();
  return FX_INR[code] ? code : "INR";
}

function costIndex(country) {
  const key = String(country || "").trim().toLowerCase();
  if (!key) return 1;
  if (COST_INDEX[key] != null) return COST_INDEX[key];
  return 3;
}

function isDomestic(originCountry, destCountry) {
  const origin = originCountry.toLowerCase();
  const dest = destCountry.toLowerCase();
  if (origin && dest) return origin === dest;
  if (dest && dest !== "india" && !origin) return false;
  if (origin && origin !== "india" && !dest) return false;
  return true;
}

function tripKm(input) {
  const lat1 = Number(input.originLat);
  const lon1 = Number(input.originLon);
  const lat2 = Number(input.destLat);
  const lon2 = Number(input.destLon);
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) return null;
  const earth = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function placeCity(value) {
  return String(value || "").split(",")[0].trim();
}

function party(input) {
  let adults = Number(input.adults);
  let kids = Number(input.kids);
  if (!Number.isFinite(adults) || adults < 1) {
    const text = String(input.travelers || "");
    const adultMatch = text.match(/(\d+)\s*adult/);
    const kidMatch = text.match(/(\d+)\s*child/);
    adults = adultMatch ? Number(adultMatch[1]) : 2;
    kids = kidMatch ? Number(kidMatch[1]) : 0;
  }
  return {
    adults: clampInt(adults, 1, 12, 2),
    kids: clampInt(kids, 0, 8, 0),
  };
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseBudgetCap(text, currency) {
  const raw = String(text || "")
    .toLowerCase()
    .replace(/[₹$€£]/g, "")
    .replace(/,/g, " ");
  if (!raw.trim()) return null;
  const take = (pattern, factor) =>
    [...raw.matchAll(pattern)].map((match) => Number(match[1]) * factor).filter((n) => n > 0);
  const crores = take(/([\d.]+)\s*crore/g, 10000000);
  if (crores.length) return Math.max(...crores);
  const lakhs = take(/([\d.]+)\s*lakh/g, 100000);
  if (lakhs.length) return Math.max(...lakhs);
  const kilos = take(/([\d.]+)\s*k\b/g, 1000);
  if (kilos.length) return Math.max(...kilos);
  const nums = [...raw.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0])).filter((n) => n >= (currency === "INR" ? 500 : 20));
  if (!nums.length) return null;
  return Math.max(...nums);
}

