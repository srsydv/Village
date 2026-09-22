import { generateDirect, hasDirectGemini } from "./geminiDirect.js";
import { lookupDestinationDirect, suggestPlacesDirect } from "./placesDirect.js";
import { PLAN_JSON_INSTRUCTIONS, SYSTEM_PROMPT, parsePlanJson, planBrief, profileLine } from "./prompts.js";
import { getAuthToken, getChats, getProfile, getTrips, getVisitorId } from "./storage.js";

function apiUrl(path) {
  const base = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
  return `${base}${path}`;
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
    res = await fetch(apiUrl("/api/auth/config"));
  } catch {
    throw new Error("Could not reach the Safar server. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load sign-in settings.");
  return data;
}

export async function signInWithGoogleCredential(credential) {
  const profile = getProfile();
  const res = await fetch(apiUrl("/api/auth/google"), {
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Google sign-in failed.");
  return data;
}

export async function fetchAccount() {
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch(apiUrl("/api/auth/me"), { headers: activityHeaders() });
  if (res.status === 401) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load account.");
  return data.user;
}

async function adminGet(path) {
  const res = await fetch(apiUrl(path), { headers: activityHeaders() });
  const data = await res.json().catch(() => ({}));
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
  const res = await fetch(apiUrl("/api/auth/me"), {
    method: "DELETE",
    headers: activityHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not delete this account.");
  return true;
}

export async function syncAccount(payload) {
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch(apiUrl("/api/auth/me"), {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not save account.");
  return data.user;
}

export async function askSafar({ messages, profile, onDelta }) {
  if (hasDirectGemini()) {
    const { text } = await generateDirect({
      messages: messages.slice(-16),
      system: SYSTEM_PROMPT + profileLine(profile),
    });
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
  const res = await fetch(apiUrl(`/api/places/suggest?q=${encodeURIComponent(q)}`), {
    headers: activityHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not look up that place.");
  return Array.isArray(data.places) ? data.places : [];
}

export async function fetchPlaces(query) {
  if (hasDirectGemini()) {
    return lookupDestinationDirect(query);
  }
  const res = await fetch(apiUrl(`/api/places?q=${encodeURIComponent(query)}`), {
    headers: activityHeaders(),
  });
  const data = await res.json().catch(() => ({}));
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
      return parsePlanJson(text);
    } catch {
      throw new Error("Safar drafted a plan but it could not be formatted. Please try again.");
    }
  }

  const res = await fetch(apiUrl("/api/travel/plan"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...activityHeaders() },
    body: JSON.stringify({ ...payload, visitorId: getVisitorId() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Safar could not build this plan.");
  return data.plan;
}
