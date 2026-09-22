import { DESTINATIONS } from "./destinations.js";

export function chatPreview(chat) {
  const messages = chat?.messages || [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const firstUser = messages.find((m) => m.role === "user");
  const text = String(lastUser?.content || firstUser?.content || "Empty conversation").trim();
  return text.replace(/\s+/g, " ").slice(0, 90);
}

export function planSeedFromChat(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const blob = list.map((m) => String(m.content || "")).join("\n").toLowerCase();
  const match = DESTINATIONS.find((d) => blob.includes(d.name.toLowerCase()));
  const lastUser = [...list].reverse().find((m) => m.role === "user");
  const last = String(lastUser?.content || "").trim();
  return {
    q: match
      ? `${match.name}, ${match.country}`
      : last && last.length <= 48 && !last.includes("?")
        ? last
        : "",
    notes: !match && (last.includes("?") || last.length > 48) ? last.slice(0, 400) : "",
  };
}
