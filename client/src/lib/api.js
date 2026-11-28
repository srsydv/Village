import { generateDirect, hasDirectGemini } from "./geminiDirect.js";
import { lookupDestinationDirect, nearbyCities as nearbyCitiesDirect, suggestPlacesDirect } from "./placesDirect.js";
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
import { currentRegion } from "./region.js";
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
  const region = currentRegion();
  return {
    "X-Safar-Visitor": getVisitorId(),
    "X-Safar-Name": profile.name || "",
    "X-Safar-Home": profile.homeCity || "",
    ...(region ? { "X-Safar-Region": region } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function searchShop({ query, budget }) {
  const params = new URLSearchParams({ q: query || "" });
  if (budget) params.set("budget", budget);
  const res = await apiFetch(`/api/shop?${params.toString()}`, { headers: activityHeaders() });
  const data = await res.json();
  if (!res.ok) return [];
  return Array.isArray(data.products) ? data.products : [];
}

export async function fetchBillingStatus() {
  const res = await apiFetch("/api/billing/status", { headers: activityHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not check the subscription.");
  return data;
}

export async function verifyPlayPurchase({ productId, purchaseToken }) {
  const res = await apiFetch("/api/billing/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ productId, purchaseToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not confirm the subscription.");
  return data;
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

export async function signInWithGoogleCredential(credential, options = {}) {
  const profile = getProfile();
  const body = {
    credential,
    chats: getChats(),
    trips: getTrips(),
    name: profile.name,
    homeCity: profile.homeCity,
    currency: profile.currency,
    nationality: profile.nationality,
  };
  if (options.client === "web") body.client = "web";
  const res = await apiFetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

export async function nearbyPlaces(query) {
  const q = String(query || "").trim();
  if (q.length < 2) return { origin: null, places: [] };
  try {
    if (hasDirectGemini()) return await nearbyCitiesDirect(q);
    const res = await apiFetch(`/api/places/nearby?q=${encodeURIComponent(q)}`, {
      headers: activityHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { origin: null, places: [] };
    return {
      origin: data.origin || null,
      places: Array.isArray(data.places) ? data.places : [],
    };
  } catch {
    return { origin: null, places: [] };
  }
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

async function keepGeneratedPlan(payload, plan, model) {
  try {
    await apiFetch("/api/travel/plan/library", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...activityHeaders() },
      body: JSON.stringify({ ...payload, visitorId: getVisitorId(), plan, model }),
    });
  } catch {
    /* This traveler still sees the plan. The next match can generate it. */
  }
}

async function createPlanOnServer(payload) {
  const res = await apiFetch("/api/travel/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ ...payload, visitorId: getVisitorId() }),
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || "Safar could not build this plan.");
    error.status = res.status;
    error.code = data.code || "";
    throw error;
  }
  if (!data?.plan) throw new Error("Safar could not build this plan.");
  return applyStyleBudget(data.plan, payload);
}

export async function createPlan(payload) {
  try {
    return await createPlanOnServer(payload);
  } catch (err) {
    const status = Number(err?.status) || 0;
    if (!hasDirectGemini() || (status && status < 500)) throw err;
  }

  const { text, model } = await generateDirect({
    messages: [{ role: "user", content: planBrief(payload) }],
    system: `${SYSTEM_PROMPT}\n\n${PLAN_JSON_INSTRUCTIONS}${profileLine(payload.profile, { includeName: false })}`,
    json: true,
  });
  let plan;
  try {
    plan = applyStyleBudget(parsePlanJson(text), payload);
  } catch {
    throw new Error("Safar drafted a plan but it could not be formatted. Please try again.");
  }
  await keepGeneratedPlan(payload, plan, model);
  return plan;
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

export async function flightStatus() {
  const res = await apiFetch("/api/flights/status", { headers: activityHeaders() });
  const data = await res.json().catch(() => ({}));
  return { enabled: Boolean(data.enabled), sandbox: Boolean(data.sandbox) };
}

export async function searchLiveFlights({ from, to, date, returnDate, adults, currency, home, question }) {
  const payload = { from, to, date, returnDate, adults, currency, home, question };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value) params.set(key, String(value));
  }
  const res = await apiFetch(`/api/flights/search?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load live fares.");
  return data;
}

export async function verifyLiveFlight(offerId) {
  const res = await apiFetch("/api/flights/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ offerId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "This fare is no longer available.");
  return data;
}

export async function prebookLiveFlight({ offerId, traveler }) {
  const res = await apiFetch("/api/flights/prebook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ offerId, traveler }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The airline could not hold this fare.");
  return data;
}

export async function attachLiveSeat({ prebookId, seat, extras }) {
  const res = await apiFetch("/api/flights/services", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ prebookId, seat, extras }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "That seat could not be added.");
  return data;
}

export async function bookLiveFlight(payload) {
  const res = await apiFetch("/api/flights/book", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Payment finished, but the ticket was not issued. Check your tickets before paying again.");
  return data.ticket;
}

export async function hotelStatus() {
  const res = await apiFetch("/api/hotels/status", { headers: activityHeaders() });
  const data = await res.json().catch(() => ({}));
  return { enabled: Boolean(data.enabled), sandbox: Boolean(data.sandbox) };
}

export async function searchLiveHotels(payload) {
  const res = await apiFetch("/api/hotels/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load hotels.");
  return data;
}

export async function hotelProfile(hotelId) {
  const res = await apiFetch("/api/hotels/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ hotelId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load this hotel.");
  return data.hotel || null;
}

export async function hotelRooms(payload) {
  const res = await apiFetch("/api/hotels/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load rooms.");
  return data;
}

export async function prebookLiveHotel(offerId) {
  const res = await apiFetch("/api/hotels/prebook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ offerId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "This room could not be held.");
  return data;
}

export async function bookLiveHotel(payload) {
  const res = await apiFetch("/api/hotels/book", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Payment finished, but the stay was not confirmed. Check your stays before paying again.");
  return data.stay;
}

export async function listStays() {
  const res = await apiFetch("/api/hotels/stays", { headers: activityHeaders() });
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.stays) ? data.stays : [];
}

export async function listTickets() {
  const res = await apiFetch("/api/flights/tickets", { headers: activityHeaders() });
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.tickets) ? data.tickets : [];
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadTicketConfirmation(bookingId) {
  const path = `/api/flights/tickets/${encodeURIComponent(bookingId)}/confirmation`;
  const headers = activityHeaders();
  const nativeHttp = isNativeApp() ? window.Capacitor?.Plugins?.CapacitorHttp : null;
  if (nativeHttp) {
    const result = await nativeHttp.request({
      url: apiUrl(path),
      method: "GET",
      headers,
      responseType: "blob",
    });
    if (result.status < 200 || result.status >= 300) {
      const data = parseBody(result.data);
      throw new Error(data?.error || "The confirmation could not be prepared.");
    }
    const binary = atob(result.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const named = /filename="([^"]+)"/.exec(result.headers?.["Content-Disposition"] || result.headers?.["content-disposition"] || "");
    saveBlob(new Blob([bytes], { type: "application/pdf" }), named?.[1] || "Safar-confirmation.pdf");
    return;
  }
  const res = await fetch(apiUrl(path), { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "The confirmation could not be prepared.");
  }
  const named = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "");
  saveBlob(await res.blob(), named?.[1] || "Safar-confirmation.pdf");
}

export async function getTicketDetail(bookingId) {
  const res = await apiFetch(`/api/flights/tickets/${encodeURIComponent(bookingId)}`, {
    headers: activityHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "This ticket could not be opened.");
  return data;
}

export async function quoteTicketCancellation(bookingId) {
  const res = await apiFetch(`/api/flights/tickets/${encodeURIComponent(bookingId)}/cancel-quote`, {
    method: "POST",
    headers: activityHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The booking partner did not return a cancellation quote. The ticket is unchanged.");
  return data.quote || {};
}

export async function cancelTicket(bookingId) {
  const res = await apiFetch(`/api/flights/tickets/${encodeURIComponent(bookingId)}/cancel`, {
    method: "POST",
    headers: activityHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The ticket was not cancelled. It is still confirmed.");
  return data.ticket;
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

export async function refreshDays(payload) {
  const res = await apiFetch("/api/travel/days/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ ...payload, visitorId: getVisitorId() }),
  });
  const data = await res.json();
  if (!res.ok || !Array.isArray(data.days) || !data.days.length) {
    throw new Error(data.error || "Safar could not refresh these days. The old days are unchanged.");
  }
  return data.days;
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
