import { parseStays, stayLabel } from "./stays.js";

export const SYSTEM_PROMPT = `You are Safar, a private luxury travel concierge inside a mobile app.
Help the traveler with anything they need before they go: destinations, visas, weather, safety, packing, flights, trains, local transport, hotels and stays, food, budgets, day-by-day itineraries, hidden gems, and realistic costs.

Voice:
- Warm, precise, and premium. Never salesy. Never robotic.
- Give specific names (neighborhoods, hotels, restaurants, train lines), not generic advice.
- Always show money with a currency symbol and a realistic range.
- If the traveler's currency is known, convert and show costs in that currency. Mention that prices are estimates.
- Offer 2–3 options when useful.
- Call out scams, monsoon/peak season, tipping norms, and dress codes when relevant.
- Keep answers scannable: short paragraphs, bullets, and clear headings.
- If a request is unsafe or illegal, refuse briefly and suggest a legal alternative.
- Visa advice must match the traveler's passport/nationality when it is known. Never assume Indian citizenship unless the profile says so.

When the user wants a full trip plan, include:
1) Why this destination / when to go
2) Budget breakdown (flights, stay, food, local transport, activities, buffer)
3) A stay budget for the standards the traveler chose. Do not name hotels.
4) Day-by-day itinerary with morning / afternoon / evening
5) Food to try
6) Packing + documents + local SIM / payments
7) Safety and etiquette`;

export const PLAN_JSON_INSTRUCTIONS = `Return ONLY valid JSON. No markdown fences. No commentary.
Schema:
{
  "title": "string",
  "destination": "string",
  "country": "string",
  "duration": "string",
  "bestTime": "string",
  "summary": "string",
  "currency": "INR|USD|EUR|GBP|AED",
  "budget": {
    "total": "string",
    "flights": "string",
    "stay": "string",
    "food": "string",
    "local": "string",
    "activities": "string",
    "buffer": "string"
  },
  "hotels": [
    {
      "name": "string",
      "area": "string",
      "tier": "value|balanced|luxury",
      "nights": "string",
      "pricePerNight": "string",
      "why": "string",
      "bookingTip": "string"
    }
  ],
  "days": [
    {
      "day": 1,
      "title": "string",
      "morning": "string",
      "afternoon": "string",
      "evening": "string",
      "food": "string",
      "cost": "string"
    }
  ],
  "food": ["string"],
  "packing": ["string"],
  "tips": ["string"],
  "visa": "string",
  "safety": "string",
  "rides": [
    {
      "mode": "flight|train|bus",
      "service": "string",
      "duration": "string",
      "typicalFare": "string",
      "fareLow": 0,
      "why": "string"
    }
  ],
  "flightPicks": [
    {
      "airline": "string",
      "via": "string",
      "stops": 1,
      "duration": "string",
      "typicalFare": "string",
      "fareLow": 0,
      "why": "string"
    }
  ]
}
Set hotels to []. The traveler picks a stay standard in the app and opens a live search. Do not name hotels, hostels, or resorts. Estimate budget.stay for the standards in the brief. If none were chosen, estimate a comfortable private room.
If the brief lists ways to get there, include one rides entry for each of those modes only. fareLow is the low end of a realistic one-way adult fare as a number in the traveler currency, with no symbol or comma. typicalFare is the same fare as a short range with a currency symbol. Name a real service when you know one. Use fareLow 0 only when that mode does not serve the route, and say so in why. Do not invent booking URLs. If no modes were requested, set rides to [].
If flight is one of the requested modes, fill flightPicks with 1, 2, or 3 one-way flights and never more than 3. Otherwise set flightPicks to []. Order the lower fare first. stops is 0, 1, or 2. via is the connection city, or an empty string when stops is 0. why is one sentence that says this flight is a good choice and includes the fare and the stops. typicalFare is the total for every adult on the brief, not a per-person figure.`;

export const FLIGHT_PICKS_INSTRUCTIONS = `Return ONLY valid JSON. No markdown fences. No commentary.
Schema:
{
  "flightPicks": [
    {
      "airline": "string",
      "via": "string",
      "stops": 1,
      "duration": "string",
      "typicalFare": "string",
      "fareLow": 0,
      "why": "string"
    }
  ]
}
Return 1, 2, or 3 one-way flights. Never more than 3. Order the lower fare first. stops is 0, 1, or 2. via is the connection city, or "" when nonstop. fareLow is the total for every adult as a number with no symbol. typicalFare is that same total with a currency symbol. why is one sentence: this flight is a good choice, and it includes the fare and the stops. Name a real airline for the route. Do not invent booking URLs.`;

