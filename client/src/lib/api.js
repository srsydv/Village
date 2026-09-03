import { generateDirect, hasDirectGemini } from "./geminiDirect.js";
import { lookupDestinationDirect } from "./placesDirect.js";
import { PLAN_JSON_INSTRUCTIONS, SYSTEM_PROMPT, parsePlanJson, planBrief, profileLine } from "./prompts.js";

export async function askAurea({ messages, profile, onDelta }) {
  if (hasDirectGemini()) {
    const { text } = await generateDirect({
      messages: messages.slice(-16),
      system: SYSTEM_PROMPT + profileLine(profile),
    });
    onDelta?.(text, text);
    return text;
  }

  const res = await fetch("/api/travel/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, profile, stream: true }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Aurea could not reply.");
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

export async function fetchPlaces(query) {
  if (hasDirectGemini()) {
    return lookupDestinationDirect(query);
  }
  const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
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
      throw new Error("Aurea drafted a plan but it could not be formatted. Please try again.");
    }
  }

  const res = await fetch("/api/travel/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Aurea could not build this plan.");
  return data.plan;
}
