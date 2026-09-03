const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const MODEL_FALLBACKS = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
];

function apiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    const err = new Error("Gemini API key is not configured");
    err.status = 500;
    throw err;
  }
  return key;
}

function modelsToTry() {
  const preferred = process.env.GEMINI_MODEL;
  const list = preferred ? [preferred, ...MODEL_FALLBACKS] : MODEL_FALLBACKS;
  return [...new Set(list)];
}

export const SYSTEM_PROMPT = `You are Aurea, a private luxury travel concierge inside a mobile app.
Help the traveler with anything they need before they go: destinations, visas, weather, safety, packing, flights, trains, local transport, hotels and stays, food, budgets, day-by-day itineraries, hidden gems, and realistic costs.

Voice:
- Warm, precise, and premium. Never salesy. Never robotic.
- Give specific names (neighborhoods, hotels, restaurants, train lines), not generic advice.
- Always show money with a currency symbol and a realistic range.
- If the traveler's currency is known, convert and show costs in that currency. Mention that prices are estimates.
- Offer 2–3 options when useful (value / balanced / luxury).
- Call out scams, monsoon/peak season, tipping norms, and dress codes when relevant.
- Keep answers scannable: short paragraphs, bullets, and clear headings.
- If a request is unsafe or illegal, refuse briefly and suggest a legal alternative.

When the user wants a full trip plan, include:
1) Why this destination / when to go
2) Budget breakdown (flights, stay, food, local transport, activities, buffer)
3) 2–3 hotel or stay picks with area, nightly range, and why
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
  "safety": "string"
}`;

function toGeminiContents(messages) {
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content) }],
    }));
}

async function postGemini(model, body, { stream = false } = {}) {
  const path = stream
    ? `${GEMINI_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`
    : `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey(),
    },
    body: JSON.stringify(body),
  });

  return res;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => p.text || "").join("");
}

function payload({ messages, system, json = false }) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature: json ? 0.6 : 0.85,
      maxOutputTokens: 4096,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };
}

export async function generateTravelReply({ messages, system = SYSTEM_PROMPT }) {
  let lastError;
  for (const model of modelsToTry()) {
    const res = await postGemini(model, payload({ messages, system }));
    if (res.ok) {
      const data = await res.json();
      const text = extractText(data).trim();
      if (!text) {
        lastError = new Error("Aurea received an empty reply. Please try again.");
        lastError.status = 502;
        continue;
      }
      return { text, model };
    }
    const errBody = await res.text();
    lastError = Object.assign(new Error(friendlyGeminiError(res.status, errBody)), {
      status: res.status >= 500 ? 502 : res.status,
    });
    if (res.status === 404 || res.status === 400 || res.status === 429 || res.status === 503) continue;
    break;
  }
  throw lastError || new Error("Gemini request failed");
}

export async function streamTravelReply({ messages, system = SYSTEM_PROMPT, onDelta }) {
  let lastError;
  for (const model of modelsToTry()) {
    const res = await postGemini(model, payload({ messages, system }), { stream: true });
    if (!res.ok) {
      const errBody = await res.text();
      lastError = Object.assign(new Error(friendlyGeminiError(res.status, errBody)), {
        status: res.status >= 500 ? 502 : res.status,
      });
      if (res.status === 404 || res.status === 400 || res.status === 429 || res.status === 503) continue;
      break;
    }
    if (!res.body) {
      lastError = new Error("No stream from Gemini");
      continue;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n");
      buffer = chunks.pop() || "";
      for (const line of chunks) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const json = JSON.parse(raw);
          const piece = extractText(json);
          if (piece) {
            full += piece;
            if (onDelta) onDelta(piece);
          }
        } catch {
          /* ignore partial JSON */
        }
      }
    }
    if (full.trim()) return { text: full, model };
    lastError = new Error("Aurea received an empty reply. Please try again.");
  }
  throw lastError || new Error("Gemini stream failed");
}

export function parsePlanJson(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

function friendlyGeminiError(status, body) {
  if (status === 401 || status === 403) {
    return "Gemini rejected the API key. Check GEMINI_API_KEY and that the Gemini API is enabled.";
  }
  if (status === 429) return "Aurea is busy right now. Please wait a moment and try again.";
  if (status === 404) return "That Gemini model is not available on this key.";
  return `Gemini error (${status}): ${String(body).slice(0, 240)}`;
}
