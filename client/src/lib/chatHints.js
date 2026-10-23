import { DESTINATIONS } from "./destinations.js";

export function chatPreview(chat) {
  const messages = chat?.messages || [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const firstUser = messages.find((m) => m.role === "user");
  const text = String(lastUser?.content || firstUser?.content || "Empty conversation").trim();
  return text.replace(/\s+/g, " ").slice(0, 90);
}

const TRAVEL_HINT =
  /\b(trip|travel|travell?ing|vacation|holiday|itinerary|visa|hotel|hostel|flight|airbnb|destination|packing list|day-by-day|weekend getaway)\b/i;

export function planSeedFromChat(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const blob = list.map((m) => String(m.content || "")).join("\n");
  const match = DESTINATIONS.find((d) => blob.toLowerCase().includes(d.name.toLowerCase()));
  const lastUser = [...list].reverse().find((m) => m.role === "user");
  const last = String(lastUser?.content || "").trim();
  if (!match && !TRAVEL_HINT.test(blob)) return null;
  return {
    q: match ? `${match.name}, ${match.country}` : "",
    notes: match ? "" : last.slice(0, 400),
  };
}