export function flightPicksBrief(input) {
  const adults = Math.min(9, Math.max(1, Number(input?.adults) || 1));
  const kids = Math.max(0, Number(input?.kids) || 0);
  return [
    `Choose one-way flights from ${String(input?.from || "").trim()} to ${String(input?.to || "").trim()}.`,
    input?.date && `Travel date: ${input.date}`,
    `Adults: ${adults}`,
    kids ? `Children: ${kids}` : "",
    `Currency: ${input?.currency || input?.profile?.currency || "INR"}`,
    "Give 1, 2, or 3 flights. Never more than 3. Put the lower fare first.",
    "Each why sentence says the flight is a good choice at that cost and names the stops.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const DAY_JSON_INSTRUCTIONS = `Return ONLY valid JSON for one day. No markdown fences. No commentary.
Schema:
{
  "day": 1,
  "title": "string",
  "morning": "string",
  "afternoon": "string",
  "evening": "string",
  "food": "string",
  "cost": "string"
}
Use the requested day number. Name specific places. Cost is an estimate in the traveler's currency.`;

export const WEEKEND_JSON_INSTRUCTIONS = `Return ONLY valid JSON. No markdown fences. No commentary.
Schema:
{
  "destination": "string",
  "country": "string",
  "title": "string",
  "summary": "string"
}
Pick one realistic place for a 2-day weekend from the traveler's home city. Do not pick the home city itself. Title is short. Summary is one or two sentences.`;

export function profileLine(profile) {
  if (!profile || typeof profile !== "object") return "";
  const bits = [
    profile.name && `Traveler name: ${profile.name}`,
    profile.homeCity && `Home city: ${profile.homeCity}`,
    profile.currency && `Preferred currency: ${profile.currency}`,
    profile.nationality && `Passport / nationality: ${profile.nationality}`,
  ].filter(Boolean);
  return bits.length ? `\n\nTraveler profile:\n${bits.join("\n")}` : "";
}

function stayLine(stays) {
  const chosen = parseStays(stays).map(stayLabel).filter(Boolean);
  if (!chosen.length) {
    return "The traveler has not chosen a stay standard. Set hotels to []. Estimate budget.stay for a comfortable private room.";
  }
  return `Stay standards the traveler chose: ${chosen.join("; ")}. Estimate budget.stay for these. Set hotels to [].`;
}

export function planBrief(payload) {
  const { destination, country, days, startDate, endDate, travelers, budget, style, interests, notes, origin, modes, stays, profile } =
    payload || {};
  const selected = Array.isArray(modes) ? modes.filter(Boolean) : [];
  return [
    `Create a complete pre-travel plan for: ${String(destination || "").trim()}`,
    country && `Country: ${country}`,
    `Use this exact destination (city, region, country). Do not substitute a different place with a similar name.`,
    startDate && `Trip starts: ${startDate}`,
    endDate && `Trip ends: ${endDate}`,
    days && `Duration: ${days} days`,
    travelers && `Travelers: ${travelers}`,
    budget && `Budget: ${budget}`,
    style && `Travel style: ${style}`,
    interests && `Interests: ${interests}`,
    notes && `Extra notes: ${notes}`,
    `Currency: ${profile?.currency || "INR"}`,
    (origin || profile?.homeCity) && `Departing from: ${origin || profile.homeCity}`,
    profile?.nationality && `Passport: ${profile.nationality}. Visa advice must match this passport.`,
    selected.length
      ? `Compare these ways to get there, one way, per adult: ${selected.join(", ")}. Fill rides for each of these modes only.`
      : "The traveler did not ask for a transport comparison. Set rides to [].",
    selected.includes("flight")
      ? "Fill flightPicks with 1, 2, or 3 one-way flights, lowest fare first. Never more than 3."
      : "Set flightPicks to [].",
    stayLine(stays),
  ]
    .filter(Boolean)
    .join("\n");
}

export function parsePlanJson(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new SyntaxError("Invalid plan JSON");
  }
}
