import { generateDirect, hasDirectGemini } from "./geminiDirect.js";
import { lookupDestinationDirect, suggestPlacesDirect } from "./placesDirect.js";
import {
  DAY_JSON_INSTRUCTIONS,
  FLIGHT_PICKS_INSTRUCTIONS,
  ASK_SYSTEM_PROMPT,
  PLAN_JSON_INSTRUCTIONS,
  SYSTEM_PROMPT,
  WEEKEND_JSON_INSTRUCTIONS,
  flightPicksBrief,
  parsePlanJson,
  planBrief,
  profileLine,
} from "./prompts.js";
import { applyStyleBudget } from "./styleBudget.js";
import { getAuthToken, getChats, getProfile, getTrips, getVisitorId } from "./storage.js";

function apiUrl(path) {
  const base = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
  return `${base}${path}`;
}

function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function parseBody(payload) {
  if (payload == null) return {};
  if (typeof payload === "object") return payload;
  const text = String(payload).trim();
  if (!text) return {};
  if (text.startsWith("<")) {
    throw new Error("Could not reach the Safar server from this phone.");
  }
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function apiFetch(path, options = {}) {
  const url = apiUrl(path);
  const nativeHttp = isNativeApp() ? window.Capacitor?.Plugins?.CapacitorHttp : null;
  if (nativeHttp) {
    let data;
    if (options.body != null) {
      data = typeof options.body === "string" ? parseBody(options.body) : options.body;
    }
    const result = await nativeHttp.request({
      url,
      method: String(options.method || "GET").toUpperCase(),
      headers: options.headers || {},
      data,
    });
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => parseBody(result.data),
    };
  }

  const res = await fetch(url, options);
  return {
    ok: res.ok,
    status: res.status,
    json: async () => parseBody(await res.text()),
    body: res.body,
  };
}

function activityHeaders() {
  const profile = getProfile();
  const token = getAuthToken();
  return {
    "X-Safar-Visitor": getVisitorId(),
    "X-Safar-Name": profile.name || "",
    "X-Safar-Home": profile.homeCity || "",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchAuthConfig() {
  let res;
  try {
    res = await apiFetch("/api/auth/config");
  } catch {
    throw new Error("Could not reach the Safar server. Check your connection.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load sign-in settings.");
  return data;
}

export async function signInWithGoogleCredential(credential) {
  const profile = getProfile();
  const res = await apiFetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential,
      chats: getChats(),
      trips: getTrips(),
      name: profile.name,
      homeCity: profile.homeCity,
      currency: profile.currency,
      nationality: profile.nationality,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Google sign-in failed.");
  return data;
}

export async function fetchAccount() {
  const token = getAuthToken();
  if (!token) return null;
  const res = await apiFetch("/api/auth/me", { headers: activityHeaders() });
  if (res.status === 401) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load account.");
  return data.user;
}

async function adminGet(path) {
  const res = await apiFetch(path, { headers: activityHeaders() });
  const data = await res.json();
  if (res.status === 403) throw new Error("Admin only.");
  if (!res.ok) throw new Error(data.error || "Could not load admin data.");
  return data;
}

export async function fetchAdminOverview() {
  return adminGet("/api/admin/overview");
}

export async function fetchAdminUsers() {
  return adminGet("/api/admin/users");
}

export async function fetchAdminUser(id) {
  return adminGet(`/api/admin/users/${encodeURIComponent(id)}`);
}

export async function deleteAccount() {
  const token = getAuthToken();
  if (!token) throw new Error("Sign in again to delete this account.");
  const res = await apiFetch("/api/auth/me", {
    method: "DELETE",
    headers: activityHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not delete this account.");
  return true;
}

export async function syncAccount(payload) {
  const token = getAuthToken();
  if (!token) return null;
  const res = await apiFetch("/api/auth/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save account.");
  return data.user;
}

export async function checkUsername(q) {
  const res = await apiFetch(`/api/auth/username?q=${encodeURIComponent(q || "")}`, {
    headers: activityHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not check that username.");
  return data;
}

export async function lookupShareUser(query) {
  const res = await apiFetch("/api/shares/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not search.");
  return data;
}

export async function shareTripWithUser({ tripId, userId }) {
  const res = await apiFetch("/api/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ tripId, userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not share this trip.");
  return data.share;
}

export async function fetchOutgoingShares(tripId) {
  const res = await apiFetch(`/api/shares/outgoing?tripId=${encodeURIComponent(tripId)}`, {
    headers: activityHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load who this is shared with.");
  return data.shares || [];
}

export async function unshareTrip(id) {
  const res = await apiFetch(`/api/shares/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: activityHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not stop sharing.");
  return true;
}

export async function fetchIncomingShares() {
  const res = await apiFetch("/api/shares/incoming", { headers: activityHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load shared trips.");
  return data.shares || [];
}

export async function fetchIncomingShare(id) {
  const res = await apiFetch(`/api/shares/incoming/${encodeURIComponent(id)}`, {
    headers: activityHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "This trip is no longer shared with you.");
  return data.share;
}

export async function askSafar({ messages, profile, onDelta }) {
  if (hasDirectGemini()) {
    const { text } = await generateDirect({
      messages: messages.slice(-16),
      system: ASK_SYSTEM_PROMPT + profileLine(profile),
    });
    onDelta?.(text, text);
    return text;
  }

  if (isNativeApp()) {
    const res = await apiFetch("/api/travel/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...activityHeaders() },
      body: JSON.stringify({ messages, profile, stream: false, visitorId: getVisitorId() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Safar could not reply.");
    const text = data.text || "";
    onDelta?.(text, text);
    return text;
  }

  const res = await fetch(apiUrl("/api/travel/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ messages, profile, stream: true, visitorId: getVisitorId() }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Safar could not reply.");
  }

  const reader = res.body?.getReader();
  if (!reader) {
    const data = await res.json();
    return data.text || "";
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw) continue;
      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        continue;
      }
      if (json.error) throw new Error(json.error);
      if (json.delta) {
        full += json.delta;
        onDelta?.(json.delta, full);
      }
    }
  }

  return full;
}

export async function suggestPlaces(query) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  if (hasDirectGemini()) {
    return suggestPlacesDirect(q);
  }
  const res = await apiFetch(`/api/places/suggest?q=${encodeURIComponent(q)}`, {
    headers: activityHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not look up that place.");
  return Array.isArray(data.places) ? data.places : [];
}

export async function fetchPlaces(query) {
  if (hasDirectGemini()) {
    return lookupDestinationDirect(query);
  }
  const res = await apiFetch(`/api/places?q=${encodeURIComponent(query)}`, {
    headers: activityHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load places for that destination.");
  return data;
}

export async function createPlan(payload) {
  if (hasDirectGemini()) {
    const { text } = await generateDirect({
      messages: [{ role: "user", content: planBrief(payload) }],
      system: `${SYSTEM_PROMPT}\n\n${PLAN_JSON_INSTRUCTIONS}${profileLine(payload.profile)}`,
      json: true,
    });
    try {
      return applyStyleBudget(parsePlanJson(text), payload);
    } catch {
      throw new Error("Safar drafted a plan but it could not be formatted. Please try again.");
    }
  }

  const res = await apiFetch("/api/travel/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ ...payload, visitorId: getVisitorId() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Safar could not build this plan.");
  return applyStyleBudget(data.plan, payload);
}

function asDay(parsed, dayNumber) {
  const raw =
    parsed?.morning || parsed?.afternoon || parsed?.evening || parsed?.title
      ? parsed
      : parsed?.day && typeof parsed.day === "object"
        ? parsed.day
        : Array.isArray(parsed?.days)
          ? parsed.days[0]
          : null;
  if (!raw || typeof raw !== "object") {
    throw new Error("Safar drafted this day but it could not be formatted. The old day is unchanged.");
  }
  return {
    day: dayNumber,
    title: String(raw.title || `Day ${dayNumber}`).trim(),
    morning: String(raw.morning || "").trim(),
    afternoon: String(raw.afternoon || "").trim(),
    evening: String(raw.evening || "").trim(),
    food: String(raw.food || "").trim(),
    cost: String(raw.cost || "").trim(),
  };
}

export async function suggestFlights(journey) {
  const brief = flightPicksBrief(journey);
  if (hasDirectGemini()) {
    const { text } = await generateDirect({
      messages: [{ role: "user", content: brief }],
      system: `${SYSTEM_PROMPT}\n\n${FLIGHT_PICKS_INSTRUCTIONS}${profileLine(journey?.profile)}`,
      json: true,
    });
    const parsed = parsePlanJson(text);
    return Array.isArray(parsed?.flightPicks) ? parsed.flightPicks.slice(0, 3) : [];
  }
  const res = await apiFetch("/api/travel/flights", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ ...journey, visitorId: getVisitorId() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not choose flights for this date.");
  return Array.isArray(data.flightPicks) ? data.flightPicks.slice(0, 3) : [];
}

export async function rewriteDay(payload) {
  const dayNumber = Number(payload?.dayNumber);
  const note = String(payload?.comment || "").trim();
  const otherDays = Array.isArray(payload?.otherDays) ? payload.otherDays : [];
  const brief = [
    `Rewrite only day ${dayNumber} of a trip to ${String(payload?.destination || "").trim()}.`,
    payload?.country && `Country: ${payload.country}`,
    payload?.dayDate && `This day is: ${payload.dayDate}`,
    `Currency: ${payload?.profile?.currency || "INR"}`,
    payload?.profile?.homeCity && `Departing from: ${payload.profile.homeCity}`,
    payload?.profile?.nationality && `Passport: ${payload.profile.nationality}`,
    otherDays.length
      ? `Other days already planned. Do not repeat these places:\n${otherDays
          .map((day) => `Day ${day.day}: ${[day.title, day.morning, day.afternoon, day.evening].filter(Boolean).join(" — ")}`)
          .join("\n")}`
      : "",
    note
      ? `The traveler wants this day to include: ${note}. Follow that text.`
      : "The traveler left no extra note. Write a strong day yourself that fits the trip and does not repeat the other days.",
    `Set "day" to ${dayNumber}.`,
  ]
    .filter(Boolean)
    .join("\n");

  if (hasDirectGemini()) {
    const { text } = await generateDirect({
      messages: [{ role: "user", content: brief }],
      system: `${SYSTEM_PROMPT}\n\n${DAY_JSON_INSTRUCTIONS}${profileLine(payload.profile)}`,
      json: true,
    });
    return asDay(parsePlanJson(text), dayNumber);
  }

  const res = await apiFetch("/api/travel/day", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ ...payload, comment: note, visitorId: getVisitorId() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Safar could not rewrite this day. The old day is unchanged.");
  return data.day;
}

export async function suggestWeekend(profile) {
  if (hasDirectGemini()) {
    const { text } = await generateDirect({
      messages: [
        {
          role: "user",
          content: `Suggest one 2-day weekend trip from ${profile?.homeCity}. Currency: ${profile?.currency || "INR"}. Do not choose the home city.`,
        },
      ],
      system: `${SYSTEM_PROMPT}\n\n${WEEKEND_JSON_INSTRUCTIONS}${profileLine(profile)}`,
      json: true,
    });
    const parsed = parsePlanJson(text);
    const destination = String(parsed?.destination || "").trim();
    if (!destination) throw new Error("Safar could not find a weekend.");
    return {
      destination,
      country: String(parsed.country || "").trim(),
      title: String(parsed.title || destination).trim(),
      summary: String(parsed.summary || "").trim(),
    };
  }

  const res = await apiFetch("/api/travel/weekend", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ profile, homeCity: profile?.homeCity, visitorId: getVisitorId() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Safar could not find a weekend.");
  return data.idea;
}
